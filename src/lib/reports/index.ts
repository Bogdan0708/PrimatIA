import { prisma, setTenantContext } from "@/lib/db";
import { formatNumber, formatDate } from "@/lib/formatting";

// ============================================================================
// Types
// ============================================================================

export interface ReportParams {
  tenantId: string;
  dateFrom?: string;
  dateTo?: string;
  fiscalYear?: number;
  taxType?: string;
}

export interface ReportRow {
  [key: string]: string | number;
}

export interface ReportResult {
  title: string;
  columns: Array<{ key: string; label: string; align?: "left" | "right" }>;
  rows: ReportRow[];
  totals?: Record<string, string | number>;
  generatedAt: string;
  parameters: Record<string, string>;
}

// ============================================================================
// 1. Situația veniturilor încasate (Revenue collected by type)
// ============================================================================

export async function reportVenituriIncasate(params: ReportParams): Promise<ReportResult> {
  await setTenantContext(params.tenantId);

  const where: Record<string, unknown> = { tenantId: params.tenantId };
  if (params.dateFrom || params.dateTo) {
    const dateFilter: Record<string, Date> = {};
    if (params.dateFrom) dateFilter.gte = new Date(params.dateFrom);
    if (params.dateTo) dateFilter.lte = new Date(params.dateTo);
    where.dataPlata = dateFilter;
  }

  const plati = await prisma.plata.findMany({
    where: where as any,
    include: {
      platiDistributie: {
        include: {
          impozit: { include: { taxType: true } },
        },
      },
    },
    orderBy: { dataPlata: "asc" },
  });

  // Aggregate by tax type
  const byType = new Map<string, { name: string; debit: number; penalties: number; total: number }>();

  for (const plata of plati) {
    for (const dist of plata.platiDistributie) {
      const code = dist.impozit.taxType.code;
      const name = typeof dist.impozit.taxType.name === "object"
        ? (dist.impozit.taxType.name as Record<string, string>).ro || code
        : code;
      const existing = byType.get(code) ?? { name, debit: 0, penalties: 0, total: 0 };
      existing.debit += Number(dist.sumaDebit);
      existing.penalties += Number(dist.sumaPenalitati);
      existing.total += Number(dist.sumaDebit) + Number(dist.sumaPenalitati);
      byType.set(code, existing);
    }
  }

  const rows: ReportRow[] = Array.from(byType.entries()).map(([, v], i) => ({
    nr: i + 1,
    tipImpozit: v.name,
    sumaDebit: formatNumber(v.debit),
    sumaPenalitati: formatNumber(v.penalties),
    total: formatNumber(v.total),
  }));

  const totalDebit = Array.from(byType.values()).reduce((s, v) => s + v.debit, 0);
  const totalPenalties = Array.from(byType.values()).reduce((s, v) => s + v.penalties, 0);

  return {
    title: "Situația veniturilor încasate",
    columns: [
      { key: "nr", label: "Nr.", align: "left" },
      { key: "tipImpozit", label: "Tip impozit/taxă", align: "left" },
      { key: "sumaDebit", label: "Debit principal (lei)", align: "right" },
      { key: "sumaPenalitati", label: "Penalități (lei)", align: "right" },
      { key: "total", label: "Total (lei)", align: "right" },
    ],
    rows,
    totals: {
      sumaDebit: formatNumber(totalDebit),
      sumaPenalitati: formatNumber(totalPenalties),
      total: formatNumber(totalDebit + totalPenalties),
    },
    generatedAt: formatDate(new Date()),
    parameters: {
      ...(params.dateFrom && { "De la": params.dateFrom }),
      ...(params.dateTo && { "Până la": params.dateTo }),
    },
  };
}

// ============================================================================
// 2. Situația restanțelor (Outstanding debts by type/period)
// ============================================================================

