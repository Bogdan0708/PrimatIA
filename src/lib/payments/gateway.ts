/**
 * Payment Gateway abstraction.
 * Designed so real Ghișeul.ro can replace the mock later.
 */

export interface PaymentItem {
  impozitId: string;
  description: string;
  amount: number; // in lei
}

export interface InitiatePaymentParams {
  tenantId: string;
  contribuabilId: string;
  citizenUserId: string;
  items: PaymentItem[];
  returnUrl: string;
  cancelUrl: string;
}

export interface InitiatePaymentResult {
  success: boolean;
  paymentId: string;
  gatewayRef: string;
  redirectUrl: string; // URL to redirect citizen to for payment
  expiresAt: Date;
}

export interface PaymentStatusResult {
  status: "pending" | "confirmed" | "failed" | "cancelled" | "expired";
  gatewayRef: string;
  amount: number;
  confirmedAt?: Date;
  transactionId?: string;
}

export interface PaymentWebhookData {
  gatewayRef: string;
  status: "confirmed" | "failed" | "cancelled";
  transactionId?: string;
  amount: number;
  confirmedAt?: Date;
}

export interface GatewayProvider {
  name: string;

  /**
   * Initiate a payment session.
   * Returns a redirect URL for the citizen.
   */
  initiatePayment(params: InitiatePaymentParams): Promise<InitiatePaymentResult>;

  /**
   * Check the status of a payment.
   */
  getPaymentStatus(gatewayRef: string): Promise<PaymentStatusResult>;

  /**
   * Validate and parse a webhook callback.
   */
  parseWebhook(body: unknown, headers: Record<string, string>): Promise<PaymentWebhookData>;
}
