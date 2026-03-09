import { NextRequest, NextResponse } from "next/server";
import { getStripeClient } from "@/lib/stripe";
import { prisma, withTenantScope } from "@/lib/db";
import { generateDocumentNumber } from "@/lib/formatting";
import { Prisma } from "@prisma/client";
import { getStatusAfterPayment } from "@/lib/tax-engine/liability-utils";
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
import { validateSelectedDebtsForContribuabil } from "@/lib/payments/selected-debts";
import { logger, getRequestLogContext } from "@/lib/logger";

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
  const logContext = getRequestLogContext(request);
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    logger.error({ ...logContext }, "Stripe webhook secret is not configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  let event;
  try {
    event = getStripeClient().webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    logger.error({ err, ...logContext }, "Stripe webhook signature verification failed");
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Handle expired checkout sessions
  if (event.type === "checkout.session.expired") {
    const session = event.data.object as any;
    const tenantId = getMetadataValue(session.metadata, "tenantId");
    if (!tenantId) {
      logger.error({ sessionId: session.id, ...logContext }, "Missing tenantId metadata in checkout.session.expired");
      return NextResponse.json({ received: true });
    }
    try {
      await prisma.onlinePayment.updateMany({
        where: {
          tenantId,
          gatewayRef: session.id,
          status: { in: allowedFromStatusesFor("expired") },
        },
        data: { status: "expired" },
      });
    } catch (error) {
      logger.error({ err: error, ...logContext }, "Stripe webhook failed while expiring a checkout session");
    }
    return NextResponse.json({ received: true });
  }

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const subscription = event.data.object as any;
    try {
      await syncTenantFromStripeSubscription(
        subscription,
        typeof subscription.customer === "string" ? subscription.customer : undefined
      );
    } catch (error) {
      logger.error({ err: error, ...logContext }, "Stripe webhook failed while syncing tenant subscription");
      return NextResponse.json({ error: "Subscription sync failed" }, { status: 500 });
    }
    return NextResponse.json({ received: true });
  }

  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object as any;
    try {
      await markTenantInvoiceOutcome({
        customerId: typeof invoice.customer === "string" ? invoice.customer : undefined,
        subscriptionId: getInvoiceSubscriptionId(invoice),
        invoiceStatus: invoice.status || "failed",
        paid: false,
      });
    } catch (error) {
      logger.error({ err: error, ...logContext }, "Stripe webhook failed while handling invoice.payment_failed");
    }
    return NextResponse.json({ received: true });
  }

  if (event.type === "invoice.payment_succeeded") {
    const invoice = event.data.object as any;
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
      logger.error({ err: error, ...logContext }, "Stripe webhook failed while handling invoice.payment_succeeded");
    }
    return NextResponse.json({ received: true });
  }

  // Handle failed payment intents
  if (event.type === "payment_intent.payment_failed") {
    const paymentIntent = event.data.object as any;
    const tenantId = getMetadataValue(paymentIntent.metadata, "tenantId");
    if (!tenantId) {
      logger.error({ paymentIntentId: paymentIntent.id, ...logContext }, "Missing tenantId metadata in payment_intent.payment_failed");
      return NextResponse.json({ received: true });
    }
    try {
      await withTenantScope(tenantId, async () => {
        const tx = prisma; // prisma proxy routes to the withTenantScope transaction
        const failureEligibleStatuses = allowedFromStatusesFor("failed");

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
      logger.error({ err: error, ...logContext }, "Stripe webhook failed while handling payment_intent.payment_failed");
    }
    return NextResponse.json({ received: true });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as any;

    if (session.payment_status !== "paid") {
      return NextResponse.json({ received: true });
    }

    const existingEvent = await prisma.onlinePayment.findFirst({
      where: { stripeEventId: event.id },
    });
    if (existingEvent) {
      return NextResponse.json({ received: true }); 
    }

    const gatewayRef = session.id;
    const metadata = session.metadata;
    const tenantId = getMetadataValue(metadata, "tenantId");
    const contribuabilId = getMetadataValue(metadata, "contribuabilId");

    if (!tenantId || !contribuabilId) {
      logger.error({ 
        ...logContext,
        gatewayRef,
      }, "Stripe checkout session completed without required metadata");
      return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
    }

    try {
      const processResult = await withTenantScope(tenantId, async (): Promise<CheckoutSessionProcessResult> => {
        const tx = prisma; 

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
          logger.error({ tenantId, gatewayRef, ...logContext }, "Stripe webhook could not find OnlinePayment for checkout session");
          return "not_found";
        }

        if (onlinePayment.contribuabilId !== contribuabilId) {
          logger.error({ gatewayRef, ...logContext }, "Stripe webhook metadata mismatched the persisted payment record");
          return "metadata_mismatch";
        }

        if (onlinePayment.status === "confirmed") {
          return "already_processed";
        }
        if (!isOnlinePaymentStatus(onlinePayment.status)) {
          logger.error({ gatewayRef, status: onlinePayment.status, ...logContext }, "Invalid payment status value");
          return "invalid_state";
        }
        if (!canTransitionOnlinePaymentStatus(onlinePayment.status, "confirmed")) {
          logger.error({ gatewayRef, from: onlinePayment.status, to: "confirmed", ...logContext }, "Invalid payment transition");
          return "invalid_state";
        }

        const dedupInsert = await tx.$queryRaw<Array<{ stripeEventId: string }>>(
          Prisma.sql`INSERT INTO "stripe_webhook_events" ("tenant_id", "stripe_event_id", "gateway_ref")
                     VALUES (${tenantId}::uuid, ${event.id}, ${gatewayRef})
                     ON CONFLICT ("stripe_event_id") DO NOTHING
                     RETURNING "stripe_event_id" AS "stripeEventId"`
        );
        if (dedupInsert.length === 0) {
          return "duplicate_event";
        }

        if (typeof session.amount_total !== "number") {
          throw new Error(`Missing Stripe amount_total for ref ${gatewayRef}`);
        }
        const paidAmount = session.amount_total / 100;
        
        const selectedDebts = onlinePayment.selectedDebts as Array<{ impozitId: string; amount: number }> | null;

        if (selectedDebts && selectedDebts.length > 0) {
          const ids = selectedDebts.map((d) => d.impozitId);
          await tx.$queryRaw`SELECT id FROM "Impozit" WHERE id::text = ANY(${ids}) FOR UPDATE`;

          const validatedSelection = await validateSelectedDebtsForContribuabil({
            tenantId,
            contribuabilId,
            items: selectedDebts,
          });

          const expectedTotal = validatedSelection.totalAmount;
          if (Math.abs(paidAmount - expectedTotal) > 0.01) {
            throw new Error(`Amount mismatch for ref ${gatewayRef}: paid=${paidAmount}, expected=${expectedTotal}`);
          }
        } else {
            const expectedAmount = Number(onlinePayment.suma);
            if (Math.abs(paidAmount - expectedAmount) > 0.01) {
              throw new Error(`Amount mismatch for ref ${gatewayRef}: paid=${paidAmount}, expected=${expectedAmount}`);
            }
        }

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

            const impozit = await tx.impozit.findUnique({
              where: { id: debt.impozitId },
            });

            if (impozit) {
              const newPaid = Number(impozit.sumaPlatita) + debt.amount;
              const newStatus = getStatusAfterPayment(impozit, debt.amount, impozit.status);

              await tx.impozit.update({
                where: { id: debt.impozitId },
                data: {
                  sumaPlatita: newPaid,
                  status: newStatus,
                },
              });
            }
          }

          await tx.plata.update({
            where: { id: plata.id },
            data: { distribuit: true },
          });
        }

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
      logger.error(
        {
          err: error,
          ...logContext,
          eventType: event.type,
        },
        "Stripe webhook processing failed unexpectedly"
      );
      return NextResponse.json({ error: "Processing failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
