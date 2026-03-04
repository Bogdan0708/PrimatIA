export const ONLINE_PAYMENT_STATUSES = [
  "initiated",
  "pending",
  "confirmed",
  "failed",
  "cancelled",
  "expired",
] as const;

export type OnlinePaymentStatus = (typeof ONLINE_PAYMENT_STATUSES)[number];

const ALLOWED_TRANSITIONS: Record<OnlinePaymentStatus, ReadonlySet<OnlinePaymentStatus>> = {
  initiated: new Set<OnlinePaymentStatus>(["pending", "confirmed", "failed", "cancelled", "expired"]),
  pending: new Set<OnlinePaymentStatus>(["confirmed", "failed", "cancelled", "expired"]),
  confirmed: new Set(),
  failed: new Set(),
  cancelled: new Set(),
  expired: new Set(),
};

export function canTransitionOnlinePaymentStatus(
  from: OnlinePaymentStatus,
  to: OnlinePaymentStatus
): boolean {
  return ALLOWED_TRANSITIONS[from].has(to);
}

export function isOnlinePaymentStatus(value: string): value is OnlinePaymentStatus {
  return (ONLINE_PAYMENT_STATUSES as readonly string[]).includes(value);
}

export function assertOnlinePaymentTransition(
  from: OnlinePaymentStatus,
  to: OnlinePaymentStatus,
  reference?: string
): void {
  if (canTransitionOnlinePaymentStatus(from, to)) {
    return;
  }

  const context = reference ? ` (${reference})` : "";
  throw new Error(`Invalid online payment transition${context}: ${from} -> ${to}`);
}

export function allowedFromStatusesFor(
  to: OnlinePaymentStatus
): OnlinePaymentStatus[] {
  return ONLINE_PAYMENT_STATUSES.filter((from) =>
    canTransitionOnlinePaymentStatus(from, to)
  );
}
