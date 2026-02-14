import { getStripeClient } from "@/lib/stripe";
import type {
  GatewayProvider,
  InitiatePaymentParams,
  InitiatePaymentResult,
  PaymentStatusResult,
  PaymentWebhookData,
} from "./gateway";

export class StripeProvider implements GatewayProvider {
  name = "stripe";

  async initiatePayment(params: InitiatePaymentParams): Promise<InitiatePaymentResult> {
    const session = await getStripeClient().checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      currency: "ron",
      line_items: params.items.map((item) => ({
        price_data: {
          currency: "ron",
          product_data: {
            name: item.description,
            metadata: {
              impozitId: item.impozitId,
            },
          },
          unit_amount: Math.round(item.amount * 100),
        },
        quantity: 1,
      })),
      metadata: {
        tenantId: params.tenantId,
        contribuabilId: params.contribuabilId,
        citizenUserId: params.citizenUserId,
        items: JSON.stringify(
          params.items.map((i) => ({ impozitId: i.impozitId, amount: i.amount }))
        ),
      },
      success_url: `${params.returnUrl}?ref={CHECKOUT_SESSION_ID}&status=success`,
      cancel_url: params.cancelUrl,
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60, // 30 minutes
    });

    const gatewayRef = session.id;
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    return {
      success: true,
      paymentId: session.id,
      gatewayRef,
      redirectUrl: session.url!,
      expiresAt,
    };
  }

  async getPaymentStatus(gatewayRef: string): Promise<PaymentStatusResult> {
    const session = await getStripeClient().checkout.sessions.retrieve(gatewayRef);

    let status: PaymentStatusResult["status"];
    switch (session.payment_status) {
      case "paid":
        status = "confirmed";
        break;
      case "unpaid":
        status = session.status === "expired" ? "expired" : "pending";
        break;
      default:
        status = "failed";
    }

    return {
      status,
      gatewayRef,
      amount: (session.amount_total ?? 0) / 100,
      confirmedAt: status === "confirmed" ? new Date() : undefined,
      transactionId: session.payment_intent as string | undefined,
    };
  }

  async parseWebhook(body: unknown, headers: Record<string, string>): Promise<PaymentWebhookData> {
    const sig = headers["stripe-signature"];
    if (!sig) {
      throw new Error("Missing stripe-signature header");
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
    }

    const event = getStripeClient().webhooks.constructEvent(
      body as string | Buffer,
      sig,
      webhookSecret
    );

    if (event.type !== "checkout.session.completed") {
      throw new Error(`Unhandled event type: ${event.type}`);
    }

    const session = event.data.object;

    return {
      gatewayRef: session.id,
      status: session.payment_status === "paid" ? "confirmed" : "failed",
      transactionId: session.payment_intent as string | undefined,
      amount: (session.amount_total ?? 0) / 100,
      confirmedAt: session.payment_status === "paid" ? new Date() : undefined,
    };
  }
}

let stripeProvider: StripeProvider | null = null;

export function getStripeProvider(): StripeProvider {
  if (!stripeProvider) {
    stripeProvider = new StripeProvider();
  }
  return stripeProvider;
}
