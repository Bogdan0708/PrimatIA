type NumericLike = number | string | bigint | { toString(): string } | null | undefined;

export interface LiabilityAmounts {
  sumaDatorata: NumericLike;
  sumaPenalitati: NumericLike;
  sumaPlatita: NumericLike;
}

function toNumber(value: NumericLike): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "object") return Number(value.toString()) || 0;
  return Number(value) || 0;
}

export function getTotalOwed(amounts: Pick<LiabilityAmounts, "sumaDatorata" | "sumaPenalitati">): number {
  return toNumber(amounts.sumaDatorata) + toNumber(amounts.sumaPenalitati);
}

export function getOutstanding(amounts: LiabilityAmounts): number {
  return getTotalOwed(amounts) - toNumber(amounts.sumaPlatita);
}

export function getStatusAfterPayment(
  amounts: LiabilityAmounts,
  additionalPayment: number,
  currentStatus: string
): string {
  const newPaid = toNumber(amounts.sumaPlatita) + additionalPayment;
  const totalOwed = getTotalOwed(amounts);
  if (newPaid >= totalOwed) return "platit";
  if (newPaid > 0) return "partial_platit";
  return currentStatus;
}