export async function reportRestante(params: ReportParams): Promise<ReportResult> {
  await setTenantContext(params.tenantId);

  const where: Record<string, unknown> = {
    tenantId: params.tenantId,
    status: { in: ["calculat", "emis", "partial_platit", "executare"] },
  };
  if (params.fiscalYear) where.fiscalYear = params.fiscalYear;

  const impozite = await prisma.impozit.findMany({
    where: where as any,
    include: { taxType: true },
    orderBy: [{ fiscalYear: "asc" }],
  });

  // Group by type + year
  const groups = new Map<string, { name: string; year: number; datorat: number; platit: number; penalitati: number; restanta: number }>();

  for (const imp of impozite) {
    const code = imp.taxType.code;
    const name = typeof imp.taxType.name === "object"
      ? (imp.taxType.name as Record<string, string>).ro || code
      : code;
    const key = `${code}-${imp.fiscalYear}`;
    const existing = groups.get(key) ?? {
      name, year: imp.fiscalYear, datorat: 0, platit: 0, penalitati: 0, restanta: 0,
    };
    existing.datorat += Number(imp.sumaDatorata);
    existing.platit += Number(imp.sumaPlatita);
    existing.penalitati += Number(imp.sumaPenalitati);
    const rest = Number(imp.sumaDatorata) + Number(imp.sumaPenalitati) - Number(imp.sumaPlatita);
    existing.restanta += Math.max(0, rest);
    groups.set(key, existing);
  }

  const rows: ReportRow[] = Array.from(groups.entries()).map(([, v], i) => ({
    nr: i + 1,
    tipImpozit: v.name,
    anFiscal: v.year,
    sumaDatorata: formatNumber(v.datorat),
    sumaPlatita: formatNumber(v.platit),
    sumaPenalitati: formatNumber(v.penalitati),
    sumaRestanta: formatNumber(v.restanta),
  }));

  const totalRestanta = Array.from(groups.values()).reduce((s, v) => s + v.restanta, 0);

  return {
    title: "Situația restanțelor",
    columns: [
      { key: "nr", label: "Nr.", align: "left" },
      { key: "tipImpozit", label: "Tip impozit/taxă", align: "left" },
      { key: "anFiscal", label: "An fiscal", align: "left" },
      { key: "sumaDatorata", label: "Stabilit (lei)", align: "right" },
      { key: "sumaPlatita", label: "Achitat (lei)", align: "right" },
      { key: "sumaPenalitati", label: "Penalități (lei)", align: "right" },
      { key: "sumaRestanta", label: "Restanță (lei)", align: "right" },
    ],
    rows,
    totals: { sumaRestanta: formatNumber(totalRestanta) },
    generatedAt: formatDate(new Date()),
    parameters: {
      ...(params.fiscalYear && { "An fiscal": params.fiscalYear.toString() }),
    },
  };
}

// ============================================================================
// 3. Registrul de rol (Taxpayer roll register)
// ============================================================================

export async function reportRegistruRol(params: ReportParams): Promise<ReportResult> {
  await setTenantContext(params.tenantId);

  const year = params.fiscalYear ?? new Date().getFullYear();

  const contribuabili = await prisma.contribuabil.findMany({
    where: { tenantId: params.tenantId, deletedAt: null },
    include: {
      impozite: {
        where: { fiscalYear: year },
        include: { taxType: true },
      },
    },
    orderBy: { nume: "asc" },
  });

  const rows: ReportRow[] = contribuabili
    .filter((c) => c.impozite.length > 0)
    .map((c, i) => {
      const totalDatorat = c.impozite.reduce((s, imp) => s + Number(imp.sumaDatorata), 0);
      const totalPlatit = c.impozite.reduce((s, imp) => s + Number(imp.sumaPlatita), 0);
      const totalPenalitati = c.impozite.reduce((s, imp) => s + Number(imp.sumaPenalitati), 0);
      const restanta = totalDatorat + totalPenalitati - totalPlatit;

      return {
        nr: i + 1,
        codRol: c.codRol || "-",
        contribuabil: `${c.nume}${c.prenume ? ` ${c.prenume}` : ""}`,
        tip: c.tip,
        nrImpozite: c.impozite.length,
        totalDatorat: formatNumber(totalDatorat),
        totalPlatit: formatNumber(totalPlatit),
        restanta: formatNumber(Math.max(0, restanta)),
      };
    });

  return {
    title: `Registrul de rol — ${year}`,
    columns: [
      { key: "nr", label: "Nr.", align: "left" },
      { key: "codRol", label: "Cod rol", align: "left" },
      { key: "contribuabil", label: "Contribuabil", align: "left" },
      { key: "tip", label: "Tip", align: "left" },
      { key: "nrImpozite", label: "Nr. impozite", align: "right" },
      { key: "totalDatorat", label: "Stabilit (lei)", align: "right" },
      { key: "totalPlatit", label: "Achitat (lei)", align: "right" },
      { key: "restanta", label: "Restanță (lei)", align: "right" },
    ],
    rows,
    generatedAt: formatDate(new Date()),
    parameters: { "An fiscal": year.toString() },
  };
}

// ============================================================================
// 4. Borderou zilnic (Daily transaction summary)
// ============================================================================

