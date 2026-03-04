import { prisma } from "@/lib/db";
import { PENALTY_DAILY_RATE, INTEREST_DAILY_RATE } from "./types";
import { roundToLei, toSafeNumber } from "./utils";

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

  // Determine start date for penalty calculation
  // Penalties start after the installment due date
  const rata1Scadenta = impozit.rata1Scadenta;

  let startDate: Date;
  if (lastPenalty) {
    startDate = new Date(lastPenalty.dataCalcul);
    startDate.setDate(startDate.getDate() + 1);
  } else {
    // Start from the day after first missed deadline
    startDate = new Date(rata1Scadenta);
    startDate.setDate(startDate.getDate() + 1);
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
    const dailyPenalty = roundToLei(outstanding * PENALTY_DAILY_RATE * 100) / 100;
    const dailyInterest = roundToLei(outstanding * INTEREST_DAILY_RATE * 100) / 100;
    const dailyTotal = dailyPenalty + dailyInterest;

    penaltyRecords.push({
      tenantId,
      impozitId,
      dataCalcul: new Date(currentDate),
      sumaRestanta: outstanding,
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
