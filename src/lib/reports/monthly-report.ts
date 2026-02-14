import { prisma, setTenantContext } from "@/lib/db";

// ============================================================================
// Types
// ============================================================================

export interface MonthlyReportParams {
  tenantId: string;
  year: number;
  month: number; // 1-12
}

export interface TaxCategoryBreakdown {
  code: string;
  name: string;
  collected: number;
  outstanding: number;
  overdue: number;
}

export interface OverdueTaxpayer {
  id: string;
  nume: string;
  prenume: string | null;
  tip: string;
  totalOverdue: number;
  oldestDueDate: string;
}

export interface MonthlyReportResult {
  period: { year: number; month: number; label: string };

  // Core metrics
  totalCollected: number;
  totalOutstanding: number;
  totalOverdue: number;
  collectionRate: number;

  // Compared to previous month
  prevMonth: {
    totalCollected: number;
    totalOutstanding: number;
    collectionRate: number;
  };
  changes: {
    collectedPct: number;
    outstandingPct: number;
    collectionRateDelta: number;
  };

  // Breakdown by tax category
  byCategory: TaxCategoryBreakdown[];

  // Top 10 overdue taxpayers
  topOverdue: OverdueTaxpayer[];

  // Summary stats
  totalTaxpayers: number;
  activeTaxpayers: number;
  totalPaymentsCount: number;

  generatedAt: string;
}

// ============================================================================
// Helpers
// ============================================================================

const ROMANIAN_MONTHS = [
  "Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie",
  "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie",
];

function monthRange(year: number, month: number) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end };
}

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function getTaxTypeName(taxType: { name: unknown; code: string }): string {
  if (typeof taxType.name === "object" && taxType.name !== null) {
    return (taxType.name as Record<string, string>).ro || taxType.code;
  }
  return taxType.code;
}

// ============================================================================
// Main report generation
// ============================================================================

