import { prisma } from "@/lib/db";
import type {
  VehicleTaxInput,
  TaxCalculationResult,
  HclDecisionContext,
  ExemptionContext,
  SuspensionType,
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
 * Trucks: axle-weight table (C2/C3/C4) + suspension type
 * Trailers: axle-weight table (R1/R2/R3/R4) + suspension type
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

/**
 * Truck axle-weight table per Art. 470 Cod Fiscal.
 * Key: "C{axles}_{suspension}" e.g. "C2_pneumatic"
 * Each entry: weight range [minTons, maxTons) -> tax in lei
 */
interface WeightBracket {
  minTons: number;
  maxTons: number;
  tax: number;
}

const TRUCK_WEIGHT_TABLE: Record<string, WeightBracket[]> = {
  // C2 - 2 axe, suspensie pneumatică
  C2_pneumatic: [
    { minTons: 0, maxTons: 12, tax: 0 },
    { minTons: 12, maxTons: 13, tax: 0 },
    { minTons: 13, maxTons: 14, tax: 132 },
    { minTons: 14, maxTons: 15, tax: 148 },
    { minTons: 15, maxTons: 18, tax: 334 },
    { minTons: 18, maxTons: Infinity, tax: 754 },
  ],
  // C2 - 2 axe, altă suspensie
  C2_other: [
    { minTons: 0, maxTons: 12, tax: 0 },
    { minTons: 12, maxTons: 13, tax: 142 },
    { minTons: 13, maxTons: 14, tax: 311 },
    { minTons: 14, maxTons: 15, tax: 438 },
    { minTons: 15, maxTons: 18, tax: 988 },
    { minTons: 18, maxTons: Infinity, tax: 988 },
  ],
  // C3 - 3 axe, suspensie pneumatică
  C3_pneumatic: [
    { minTons: 0, maxTons: 15, tax: 0 },
    { minTons: 15, maxTons: 17, tax: 132 },
    { minTons: 17, maxTons: 19, tax: 271 },
    { minTons: 19, maxTons: 21, tax: 352 },
    { minTons: 21, maxTons: 23, tax: 541 },
    { minTons: 23, maxTons: 25, tax: 842 },
    { minTons: 25, maxTons: 26, tax: 842 },
    { minTons: 26, maxTons: Infinity, tax: 842 },
  ],
  // C3 - 3 axe, altă suspensie
  C3_other: [
    { minTons: 0, maxTons: 15, tax: 0 },
    { minTons: 15, maxTons: 17, tax: 183 },
    { minTons: 17, maxTons: 19, tax: 375 },
    { minTons: 19, maxTons: 21, tax: 487 },
    { minTons: 21, maxTons: 23, tax: 749 },
    { minTons: 23, maxTons: 25, tax: 1164 },
    { minTons: 25, maxTons: 26, tax: 1164 },
    { minTons: 26, maxTons: Infinity, tax: 1164 },
  ],
  // C4 - 4+ axe, suspensie pneumatică
  C4_pneumatic: [
    { minTons: 0, maxTons: 23, tax: 541 },
    { minTons: 23, maxTons: 25, tax: 550 },
    { minTons: 25, maxTons: 27, tax: 855 },
    { minTons: 27, maxTons: 29, tax: 1353 },
    { minTons: 29, maxTons: 31, tax: 2028 },
    { minTons: 31, maxTons: 32, tax: 2028 },
    { minTons: 32, maxTons: Infinity, tax: 2028 },
  ],
  // C4 - 4+ axe, altă suspensie
  C4_other: [
    { minTons: 0, maxTons: 23, tax: 749 },
    { minTons: 23, maxTons: 25, tax: 855 },
    { minTons: 25, maxTons: 27, tax: 1353 },
    { minTons: 27, maxTons: 29, tax: 2138 },
    { minTons: 29, maxTons: 31, tax: 3201 },
    { minTons: 31, maxTons: 32, tax: 3201 },
    { minTons: 32, maxTons: Infinity, tax: 3201 },
  ],
};

/**
 * Trailer (remorcă) axle-weight table per Art. 470 Cod Fiscal.
 */
const TRAILER_WEIGHT_TABLE: Record<string, WeightBracket[]> = {
  // R1 - 1 axă, suspensie pneumatică
  R1_pneumatic: [
    { minTons: 0, maxTons: 10, tax: 0 },
    { minTons: 10, maxTons: Infinity, tax: 0 },
  ],
  // R1 - 1 axă, altă suspensie
  R1_other: [
    { minTons: 0, maxTons: 10, tax: 0 },
    { minTons: 10, maxTons: Infinity, tax: 0 },
  ],
  // R2 - 2 axe, suspensie pneumatică
  R2_pneumatic: [
    { minTons: 0, maxTons: 18, tax: 0 },
    { minTons: 18, maxTons: 20, tax: 60 },
    { minTons: 20, maxTons: 23, tax: 166 },
    { minTons: 23, maxTons: 25, tax: 326 },
    { minTons: 25, maxTons: 28, tax: 572 },
    { minTons: 28, maxTons: Infinity, tax: 572 },
  ],
  // R2 - 2 axe, altă suspensie
  R2_other: [
    { minTons: 0, maxTons: 18, tax: 0 },
    { minTons: 18, maxTons: 20, tax: 85 },
    { minTons: 20, maxTons: 23, tax: 235 },
    { minTons: 23, maxTons: 25, tax: 461 },
    { minTons: 25, maxTons: 28, tax: 808 },
    { minTons: 28, maxTons: Infinity, tax: 808 },
  ],
  // R3 - 3 axe, suspensie pneumatică
  R3_pneumatic: [
    { minTons: 0, maxTons: 24, tax: 166 },
    { minTons: 24, maxTons: 28, tax: 291 },
    { minTons: 28, maxTons: 33, tax: 444 },
    { minTons: 33, maxTons: 38, tax: 616 },
    { minTons: 38, maxTons: Infinity, tax: 616 },
  ],
  // R3 - 3 axe, altă suspensie
  R3_other: [
    { minTons: 0, maxTons: 24, tax: 235 },
    { minTons: 24, maxTons: 28, tax: 406 },
    { minTons: 28, maxTons: 33, tax: 616 },
    { minTons: 33, maxTons: 38, tax: 855 },
    { minTons: 38, maxTons: Infinity, tax: 855 },
  ],
  // R4 - 4+ axe, suspensie pneumatică
  R4_pneumatic: [
    { minTons: 0, maxTons: 29, tax: 291 },
    { minTons: 29, maxTons: 31, tax: 513 },
    { minTons: 31, maxTons: 33, tax: 510 },
    { minTons: 33, maxTons: 36, tax: 751 },
    { minTons: 36, maxTons: 38, tax: 751 },
    { minTons: 38, maxTons: Infinity, tax: 751 },
  ],
  // R4 - 4+ axe, altă suspensie
  R4_other: [
    { minTons: 0, maxTons: 29, tax: 406 },
    { minTons: 29, maxTons: 31, tax: 616 },
    { minTons: 31, maxTons: 33, tax: 751 },
    { minTons: 33, maxTons: 36, tax: 1118 },
    { minTons: 36, maxTons: 38, tax: 1472 },
    { minTons: 38, maxTons: Infinity, tax: 1472 },
  ],
};

/**
 * Get truck axle category from number of axles.
 */
export function getTruckAxleCategory(nrAxe: number): "C2" | "C3" | "C4" {
  if (nrAxe <= 2) return "C2";
  if (nrAxe === 3) return "C3";
  return "C4";
}

/**
 * Get trailer axle category from number of axles.
 */
export function getTrailerAxleCategory(nrAxe: number): "R1" | "R2" | "R3" | "R4" {
  if (nrAxe <= 1) return "R1";
  if (nrAxe === 2) return "R2";
  if (nrAxe === 3) return "R3";
  return "R4";
}

/**
 * Look up tax from weight table given tons and table key.
 */
export function lookupWeightTax(
  table: Record<string, WeightBracket[]>,
  key: string,
  tons: number
): number {
  const brackets = table[key];
  if (!brackets) return 0;
  for (const bracket of brackets) {
    if (tons >= bracket.minTons && tons < bracket.maxTons) {
      return bracket.tax;
    }
  }
  // If beyond all brackets, use the last bracket's tax
  return brackets[brackets.length - 1]?.tax ?? 0;
}

/**
 * Calculate truck tax per Art. 470 using axle-weight tables.
 * Falls back to DB rate lookup if nrAxe is not provided (legacy behavior).
 */
function calculateTruckTax(input: VehicleTaxInput): {
  bazaImpozabila: number;
  rataAplicata: number;
  sumaCalculata: number;
  category: string;
  usesWeightTable: true;
} | null {
  if (input.nrAxe == null || input.nrAxe < 2) return null;
  const tons = (input.masaTotalaKg ?? 0) / 1000;
  const suspension: SuspensionType = input.tipSuspensie ?? "other";
  const axleCategory = getTruckAxleCategory(input.nrAxe);
  const key = `${axleCategory}_${suspension}`;
  const tax = lookupWeightTax(TRUCK_WEIGHT_TABLE, key, tons);
  return {
    bazaImpozabila: tons,
    rataAplicata: tax, // the looked-up value IS the tax
    sumaCalculata: tax,
    category: `camion_${key}`,
    usesWeightTable: true,
  };
}

/**
 * Calculate trailer tax per Art. 470 using axle-weight tables.
 */
function calculateTrailerTax(input: VehicleTaxInput): {
  bazaImpozabila: number;
  rataAplicata: number;
  sumaCalculata: number;
  category: string;
  usesWeightTable: true;
} | null {
  const nrAxe = input.nrAxe ?? 1;
  const tons = (input.masaTotalaKg ?? 0) / 1000;
  const suspension: SuspensionType = input.tipSuspensie ?? "other";
  const axleCategory = getTrailerAxleCategory(nrAxe);
  const key = `${axleCategory}_${suspension}`;
  const tax = lookupWeightTax(TRAILER_WEIGHT_TABLE, key, tons);
  return {
    bazaImpozabila: tons,
    rataAplicata: tax,
    sumaCalculata: tax,
    category: `remorca_${key}`,
    usesWeightTable: true,
  };
}

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
    // Try axle-weight table first (Art. 470 proper)
    const truckResult = calculateTruckTax(input);
    if (truckResult) {
      bazaImpozabila = truckResult.bazaImpozabila;
      rataAplicata = truckResult.rataAplicata;
      sumaCalculata = truckResult.sumaCalculata;
      category = truckResult.category;
      rateTableId = `weight_table_${category}`;
    } else {
      // Legacy fallback: flat per-ton from DB
      category = "camion";
      const rateEntry = await findVehicleRate(
        input.tenantId,
        hclDecision.id,
        taxType,
        category
      );
      if (!rateEntry) throw new Error(`No rate for vehicle: ${category}`);

      rateTableId = rateEntry.id;
      bazaImpozabila = (input.masaTotalaKg ?? 0) / 1000;
      rataAplicata = Number(rateEntry.rateValue);
      sumaCalculata = bazaImpozabila * rataAplicata;
    }
  } else if (input.tipVehicul === "remorca") {
    // Trailer: axle-weight table (Art. 470)
    const trailerResult = calculateTrailerTax(input);
    if (trailerResult) {
      bazaImpozabila = trailerResult.bazaImpozabila;
      rataAplicata = trailerResult.rataAplicata;
      sumaCalculata = trailerResult.sumaCalculata;
      category = trailerResult.category;
      rateTableId = `weight_table_${category}`;
    } else {
      // Fallback: flat rate from DB
      category = "remorca";
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
  } else {
    // Tractor, etc. -- flat rate by category
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

  // Apply Euro norm adjustment (not applied to weight-table trucks/trailers)
  const isWeightTable = rateTableId.startsWith("weight_table_");
  if (!isWeightTable) {
    const normAdjustment = EURO_NORM_ADJUSTMENTS[input.normaPoluare ?? "euro_4"] ?? 1.0;
    sumaCalculata = sumaCalculata * normAdjustment;
  }

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

// Exported for testing
export { TRUCK_WEIGHT_TABLE, TRAILER_WEIGHT_TABLE };

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
