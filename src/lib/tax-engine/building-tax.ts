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
  exemptionAppliesToTaxType,
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
  defaultRate: number,
  fiscalYear: number,
  maxConfiguredRate: number | undefined,
  dataUltimeiReevaluari?: Date
): number {
  if (!dataUltimeiReevaluari) {
    return Math.max(maxConfiguredRate ?? defaultRate, 5.0);
  }

  const revalYear = dataUltimeiReevaluari.getFullYear();
  const yearsSinceReval = fiscalYear - revalYear;

  if (yearsSinceReval > 5) {
    return Math.max(maxConfiguredRate ?? defaultRate, 5.0);
  }

  return defaultRate;
}

function resolveMixedUseShares(input: BuildingTaxInput): {
  residentialShare: number;
  nonResidentialShare: number;
} {
  const totalSurface = input.suprafataDesfasurata ?? input.suprafataConstruita;
  let residentialSurface = input.suprafataRezidentiala ?? 0;
  let nonResidentialSurface = input.suprafataNerezidentiala ?? 0;

  if (residentialSurface <= 0 && nonResidentialSurface <= 0) {
    throw new Error("Mixed-use buildings require residential or non-residential area data");
  }

  if (residentialSurface <= 0 && nonResidentialSurface > 0 && totalSurface > nonResidentialSurface) {
    residentialSurface = totalSurface - nonResidentialSurface;
  }

  if (nonResidentialSurface <= 0 && residentialSurface > 0 && totalSurface > residentialSurface) {
    nonResidentialSurface = totalSurface - residentialSurface;
  }

  const totalDeclaredSurface = residentialSurface + nonResidentialSurface;
  if (totalDeclaredSurface <= 0) {
    throw new Error("Mixed-use building surface split is invalid");
  }

  return {
    residentialShare: residentialSurface / totalDeclaredSurface,
    nonResidentialShare: nonResidentialSurface / totalDeclaredSurface,
  };
}