export async function generateMonthlyReport(
  params: MonthlyReportParams
): Promise<MonthlyReportResult> {
  await setTenantContext(params.tenantId);

  const { year, month } = params;
  const { start: monthStart, end: monthEnd } = monthRange(year, month);

  // Previous month
  const prevYear = month === 1 ? year - 1 : year;
  const prevMonthNum = month === 1 ? 12 : month - 1;
  const { start: prevStart, end: prevEnd } = monthRange(prevYear, prevMonthNum);

  // ---- Parallel queries ----
  const [
    currentMonthPayments,
    prevMonthPayments,
    allImpozite,
    totalTaxpayers,
    activeTaxpayers,
  ] = await Promise.all([
    // Payments this month
    prisma.plata.findMany({
      where: {
        tenantId: params.tenantId,
        dataPlata: { gte: monthStart, lte: monthEnd },
      },
      include: {
        platiDistributie: {
          include: { impozit: { include: { taxType: true } } },
        },
      },
    }),
    // Payments previous month
    prisma.plata.findMany({
      where: {
        tenantId: params.tenantId,
        dataPlata: { gte: prevStart, lte: prevEnd },
      },
      select: { suma: true },
    }),
    // All impozite for fiscal year
    prisma.impozit.findMany({
      where: { tenantId: params.tenantId, fiscalYear: year },
      include: {
        taxType: true,
        contribuabil: { select: { id: true, nume: true, prenume: true, tip: true } },
      },
    }),
    // Taxpayer counts
    prisma.contribuabil.count({
      where: { tenantId: params.tenantId, deletedAt: null },
    }),
    prisma.contribuabil.count({
      where: { tenantId: params.tenantId, deletedAt: null, status: "activ" },
    }),
  ]);

  // ---- Current month total collected ----
  const totalCollected = currentMonthPayments.reduce(
    (s, p) => s + Number(p.suma),
    0
  );

  // ---- Previous month total collected ----
  const prevTotalCollected = prevMonthPayments.reduce(
    (s, p) => s + Number(p.suma),
    0
  );

  // ---- Outstanding and overdue by category ----
  const catMap = new Map<string, TaxCategoryBreakdown>();
  const overdueByTaxpayer = new Map<
    string,
    { id: string; nume: string; prenume: string | null; tip: string; total: number; oldest: Date }
  >();

  let totalOutstanding = 0;
  let totalOverdue = 0;

  for (const imp of allImpozite) {
    const owed = Number(imp.sumaDatorata) + Number(imp.sumaPenalitati);
    const paid = Number(imp.sumaPlatita);
    const remaining = Math.max(0, owed - paid);

    if (remaining <= 0) continue;

    totalOutstanding += remaining;

    const code = imp.taxType.code;
    const name = getTaxTypeName(imp.taxType);
    const cat = catMap.get(code) ?? { code, name, collected: 0, outstanding: 0, overdue: 0 };
    cat.outstanding += remaining;

    // Check if overdue (past both installment deadlines)
    const now = new Date();
    const isOverdue =
      (now > new Date(imp.rata1Scadenta) && paid < Number(imp.rata1)) ||
      (now > new Date(imp.rata2Scadenta) && paid < owed);

    if (isOverdue) {
      totalOverdue += remaining;
      cat.overdue += remaining;

      // Track by taxpayer for top-10
      const c = imp.contribuabil;
      const existing = overdueByTaxpayer.get(c.id);
      const dueDate = new Date(imp.rata1Scadenta);
      if (existing) {
        existing.total += remaining;
        if (dueDate < existing.oldest) existing.oldest = dueDate;
      } else {
        overdueByTaxpayer.set(c.id, {
          id: c.id,
          nume: c.nume,
          prenume: c.prenume,
          tip: c.tip,
          total: remaining,
          oldest: dueDate,
        });
      }
    }

    catMap.set(code, cat);
  }

  // ---- Add collected amounts to category breakdown ----
  for (const plata of currentMonthPayments) {
    for (const dist of plata.platiDistributie) {
      const code = dist.impozit.taxType.code;
      const name = getTaxTypeName(dist.impozit.taxType);
      const cat = catMap.get(code) ?? { code, name, collected: 0, outstanding: 0, overdue: 0 };
      cat.collected += Number(dist.sumaDebit) + Number(dist.sumaPenalitati);
      catMap.set(code, cat);
    }
  }

  // ---- Collection rate ----
  const totalDue = allImpozite.reduce(
    (s, imp) => s + Number(imp.sumaDatorata) + Number(imp.sumaPenalitati),
    0
  );
  const totalPaidYear = allImpozite.reduce(
    (s, imp) => s + Number(imp.sumaPlatita),
    0
  );
  const collectionRate = totalDue > 0 ? (totalPaidYear / totalDue) * 100 : 0;

  // Previous month collection rate (approximate - based on what was known then)
  const prevOutstanding = totalOutstanding + totalCollected; // rough approximation
  const prevCollectionRate =
    prevOutstanding + prevTotalCollected > 0
      ? (prevTotalCollected / (prevOutstanding + prevTotalCollected)) * 100
      : 0;

  // ---- Top 10 overdue ----
  const topOverdue = Array.from(overdueByTaxpayer.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)
    .map((t) => ({
      id: t.id,
      nume: t.nume,
      prenume: t.prenume,
      tip: t.tip,
      totalOverdue: Math.round(t.total * 100) / 100,
      oldestDueDate: t.oldest.toISOString().split("T")[0],
    }));

  // ---- Build result ----
  return {
    period: {
      year,
      month,
      label: `${ROMANIAN_MONTHS[month - 1]} ${year}`,
    },
    totalCollected: Math.round(totalCollected * 100) / 100,
    totalOutstanding: Math.round(totalOutstanding * 100) / 100,
    totalOverdue: Math.round(totalOverdue * 100) / 100,
    collectionRate: Math.round(collectionRate * 10) / 10,
    prevMonth: {
      totalCollected: Math.round(prevTotalCollected * 100) / 100,
      totalOutstanding: Math.round(prevOutstanding * 100) / 100,
      collectionRate: Math.round(prevCollectionRate * 10) / 10,
    },
    changes: {
      collectedPct: pctChange(totalCollected, prevTotalCollected),
      outstandingPct: pctChange(totalOutstanding, prevOutstanding),
      collectionRateDelta:
        Math.round((collectionRate - prevCollectionRate) * 10) / 10,
    },
    byCategory: Array.from(catMap.values()).sort((a, b) => b.collected - a.collected),
    topOverdue,
    totalTaxpayers,
    activeTaxpayers,
    totalPaymentsCount: currentMonthPayments.length,
    generatedAt: new Date().toISOString(),
  };
}
