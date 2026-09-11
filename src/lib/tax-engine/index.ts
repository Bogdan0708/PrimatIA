export * from "./types";
export * from "./utils";
export { TaxConfigurationError } from "./errors";
export { calculateBuildingTax } from "./building-tax";
export { calculateLandTax } from "./land-tax";
export { calculateVehicleTax } from "./vehicle-tax";

import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { calculateBuildingTax } from "./building-tax";
import { calculateLandTax } from "./land-tax";
import { calculateVehicleTax } from "./vehicle-tax";
import { TaxConfigurationError } from "./errors";
import { toSafeNumber } from "./utils";
import { normalizeVehicleType } from "@/lib/vehicle-normalization";
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
      status: { in: ["active", "activ"] },
    },
    orderBy: { validFrom: "desc" },
  });

  if (!hcl) return null;

  return {
    id: hcl.id,
    fiscalYear: hcl.fiscalYear,
    inflationIndex: hcl.inflationIndex != null
      ? toSafeNumber(hcl.inflationIndex, "hclDecision.inflationIndex")
      : undefined,
    bonificatieProcent: hcl.bonificatieProcent != null
      ? toSafeNumber(hcl.bonificatieProcent, "hclDecision.bonificatieProcent")
      : undefined,
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
    discountPercent: toSafeNumber(
      e.scutireRegula.discountPercent,
      "scutireRegula.discountPercent"
    ),
    ruleId: e.scutireRegula.id,
    ruleName: e.scutireRegula.nameRo,
    taxTypes: e.scutireRegula.taxTypes,
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
  buildings: (TaxCalculationResult | null)[];
  land: (TaxCalculationResult | null)[];
  vehicles: (TaxCalculationResult | null)[];
  errors: { propertyType: string; propertyId: string; error: string }[];
}> {
  const hcl = await resolveActiveHcl(tenantId, fiscalYear);
  if (!hcl) throw new TaxConfigurationError(`Nu există HCL activ pentru anul fiscal ${fiscalYear}`);

  // Load contribuabil type (PF/PJ) and tenant commune rank
  const [contribuabil, tenant] = await Promise.all([
    prisma.contribuabil.findUnique({
      where: { id: contribuabilId },
      select: { tip: true },
    }),
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { communeRank: true },
    }),
  ]);

  const tipContribuabil = (contribuabil?.tip as "PF" | "PJ") ?? "PF";
  const communeRank = (tenant?.communeRank ?? 5) as BuildingTaxInput["communeRank"];

  // Get all active properties (ordered by ID for deterministic mapping)
  const [buildings, land, vehicles] = await Promise.all([
    prisma.proprietateCladire.findMany({
      where: { tenantId, contribuabilId, status: "activ", deletedAt: null },
      orderBy: { id: "asc" },
    }),
    prisma.proprietateTeren.findMany({
      where: { tenantId, contribuabilId, status: "activ", deletedAt: null },
      orderBy: { id: "asc" },
    }),
    prisma.proprietateVehicul.findMany({
      where: { tenantId, contribuabilId, status: "activ", deletedAt: null },
      orderBy: { id: "asc" },
    }),
  ]);

  const errors: { propertyType: string; propertyId: string; error: string }[] = [];

  const buildingResults: (TaxCalculationResult | null)[] = [];
  for (const b of buildings) {
    try {
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
          suprafataConstruita: toSafeNumber(
            b.suprafataConstruita,
            "proprietateCladire.suprafataConstruita"
          ),
          suprafataDesfasurata: b.suprafataDesfasurata != null
            ? toSafeNumber(
              b.suprafataDesfasurata,
              "proprietateCladire.suprafataDesfasurata"
            )
            : undefined,
          valoareImpozabila: b.valoareImpozabila != null
            ? toSafeNumber(
              b.valoareImpozabila,
              "proprietateCladire.valoareImpozabila"
            )
            : undefined,
          valoareInventar: b.valoareInventar != null
            ? toSafeNumber(
              b.valoareInventar,
              "proprietateCladire.valoareInventar"
            )
            : undefined,
          zona: b.zona,
          cotaParte: toSafeNumber(b.cotaParte, "proprietateCladire.cotaParte"),
          dataDobandire: b.dataDobandire,
          dataInstrainare: b.dataInstrainare ?? undefined,
          suprafataRezidentiala: b.suprafataRezidentiala != null
            ? toSafeNumber(
              b.suprafataRezidentiala,
              "proprietateCladire.suprafataRezidentiala"
            )
            : undefined,
          suprafataNerezidentiala: b.suprafataNerezidentiala != null
            ? toSafeNumber(
              b.suprafataNerezidentiala,
              "proprietateCladire.suprafataNerezidentiala"
            )
            : undefined,
          tipContribuabil,
          communeRank,
        },
        hcl,
        exemptions
      );
      buildingResults.push(result);
    } catch (err) {
      logger.error({ err, buildingId: b.id, contribuabilId }, "Error calculating building tax");
      buildingResults.push(null);
      errors.push({
        propertyType: "cladire",
        propertyId: b.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const landResults: (TaxCalculationResult | null)[] = [];
  for (const l of land) {
    try {
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
          suprafataMp: toSafeNumber(l.suprafataMp, "proprietateTeren.suprafataMp"),
          zona: l.zona,
          cotaParte: toSafeNumber(l.cotaParte, "proprietateTeren.cotaParte"),
          dataDobandire: l.dataDobandire,
          dataInstrainare: l.dataInstrainare ?? undefined,
        },
        hcl,
        exemptions
      );
      landResults.push(result);
    } catch (err) {
      logger.error({ err, landId: l.id, contribuabilId }, "Error calculating land tax");
      landResults.push(null);
      errors.push({
        propertyType: "teren",
        propertyId: l.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const vehicleResults: (TaxCalculationResult | null)[] = [];
  for (const v of vehicles) {
    try {
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
          tipVehicul: normalizeVehicleType(v.tipVehicul) ?? v.tipVehicul,
          cilindreeCmc: v.cilindreeCmc ?? undefined,
          putereKw: v.putereKw != null
            ? toSafeNumber(v.putereKw, "proprietateVehicul.putereKw")
            : undefined,
          masaTotalaKg: v.masaTotalaKg ?? undefined,
          nrLocuri: v.nrLocuri ?? undefined,
          normaPoluare: v.normaPoluare ?? undefined,
          tipCombustibil: v.tipCombustibil ?? undefined,
          emisiiCo2GKm: v.emisiiCo2GKm ?? undefined,
          anFabricatie: v.anFabricatie,
          dataDobandire: v.dataDobandire,
          dataInstrainare: v.dataInstrainare ?? undefined,
        },
        hcl,
        exemptions
      );
      vehicleResults.push(result);
    } catch (err) {
      logger.error({ err, vehicleId: v.id, contribuabilId }, "Error calculating vehicle tax");
      vehicleResults.push(null);
      errors.push({
        propertyType: "vehicul",
        propertyId: v.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    buildings: buildingResults,
    land: landResults,
    vehicles: vehicleResults,
    errors,
  };
}