function calculateExemptionForTaxType(
  amountLei: number,
  exemptions: ExemptionContext[],
  taxType: string
): number {
  let totalExemptionLei = 0;
  const amountMicroLei = toMicroLei(amountLei);
  for (const exemption of exemptions) {
    if (!exemptionAppliesToTaxType(exemption, taxType)) continue;
    totalExemptionLei += roundMicroLeiToLei(
      applyPercentToMicroLei(amountMicroLei, exemption.discountPercent)
    );
  }
  return Math.min(totalExemptionLei, amountLei);
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
  // 2. Calculate base
  let bazaImpozabila: number;
  let rataAplicata: number;
  let rateTableId: string;

  if (input.destinatie === "mixta") {
    // Art. 459: Split the taxable base by surface area, tax each part separately
    const [residentialRateEntry, nonResidentialRateEntry] = await Promise.all([
      findRateTableEntry(
        input.tenantId,
        hclDecision.id,
        "impozit_cladiri_rezidentiale",
        input.tipConstructie,
        input.zona
      ),
      findRateTableEntry(
        input.tenantId,
        hclDecision.id,
        "impozit_cladiri_nerezidentiale",
        input.tipConstructie,
        input.zona
      ),
    ]);

    if (!residentialRateEntry || !nonResidentialRateEntry) {
      throw new Error(
        `No rate table entry found for mixed building tax: construction=${input.tipConstructie}, zone=${input.zona}`
      );
    }

    const { residentialShare, nonResidentialShare } = resolveMixedUseShares(input);
    const totalBase = input.valoareImpozabila ?? input.valoareInventar ?? 0;
    // Split the taxable base proportionally by surface
    const residentialBase = totalBase * residentialShare;
    const nonResidentialBase = totalBase * nonResidentialShare;

    const residentialRate = residentialRateEntry.rateValue;
    const nonResidentialRate =
      input.tipContribuabil === "PJ"
        ? getPjBuildingRate(
            nonResidentialRateEntry.rateValue,
            input.fiscalYear,
            nonResidentialRateEntry.maxRate,
            input.dataUltimeiReevaluari
          )
        : nonResidentialRateEntry.rateValue;

    // Store the total base and the dominant rate for the record
    bazaImpozabila = totalBase;
    rataAplicata =
      residentialRate * residentialShare +
      nonResidentialRate * nonResidentialShare;
    rateTableId =
      residentialShare >= nonResidentialShare
        ? residentialRateEntry.id
        : nonResidentialRateEntry.id;

    // Calculate each portion separately, then sum (Art. 459 compliant)
    let resMicroLei = applyPercentToMicroLei(toMicroLei(residentialBase), residentialRate);
    let nonResMicroLei = applyPercentToMicroLei(toMicroLei(nonResidentialBase), nonResidentialRate);

    // Age coefficient applies only to PF residential portion
    if (input.tipContribuabil !== "PJ") {
      const ageCoeff = getBuildingAgeCoefficient(input.anConstructie, input.fiscalYear);
      resMicroLei = applyMultiplierToMicroLei(resMicroLei, ageCoeff);
    }

    // Zone multiplier applies to both portions
    const zoneMultiplier = getCommuneRankMultiplier(input.communeRank);
    resMicroLei = applyMultiplierToMicroLei(resMicroLei, zoneMultiplier);
    nonResMicroLei = applyMultiplierToMicroLei(nonResMicroLei, zoneMultiplier);

    // Inflation index
    if (hclDecision.inflationIndex && hclDecision.inflationIndex > 0) {
      resMicroLei = Math.round(resMicroLei * hclDecision.inflationIndex);
      nonResMicroLei = Math.round(nonResMicroLei * hclDecision.inflationIndex);
    }

    // Co-ownership
    resMicroLei = applyPercentToMicroLei(resMicroLei, input.cotaParte);
    nonResMicroLei = applyPercentToMicroLei(nonResMicroLei, input.cotaParte);

    // Proration
    const { months, startDate, endDate } = calculateTaxableMonths(
      input.fiscalYear,
      input.dataDobandire,
      input.dataInstrainare
    );
    const residentialLei = roundMicroLeiToLei(prorateMicroLei(resMicroLei, months));
    const nonResidentialLei = roundMicroLeiToLei(prorateMicroLei(nonResMicroLei, months));
    const sumaCalculata = residentialLei + nonResidentialLei;

    // Exemptions
    let sumaScutire =
      calculateExemptionForTaxType(
        residentialLei,
        exemptions,
        "impozit_cladiri_rezidentiale"
      ) +
      calculateExemptionForTaxType(
        nonResidentialLei,
        exemptions,
        "impozit_cladiri_nerezidentiale"
      );
    sumaScutire = Math.min(sumaScutire, sumaCalculata);

    const sumaDatorata = roundToLei(sumaCalculata - sumaScutire);
    const bonificatie = calculateBonificatie(sumaDatorata, hclDecision.bonificatieProcent);
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
      rateTableId,
    };
  } else {
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

    if (input.tipContribuabil === "PJ" && input.destinatie === "nerezidentiala") {
      bazaImpozabila = input.valoareInventar ?? input.valoareImpozabila ?? 0;
      rataAplicata = getPjBuildingRate(
        rateEntry.rateValue,
        input.fiscalYear,
        rateEntry.maxRate,
        input.dataUltimeiReevaluari
      );
    } else if (input.destinatie === "nerezidentiala") {
      bazaImpozabila = input.valoareInventar ?? input.valoareImpozabila ?? 0;
      rataAplicata = rateEntry.rateValue;
    } else {
      bazaImpozabila = input.valoareImpozabila ?? 0;
      rataAplicata = rateEntry.rateValue;
    }

    rateTableId = rateEntry.id;
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

  // 4c. Apply HCL inflation coefficient when configured
  if (hclDecision.inflationIndex && hclDecision.inflationIndex > 0) {
    sumaCalculataMicroLei = Math.round(sumaCalculataMicroLei * hclDecision.inflationIndex);
  }

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
  const taxType = getTaxTypeForBuilding(input.destinatie);
  for (const exemption of exemptions) {
    if (!exemptionAppliesToTaxType(exemption, taxType)) continue;
    sumaScutire += roundMicroLeiToLei(
      applyPercentToMicroLei(sumaCalculataMicroLeiRounded, exemption.discountPercent)
    );
  }
  sumaScutire = Math.min(sumaScutire, sumaCalculata);

  // 8. Calculate final amount
  const sumaDatorata = roundToLei(sumaCalculata - sumaScutire);

  // 9. Calculate bonificatie
  const bonificatie = calculateBonificatie(sumaDatorata, hclDecision.bonificatieProcent);

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
    rateTableId,
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
