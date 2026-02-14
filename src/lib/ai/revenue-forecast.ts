import { prisma } from "@/lib/db";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RevenueForecast {
  currentYear: number;
  projectedTotal: number;
  collectedTotal: number;
  collectionRate: number;
  byTaxType: { taxType: string; projected: number; collected: number; rate: number }[];
  byMonth: { month: number; projected: number; collected: number }[];
  yearOverYear: { previousYear: number; currentYear: number; growthPercent: number };
  nextYearEstimate: number;
}

// ─── Main ────────────────────────────────────────────────────────────────────

export async function generateRevenueForecast(
  tenantId: string,
  year?: number
): Promise<RevenueForecast> {
  const currentYear = year ?? new Date().getFullYear();
  const previousYear = currentYear - 1;

  // All taxes for current year
  const currentTaxes = await prisma.impozit.findMany({
    where: { tenantId, fiscalYear: currentYear },
    select: {
      sumaDatorata: true,
      sumaPlatita: true,
      taxType: { select: { code: true, name: true } },
      proprietateType: true,
    },
  });

  // Previous year taxes
  const prevTaxes = await prisma.impozit.findMany({
    where: { tenantId, fiscalYear: previousYear },
    select: { sumaDatorata: true, sumaPlatita: true },
  });

  // Payments by month for current year
  const payments = await prisma.plata.findMany({
    where: {
      tenantId,
      dataPlata: {
        gte: new Date(currentYear, 0, 1),
        lt: new Date(currentYear + 1, 0, 1),
      },
    },
    select: { suma: true, dataPlata: true },
  });

  // ── Totals ──
  const projectedTotal = currentTaxes.reduce((s, t) => s + Number(t.sumaDatorata), 0);
  const collectedTotal = currentTaxes.reduce((s, t) => s + Number(t.sumaPlatita), 0);
  const collectionRate = projectedTotal > 0 ? (collectedTotal / projectedTotal) * 100 : 0;

  // ── By tax type ──
  const taxTypeMap = new Map<string, { projected: number; collected: number }>();
  for (const t of currentTaxes) {
    const code = t.taxType.code;
    const entry = taxTypeMap.get(code) ?? { projected: 0, collected: 0 };
    entry.projected += Number(t.sumaDatorata);
    entry.collected += Number(t.sumaPlatita);
    taxTypeMap.set(code, entry);
  }
  const byTaxType = Array.from(taxTypeMap.entries()).map(([taxType, v]) => ({
    taxType,
    projected: round2(v.projected),
    collected: round2(v.collected),
    rate: v.projected > 0 ? round2((v.collected / v.projected) * 100) : 0,
  }));

  // ── By month ──
  const monthlyProjected = projectedTotal / 12;
  const monthlyCollected = new Array(12).fill(0);
  for (const p of payments) {
    const month = p.dataPlata.getMonth();
    monthlyCollected[month] += Number(p.suma);
  }
  const byMonth = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    projected: round2(monthlyProjected),
    collected: round2(monthlyCollected[i]),
  }));

  // ── Year over year ──
  const prevTotal = prevTaxes.reduce((s, t) => s + Number(t.sumaDatorata), 0);
  const growthPercent = prevTotal > 0
    ? round2(((projectedTotal - prevTotal) / prevTotal) * 100)
    : 0;

  // ── Next year estimate ──
  // Try to get inflation index from HCL decisions
  const nextYearHcl = await prisma.hclDecision.findFirst({
    where: { tenantId, fiscalYear: currentYear + 1, status: 'aprobat' },
    select: { inflationIndex: true },
  });
  const currentHcl = await prisma.hclDecision.findFirst({
    where: { tenantId, fiscalYear: currentYear, status: 'aprobat' },
    select: { inflationIndex: true },
  });

  const inflationIndex = nextYearHcl?.inflationIndex
    ?? currentHcl?.inflationIndex
    ?? null;
  const inflationMultiplier = inflationIndex ? Number(inflationIndex) : 1.05; // default 5%
  const nextYearEstimate = round2(projectedTotal * inflationMultiplier);

  return {
    currentYear,
    projectedTotal: round2(projectedTotal),
    collectedTotal: round2(collectedTotal),
    collectionRate: round2(collectionRate),
    byTaxType,
    byMonth,
    yearOverYear: {
      previousYear: round2(prevTotal),
      currentYear: round2(projectedTotal),
      growthPercent,
    },
    nextYearEstimate,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
