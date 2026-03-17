import { BONIFICATIE_PERCENT, type ExemptionContext } from "./types";

/**
 * Calculate the number of taxable months for partial year (Art. 461).
 * Rule: tax starts from the first day of the month following acquisition.
 * Tax ends at the end of the month of disposal.
 */
export function calculateTaxableMonths(
  fiscalYear: number,
  dataDobandire: Date,
  dataInstrainare?: Date
): { months: number; startDate: Date; endDate: Date } {
  const yearStart = new Date(fiscalYear, 0, 1);
  const yearEnd = new Date(fiscalYear, 11, 31);

  let startDate: Date;
  if (dataDobandire.getFullYear() < fiscalYear) {
    startDate = yearStart;
  } else if (dataDobandire.getFullYear() === fiscalYear) {
    // First of next month rule
    const nextMonth = new Date(dataDobandire.getFullYear(), dataDobandire.getMonth() + 1, 1);
    startDate = nextMonth;
  } else {
    return { months: 0, startDate: yearStart, endDate: yearEnd };
  }

  let endDate: Date;
  if (!dataInstrainare || dataInstrainare.getFullYear() > fiscalYear) {
    endDate = yearEnd;
  } else if (dataInstrainare.getFullYear() === fiscalYear) {
    // End of the month of disposal
    endDate = new Date(dataInstrainare.getFullYear(), dataInstrainare.getMonth() + 1, 0);
  } else {
    return { months: 0, startDate: yearStart, endDate: yearEnd };
  }

  if (startDate > endDate) return { months: 0, startDate, endDate };

  const months =
    (endDate.getFullYear() - startDate.getFullYear()) * 12 +
    (endDate.getMonth() - startDate.getMonth()) +
    1;
  return { months: Math.min(12, Math.max(0, months)), startDate, endDate };
}

/**
 * Round to whole lei (Art. 489 Cod Fiscal).
 * Amounts are rounded: 0-49 bani -> down, 50-99 bani -> up.
 */
export function roundToLei(amount: number): number {
  return Math.round(amount);
}

const BANI_PER_LEU = 100;
const MICRO_LEI_PER_LEU = 1_000_000;
const PERCENT_SCALE = 10_000;
const PERCENT_DIVISOR = 100 * PERCENT_SCALE;
const MULTIPLIER_SCALE = MICRO_LEI_PER_LEU;
const MAX_MICRO_LEI_SAFE_ABS = Number.MAX_SAFE_INTEGER / MICRO_LEI_PER_LEU;

type DecimalLike = {
  toNumber(): number;
  toString(): string;
};

function isDecimalLike(value: unknown): value is DecimalLike {
  return (
    typeof value === "object" &&
    value !== null &&
    "toNumber" in value &&
    typeof (value as { toNumber?: unknown }).toNumber === "function" &&
    "toString" in value &&
    typeof (value as { toString?: unknown }).toString === "function"
  );
}

