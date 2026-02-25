"use server";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-utils";
import { setTenantContext } from "@/lib/db";
import { revalidatePath } from "next/cache";
import {
  calculateAllTaxesForContribuabil,
  resolveActiveHcl,
  type TaxCalculationResult,
} from "@/lib/tax-engine";

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
          if (buildings[i]) {
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
          if (land[i]) {
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
          if (vehicles[i]) {
            allEntries.push({
              result: r,
              proprietateType: "vehicul",
              proprietateId: vehicles[i].id,
              taxTypeCode: "impozit_mijloace_transport",
            });
          }
        });

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
