import { prisma } from "@/lib/db";
import type {
  BuildingTaxInput,
  TaxCalculationResult,
  TaxRateEntry,
  HclDecisionContext,
  ExemptionContext,
  CommuneRank,
} from "./types";
import {
  applyMultiplierToMicroLei,
  applyPercentToMicroLei,
  calculateTaxableMonths,
  prorateMicroLei,
  roundMicroLeiToLei,
  roundToLei,
  splitInstallments,
  toMicroLei,
  toSafeNumber,
  calculateBonificatie,
  getBuildingAgeCoefficient,
} from "./utils";

/**
 * Commune rank zone multipliers per Art. 457 Cod Fiscal.
 */
const COMMUNE_RANK_MULTIPLIERS: Record<number, number> = {
  0: 2.5, // București
  1: 2.5, // Rang I
  2: 2.0, // Rang II
  3: 1.5, // Rang III
  4: 1.1, // Rang IV
  5: 1.0, // Rang V
};

/**
 * Get commune rank multiplier. Default 1.0 if no rank provided.
 */
export function getCommuneRankMultiplier(rank?: CommuneRank): number {
  if (rank == null) return 1.0;
  return COMMUNE_RANK_MULTIPLIERS[rank] ?? 1.0;
}

/**
 * Get PJ building tax rate based on revaluation date (Art. 460 Cod Fiscal).
 * - Standard rate: 1.0-1.5% if revalued within 5 years
 * - Penalty rate: 5% if not revalued in 5+ years
 * - If revalued within 3 years: standard 1.0%
 * - If revalued 3-5 years ago: 1.5%
 */
export function getPjBuildingRate(
  fiscalYear: number,
  dataUltimeiReevaluari?: Date
): number {
  if (!dataUltimeiReevaluari) {
    // No revaluation recorded => penalty rate
    return 5.0;
  }

  const revalYear = dataUltimeiReevaluari.getFullYear();
  const yearsSinceReval = fiscalYear - revalYear;

  if (yearsSinceReval > 5) {
    return 5.0; // Penalty: not revalued in 5+ years
  }
  if (yearsSinceReval <= 3) {
    return 1.0; // Standard lower bound: revalued recently
  }
  // 3 < years <= 5
  return 1.5; // Standard upper bound
}

/**
 * Calculate building tax per Art. 457-459 Cod Fiscal.
 *
 * For PF (residential):
 *   Tax = valoare_impozabila x rate x age_coefficient x zone_multiplier x cota_parte / 100
 *
 * For PJ (non-residential):
 *   Tax = valoare_inventar x pj_rate x zone_multiplier x cota_parte / 100
 *
 * For mixed:
 *   Proportional split between residential and non-residential
 */
export async function calculateBuildingTax(
  input: BuildingTaxInput,
  hclDecision: HclDecisionContext,
  exemptions: ExemptionContext[]
): Promise<TaxCalculationResult> {
  // 1. Look up rate table
  const taxType = getTaxTypeForBuilding(input.destinatie);
  const rateEntry = await findRateTableEntry(
    input.tenantId,
    hclDecision.id,
    taxType,
    input.tipConstructie,
    input.zona
  );

  if (!rateEntry) {
    throw new Error(
      `No rate table entry found for building tax: type=${taxType}, construction=${input.tipConstructie}, zone=${input.zona}`
    );
  }

  // 2. Calculate base
  let bazaImpozabila: number;
  let rataAplicata: number;

  if (input.tipContribuabil === "PJ" && input.destinatie === "nerezidentiala") {
    // PJ path: use valoareInventar with date-bounded rate (Art. 460)
    bazaImpozabila = input.valoareInventar ?? input.valoareImpozabila ?? 0;
    rataAplicata = getPjBuildingRate(input.fiscalYear, input.dataUltimeiReevaluari);
  } else if (input.destinatie === "nerezidentiala") {
    bazaImpozabila = input.valoareInventar ?? input.valoareImpozabila ?? 0;
    rataAplicata = rateEntry.rateValue;
  } else if (input.destinatie === "rezidentiala") {
    bazaImpozabila = input.valoareImpozabila ?? 0;
    rataAplicata = rateEntry.rateValue;
  } else {
    // Mixed: proportional
    bazaImpozabila = input.valoareImpozabila ?? 0;
    rataAplicata = rateEntry.rateValue;
  }

  // 3. Apply rate in micro-lei to preserve Decimal(12,6) precision.
  let sumaCalculataMicroLei = applyPercentToMicroLei(toMicroLei(bazaImpozabila), rataAplicata);

  // 4. Apply age coefficient (Art. 457) — PF only
  if (input.tipContribuabil !== "PJ") {
    const ageCoeff = getBuildingAgeCoefficient(input.anConstructie, input.fiscalYear);
    sumaCalculataMicroLei = applyMultiplierToMicroLei(sumaCalculataMicroLei, ageCoeff);
  }

  // 4b. Apply commune rank zone multiplier (Art. 457)
  const zoneMultiplier = getCommuneRankMultiplier(input.communeRank);
  sumaCalculataMicroLei = applyMultiplierToMicroLei(sumaCalculataMicroLei, zoneMultiplier);

  // 5. Apply co-ownership
  sumaCalculataMicroLei = applyPercentToMicroLei(sumaCalculataMicroLei, input.cotaParte);

  // 6. Apply partial year proration
  const { months, startDate, endDate } = calculateTaxableMonths(
    input.fiscalYear,
    input.dataDobandire,
    input.dataInstrainare
  );
  const sumaCalculata = roundMicroLeiToLei(prorateMicroLei(sumaCalculataMicroLei, months));

  // 7. Apply exemptions
  let sumaScutire = 0;
  const sumaCalculataMicroLeiRounded = toMicroLei(sumaCalculata);
  for (const exemption of exemptions) {
    sumaScutire += roundMicroLeiToLei(
      applyPercentToMicroLei(sumaCalculataMicroLeiRounded, exemption.discountPercent)
    );
  }
  sumaScutire = Math.min(sumaScutire, sumaCalculata);

  // 8. Calculate final amount
  const sumaDatorata = roundToLei(sumaCalculata - sumaScutire);

  // 9. Calculate bonificatie
  const bonificatie = calculateBonificatie(sumaDatorata);

  // 10. Split installments
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

function getTaxTypeForBuilding(destinatie: string): string {
  switch (destinatie) {
    case "rezidentiala":
      return "impozit_cladiri_rezidentiale";
    case "nerezidentiala":
      return "impozit_cladiri_nerezidentiale";
    case "mixta":
      return "impozit_cladiri_mixte";
    default:
      return "impozit_cladiri_rezidentiale";
  }
}

async function findRateTableEntry(
  tenantId: string,
  hclDecisionId: string,
  taxType: string,
  category: string,
  zona: string
): Promise<TaxRateEntry | null> {
  const entry = await prisma.taxRateTable.findFirst({
    where: {
      tenantId,
      hclDecisionId,
      taxType,
      category,
      zona,
    },
  });

  if (!entry) {
    // Try without category (fallback)
    const fallback = await prisma.taxRateTable.findFirst({
      where: {
        tenantId,
        hclDecisionId,
        taxType,
        zona,
        category: null,
      },
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
      category: fallback.category ?? undefined,
      zona: fallback.zona ?? undefined,
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
    category: entry.category ?? undefined,
    zona: entry.zona ?? undefined,
  };
}
