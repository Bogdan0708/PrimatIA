import { NextRequest, NextResponse } from "next/server";
import { getStripeClient } from "@/lib/stripe";
import { prisma, withTenantScope } from "@/lib/db";
import { generateDocumentNumber } from "@/lib/formatting";
import { Prisma } from "@prisma/client";
import {
  fetchSubscriptionFromInvoice,
  markTenantInvoiceOutcome,
  syncTenantFromStripeSubscription,
} from "@/lib/billing/tenant-subscription";

function getInvoiceSubscriptionId(invoice: unknown): string | undefined {
  const obj = invoice as { subscription?: string | null };
  return typeof obj.subscription === "string" ? obj.subscription : undefined;
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET not configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  let event;
  try {
    event = getStripeClient().webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Handle expired checkout sessions
  if (event.type === "checkout.session.expired") {
    const session = event.data.object;
    try {
      await prisma.onlinePayment.updateMany({
        where: { gatewayRef: session.id, status: { not: "confirmed" } },
        data: { status: "expired" },
      });
    } catch (error) {
      console.error("Error handling expired session:", error);
    }
    return NextResponse.json({ received: true });
  }

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const subscription = event.data.object;
    try {
      await syncTenantFromStripeSubscription(
        subscription,
        typeof subscription.customer === "string" ? subscription.customer : undefined
      );
    } catch (error) {
      console.error("Error syncing tenant subscription status:", error);
      return NextResponse.json({ error: "Subscription sync failed" }, { status: 500 });
    }
    return NextResponse.json({ received: true });
  }

  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object;
    try {
      await markTenantInvoiceOutcome({
        customerId: typeof invoice.customer === "string" ? invoice.customer : undefined,
        subscriptionId: getInvoiceSubscriptionId(invoice),
        invoiceStatus: invoice.status || "failed",
        paid: false,
      });
    } catch (error) {
      console.error("Error handling tenant invoice failure:", error);
    }
    return NextResponse.json({ received: true });
  }

  if (event.type === "invoice.payment_succeeded") {
    const invoice = event.data.object;
    try {
      await markTenantInvoiceOutcome({
        customerId: typeof invoice.customer === "string" ? invoice.customer : undefined,
        subscriptionId: getInvoiceSubscriptionId(invoice),
        invoiceStatus: invoice.status || "paid",
        paid: true,
      });

      const subscription = await fetchSubscriptionFromInvoice(invoice);
      if (subscription) {
        await syncTenantFromStripeSubscription(
          subscription,
          typeof invoice.customer === "string" ? invoice.customer : undefined
        );
      }
    } catch (error) {
      console.error("Error handling tenant invoice success:", error);
    }
    return NextResponse.json({ received: true });
  }

  // Handle failed payment intents
  if (event.type === "payment_intent.payment_failed") {
    const paymentIntent = event.data.object;
    try {
      // Find by gateway response containing this payment intent
      const onlinePayments = await prisma.onlinePayment.findMany({
        where: { status: "initiated" },
      });
      for (const op of onlinePayments) {
        const resp = op.gatewayResponse as Record<string, unknown> | null;
        if (resp?.paymentIntentId === paymentIntent.id) {
          await prisma.onlinePayment.update({
            where: { id: op.id },
            data: { status: "failed" },
          });
          break;
        }
      }
      // Also try matching via Stripe session lookup
      if (paymentIntent.latest_charge) {
        await prisma.onlinePayment.updateMany({
          where: { gatewayRef: paymentIntent.id, status: { not: "confirmed" } },
          data: { status: "failed" },
        });
      }
    } catch (error) {
      console.error("Error handling failed payment intent:", error);
    }
    return NextResponse.json({ received: true });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    if (session.payment_status !== "paid") {
      return NextResponse.json({ received: true });
    }

    // Stripe event ID deduplication
    const existingEvent = await prisma.onlinePayment.findFirst({
      where: { stripeEventId: event.id },
    });
    if (existingEvent) {
      return NextResponse.json({ received: true }); // Already processed
    }

    const gatewayRef = session.id;
    const metadata = session.metadata;

    if (!metadata?.tenantId || !metadata?.contribuabilId) {
      console.error("Missing metadata in Stripe session:", gatewayRef);
      return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
    }

    try {
      // Find the OnlinePayment record
      const onlinePayment = await prisma.onlinePayment.findFirst({
        where: { gatewayRef },
      });

      if (!onlinePayment) {
        console.error("OnlinePayment not found for ref:", gatewayRef);
        return NextResponse.json({ error: "Payment not found" }, { status: 404 });
      }

      // Skip if already processed
      if (onlinePayment.status === "confirmed") {
        return NextResponse.json({ received: true });
      }

      const selectedDebts = onlinePayment.selectedDebts as Array<{ impozitId: string; amount: number }>;

      // Use withTenantScope to ensure SET LOCAL + all queries share one transaction.
      await withTenantScope(metadata.tenantId, async () => {
        const tx = prisma; // prisma proxy routes to the withTenantScope transaction
        // Lock and validate debts inside transaction to prevent concurrent modifications
        if (selectedDebts && selectedDebts.length > 0) {
          const ids = selectedDebts.map((d) => d.impozitId);
          await tx.$queryRaw`SELECT id FROM "Impozit" WHERE id::text = ANY(${ids}) FOR UPDATE`;

          const expectedTotal = selectedDebts.reduce((sum, d) => sum + d.amount, 0);
          const paidAmount = Number(onlinePayment.suma);
          if (Math.abs(paidAmount - expectedTotal) > 0.01) {
            throw new Error(`Amount mismatch for ref ${gatewayRef}: paid=${paidAmount}, expected=${expectedTotal}`);
          }

          for (const debt of selectedDebts) {
            const impozit = await tx.impozit.findUnique({ where: { id: debt.impozitId } });
            if (!impozit) throw new Error(`Impozit ${debt.impozitId} not found`);
            const remaining = Number(impozit.sumaDatorata) - Number(impozit.sumaPlatita);
            if (debt.amount > remaining + 0.01) {
              throw new Error(`Overpayment on impozit ${debt.impozitId}: paying ${debt.amount}, remaining ${remaining}`);
            }
          }
        }

        // Generate chitanță number atomically using row lock
        const year = new Date().getFullYear();
        const seqResult = await tx.$queryRaw<Array<{ next_val: bigint }>>(
          Prisma.sql`INSERT INTO "ChitantaSequence" ("tenantId", "year", "currentVal")
                     VALUES (${metadata.tenantId}, ${year}, 1)
                     ON CONFLICT ("tenantId", "year")
                     DO UPDATE SET "currentVal" = "ChitantaSequence"."currentVal" + 1
                     RETURNING "currentVal" AS next_val`
        );
        const seqNum = Number(seqResult[0].next_val);
        const nrChitanta = generateDocumentNumber("CHT", year, seqNum);

        // Create the actual Plata record
        const plata = await tx.plata.create({
          data: {
            tenantId: metadata.tenantId,
            contribuabilId: metadata.contribuabilId,
            suma: onlinePayment.suma,
            dataPlata: new Date(),
            modalitate: "card",
            nrChitanta,
            gatewayRef: gatewayRef,
            distribuit: false,
          },
        });

        // Update OnlinePayment status
        await tx.onlinePayment.update({
          where: { id: onlinePayment.id },
          data: {
            status: "confirmed",
            confirmedAt: new Date(),
            plataId: plata.id,
            stripeEventId: event.id,
            gatewayResponse: {
              confirmed: true,
              transactionId: session.payment_intent as string,
              stripeSessionId: session.id,
            },
          },
        });

        // Auto-distribute payment to debts
        if (selectedDebts && selectedDebts.length > 0) {
          for (const debt of selectedDebts) {
            await tx.plataDistributie.create({
              data: {
                tenantId: metadata.tenantId,
                plataId: plata.id,
                impozitId: debt.impozitId,
                sumaDebit: debt.amount,
                sumaPenalitati: 0,
              },
            });

            // Update the impozit's paid amount
            const impozit = await tx.impozit.findUnique({
              where: { id: debt.impozitId },
            });

            if (impozit) {
              const newPaid = Number(impozit.sumaPlatita) + debt.amount;
              const totalOwed = Number(impozit.sumaDatorata);
              const newStatus = newPaid >= totalOwed ? "platit" : "partial_platit";

              await tx.impozit.update({
                where: { id: debt.impozitId },
                data: {
                  sumaPlatita: newPaid,
                  status: newStatus,
                },
              });
            }
          }

          // Mark the payment as distributed
          await tx.plata.update({
            where: { id: plata.id },
            data: { distribuit: true },
          });
        }

        // Generate chitanță document
        await tx.document.create({
          data: {
            tenantId: metadata.tenantId,
            contribuabilId: metadata.contribuabilId,
            tip: "chitanta",
            numarDocument: nrChitanta,
            dataDocument: new Date(),
            dataJson: {
              plataId: plata.id,
              suma: Number(onlinePayment.suma),
              modalitate: "card",
              gatewayRef,
              items: selectedDebts,
            },
            status: "generat",
          },
        });
      });
    } catch (error) {
      console.error("Error processing Stripe webhook:", error);
      return NextResponse.json({ error: "Processing failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
