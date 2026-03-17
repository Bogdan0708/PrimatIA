"use server";

import { prisma, withTenantScope } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-utils";
import { setTenantContext } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import {
  calculateAllTaxesForContribuabil,
  resolveActiveHcl,
  type TaxCalculationResult,
} from "@/lib/tax-engine";
import { clearAnomalyCache } from "@/lib/ai/anomaly-detection";
import {
  evaluateConditions,
  type ContribuabilSnapshot,
  type BuildingSnapshot,
  type LandSnapshot,
  type RuleSnapshot,
} from "@/lib/tax-engine/exemption-conditions";

type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

interface TaxResultWithProperty {
  result: TaxCalculationResult;
  proprietateType: string;
  proprietateId: string;
  taxTypeCode: string;
}

export async function runMassCalculation(
  fiscalYear: number
): Promise<ActionResult<{ processed: number; taxes: number; errors: number }>> {
  const session = await requireAdmin();
  if (!session?.user?.tenantId)
    return { success: false, error: "No tenant context" };
  await setTenantContext(session.user.tenantId);

  try {
    // Verify active HCL exists
    const hcl = await resolveActiveHcl(session.user.tenantId, fiscalYear);
    if (!hcl) {
      return {
        success: false,
        error: `Nu există HCL activ pentru anul fiscal ${fiscalYear}`,
      };
    }

    // Get all active contribuabili
    const contribuabili = await prisma.contribuabil.findMany({
      where: {
        tenantId: session.user.tenantId,
        status: "activ",
        deletedAt: null,
      },
      select: { id: true },
    });

    let processed = 0;
    let totalTaxes = 0;
    let errors = 0;

    for (const c of contribuabili) {
      try {
        const calcResults = await calculateAllTaxesForContribuabil(
          session.user.tenantId,
          c.id,
          fiscalYear
        );

        // Get property details to map results (ordered by ID to match calculator)
        const [buildings, land, vehicles] = await Promise.all([
          prisma.proprietateCladire.findMany({
            where: {
              tenantId: session.user.tenantId,
              contribuabilId: c.id,
              status: "activ",
              deletedAt: null,
            },
            select: { id: true, destinatie: true },
            orderBy: { id: "asc" },
          }),
          prisma.proprietateTeren.findMany({
            where: {
              tenantId: session.user.tenantId,
              contribuabilId: c.id,
              status: "activ",
              deletedAt: null,
            },
            select: { id: true, categorie: true },
            orderBy: { id: "asc" },
          }),
          prisma.proprietateVehicul.findMany({
            where: {
              tenantId: session.user.tenantId,
              contribuabilId: c.id,
              status: "activ",
              deletedAt: null,
            },
            select: { id: true },
            orderBy: { id: "asc" },
          }),
        ]);

        // Map results to properties with correct tax type codes
        const allEntries: TaxResultWithProperty[] = [];
        calcResults.buildings.forEach((r, i) => {
          if (r && buildings[i]) {
            const dest = buildings[i].destinatie;
            const code = dest === "nerezidentiala"
              ? "impozit_cladiri_nerezidentiale"
              : dest === "mixta"
                ? "impozit_cladiri_mixte"
                : "impozit_cladiri_rezidentiale";
            allEntries.push({
              result: r,
              proprietateType: "cladire",
              proprietateId: buildings[i].id,
              taxTypeCode: code,
            });
          }
        });
        calcResults.land.forEach((r, i) => {
          if (r && land[i]) {
            const cat = land[i].categorie;
            const code = cat.startsWith("extravilan")
              ? "impozit_teren_extravilan"
              : cat.includes("curti")
                ? "impozit_teren_curti"
                : "impozit_teren_intravilan";
            allEntries.push({
              result: r,
              proprietateType: "teren",
              proprietateId: land[i].id,
              taxTypeCode: code,
            });
          }
        });
        calcResults.vehicles.forEach((r, i) => {
          if (r && vehicles[i]) {
            allEntries.push({
              result: r,
              proprietateType: "vehicul",
              proprietateId: vehicles[i].id,
              taxTypeCode: "impozit_mijloace_transport",
            });
          }
        });

        errors += calcResults.errors.length;

        for (const entry of allEntries) {
          const { result: r } = entry;

          // Find existing tax for this property/year
          const existing = await prisma.impozit.findFirst({
            where: {
              tenantId: session.user.tenantId,
              contribuabilId: c.id,
              fiscalYear,
              proprietateType: entry.proprietateType,
              proprietateId: entry.proprietateId,
            },
          });

          if (existing) {
            await prisma.impozit.update({
              where: { id: existing.id },
              data: {
                bazaImpozabila: r.bazaImpozabila,
                rataAplicata: r.rataAplicata,
                sumaCalculata: r.sumaCalculata,
                sumaScutire: r.sumaScutire,
                sumaDatorata: r.sumaDatorata,
                nrLuni: r.nrLuni,
                rata1: r.rata1,
                rata1Scadenta: r.rata1Scadenta,
                rata2: r.rata2,
                rata2Scadenta: r.rata2Scadenta,
                bonificatie: r.bonificatie,
                hclDecisionId: r.hclDecisionId,
                rateTableId: r.rateTableId,
                status: existing.status === "platit" ? "platit" : "calculat",
              },
            });
          } else {
            // Resolve tax type ID
            const taxType = await prisma.taxTypeRegistry.findFirst({
              where: { code: entry.taxTypeCode },
            });

            if (!taxType) {
              console.error(`Tax type not found: ${entry.taxTypeCode}`);
              errors++;
              continue;
            }

            await prisma.impozit.create({
              data: {
                tenantId: session.user.tenantId,
                contribuabilId: c.id,
                fiscalYear,
                taxTypeId: taxType.id,
                hclDecisionId: r.hclDecisionId,
                rateTableId: r.rateTableId,
                proprietateType: entry.proprietateType,
                proprietateId: entry.proprietateId,
                bazaImpozabila: r.bazaImpozabila,
                rataAplicata: r.rataAplicata,
                sumaCalculata: r.sumaCalculata,
                sumaScutire: r.sumaScutire,
                sumaDatorata: r.sumaDatorata,
                sumaPlatita: 0,
                sumaPenalitati: 0,
                nrLuni: r.nrLuni,
                rata1: r.rata1,
                rata1Scadenta: r.rata1Scadenta,
                rata2: r.rata2,
                rata2Scadenta: r.rata2Scadenta,
                bonificatie: r.bonificatie,
                dataStartCalcul: r.dataStartCalcul,
                dataStopCalcul: r.dataStopCalcul,
                status: "calculat",
              },
            });
          }
          totalTaxes++;
        }
        processed++;
      } catch (err) {
        console.error(
          `Error calculating taxes for contribuabil ${c.id}:`,
          err
        );
        errors++;
      }
    }

    clearAnomalyCache(session.user.tenantId);
    revalidatePath("/admin/calcul");
    revalidatePath("/contribuabili");

    return {
      success: true,
      data: { processed, taxes: totalTaxes, errors },
    };
  } catch (error) {
    console.error("Error running mass calculation:", error);
    return { success: false, error: "Eroare la calculul în masă" };
  }
}

