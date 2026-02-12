import { prisma } from "@/lib/db";
import type {
  BuildingTaxInput,
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
  getBuildingAgeCoefficient,
} from "./utils";

/**
 * Calculate building tax per Art. 457-459 Cod Fiscal.
 *
 * For PF (residential):
 *   Tax = valoare_impozabila x rate x age_coefficient x cota_parte / 100
 *
 * For PJ (non-residential):
 *   Tax = valoare_inventar x rate x cota_parte / 100
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
  if (input.destinatie === "rezidentiala") {
    bazaImpozabila = input.valoareImpozabila ?? 0;
  } else if (input.destinatie === "nerezidentiala") {
    bazaImpozabila = input.valoareInventar ?? input.valoareImpozabila ?? 0;
  } else {
    // Mixed: proportional
    bazaImpozabila = input.valoareImpozabila ?? 0;
  }

  // 3. Apply rate
  const rataAplicata = rateEntry.rateValue;
  let sumaCalculata = bazaImpozabila * (rataAplicata / 100);

  // 4. Apply age coefficient (Art. 457)
  const ageCoeff = getBuildingAgeCoefficient(input.anConstructie, input.fiscalYear);
  sumaCalculata = sumaCalculata * ageCoeff;

  // 5. Apply co-ownership
  sumaCalculata = sumaCalculata * (input.cotaParte / 100);

  // 6. Apply partial year proration
  const { months, startDate, endDate } = calculateTaxableMonths(
    input.fiscalYear,
    input.dataDobandire,
    input.dataInstrainare
  );
  sumaCalculata = roundToLei((sumaCalculata * months) / 12);

  // 7. Apply exemptions
  let sumaScutire = 0;
  for (const exemption of exemptions) {
    sumaScutire += roundToLei(sumaCalculata * (exemption.discountPercent / 100));
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
      rateValue: Number(fallback.rateValue),
      unit: fallback.unit ?? undefined,
      minRate: fallback.minRate ? Number(fallback.minRate) : undefined,
      maxRate: fallback.maxRate ? Number(fallback.maxRate) : undefined,
      category: fallback.category ?? undefined,
      zona: fallback.zona ?? undefined,
    };
  }

  return {
    id: entry.id,
    rateType: entry.rateType,
    rateValue: Number(entry.rateValue),
    unit: entry.unit ?? undefined,
    minRate: entry.minRate ? Number(entry.minRate) : undefined,
    maxRate: entry.maxRate ? Number(entry.maxRate) : undefined,
    category: entry.category ?? undefined,
    zona: entry.zona ?? undefined,
  };
}
