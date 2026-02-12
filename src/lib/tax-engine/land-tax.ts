import { prisma } from "@/lib/db";
import type {
  LandTaxInput,
  TaxCalculationResult,
  TaxRateEntry,
  HclDecisionContext,
  ExemptionContext,
} from "./types";
import {
  calculateTaxableMonths,
  roundToLei,
  splitInstallments,
  calculateBonificatie,
} from "./utils";

/**
 * Calculate land tax per Art. 465 Cod Fiscal.
 * Tax = rate_per_mp x suprafata_mp x cota_parte / 100
 * Rate depends on zone and land category.
 */
export async function calculateLandTax(
  input: LandTaxInput,
  hclDecision: HclDecisionContext,
  exemptions: ExemptionContext[]
): Promise<TaxCalculationResult> {
  // 1. Determine tax type
  const taxType = input.categorie.startsWith("extravilan")
    ? "impozit_teren_extravilan"
    : input.categorie.includes("curti")
      ? "impozit_teren_curti"
      : "impozit_teren_intravilan";

  // 2. Look up rate
  const rateEntry = await findLandRateEntry(
    input.tenantId,
    hclDecision.id,
    taxType,
    input.categorie,
    input.zona
  );

  if (!rateEntry) {
    throw new Error(
      `No rate table entry found for land tax: type=${taxType}, category=${input.categorie}, zone=${input.zona}`
    );
  }

  // 3. Calculate base (area in mp)
  const bazaImpozabila = input.suprafataMp;

  // 4. Apply rate (lei per m2 or lei per ha)
  const rataAplicata = rateEntry.rateValue;
  let sumaCalculata: number;
  if (rateEntry.unit === "lei/ha") {
    sumaCalculata = (bazaImpozabila / 10000) * rataAplicata;
  } else {
    // lei/mp
    sumaCalculata = bazaImpozabila * rataAplicata;
  }

  // 5. Apply co-ownership
  sumaCalculata = sumaCalculata * (input.cotaParte / 100);

  // 6. Partial year proration
  const { months, startDate, endDate } = calculateTaxableMonths(
    input.fiscalYear,
    input.dataDobandire,
    input.dataInstrainare
  );
  sumaCalculata = roundToLei((sumaCalculata * months) / 12);

  // 7. Exemptions
  let sumaScutire = 0;
  for (const exemption of exemptions) {
    sumaScutire += roundToLei(sumaCalculata * (exemption.discountPercent / 100));
  }
  sumaScutire = Math.min(sumaScutire, sumaCalculata);

  // 8. Final
  const sumaDatorata = roundToLei(sumaCalculata - sumaScutire);
  const bonificatie = calculateBonificatie(sumaDatorata);
  const { rata1, rata1Scadenta, rata2, rata2Scadenta } = splitInstallments(
    sumaDatorata,
    input.fiscalYear
  );

  return {
    bazaImpozabila,
    rataAplicata,
    sumaCalculata,
    sumaScutire,
    bonificatie,
    sumaDatorata,
    nrLuni: months,
    rata1,
    rata1Scadenta,
    rata2,
    rata2Scadenta,
    dataStartCalcul: startDate,
    dataStopCalcul: endDate,
    hclDecisionId: hclDecision.id,
    rateTableId: rateEntry.id,
  };
}

async function findLandRateEntry(
  tenantId: string,
  hclDecisionId: string,
  taxType: string,
  category: string,
  zona: string
): Promise<TaxRateEntry | null> {
  const entry = await prisma.taxRateTable.findFirst({
    where: { tenantId, hclDecisionId, taxType, category, zona },
  });
  if (!entry) {
    const fallback = await prisma.taxRateTable.findFirst({
      where: { tenantId, hclDecisionId, taxType, zona, category: null },
    });
    if (!fallback) return null;
    return {
      id: fallback.id,
      rateType: fallback.rateType,
      rateValue: Number(fallback.rateValue),
      unit: fallback.unit ?? undefined,
      minRate: fallback.minRate ? Number(fallback.minRate) : undefined,
      maxRate: fallback.maxRate ? Number(fallback.maxRate) : undefined,
    };
  }
  return {
    id: entry.id,
    rateType: entry.rateType,
    rateValue: Number(entry.rateValue),
    unit: entry.unit ?? undefined,
    minRate: entry.minRate ? Number(entry.minRate) : undefined,
    maxRate: entry.maxRate ? Number(entry.maxRate) : undefined,
  };
}