// ============================================================================
// ELIGIBILITY DETECTION (Art. 456)
// ============================================================================

export async function runEligibilityDetection(
  fiscalYear: number
): Promise<ActionResult<{ checked: number; detected: number; skipped: number; errors: number }>> {
  const session = await requireAdmin();
  if (!session?.user?.tenantId)
    return { success: false, error: "No tenant context" };

  // Validate fiscal year
  if (!Number.isFinite(fiscalYear) || fiscalYear < 2020 || fiscalYear > 2100) {
    return { success: false, error: "Anul fiscal este invalid" };
  }

  const tenantId = session.user.tenantId;

  try {
    return await withTenantScope(tenantId, async () => {
      // Load all active rules with structured conditions
      const rules = await prisma.scutireRegula.findMany({
        where: {
          tenantId,
          isActive: true,
          conditions: { not: Prisma.JsonNull },
        },
        select: {
          id: true,
          nameRo: true,
          conditions: true,
          discountPercent: true,
        },
      });

      if (rules.length === 0) {
        return { success: false, error: "Nu există reguli active cu condiții" };
      }

      // Load all active contribuabili with eligibility flags
      const contribuabili = await prisma.contribuabil.findMany({
        where: {
          tenantId,
          status: "activ",
          deletedAt: null,
        },
        select: {
          id: true,
          tip: true,
          handicapGrav: true,
          handicapCertNr: true,
          handicapCertExp: true,
          veteranRazboi: true,
          vaduvaVeteran: true,
          erouRevolutie: true,
          organizatieNonpro: true,
          pensionar: true,
          proprietatiCladiri: {
            where: { status: "activ", deletedAt: null },
            select: { id: true, isCultReligios: true, isMonumentIstoric: true },
          },
          proprietatiTerenuri: {
            where: { status: "activ", deletedAt: null },
            select: { id: true, isCultReligios: true },
          },
        },
      });

      // Pre-load existing exemptions into a Set for O(1) dedup lookups
      const existingExemptions = await prisma.scutireContribuabil.findMany({
        where: { tenantId, fiscalYear },
        select: {
          contribuabilId: true,
          scutireRegulaId: true,
          proprietateType: true,
          proprietateId: true,
        },
      });
      const existingKeys = new Set(
        existingExemptions.map(
          (e) => `${e.contribuabilId}|${e.scutireRegulaId}|${e.proprietateType ?? ""}|${e.proprietateId ?? ""}`
        )
      );

      let checked = 0;
      let detected = 0;
      let skipped = 0;
      let errors = 0;

      const yearStart = new Date(`${fiscalYear}-01-01`);

      // Collect all new records for batch insert
      const newRecords: Array<{
        tenantId: string;
        contribuabilId: string;
        scutireRegulaId: string;
        fiscalYear: number;
        validFrom: Date;
        proprietateType: string | null;
        proprietateId: string | null;
        status: string;
        note: string;
        approvedById: string | null;
        approvedAt: Date | null;
      }> = [];

      for (const c of contribuabili) {
        try {
          const snapshot: ContribuabilSnapshot = {
            id: c.id,
            tip: c.tip,
            handicapGrav: c.handicapGrav,
            handicapCertNr: c.handicapCertNr,
            handicapCertExp: c.handicapCertExp,
            veteranRazboi: c.veteranRazboi,
            vaduvaVeteran: c.vaduvaVeteran,
            erouRevolutie: c.erouRevolutie,
            organizatieNonpro: c.organizatieNonpro,
            pensionar: c.pensionar,
          };

          const buildings: BuildingSnapshot[] = c.proprietatiCladiri;
          const land: LandSnapshot[] = c.proprietatiTerenuri;

          for (const rule of rules as RuleSnapshot[]) {
            const results = evaluateConditions(rule, snapshot, buildings, land);

            for (const result of results) {
              if (!result.eligible) continue;

              const dedupKey = `${c.id}|${rule.id}|${result.proprietateType ?? ""}|${result.proprietateId ?? ""}`;
              if (existingKeys.has(dedupKey)) {
                skipped++;
                continue;
              }
              // Also mark as seen for within-batch dedup
              existingKeys.add(dedupKey);

              newRecords.push({
                tenantId,
                contribuabilId: c.id,
                scutireRegulaId: rule.id,
                fiscalYear,
                validFrom: yearStart,
                proprietateType: result.proprietateType ?? null,
                proprietateId: result.proprietateId ?? null,
                status: result.autoApprove ? "approved" : "pending",
                note: `Detectat automat — ${result.matchedFlag}`,
                approvedById: result.autoApprove ? session.user.id : null,
                approvedAt: result.autoApprove ? new Date() : null,
              });
              detected++;
            }
          }
          checked++;
        } catch (err) {
          console.error(`Error detecting eligibility for ${c.id}:`, err);
          errors++;
        }
      }

      // Batch insert all detected exemptions
      if (newRecords.length > 0) {
        await prisma.scutireContribuabil.createMany({
          data: newRecords,
          skipDuplicates: true, // safety net for unique constraint
        });
      }

      revalidatePath("/admin/calcul");
      revalidatePath("/admin/scutiri");

      return {
        success: true as const,
        data: { checked, detected, skipped, errors },
      };
    });
  } catch (error) {
    console.error("Error running eligibility detection:", error);
    return { success: false, error: "Eroare la detectarea eligibilității" };
  }
}
