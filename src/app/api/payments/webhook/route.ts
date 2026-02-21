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
import {
  allowedFromStatusesFor,
  canTransitionOnlinePaymentStatus,
  isOnlinePaymentStatus,
} from "@/lib/payments/online-payment-state-machine";

function getInvoiceSubscriptionId(invoice: unknown): string | undefined {
  const obj = invoice as { subscription?: string | null };
  return typeof obj.subscription === "string" ? obj.subscription : undefined;
}

function getMetadataValue(metadata: unknown, key: string): string | null {
  if (!metadata || typeof metadata !== "object") {
    return null;
  }
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

type CheckoutSessionProcessResult =
  | "processed"
  | "already_processed"
  | "duplicate_event"
  | "invalid_state"
  | "metadata_mismatch"
  | "not_found";

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
    const tenantId = getMetadataValue(session.metadata, "tenantId");
    if (!tenantId) {
      console.error("Missing tenantId metadata in checkout.session.expired:", session.id);
      return NextResponse.json({ received: true });
    }
    try {
      await withTenantScope(tenantId, async () => {
        await prisma.onlinePayment.updateMany({
          where: {
            tenantId,
            gatewayRef: session.id,
            status: { in: allowedFromStatusesFor("expired") },
          },
          data: { status: "expired" },
        });
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
    const tenantId = getMetadataValue(paymentIntent.metadata, "tenantId");
    if (!tenantId) {
      console.error("Missing tenantId metadata in payment_intent.payment_failed:", paymentIntent.id);
      return NextResponse.json({ received: true });
    }
    try {
      await withTenantScope(tenantId, async () => {
        const tx = prisma; // prisma proxy routes to the withTenantScope transaction
        const failureEligibleStatuses = allowedFromStatusesFor("failed");

        // Direct JSONB lookup avoids O(N) in-memory scans and is compatible with an expression index.
        const [paymentByIntentId] = await tx.$queryRaw<Array<{ id: string }>>(
          Prisma.sql`SELECT id
                     FROM "online_payments"
                     WHERE tenant_id = ${tenantId}::uuid
                       AND status IN ('initiated', 'pending')
                       AND gateway_response->>'paymentIntentId' = ${paymentIntent.id}
                     LIMIT 1
                     FOR UPDATE`
        );

        if (paymentByIntentId) {
          await tx.onlinePayment.updateMany({
            where: {
              id: paymentByIntentId.id,
              tenantId,
              status: { in: failureEligibleStatuses },
            },
            data: { status: "failed" },
          });
          return;
        }

        // Also try matching via Stripe session lookup.
        if (paymentIntent.latest_charge) {
          const [paymentByGatewayRef] = await tx.$queryRaw<Array<{ id: string }>>(
            Prisma.sql`SELECT id
                       FROM "online_payments"
                       WHERE tenant_id = ${tenantId}::uuid
                         AND gateway_ref = ${paymentIntent.id}
                         AND status IN ('initiated', 'pending')
                       LIMIT 1
                       FOR UPDATE`
          );

          if (paymentByGatewayRef) {
            await tx.onlinePayment.updateMany({
              where: {
                id: paymentByGatewayRef.id,
                tenantId,
                status: { in: failureEligibleStatuses },
              },
              data: { status: "failed" },
            });
          }
        }
      });
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

    const gatewayRef = session.id;
    const metadata = session.metadata;
    const tenantId = getMetadataValue(metadata, "tenantId");
    const contribuabilId = getMetadataValue(metadata, "contribuabilId");

    if (!tenantId || !contribuabilId) {
      console.error("Missing metadata in Stripe session:", gatewayRef);
      return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
    }

    try {
      // Use withTenantScope to ensure SET LOCAL + all queries share one transaction.
      const processResult = await withTenantScope(tenantId, async (): Promise<CheckoutSessionProcessResult> => {
        const tx = prisma; // prisma proxy routes to the withTenantScope transaction

        // Lock payment row to prevent concurrent state transitions
        const [onlinePayment] = await tx.$queryRaw<Array<{
          id: string;
          status: string;
          suma: Prisma.Decimal;
          selectedDebts: Prisma.JsonValue;
          contribuabilId: string;
        }>>(
          Prisma.sql`SELECT
                       id,
                       status,
                       suma,
                       selected_debts AS "selectedDebts",
                       contribuabil_id AS "contribuabilId"
                     FROM "online_payments"
                     WHERE gateway_ref = ${gatewayRef}
                       AND tenant_id = ${tenantId}::uuid
                     LIMIT 1
                     FOR UPDATE`
        );

        if (!onlinePayment) {
          console.error("OnlinePayment not found for tenant/ref:", tenantId, gatewayRef);
          return "not_found";
        }

        // Metadata and DB row must agree on owner
        if (onlinePayment.contribuabilId !== contribuabilId) {
          console.error("Metadata contribuabilId mismatch for ref:", gatewayRef);
          return "metadata_mismatch";
        }

        // Payment state machine: only initiated -> confirmed is allowed
        if (onlinePayment.status === "confirmed") {
          return "already_processed";
        }
        if (!isOnlinePaymentStatus(onlinePayment.status)) {
          console.error(
            `Invalid payment status value for ref ${gatewayRef}: ${onlinePayment.status}`
          );
          return "invalid_state";
        }
        if (!canTransitionOnlinePaymentStatus(onlinePayment.status, "confirmed")) {
          console.error(
            `Invalid payment transition for ref ${gatewayRef}: ${onlinePayment.status} -> confirmed`
          );
          return "invalid_state";
        }

        // Atomic Stripe event deduplication in-transaction
        const dedupInsert = await tx.$queryRaw<Array<{ stripeEventId: string }>>(
          Prisma.sql`INSERT INTO "stripe_webhook_events" ("tenant_id", "stripe_event_id", "gateway_ref")
                     VALUES (${tenantId}::uuid, ${event.id}, ${gatewayRef})
                     ON CONFLICT ("stripe_event_id") DO NOTHING
                     RETURNING "stripe_event_id" AS "stripeEventId"`
        );
        if (dedupInsert.length === 0) {
          return "duplicate_event";
        }

        // Validate Stripe amount before any status-changing writes
        if (typeof session.amount_total !== "number") {
          throw new Error(`Missing Stripe amount_total for ref ${gatewayRef}`);
        }
        const expectedAmount = Number(onlinePayment.suma);
        const paidAmount = session.amount_total / 100;
        if (Math.abs(paidAmount - expectedAmount) > 0.01) {
          throw new Error(`Amount mismatch for ref ${gatewayRef}: paid=${paidAmount}, expected=${expectedAmount}`);
        }

        const selectedDebts = onlinePayment.selectedDebts as Array<{ impozitId: string; amount: number }> | null;

        // Lock and validate debts inside transaction to prevent concurrent modifications
        if (selectedDebts && selectedDebts.length > 0) {
          const ids = selectedDebts.map((d) => d.impozitId);
          await tx.$queryRaw`SELECT id FROM "Impozit" WHERE id::text = ANY(${ids}) FOR UPDATE`;

          const selectedDebtTotal = selectedDebts.reduce((sum, d) => sum + d.amount, 0);
          if (Math.abs(expectedAmount - selectedDebtTotal) > 0.01) {
            throw new Error(
              `Debt total mismatch for ref ${gatewayRef}: debts=${selectedDebtTotal}, expected=${expectedAmount}`
            );
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
                     VALUES (${tenantId}, ${year}, 1)
                     ON CONFLICT ("tenantId", "year")
                     DO UPDATE SET "currentVal" = "ChitantaSequence"."currentVal" + 1
                     RETURNING "currentVal" AS next_val`
        );
        const seqNum = Number(seqResult[0].next_val);
        const nrChitanta = generateDocumentNumber("CHT", year, seqNum);

        // Create the actual Plata record
        const plata = await tx.plata.create({
          data: {
            tenantId,
            contribuabilId,
            suma: onlinePayment.suma,
            dataPlata: new Date(),
            modalitate: "card",
            nrChitanta,
            gatewayRef: gatewayRef,
            distribuit: false,
          },
        });

        // Update OnlinePayment status after all validations pass
        const updatedPayment = await tx.onlinePayment.updateMany({
          where: {
            id: onlinePayment.id,
            tenantId,
            status: { in: allowedFromStatusesFor("confirmed") },
          },
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
        if (updatedPayment.count !== 1) {
          throw new Error(`Failed to update payment state for ref ${gatewayRef}`);
        }

        // Auto-distribute payment to debts
        if (selectedDebts && selectedDebts.length > 0) {
          for (const debt of selectedDebts) {
            await tx.plataDistributie.create({
              data: {
                tenantId,
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
            tenantId,
            contribuabilId,
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
        return "processed";
      });

      if (processResult === "not_found") {
        return NextResponse.json({ error: "Payment not found" }, { status: 404 });
      }

      if (
        processResult === "already_processed" ||
        processResult === "duplicate_event" ||
        processResult === "invalid_state" ||
        processResult === "metadata_mismatch"
      ) {
        return NextResponse.json({ received: true });
      }
    } catch (error) {
      console.error("Error processing Stripe webhook:", error);
      return NextResponse.json({ error: "Processing failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