function getDecimalPlaces(raw: string): number {
  const normalized = raw.trim();
  const numericPattern = /^[+-]?\d+(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/;
  const match = normalized.match(numericPattern);

  if (!match) return NaN;

  const fractionalDigits = match[1]?.length ?? 0;
  const exponent = Number(match[2] ?? "0");
  return Math.max(0, fractionalDigits - exponent);
}

function assertMicroLeiCompatible(value: number, fieldName: string): void {
  if (Math.abs(value) > MAX_MICRO_LEI_SAFE_ABS) {
    throw new Error(`Numeric value for ${fieldName} exceeds supported range`);
  }

  const scaled = value * MICRO_LEI_PER_LEU;
  if (!Number.isFinite(scaled) || !Number.isSafeInteger(Math.round(scaled))) {
    throw new Error(`Numeric value for ${fieldName} exceeds supported precision`);
  }
}

export function toSafeNumber(
  value: number | string | { toString(): string } | null | undefined,
  fieldName: string
): number {
  if (value == null) {
    throw new Error(`Missing numeric value for ${fieldName}`);
  }

  let parsed: number;

  if (typeof value === "number") {
    parsed = value;
  } else if (isDecimalLike(value)) {
    const raw = value.toString().trim();
    const decimalPlaces = getDecimalPlaces(raw);
    if (!Number.isFinite(decimalPlaces)) {
      throw new Error(`Invalid numeric value for ${fieldName}`);
    }
    if (decimalPlaces > 6) {
      throw new Error(`Invalid numeric precision for ${fieldName}: max 6 decimal places`);
    }
    parsed = value.toNumber();
  } else {
    const raw = value.toString().trim();
    const decimalPlaces = getDecimalPlaces(raw);
    if (!Number.isFinite(decimalPlaces)) {
      throw new Error(`Invalid numeric value for ${fieldName}`);
    }
    if (decimalPlaces > 6) {
      throw new Error(`Invalid numeric precision for ${fieldName}: max 6 decimal places`);
    }
    parsed = Number(raw);
  }

  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid numeric value for ${fieldName}`);
  }

  return parsed;
}

export function toBani(amountLei: number): number {
  return Math.round(amountLei * BANI_PER_LEU);
}

export function toMicroLei(amountLei: number): number {
  assertMicroLeiCompatible(amountLei, "amountLei");
  return Math.round(amountLei * MICRO_LEI_PER_LEU);
}

export function percentToBasisPoints(percent: number): number {
  return Math.round(percent * PERCENT_SCALE);
}

export function multiplierToBasisPoints(multiplier: number): number {
  return Math.round(multiplier * MULTIPLIER_SCALE);
}

export function applyPercentToMicroLei(amountMicroLei: number, percent: number): number {
  const percentBps = percentToBasisPoints(percent);
  return (amountMicroLei * percentBps) / PERCENT_DIVISOR;
}

export function applyMultiplierToMicroLei(amountMicroLei: number, multiplier: number): number {
  const multiplierBps = multiplierToBasisPoints(multiplier);
  return (amountMicroLei * multiplierBps) / MULTIPLIER_SCALE;
}

export function prorateMicroLei(amountMicroLei: number, months: number): number {
  return (amountMicroLei * months) / 12;
}

export function roundMicroLeiToLei(amountMicroLei: number): number {
  return roundToLei(amountMicroLei / MICRO_LEI_PER_LEU);
}

function divideAndRound(value: number, divisor: number): number {
  return Math.round(value / divisor);
}

export function applyPercentToBani(amountBani: number, percent: number): number {
  const percentBps = percentToBasisPoints(percent);
  return divideAndRound(amountBani * percentBps, PERCENT_DIVISOR);
}

export function applyMultiplierToBani(amountBani: number, multiplier: number): number {
  const multiplierBps = multiplierToBasisPoints(multiplier);
  return divideAndRound(amountBani * multiplierBps, MULTIPLIER_SCALE);
}

export function prorateBani(amountBani: number, months: number): number {
  return divideAndRound(amountBani * months, 12);
}

export function roundBaniToLei(amountBani: number): number {
  return roundToLei(amountBani / BANI_PER_LEU);
}

function normalizeTaxTypeForMatching(taxType: string): string[] {
  switch (taxType) {
    case "impozit_mijloace_transport":
      return ["impozit_mijloace_transport", "impozit_vehicul"];
    case "impozit_vehicul":
      return ["impozit_vehicul", "impozit_mijloace_transport"];
    case "impozit_teren_curti":
      return ["impozit_teren_curti", "impozit_teren_intravilan"];
    default:
      return [taxType];
  }
}

export function exemptionAppliesToTaxType(
  exemption: ExemptionContext,
  taxType: string
): boolean {
  if (exemption.taxTypes.length === 0) {
    return true;
  }

  const candidateTypes = new Set(normalizeTaxTypeForMatching(taxType));
  return exemption.taxTypes.some((ruleTaxType) =>
    normalizeTaxTypeForMatching(ruleTaxType).some((candidate) =>
      candidateTypes.has(candidate)
    )
  );
}

/**
 * Split tax into 2 installments (Art. 462 Cod Fiscal).
 * First installment: March 31
 * Second installment: September 30
 * Each is half, with remainder going to first installment.
 */
export function splitInstallments(
  totalAmount: number,
  fiscalYear: number
): { rata1: number; rata1Scadenta: Date; rata2: number; rata2Scadenta: Date } {
  const half = Math.floor(totalAmount / 2);
  const rata1 = totalAmount - half; // First gets the remainder
  const rata2 = half;

  return {
    rata1,
    rata1Scadenta: new Date(fiscalYear, 2, 31), // March 31
    rata2,
    rata2Scadenta: new Date(fiscalYear, 8, 30), // September 30
  };
}

/**
 * Calculate bonificatie (Art. 462 Cod Fiscal).
 * Discount for full annual tax payment by March 31.
 * BONIFICATIE_PERCENT (10%) is the legal ceiling; each HCL sets 0-10%.
 */
export function calculateBonificatie(totalAmount: number, hclPercent?: number): number {
  const percent = hclPercent != null
    ? Math.min(hclPercent, BONIFICATIE_PERCENT) // Cap at legal ceiling
    : BONIFICATIE_PERCENT; // Default to ceiling if HCL doesn't specify
  return roundToLei(totalAmount * (percent / 100));
}

/**
 * Apply an HCL inflation coefficient when configured.
 * Values <= 0 are ignored as invalid configuration.
 */
export function applyInflationIndex(amount: number, inflationIndex?: number): number {
  if (!inflationIndex || inflationIndex <= 0) return amount;
  return amount * inflationIndex;
}

/**
 * Building age coefficient (Art. 457 Cod Fiscal).
 *
 * IMPORTANT: Art. 457 alin. (7)-(9) were ABROGATED by Legea 239/2025.
 * Age coefficients no longer apply starting fiscal year 2026.
 * Kept for historical correctness (fiscal years ≤ 2025).
 *
 * Historical coefficients:
 * - Over 100 years: 0.85
 * - 50-100 years: 0.90
 * - 30-50 years: 0.95
 * - Under 30 years: 1.00
 */
export function getBuildingAgeCoefficient(anConstructie: number, fiscalYear: number): number {
  // Legea 239/2025: age coefficients abrogated starting 2026
  if (fiscalYear >= 2026) return 1.0;

  const age = fiscalYear - anConstructie;
  if (age > 100) return 0.85;
  if (age > 50) return 0.9;
  if (age > 30) return 0.95;
  return 1.0;
}
