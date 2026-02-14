import { prisma, setTenantContext } from "@/lib/db";

// ============================================================================
// Types
// ============================================================================

export type ComplianceGrade = "A" | "B" | "C" | "D" | "F";
export type ComplianceColor = "green" | "yellow" | "orange" | "red";

export interface ComplianceFactors {
  paymentTimeliness: { score: number; avgDaysLate: number; totalPayments: number };
  declarationCompleteness: { score: number; filed: number; expected: number };
  paymentConsistency: { score: number; variance: number };
  disputeHistory: { score: number; totalDisputes: number; activeDisputes: number };
}

export interface ComplianceScoreResult {
  score: number;
  grade: ComplianceGrade;
  color: ComplianceColor;
  factors: ComplianceFactors;
}

// ============================================================================
// Grade / color mapping
// ============================================================================

function gradeFromScore(score: number): ComplianceGrade {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 40) return "D";
  return "F";
}

function colorFromGrade(grade: ComplianceGrade): ComplianceColor {
  switch (grade) {
    case "A": return "green";
    case "B": return "yellow";
    case "C": return "orange";
    case "D":
    case "F": return "red";
  }
}

// ============================================================================
// Factor calculations
// ============================================================================

/**
 * Payment timeliness (40% weight):
 * Avg days late over last 12 months.
 * 0 days late = 100pts, 30+ days = 0pts (linear scale).
 */
