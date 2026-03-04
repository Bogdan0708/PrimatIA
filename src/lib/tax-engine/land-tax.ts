import { prisma } from "@/lib/db";
import type {
  LandTaxInput,
  TaxCalculationResult,
  TaxRateEntry,
  HclDecisionContext,
  ExemptionContext,
} from "./types";
import {
  applyPercentToMicroLei,
  calculateTaxableMonths,
  prorateMicroLei,
  roundMicroLeiToLei,
  roundToLei,
  splitInstallments,
  calculateBonificatie,
  toMicroLei,
  toSafeNumber,
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

  // 4. Apply rate (lei per m2 or lei per ha) in micro-lei arithmetic
  const rataAplicata = rateEntry.rateValue;
  let sumaCalculataMicroLei: number;
  if (rateEntry.unit === "lei/ha") {
    sumaCalculataMicroLei = (bazaImpozabila * toMicroLei(rataAplicata)) / 10000;
  } else {
    // lei/mp
    sumaCalculataMicroLei = bazaImpozabila * toMicroLei(rataAplicata);
  }

  // 5. Apply co-ownership
  sumaCalculataMicroLei = applyPercentToMicroLei(sumaCalculataMicroLei, input.cotaParte);

  // 6. Partial year proration
  const { months, startDate, endDate } = calculateTaxableMonths(
    input.fiscalYear,
    input.dataDobandire,
    input.dataInstrainare
  );
  const sumaCalculata = roundMicroLeiToLei(prorateMicroLei(sumaCalculataMicroLei, months));

  // 7. Exemptions
  let sumaScutire = 0;
  const sumaCalculataMicroLeiRounded = toMicroLei(sumaCalculata);
  for (const exemption of exemptions) {
    sumaScutire += roundMicroLeiToLei(
      applyPercentToMicroLei(sumaCalculataMicroLeiRounded, exemption.discountPercent)
    );
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
      rateValue: toSafeNumber(fallback.rateValue, "taxRateTable.rateValue"),
      unit: fallback.unit ?? undefined,
      minRate: fallback.minRate != null
        ? toSafeNumber(fallback.minRate, "taxRateTable.minRate")
        : undefined,
      maxRate: fallback.maxRate != null
        ? toSafeNumber(fallback.maxRate, "taxRateTable.maxRate")
        : undefined,
    };
  }
  return {
    id: entry.id,
    rateType: entry.rateType,
    rateValue: toSafeNumber(entry.rateValue, "taxRateTable.rateValue"),
    unit: entry.unit ?? undefined,
    minRate: entry.minRate != null
      ? toSafeNumber(entry.minRate, "taxRateTable.minRate")
      : undefined,
    maxRate: entry.maxRate != null
      ? toSafeNumber(entry.maxRate, "taxRateTable.maxRate")
      : undefined,
  };
}
