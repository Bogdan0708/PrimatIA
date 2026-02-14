import { randomBytes } from "crypto";
import type {
  GatewayProvider,
  InitiatePaymentParams,
  InitiatePaymentResult,
  PaymentStatusResult,
  PaymentWebhookData,
} from "./gateway";

/**
 * In-memory store for mock payments.
 * In production, this would be replaced by actual Ghișeul.ro (SNEP) API calls.
 */
const mockPayments = new Map<
  string,
  {
    params: InitiatePaymentParams;
    status: "pending" | "confirmed" | "failed" | "cancelled" | "expired";
    amount: number;
    createdAt: Date;
    expiresAt: Date;
    confirmedAt?: Date;
    transactionId?: string;
  }
>();

export class MockGatewayProvider implements GatewayProvider {
  name = "ghiseul_mock";

  async initiatePayment(params: InitiatePaymentParams): Promise<InitiatePaymentResult> {
    const gatewayRef = `MOCK-${randomBytes(8).toString("hex").toUpperCase()}`;
    const amount = params.items.reduce((sum, item) => sum + item.amount, 0);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    mockPayments.set(gatewayRef, {
      params,
      status: "pending",
      amount,
      createdAt: new Date(),
      expiresAt,
    });

    // In production, this would be a Ghișeul.ro payment page URL.
    // For mock, we redirect to our own mock payment page.
    const redirectUrl = `/portal/plati/mock-gateway?ref=${gatewayRef}&amount=${amount}`;

    return {
      success: true,
      paymentId: gatewayRef,
      gatewayRef,
      redirectUrl,
      expiresAt,
    };
  }

  async getPaymentStatus(gatewayRef: string): Promise<PaymentStatusResult> {
    const payment = mockPayments.get(gatewayRef);

    if (!payment) {
      return {
        status: "failed",
        gatewayRef,
        amount: 0,
      };
    }

    // Auto-expire after timeout
    if (payment.status === "pending" && payment.expiresAt < new Date()) {
      payment.status = "expired";
    }

    return {
      status: payment.status,
      gatewayRef,
      amount: payment.amount,
      confirmedAt: payment.confirmedAt,
      transactionId: payment.transactionId,
    };
  }

  async parseWebhook(body: unknown): Promise<PaymentWebhookData> {
    const data = body as {
      gatewayRef: string;
      status: "confirmed" | "failed" | "cancelled";
      transactionId?: string;
    };

    const payment = mockPayments.get(data.gatewayRef);
    if (!payment) {
      throw new Error(`Unknown payment reference: ${data.gatewayRef}`);
    }

    return {
      gatewayRef: data.gatewayRef,
      status: data.status,
      transactionId: data.transactionId,
      amount: payment.amount,
      confirmedAt: data.status === "confirmed" ? new Date() : undefined,
    };
  }

  /**
   * Mock-only method: simulate confirming a payment.
   * In production, this would come from Ghișeul.ro webhook.
   */
  async confirmMockPayment(gatewayRef: string): Promise<boolean> {
    const payment = mockPayments.get(gatewayRef);
    if (!payment || payment.status !== "pending") return false;

    payment.status = "confirmed";
    payment.confirmedAt = new Date();
    payment.transactionId = `TXN-${randomBytes(6).toString("hex").toUpperCase()}`;

    return true;
  }

  /**
   * Mock-only method: simulate cancelling a payment.
   */
  async cancelMockPayment(gatewayRef: string): Promise<boolean> {
    const payment = mockPayments.get(gatewayRef);
    if (!payment || payment.status !== "pending") return false;

    payment.status = "cancelled";
    return true;
  }
}

// Singleton instance
let mockProvider: MockGatewayProvider | null = null;

export function getMockGatewayProvider(): MockGatewayProvider {
  if (!mockProvider) {
    mockProvider = new MockGatewayProvider();
  }
  return mockProvider;
}

/**
 * Get the active payment gateway provider.
 * Switch between mock and real based on PAYMENT_MODE env var.
 */
export function getPaymentGateway(): GatewayProvider {
  if (process.env.PAYMENT_MODE === "stripe") {
    // Dynamic import to avoid loading Stripe SDK when not needed
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getStripeProvider } = require("./stripe-provider");
    return getStripeProvider();
  }
  return getMockGatewayProvider();
}
