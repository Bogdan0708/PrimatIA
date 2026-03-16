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

/** Count calendar days between two dates (inclusive of both endpoints). */
function daysBetweenInclusive(from: Date, to: Date): number {
  const msPerDay = 86_400_000;
  return Math.floor((to.getTime() - from.getTime()) / msPerDay) + 1;
}

/**
 * Calculate penalties for overdue taxes per Cod Procedura Fiscala Art. 173-174.
 *
 * Rates: 0.02%/day interest (dobândă) + 0.01%/day penalties (penalitate de întârziere).
 * Total: 0.03%/day.
 *
 * Calculation method: period-based (principal × rate × days), rounded to bani
 * on the total per period — NOT rounded per day (avoids accumulation drift).
 * Individual daily records are still stored for audit trail, but amounts
 * are computed from the period total and distributed evenly.
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

  // Build continuous segments where overdue principal is constant.
  // The principal can change at rata2Scadenta + 1 day.
  const rata2Boundary = new Date(impozit.rata2Scadenta);
  rata2Boundary.setDate(rata2Boundary.getDate() + 1);

  interface Segment { from: Date; to: Date; principal: number }
  const segments: Segment[] = [];

  if (startDate < rata2Boundary && calculationDate >= rata2Boundary) {
    // Segment spans the rata2 boundary — split into two segments
    const beforeEnd = new Date(rata2Boundary);
    beforeEnd.setDate(beforeEnd.getDate() - 1);

    const principalBefore = getOverduePrincipalForDate(impozit, startDate);
    if (principalBefore > 0) {
      segments.push({ from: new Date(startDate), to: beforeEnd, principal: principalBefore });
    }

    const principalAfter = getOverduePrincipalForDate(impozit, rata2Boundary);
    if (principalAfter > 0) {
      segments.push({ from: new Date(rata2Boundary), to: new Date(calculationDate), principal: principalAfter });
    }
  } else {
    // Single segment — principal is constant throughout
    const principal = getOverduePrincipalForDate(impozit, startDate);
    if (principal > 0) {
      segments.push({ from: new Date(startDate), to: new Date(calculationDate), principal });
    }
  }

  if (segments.length === 0) {
    return { totalPenalties: 0, totalInterest: 0, newRecords: 0 };
  }

  // Calculate period-based totals, rounded once per segment (not per day)
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

  for (const seg of segments) {
    const days = daysBetweenInclusive(seg.from, seg.to);
    if (days <= 0) continue;

    // Period-based calculation: principal × rate × days, rounded to bani once
    const segPenalty = Math.round(seg.principal * PENALTY_DAILY_RATE * days * 100) / 100;
    const segInterest = Math.round(seg.principal * INTEREST_DAILY_RATE * days * 100) / 100;

    totalPenalties += segPenalty;
    totalInterest += segInterest;

    // Distribute evenly across daily records for audit trail
    const dailyPenalty = Math.round(segPenalty / days * 100) / 100;
    const dailyInterest = Math.round(segInterest / days * 100) / 100;
    const dailyTotal = dailyPenalty + dailyInterest;

    // Track remainder to ensure daily records sum exactly to segment total
    let penaltyRemainder = segPenalty;
    let interestRemainder = segInterest;

    const currentDate = new Date(seg.from);
    for (let d = 0; d < days; d++) {
      const isLast = d === days - 1;
      const dayPen = isLast ? penaltyRemainder : dailyPenalty;
      const dayInt = isLast ? interestRemainder : dailyInterest;

      penaltyRecords.push({
        tenantId,
        impozitId,
        dataCalcul: new Date(currentDate),
        sumaRestanta: seg.principal,
        rataPenalizare: PENALTY_DAILY_RATE + INTEREST_DAILY_RATE,
        sumaPenalizare: isLast ? dayPen + dayInt : dailyTotal,
      });

      penaltyRemainder -= dailyPenalty;
      interestRemainder -= dailyInterest;
      newRecords++;
      currentDate.setDate(currentDate.getDate() + 1);
    }
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
