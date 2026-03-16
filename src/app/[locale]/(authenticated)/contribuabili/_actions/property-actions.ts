"use server";

import { prisma, withTenantScope } from "@/lib/db";
import { auth } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { normalizeVehicleEuroNorm, normalizeVehicleFuelType, normalizeVehicleType } from "@/lib/vehicle-normalization";

type ActionResult = { success: true } | { success: false; error: string };
const STAFF_ROLES = new Set(["super_admin", "primaria_admin", "operator", "contabil"]);

function serializePropertyDate(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function getBuildingAuditSnapshot(
  building: {
    id: string;
    contribuabilId: string;
    destinatie: string;
    tipConstructie: string;
    anConstructie: number;
    suprafataConstruita: unknown;
    suprafataUtila: unknown;
    suprafataDesfasurata: unknown;
    nrEtaje: number;
    valoareImpozabila: unknown;
    valoareInventar: unknown;
    suprafataRezidentiala: unknown;
    suprafataNerezidentiala: unknown;
    zona: string;
    cotaParte: unknown;
    nrProprietari: number;
    dataDobandire: Date;
    dataInstrainare: Date | null;
    numarCadastral: string | null;
    numarCarteFunciara: string | null;
    status: string;
  }
) {
  return {
    id: building.id,
    contribuabilId: building.contribuabilId,
    destinatie: building.destinatie,
    tipConstructie: building.tipConstructie,
    anConstructie: building.anConstructie,
    suprafataConstruita: Number(building.suprafataConstruita),
    suprafataUtila: building.suprafataUtila == null ? null : Number(building.suprafataUtila),
    suprafataDesfasurata:
      building.suprafataDesfasurata == null ? null : Number(building.suprafataDesfasurata),
    nrEtaje: building.nrEtaje,
    valoareImpozabila: building.valoareImpozabila == null ? null : Number(building.valoareImpozabila),
    valoareInventar: building.valoareInventar == null ? null : Number(building.valoareInventar),
    suprafataRezidentiala:
      building.suprafataRezidentiala == null ? null : Number(building.suprafataRezidentiala),
    suprafataNerezidentiala:
      building.suprafataNerezidentiala == null ? null : Number(building.suprafataNerezidentiala),
    zona: building.zona,
    cotaParte: Number(building.cotaParte),
    nrProprietari: building.nrProprietari,
    dataDobandire: serializePropertyDate(building.dataDobandire),
    dataInstrainare: serializePropertyDate(building.dataInstrainare),
    numarCadastral: building.numarCadastral,
    numarCarteFunciara: building.numarCarteFunciara,
    status: building.status,
  };
}

function getLandAuditSnapshot(
  land: {
    id: string;
    contribuabilId: string;
    categorie: string;
    suprafataMp: unknown;
    suprafataHa: unknown;
    zona: string;
    cotaParte: unknown;
    dataDobandire: Date;
    dataInstrainare: Date | null;
    numarCadastral: string | null;
    numarCarteFunciara: string | null;
    status: string;
  }
) {
  return {
    id: land.id,
    contribuabilId: land.contribuabilId,
    categorie: land.categorie,
    suprafataMp: Number(land.suprafataMp),
    suprafataHa: land.suprafataHa == null ? null : Number(land.suprafataHa),
    zona: land.zona,
    cotaParte: Number(land.cotaParte),
    dataDobandire: serializePropertyDate(land.dataDobandire),
    dataInstrainare: serializePropertyDate(land.dataInstrainare),
    numarCadastral: land.numarCadastral,
    numarCarteFunciara: land.numarCarteFunciara,
    status: land.status,
  };
}

function getVehicleAuditSnapshot(
  vehicle: {
    id: string;
    contribuabilId: string;
    tipVehicul: string;
    marca: string | null;
    model: string | null;
    anFabricatie: number;
    cilindreeCmc: number | null;
    putereKw: unknown;
    masaTotalaKg: number | null;
    nrLocuri: number | null;
    normaPoluare: string | null;
    tipCombustibil: string | null;
    emisiiCo2GKm: number | null;
    numarInmatriculare: string | null;
    serieSasiu: string | null;
    nrCarteIdentitate: string | null;
    dataDobandire: Date;
    dataInstrainare: Date | null;
    status: string;
  }
) {
  return {
    id: vehicle.id,
    contribuabilId: vehicle.contribuabilId,
    tipVehicul: vehicle.tipVehicul,
    marca: vehicle.marca,
    model: vehicle.model,
    anFabricatie: vehicle.anFabricatie,
    cilindreeCmc: vehicle.cilindreeCmc,
    putereKw: vehicle.putereKw == null ? null : Number(vehicle.putereKw),
    masaTotalaKg: vehicle.masaTotalaKg,
    nrLocuri: vehicle.nrLocuri,
    normaPoluare: vehicle.normaPoluare,
    tipCombustibil: vehicle.tipCombustibil,
    emisiiCo2GKm: vehicle.emisiiCo2GKm,
    numarInmatriculare: vehicle.numarInmatriculare,
    serieSasiu: vehicle.serieSasiu,
    nrCarteIdentitate: vehicle.nrCarteIdentitate,
    dataDobandire: serializePropertyDate(vehicle.dataDobandire),
    dataInstrainare: serializePropertyDate(vehicle.dataInstrainare),
    status: vehicle.status,
  };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNullableFiniteNumber(value: unknown): boolean {
  return value == null || isFiniteNumber(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function parseDateInput(value: unknown): Date | null {
  if (!isNonEmptyString(value)) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

// ============================================================================
// BUILDING (ProprietateCladire)
// ============================================================================

export async function updateBuilding(
  id: string,
  data: {
    destinatie: string;
    tipConstructie: string;
    anConstructie: number;
    suprafataConstruita: number;
    suprafataUtila?: number | null;
    suprafataDesfasurata?: number | null;
    nrEtaje: number;
    valoareImpozabila?: number | null;
    valoareInventar?: number | null;
    suprafataRezidentiala?: number | null;
    suprafataNerezidentiala?: number | null;
    zona: string;
    cotaParte: number;
    nrProprietari: number;
    dataDobandire: string;
    dataInstrainare?: string | null;
    numarCadastral?: string | null;
    numarCarteFunciara?: string | null;
    status: string;
  }
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.tenantId) return { success: false, error: "No tenant context" };
  if (!STAFF_ROLES.has(session.user.role)) return { success: false, error: "Neautorizat" };

  if (
    !isNonEmptyString(data.destinatie) ||
    !isNonEmptyString(data.tipConstructie) ||
    !isFiniteNumber(data.anConstructie) ||
    !isFiniteNumber(data.suprafataConstruita) ||
    !isFiniteNumber(data.nrEtaje) ||
    !isNullableFiniteNumber(data.suprafataUtila) ||
    !isNullableFiniteNumber(data.suprafataDesfasurata) ||
    !isNullableFiniteNumber(data.valoareImpozabila) ||
    !isNullableFiniteNumber(data.valoareInventar) ||
    !isNullableFiniteNumber(data.suprafataRezidentiala) ||
    !isNullableFiniteNumber(data.suprafataNerezidentiala) ||
    !isNonEmptyString(data.zona) ||
    !isFiniteNumber(data.cotaParte) ||
    !isFiniteNumber(data.nrProprietari) ||
    !isNonEmptyString(data.status)
  ) {
    return { success: false, error: "Date invalide pentru clădire" };
  }

  const dataDobandire = parseDateInput(data.dataDobandire);
  if (!dataDobandire) return { success: false, error: "Data dobândirii este invalidă" };
  const dataInstrainare = data.dataInstrainare ? parseDateInput(data.dataInstrainare) : null;
  if (data.dataInstrainare && !dataInstrainare) {
    return { success: false, error: "Data înstrăinării este invalidă" };
  }

  try {
    return await withTenantScope(session.user.tenantId, async () => {
      const existing = await prisma.proprietateCladire.findFirst({
        where: { id, tenantId: session.user.tenantId, deletedAt: null },
      });
      if (!existing) return { success: false, error: "Clădirea nu a fost găsită" };

      const updated = await prisma.proprietateCladire.update({
        where: { id },
        data: {
          destinatie: data.destinatie,
          tipConstructie: data.tipConstructie,
          anConstructie: data.anConstructie,
          suprafataConstruita: data.suprafataConstruita,
          suprafataUtila: data.suprafataUtila ?? null,
          suprafataDesfasurata: data.suprafataDesfasurata ?? null,
          nrEtaje: data.nrEtaje,
          valoareImpozabila: data.valoareImpozabila ?? null,
          valoareInventar: data.valoareInventar ?? null,
          suprafataRezidentiala: data.suprafataRezidentiala ?? null,
          suprafataNerezidentiala: data.suprafataNerezidentiala ?? null,
          zona: data.zona,
          cotaParte: data.cotaParte,
          nrProprietari: data.nrProprietari,
          dataDobandire,
          dataInstrainare,
          numarCadastral: data.numarCadastral ?? null,
          numarCarteFunciara: data.numarCarteFunciara ?? null,
          status: data.status,
        },
      });

      await writeAuditLog({
        tenantId: session.user.tenantId,
        userId: session.user.id,
        action: "update",
        entityType: "proprietate_cladire",
        entityId: updated.id,
        oldValues: getBuildingAuditSnapshot(existing),
        newValues: getBuildingAuditSnapshot(updated),
      });

      revalidatePath(`/contribuabili/${existing.contribuabilId}`);
      return { success: true };
    });
  } catch (error) {
    console.error("Error updating building:", error);
    return { success: false, error: "Eroare la actualizarea clădirii" };
  }
}

// ============================================================================
// LAND (ProprietateTeren)
// ============================================================================

export async function updateLand(
  id: string,
  data: {
    categorie: string;
    suprafataMp: number;
    suprafataHa?: number | null;
    zona: string;
    cotaParte: number;
    dataDobandire: string;
    dataInstrainare?: string | null;
    numarCadastral?: string | null;
    numarCarteFunciara?: string | null;
    status: string;
  }
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.tenantId) return { success: false, error: "No tenant context" };
  if (!STAFF_ROLES.has(session.user.role)) return { success: false, error: "Neautorizat" };

  if (
    !isNonEmptyString(data.categorie) ||
    !isFiniteNumber(data.suprafataMp) ||
    !isNullableFiniteNumber(data.suprafataHa) ||
    !isNonEmptyString(data.zona) ||
    !isFiniteNumber(data.cotaParte) ||
    !isNonEmptyString(data.status)
  ) {
    return { success: false, error: "Date invalide pentru teren" };
  }

  const dataDobandire = parseDateInput(data.dataDobandire);
  if (!dataDobandire) return { success: false, error: "Data dobândirii este invalidă" };
  const dataInstrainare = data.dataInstrainare ? parseDateInput(data.dataInstrainare) : null;
  if (data.dataInstrainare && !dataInstrainare) {
    return { success: false, error: "Data înstrăinării este invalidă" };
  }

  try {
    return await withTenantScope(session.user.tenantId, async () => {
      const existing = await prisma.proprietateTeren.findFirst({
        where: { id, tenantId: session.user.tenantId, deletedAt: null },
      });
      if (!existing) return { success: false, error: "Terenul nu a fost găsit" };

      const updated = await prisma.proprietateTeren.update({
        where: { id },
        data: {
          categorie: data.categorie,
          suprafataMp: data.suprafataMp,
          suprafataHa: data.suprafataHa ?? null,
          zona: data.zona,
          cotaParte: data.cotaParte,
          dataDobandire,
          dataInstrainare,
          numarCadastral: data.numarCadastral ?? null,
          numarCarteFunciara: data.numarCarteFunciara ?? null,
          status: data.status,
        },
      });

      await writeAuditLog({
        tenantId: session.user.tenantId,
        userId: session.user.id,
        action: "update",
        entityType: "proprietate_teren",
        entityId: updated.id,
        oldValues: getLandAuditSnapshot(existing),
        newValues: getLandAuditSnapshot(updated),
      });

      revalidatePath(`/contribuabili/${existing.contribuabilId}`);
      return { success: true };
    });
  } catch (error) {
    console.error("Error updating land:", error);
    return { success: false, error: "Eroare la actualizarea terenului" };
  }
}

// ============================================================================
// VEHICLE (ProprietateVehicul)
// ============================================================================

export async function updateVehicle(
  id: string,
  data: {
    tipVehicul: string;
    marca?: string | null;
    model?: string | null;
    anFabricatie: number;
    cilindreeCmc?: number | null;
    putereKw?: number | null;
    masaTotalaKg?: number | null;
    nrLocuri?: number | null;
    normaPoluare?: string | null;
    tipCombustibil?: string | null;
    emisiiCo2GKm?: number | null;
    numarInmatriculare?: string | null;
    serieSasiu?: string | null;
    nrCarteIdentitate?: string | null;
    dataDobandire: string;
    dataInstrainare?: string | null;
    status: string;
  }
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.tenantId) return { success: false, error: "No tenant context" };
  if (!STAFF_ROLES.has(session.user.role)) return { success: false, error: "Neautorizat" };

  if (
    !isNonEmptyString(data.tipVehicul) ||
    !isFiniteNumber(data.anFabricatie) ||
    !isNullableFiniteNumber(data.cilindreeCmc) ||
    !isNullableFiniteNumber(data.putereKw) ||
    !isNullableFiniteNumber(data.masaTotalaKg) ||
    !isNullableFiniteNumber(data.nrLocuri) ||
    !isNonEmptyString(data.status)
  ) {
    return { success: false, error: "Date invalide pentru vehicul" };
  }

  const dataDobandire = parseDateInput(data.dataDobandire);
  if (!dataDobandire) return { success: false, error: "Data dobândirii este invalidă" };
  const dataInstrainare = data.dataInstrainare ? parseDateInput(data.dataInstrainare) : null;
  if (data.dataInstrainare && !dataInstrainare) {
    return { success: false, error: "Data înstrăinării este invalidă" };
  }

  try {
    return await withTenantScope(session.user.tenantId, async () => {
      const existing = await prisma.proprietateVehicul.findFirst({
        where: { id, tenantId: session.user.tenantId, deletedAt: null },
      });
      if (!existing) return { success: false, error: "Vehiculul nu a fost găsit" };

      const updated = await prisma.proprietateVehicul.update({
        where: { id },
        data: {
          tipVehicul: normalizeVehicleType(data.tipVehicul) ?? data.tipVehicul,
          marca: data.marca ?? null,
          model: data.model ?? null,
          anFabricatie: data.anFabricatie,
          cilindreeCmc: data.cilindreeCmc ?? null,
          putereKw: data.putereKw ?? null,
          masaTotalaKg: data.masaTotalaKg ?? null,
          nrLocuri: data.nrLocuri ?? null,
          normaPoluare: normalizeVehicleEuroNorm(data.normaPoluare ?? null),
          tipCombustibil: normalizeVehicleFuelType(data.tipCombustibil ?? null),
          emisiiCo2GKm: data.emisiiCo2GKm ?? null,
          numarInmatriculare: data.numarInmatriculare ?? null,
          serieSasiu: data.serieSasiu ?? null,
          nrCarteIdentitate: data.nrCarteIdentitate ?? null,
          dataDobandire,
          dataInstrainare,
          status: data.status,
        },
      });

      await writeAuditLog({
        tenantId: session.user.tenantId,
        userId: session.user.id,
        action: "update",
        entityType: "proprietate_vehicul",
        entityId: updated.id,
        oldValues: getVehicleAuditSnapshot(existing),
        newValues: getVehicleAuditSnapshot(updated),
      });

      revalidatePath(`/contribuabili/${existing.contribuabilId}`);
      return { success: true };
    });
  } catch (error) {
    console.error("Error updating vehicle:", error);
    return { success: false, error: "Eroare la actualizarea vehiculului" };
  }
}
