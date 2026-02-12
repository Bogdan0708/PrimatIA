export * from "./types";
export * from "./utils";
export { calculateBuildingTax } from "./building-tax";
export { calculateLandTax } from "./land-tax";
export { calculateVehicleTax } from "./vehicle-tax";

import { prisma } from "@/lib/db";
import { calculateBuildingTax } from "./building-tax";
import { calculateLandTax } from "./land-tax";
import { calculateVehicleTax } from "./vehicle-tax";
import type {
  BuildingTaxInput,
  HclDecisionContext,
  ExemptionContext,
  TaxCalculationResult,
} from "./types";

/**
 * Resolve the active HCL decision for a given tenant and fiscal year.
 */
export async function resolveActiveHcl(
  tenantId: string,
  fiscalYear: number
): Promise<HclDecisionContext | null> {
  const hcl = await prisma.hclDecision.findFirst({
    where: {
      tenantId,
      fiscalYear,
      status: "active",
    },
    orderBy: { validFrom: "desc" },
  });

  if (!hcl) return null;

  return {
    id: hcl.id,
    fiscalYear: hcl.fiscalYear,
    inflationIndex: hcl.inflationIndex ? Number(hcl.inflationIndex) : undefined,
  };
}

/**
 * Get applicable exemptions for a contribuabil for a given fiscal year.
 */
export async function getApplicableExemptions(
  tenantId: string,
  contribuabilId: string,
  fiscalYear: number,
  proprietateType?: string,
  proprietateId?: string
): Promise<ExemptionContext[]> {
  const exemptions = await prisma.scutireContribuabil.findMany({
    where: {
      tenantId,
      contribuabilId,
      fiscalYear,
      status: "approved",
      OR: [
        { proprietateType: null },
        {
          proprietateType: proprietateType ?? undefined,
          proprietateId: proprietateId ?? undefined,
        },
      ],
    },
    include: {
      scutireRegula: true,
    },
  });

  return exemptions.map((e) => ({
    discountPercent: Number(e.scutireRegula.discountPercent),
    ruleId: e.scutireRegula.id,
    ruleName: e.scutireRegula.nameRo,
  }));
}

/**
 * Calculate all taxes for a single contribuabil for a fiscal year.
 */
export async function calculateAllTaxesForContribuabil(
  tenantId: string,
  contribuabilId: string,
  fiscalYear: number
): Promise<{
  buildings: TaxCalculationResult[];
  land: TaxCalculationResult[];
  vehicles: TaxCalculationResult[];
}> {
  const hcl = await resolveActiveHcl(tenantId, fiscalYear);
  if (!hcl) throw new Error(`No active HCL decision for fiscal year ${fiscalYear}`);

  // Get all active properties
  const [buildings, land, vehicles] = await Promise.all([
    prisma.proprietateCladire.findMany({
      where: { tenantId, contribuabilId, status: "activ", deletedAt: null },
    }),
    prisma.proprietateTeren.findMany({
      where: { tenantId, contribuabilId, status: "activ", deletedAt: null },
    }),
    prisma.proprietateVehicul.findMany({
      where: { tenantId, contribuabilId, status: "activ", deletedAt: null },
    }),
  ]);

  const buildingResults: TaxCalculationResult[] = [];
  for (const b of buildings) {
    const exemptions = await getApplicableExemptions(
      tenantId,
      contribuabilId,
      fiscalYear,
      "cladire",
      b.id
    );
    const result = await calculateBuildingTax(
      {
        buildingId: b.id,
        contribuabilId,
        tenantId,
        fiscalYear,
        destinatie: b.destinatie as BuildingTaxInput["destinatie"],
        tipConstructie: b.tipConstructie,
        anConstructie: b.anConstructie,
        suprafataConstruita: Number(b.suprafataConstruita),
        suprafataDesfasurata: b.suprafataDesfasurata
          ? Number(b.suprafataDesfasurata)
          : undefined,
        valoareImpozabila: b.valoareImpozabila
          ? Number(b.valoareImpozabila)
          : undefined,
        valoareInventar: b.valoareInventar ? Number(b.valoareInventar) : undefined,
        zona: b.zona,
        cotaParte: Number(b.cotaParte),
        dataDobandire: b.dataDobandire,
        dataInstrainare: b.dataInstrainare ?? undefined,
        suprafataRezidentiala: b.suprafataRezidentiala
          ? Number(b.suprafataRezidentiala)
          : undefined,
        suprafataNerezidentiala: b.suprafataNerezidentiala
          ? Number(b.suprafataNerezidentiala)
          : undefined,
      },
      hcl,
      exemptions
    );
    buildingResults.push(result);
  }

  const landResults: TaxCalculationResult[] = [];
  for (const l of land) {
    const exemptions = await getApplicableExemptions(
      tenantId,
      contribuabilId,
      fiscalYear,
      "teren",
      l.id
    );
    const result = await calculateLandTax(
      {
        landId: l.id,
        contribuabilId,
        tenantId,
        fiscalYear,
        categorie: l.categorie,
        suprafataMp: Number(l.suprafataMp),
        zona: l.zona,
        cotaParte: Number(l.cotaParte),
        dataDobandire: l.dataDobandire,
        dataInstrainare: l.dataInstrainare ?? undefined,
      },
      hcl,
      exemptions
    );
    landResults.push(result);
  }

  const vehicleResults: TaxCalculationResult[] = [];
  for (const v of vehicles) {
    const exemptions = await getApplicableExemptions(
      tenantId,
      contribuabilId,
      fiscalYear,
      "vehicul",
      v.id
    );
    const result = await calculateVehicleTax(
      {
        vehicleId: v.id,
        contribuabilId,
        tenantId,
        fiscalYear,
        tipVehicul: v.tipVehicul,
        cilindreeCmc: v.cilindreeCmc ?? undefined,
        putereKw: v.putereKw ? Number(v.putereKw) : undefined,
        masaTotalaKg: v.masaTotalaKg ?? undefined,
        nrLocuri: v.nrLocuri ?? undefined,
        normaPoluare: v.normaPoluare ?? undefined,
        anFabricatie: v.anFabricatie,
        dataDobandire: v.dataDobandire,
        dataInstrainare: v.dataInstrainare ?? undefined,
      },
      hcl,
      exemptions
    );
    vehicleResults.push(result);
  }

  return { buildings: buildingResults, land: landResults, vehicles: vehicleResults };
}
