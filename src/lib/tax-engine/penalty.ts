import { prisma } from "@/lib/db";
import { PENALTY_DAILY_RATE, INTEREST_DAILY_RATE } from "./types";
import { roundToLei, toSafeNumber } from "./utils";

function getOverduePrincipalForDate(impozit: {
  rata1: unknown;
  rata2: unknown;
  rata1Scadenta: Date;
  rata2Scadenta: Date;
  sumaPlatita: unknown;
}, date: Date): number {
  const rata1 = Number(impozit.rata1);
  const rata2 = Number(impozit.rata2);
  const paid = Number(impozit.sumaPlatita);

  let overdue = 0;

  if (date > new Date(impozit.rata1Scadenta)) {
    overdue += Math.max(0, rata1 - paid);
  }

  if (date > new Date(impozit.rata2Scadenta)) {
    const paidTowardSecondInstallment = Math.max(0, paid - rata1);
    overdue += Math.max(0, rata2 - paidTowardSecondInstallment);
  }

  return overdue;
}

function getInitialPenaltyStartDate(impozit: {
  rata1: unknown;
  rata2: unknown;
  rata1Scadenta: Date;
  rata2Scadenta: Date;
  sumaPlatita: unknown;
}): Date | null {
  const paid = Number(impozit.sumaPlatita);
  const rata1 = Number(impozit.rata1);
  const rata2 = Number(impozit.rata2);

  if (paid < rata1) {
    const start = new Date(impozit.rata1Scadenta);
    start.setDate(start.getDate() + 1);
    return start;
  }

  if (paid < rata1 + rata2) {
    const start = new Date(impozit.rata2Scadenta);
    start.setDate(start.getDate() + 1);
    return start;
  }

  return null;
}

/**
 * Calculate penalties for overdue taxes per Cod Procedura Fiscala.
 * Daily accrual: 0.01%/day delay interest + 0.01%/day penalties.
 */
export async function calculatePenalties(
  tenantId: string,
  impozitId: string,
  calculationDate: Date
): Promise<{ totalPenalties: number; totalInterest: number; newRecords: number }> {
  const impozit = await prisma.impozit.findUnique({
    where: { id: impozitId },
  });

  if (!impozit) throw new Error(`Tax record not found: ${impozitId}`);

  const sumaDatorata = toSafeNumber(impozit.sumaDatorata, "impozit.sumaDatorata");
  const sumaPlatita = toSafeNumber(impozit.sumaPlatita, "impozit.sumaPlatita");
  const outstanding = sumaDatorata - sumaPlatita;

  if (outstanding <= 0) return { totalPenalties: 0, totalInterest: 0, newRecords: 0 };

  // Find the last penalty calculation date
  const lastPenalty = await prisma.penalitate.findFirst({
    where: { tenantId, impozitId },
    orderBy: { dataCalcul: "desc" },
  });

  let startDate: Date;
  if (lastPenalty) {
    startDate = new Date(lastPenalty.dataCalcul);
    startDate.setDate(startDate.getDate() + 1);
  } else {
    const initialStart = getInitialPenaltyStartDate(impozit);
    if (!initialStart) {
      return { totalPenalties: 0, totalInterest: 0, newRecords: 0 };
    }
    startDate = initialStart;
  }

  if (startDate > calculationDate) {
    return { totalPenalties: 0, totalInterest: 0, newRecords: 0 };
  }

  let totalPenalties = 0;
  let totalInterest = 0;
  let newRecords = 0;
  const penaltyRecords: Array<{
    tenantId: string;
    impozitId: string;
    dataCalcul: Date;
    sumaRestanta: number;
    rataPenalizare: number;
    sumaPenalizare: number;
  }> = [];

  const currentDate = new Date(startDate);
  while (currentDate <= calculationDate) {
    const overduePrincipal = getOverduePrincipalForDate(impozit, currentDate);
    if (overduePrincipal <= 0) {
      currentDate.setDate(currentDate.getDate() + 1);
      continue;
    }

    const dailyPenalty = roundToLei(overduePrincipal * PENALTY_DAILY_RATE * 100) / 100;
    const dailyInterest = roundToLei(overduePrincipal * INTEREST_DAILY_RATE * 100) / 100;
    const dailyTotal = dailyPenalty + dailyInterest;

    penaltyRecords.push({
      tenantId,
      impozitId,
      dataCalcul: new Date(currentDate),
      sumaRestanta: overduePrincipal,
      rataPenalizare: PENALTY_DAILY_RATE + INTEREST_DAILY_RATE,
      sumaPenalizare: dailyTotal,
    });

    totalPenalties += dailyPenalty;
    totalInterest += dailyInterest;
    newRecords++;
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Batch insert penalty records
  if (penaltyRecords.length > 0) {
    await prisma.penalitate.createMany({
      data: penaltyRecords,
      skipDuplicates: true,
    });

    // Update the impozit's penalty total
    const existingPenalties = await prisma.penalitate.aggregate({
      where: { tenantId, impozitId },
      _sum: { sumaPenalizare: true },
    });

    await prisma.impozit.update({
      where: { id: impozitId },
      data: {
        sumaPenalitati: existingPenalties._sum.sumaPenalizare ?? 0,
      },
    });
  }

  return {
    totalPenalties: roundToLei(totalPenalties),
    totalInterest: roundToLei(totalInterest),
    newRecords,
  };
}
