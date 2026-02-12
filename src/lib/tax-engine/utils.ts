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
 * 10% discount if full annual tax is paid by March 31.
 */
export function calculateBonificatie(totalAmount: number): number {
  return roundToLei(totalAmount * 0.1);
}

/**
 * Building age coefficient (Art. 457 Cod Fiscal).
 * Reduction coefficient based on building age:
 * - Over 100 years: 0.85
 * - 50-100 years: 0.90
 * - 30-50 years: 0.95
 * - Under 30 years: 1.00
 */
export function getBuildingAgeCoefficient(anConstructie: number, fiscalYear: number): number {
  const age = fiscalYear - anConstructie;
  if (age > 100) return 0.85;
  if (age > 50) return 0.9;
  if (age > 30) return 0.95;
  return 1.0;
}