async function calcPaymentTimeliness(
  tenantId: string,
  contribuabilId: string
): Promise<ComplianceFactors["paymentTimeliness"]> {
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  // Get impozite with installment deadlines
  const impozite = await prisma.impozit.findMany({
    where: {
      tenantId,
      contribuabilId,
      createdAt: { gte: twelveMonthsAgo },
    },
    include: {
      platiDistributie: {
        include: { plata: true },
      },
    },
  });

  if (impozite.length === 0) {
    return { score: 100, avgDaysLate: 0, totalPayments: 0 };
  }

  let totalDaysLate = 0;
  let installmentCount = 0;

  for (const imp of impozite) {
    const deadlines = [
      { amount: Number(imp.rata1), deadline: new Date(imp.rata1Scadenta) },
      { amount: Number(imp.rata2), deadline: new Date(imp.rata2Scadenta) },
    ];

    // Sum of distributions for this impozit
    const payments = imp.platiDistributie
      .filter((d) => d.plata)
      .map((d) => ({
        date: new Date(d.plata.dataPlata),
        amount: Number(d.sumaDebit),
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    let cumPaid = 0;
    let paymentIdx = 0;

    for (const dl of deadlines) {
      if (dl.amount <= 0) continue;
      installmentCount++;

      // Find when cumulative payments covered this installment
      const targetCum = cumPaid + dl.amount;
      let paidDate: Date | null = null;

      while (paymentIdx < payments.length) {
        cumPaid += payments[paymentIdx].amount;
        if (cumPaid >= targetCum * 0.95) {
          // 95% threshold
          paidDate = payments[paymentIdx].date;
          paymentIdx++;
          break;
        }
        paymentIdx++;
      }

      if (paidDate) {
        const daysLate = Math.max(
          0,
          Math.floor(
            (paidDate.getTime() - dl.deadline.getTime()) / (1000 * 60 * 60 * 24)
          )
        );
        totalDaysLate += daysLate;
      } else {
        // Not yet paid — count days from deadline to now
        const now = new Date();
        if (now > dl.deadline) {
          const daysLate = Math.floor(
            (now.getTime() - dl.deadline.getTime()) / (1000 * 60 * 60 * 24)
          );
          totalDaysLate += daysLate;
        }
      }
    }
  }

  const avgDaysLate =
    installmentCount > 0 ? totalDaysLate / installmentCount : 0;
  // Linear: 0 days = 100, 30+ days = 0
  const score = Math.max(0, Math.min(100, 100 - (avgDaysLate / 30) * 100));

  return {
    score: Math.round(score),
    avgDaysLate: Math.round(avgDaysLate * 10) / 10,
    totalPayments: installmentCount,
  };
}

/**
 * Declaration completeness (25% weight):
 * % of expected tax declarations filed.
 * Based on active properties vs impozite for the current fiscal year.
 */
async function calcDeclarationCompleteness(
  tenantId: string,
  contribuabilId: string
): Promise<ComplianceFactors["declarationCompleteness"]> {
  const currentYear = new Date().getFullYear();

  // Count active properties (each should have a corresponding tax)
  const [buildings, land, vehicles] = await Promise.all([
    prisma.proprietateCladire.count({
      where: { tenantId, contribuabilId, status: "activ" },
    }),
    prisma.proprietateTeren.count({
      where: { tenantId, contribuabilId, status: "activ" },
    }),
    prisma.proprietateVehicul.count({
      where: { tenantId, contribuabilId, status: "activ" },
    }),
  ]);

  const expected = buildings + land + vehicles;
  if (expected === 0) {
    return { score: 100, filed: 0, expected: 0 };
  }

  // Count impozite for current year
  const filed = await prisma.impozit.count({
    where: { tenantId, contribuabilId, fiscalYear: currentYear },
  });

  const ratio = Math.min(1, filed / expected);
  return {
    score: Math.round(ratio * 100),
    filed,
    expected,
  };
}

/**
 * Payment consistency (20% weight):
 * Lower variance in monthly payment amounts = higher score.
 */
async function calcPaymentConsistency(
  tenantId: string,
  contribuabilId: string
): Promise<ComplianceFactors["paymentConsistency"]> {
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  const plati = await prisma.plata.findMany({
    where: {
      tenantId,
      contribuabilId,
      dataPlata: { gte: twelveMonthsAgo },
    },
    select: { suma: true, dataPlata: true },
    orderBy: { dataPlata: "asc" },
  });

  if (plati.length <= 1) {
    // Not enough data to determine consistency
    return { score: 80, variance: 0 };
  }

  // Group by month
  const monthlyTotals = new Map<string, number>();
  for (const p of plati) {
    const date = new Date(p.dataPlata);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    monthlyTotals.set(key, (monthlyTotals.get(key) ?? 0) + Number(p.suma));
  }

  const amounts = Array.from(monthlyTotals.values());
  if (amounts.length <= 1) {
    return { score: 80, variance: 0 };
  }

  const mean = amounts.reduce((s, v) => s + v, 0) / amounts.length;
  if (mean === 0) return { score: 80, variance: 0 };

  const variance =
    amounts.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / amounts.length;
  const coefficientOfVariation = Math.sqrt(variance) / mean;

  // CV 0 = 100 points, CV >= 1.5 = 0 points
  const score = Math.max(0, Math.min(100, 100 - (coefficientOfVariation / 1.5) * 100));

  return {
    score: Math.round(score),
    variance: Math.round(coefficientOfVariation * 100) / 100,
  };
}

/**
 * Dispute history (15% weight):
 * Based on somatii (enforcement notices). Fewer = higher score.
 */
async function calcDisputeHistory(
  tenantId: string,
  contribuabilId: string
): Promise<ComplianceFactors["disputeHistory"]> {
  const [total, active] = await Promise.all([
    prisma.somatie.count({
      where: { tenantId, contribuabilId },
    }),
    prisma.somatie.count({
      where: {
        tenantId,
        contribuabilId,
        status: { in: ["emis", "comunicat"] },
      },
    }),
  ]);

  // 0 disputes = 100, each dispute -15 points, active disputes -25 each
  let score = 100 - total * 15 - active * 10;
  score = Math.max(0, Math.min(100, score));

  return {
    score: Math.round(score),
    totalDisputes: total,
    activeDisputes: active,
  };
}

// ============================================================================
// Main calculation
// ============================================================================

const WEIGHTS = {
  paymentTimeliness: 0.4,
  declarationCompleteness: 0.25,
  paymentConsistency: 0.2,
  disputeHistory: 0.15,
};

export async function calculateComplianceScore(
  tenantId: string,
  contribuabilId: string
): Promise<ComplianceScoreResult> {
  await setTenantContext(tenantId);

  const [paymentTimeliness, declarationCompleteness, paymentConsistency, disputeHistory] =
    await Promise.all([
      calcPaymentTimeliness(tenantId, contribuabilId),
      calcDeclarationCompleteness(tenantId, contribuabilId),
      calcPaymentConsistency(tenantId, contribuabilId),
      calcDisputeHistory(tenantId, contribuabilId),
    ]);

  const weightedScore =
    paymentTimeliness.score * WEIGHTS.paymentTimeliness +
    declarationCompleteness.score * WEIGHTS.declarationCompleteness +
    paymentConsistency.score * WEIGHTS.paymentConsistency +
    disputeHistory.score * WEIGHTS.disputeHistory;

  const score = Math.round(weightedScore);
  const grade = gradeFromScore(score);
  const color = colorFromGrade(grade);

  return {
    score,
    grade,
    color,
    factors: {
      paymentTimeliness,
      declarationCompleteness,
      paymentConsistency,
      disputeHistory,
    },
  };
}
