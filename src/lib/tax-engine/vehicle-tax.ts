import { prisma } from "@/lib/db";
import type {
  VehicleTaxInput,
  TaxCalculationResult,
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
 * Vehicle tax brackets per Art. 470 Cod Fiscal.
 * Cars: per each 200 cm3 bracket
 * Buses: per seat
 * Trucks: per ton of total authorized mass
 * Motorcycles: flat rate by engine size bracket
 */

// Default Art. 470 bracket rates (these are the legal ranges, actual rates set by HCL)
const CAR_BRACKETS = [
  { minCmc: 0, maxCmc: 1600, label: "sub_1600" },
  { minCmc: 1601, maxCmc: 2000, label: "1601_2000" },
  { minCmc: 2001, maxCmc: 2600, label: "2001_2600" },
  { minCmc: 2601, maxCmc: 3000, label: "2601_3000" },
  { minCmc: 3001, maxCmc: Infinity, label: "peste_3000" },
] as const;

const MOTORCYCLE_BRACKETS = [
  { minCmc: 0, maxCmc: 200, label: "sub_200" },
  { minCmc: 201, maxCmc: 500, label: "201_500" },
  { minCmc: 501, maxCmc: Infinity, label: "peste_500" },
] as const;

// Euro norm adjustment factors (surcharges/discounts)
const EURO_NORM_ADJUSTMENTS: Record<string, number> = {
  non_euro: 1.5, // +50%
  euro_1: 1.3,
  euro_2: 1.2,
  euro_3: 1.1,
  euro_4: 1.0,
  euro_5: 0.95,
  euro_6: 0.9,
};

export async function calculateVehicleTax(
  input: VehicleTaxInput,
  hclDecision: HclDecisionContext,
  exemptions: ExemptionContext[]
): Promise<TaxCalculationResult> {
  const taxType = "impozit_mijloace_transport";

  let bazaImpozabila: number;
  let rataAplicata: number;
  let sumaCalculata: number;
  let rateTableId = "";
  let category = "";

  if (input.tipVehicul === "autoturism") {
    // Per 200 cm3 bracket
    const cmc = input.cilindreeCmc ?? 0;
    const bracket =
      CAR_BRACKETS.find((b) => cmc >= b.minCmc && cmc <= b.maxCmc) ?? CAR_BRACKETS[0];
    category = `autoturism_${bracket.label}`;

    const rateEntry = await findVehicleRate(
      input.tenantId,
      hclDecision.id,
      taxType,
      category
    );
    if (!rateEntry) throw new Error(`No rate for vehicle: ${category}`);

    rateTableId = rateEntry.id;
    bazaImpozabila = cmc;
    rataAplicata = Number(rateEntry.rateValue);

    // Rate is per 200 cm3
    const units = Math.ceil(cmc / 200);
    sumaCalculata = units * rataAplicata;
  } else if (input.tipVehicul === "motocicleta") {
    const cmc = input.cilindreeCmc ?? 0;
    const bracket =
      MOTORCYCLE_BRACKETS.find((b) => cmc >= b.minCmc && cmc <= b.maxCmc) ??
      MOTORCYCLE_BRACKETS[0];
    category = `motocicleta_${bracket.label}`;

    const rateEntry = await findVehicleRate(
      input.tenantId,
      hclDecision.id,
      taxType,
      category
    );
    if (!rateEntry) throw new Error(`No rate for vehicle: ${category}`);

    rateTableId = rateEntry.id;
    bazaImpozabila = cmc;
    rataAplicata = Number(rateEntry.rateValue);
    sumaCalculata = rataAplicata; // Flat rate for motorcycles
  } else if (input.tipVehicul === "autobuz") {
    category = "autobuz";
    const rateEntry = await findVehicleRate(
      input.tenantId,
      hclDecision.id,
      taxType,
      category
    );
    if (!rateEntry) throw new Error(`No rate for vehicle: ${category}`);

    rateTableId = rateEntry.id;
    bazaImpozabila = input.nrLocuri ?? 0;
    rataAplicata = Number(rateEntry.rateValue);
    sumaCalculata = bazaImpozabila * rataAplicata; // Per seat
  } else if (input.tipVehicul === "camion") {
    category = "camion";
    const rateEntry = await findVehicleRate(
      input.tenantId,
      hclDecision.id,
      taxType,
      category
    );
    if (!rateEntry) throw new Error(`No rate for vehicle: ${category}`);

    rateTableId = rateEntry.id;
    bazaImpozabila = (input.masaTotalaKg ?? 0) / 1000; // Convert to tons
    rataAplicata = Number(rateEntry.rateValue);
    sumaCalculata = bazaImpozabila * rataAplicata; // Per ton
  } else {
    // Tractor, remorca, etc. -- flat rate by category
    category = input.tipVehicul;
    const rateEntry = await findVehicleRate(
      input.tenantId,
      hclDecision.id,
      taxType,
      category
    );
    if (!rateEntry) throw new Error(`No rate for vehicle: ${category}`);

    rateTableId = rateEntry.id;
    bazaImpozabila = 1;
    rataAplicata = Number(rateEntry.rateValue);
    sumaCalculata = rataAplicata;
  }

  // Apply Euro norm adjustment
  const normAdjustment = EURO_NORM_ADJUSTMENTS[input.normaPoluare ?? "euro_4"] ?? 1.0;
  sumaCalculata = sumaCalculata * normAdjustment;

  // Partial year proration
  const { months, startDate, endDate } = calculateTaxableMonths(
    input.fiscalYear,
    input.dataDobandire,
    input.dataInstrainare
  );
  sumaCalculata = roundToLei((sumaCalculata * months) / 12);

  // Exemptions
  let sumaScutire = 0;
  for (const exemption of exemptions) {
    sumaScutire += roundToLei(sumaCalculata * (exemption.discountPercent / 100));
  }
  sumaScutire = Math.min(sumaScutire, sumaCalculata);

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
    rateTableId,
  };
}

async function findVehicleRate(
  tenantId: string,
  hclDecisionId: string,
  taxType: string,
  category: string
) {
  return prisma.taxRateTable.findFirst({
    where: { tenantId, hclDecisionId, taxType, category },
  });
}