export async function reportBordeRouZilnic(params: ReportParams): Promise<ReportResult> {
  await setTenantContext(params.tenantId);

  const date = params.dateFrom ? new Date(params.dateFrom) : new Date();
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const plati = await prisma.plata.findMany({
    where: {
      tenantId: params.tenantId,
      dataPlata: { gte: startOfDay, lte: endOfDay },
    },
    include: {
      contribuabil: true,
      inregistratDe: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const modalitateLabel: Record<string, string> = {
    numerar: "Numerar",
    virament: "Virament bancar",
    mandat_postal: "Mandat poștal",
    ghiseul_ro: "Ghișeul.ro",
    card: "Card",
  };

  let totalNumerar = 0;
  let totalNonNumerar = 0;

  const rows: ReportRow[] = plati.map((p, i) => {
    const suma = Number(p.suma);
    if (p.modalitate === "numerar") totalNumerar += suma;
    else totalNonNumerar += suma;

    return {
      nr: i + 1,
      nrChitanta: p.nrChitanta || p.nrDocument || "-",
      contribuabil: `${p.contribuabil.nume}${p.contribuabil.prenume ? ` ${p.contribuabil.prenume}` : ""}`,
      modalitate: modalitateLabel[p.modalitate] || p.modalitate,
      suma: formatNumber(suma),
      casier: p.inregistratDe
        ? `${p.inregistratDe.firstName} ${p.inregistratDe.lastName}`
        : "-",
    };
  });

  return {
    title: `Borderou zilnic — ${formatDate(date)}`,
    columns: [
      { key: "nr", label: "Nr. crt.", align: "left" },
      { key: "nrChitanta", label: "Nr. chitanță/doc.", align: "left" },
      { key: "contribuabil", label: "Contribuabil", align: "left" },
      { key: "modalitate", label: "Modalitate", align: "left" },
      { key: "suma", label: "Sumă (lei)", align: "right" },
      { key: "casier", label: "Casier", align: "left" },
    ],
    rows,
    totals: {
      totalNumerar: formatNumber(totalNumerar),
      totalNonNumerar: formatNumber(totalNonNumerar),
      totalGeneral: formatNumber(totalNumerar + totalNonNumerar),
    },
    generatedAt: formatDate(new Date()),
    parameters: { Data: formatDate(date) },
  };
}

// ============================================================================
// 5. Raport debite-încasări (Debits vs collections)
// ============================================================================

export async function reportDebiteIncasari(params: ReportParams): Promise<ReportResult> {
  await setTenantContext(params.tenantId);

  const year = params.fiscalYear ?? new Date().getFullYear();

  // Get all taxes for the year
  const impozite = await prisma.impozit.findMany({
    where: { tenantId: params.tenantId, fiscalYear: year },
    include: { taxType: true },
  });

  // Group by tax type
  const groups = new Map<string, { name: string; stabilit: number; incasat: number; restanta: number; penalitati: number }>();

  for (const imp of impozite) {
    const code = imp.taxType.code;
    const name = typeof imp.taxType.name === "object"
      ? (imp.taxType.name as Record<string, string>).ro || code
      : code;
    const existing = groups.get(code) ?? { name, stabilit: 0, incasat: 0, restanta: 0, penalitati: 0 };
    existing.stabilit += Number(imp.sumaDatorata);
    existing.incasat += Number(imp.sumaPlatita);
    existing.penalitati += Number(imp.sumaPenalitati);
    const rest = Number(imp.sumaDatorata) + Number(imp.sumaPenalitati) - Number(imp.sumaPlatita);
    existing.restanta += Math.max(0, rest);
    groups.set(code, existing);
  }

  let gStabilit = 0, gIncasat = 0, gRestanta = 0;

  const rows: ReportRow[] = Array.from(groups.entries()).map(([, v], i) => {
    gStabilit += v.stabilit;
    gIncasat += v.incasat;
    gRestanta += v.restanta;
    const rata = v.stabilit > 0 ? (v.incasat / v.stabilit) * 100 : 0;

    return {
      nr: i + 1,
      tipImpozit: v.name,
      sumaStabilita: formatNumber(v.stabilit),
      sumaIncasata: formatNumber(v.incasat),
      sumaRestanta: formatNumber(v.restanta),
      rataColectare: formatNumber(rata, 1) + "%",
    };
  });

  const rataGenerala = gStabilit > 0 ? (gIncasat / gStabilit) * 100 : 0;

  return {
    title: `Raport debite-încasări — ${year}`,
    columns: [
      { key: "nr", label: "Nr.", align: "left" },
      { key: "tipImpozit", label: "Tip impozit/taxă", align: "left" },
      { key: "sumaStabilita", label: "Stabilit (lei)", align: "right" },
      { key: "sumaIncasata", label: "Încasat (lei)", align: "right" },
      { key: "sumaRestanta", label: "Restanță (lei)", align: "right" },
      { key: "rataColectare", label: "Rată colectare", align: "right" },
    ],
    rows,
    totals: {
      sumaStabilita: formatNumber(gStabilit),
      sumaIncasata: formatNumber(gIncasat),
      sumaRestanta: formatNumber(gRestanta),
      rataColectare: formatNumber(rataGenerala, 1) + "%",
    },
    generatedAt: formatDate(new Date()),
    parameters: { "An fiscal": year.toString() },
  };
}

// ============================================================================
// CSV export helper
// ============================================================================

export function reportToCsv(report: ReportResult): string {
  const header = report.columns.map((c) => c.label).join(",");
  const rows = report.rows.map((row) =>
    report.columns
      .map((col) => {
        const val = row[col.key];
        if (typeof val === "string" && val.includes(",")) return `"${val}"`;
        return String(val ?? "");
      })
      .join(",")
  );
  return [header, ...rows].join("\n");
}
