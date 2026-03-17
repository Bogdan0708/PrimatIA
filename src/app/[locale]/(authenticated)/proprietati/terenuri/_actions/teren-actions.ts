"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { setTenantContext } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

// Type for the result of actions
type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

function serializeDate(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function getAddressAuditSnapshot(
  address:
    | {
        strada?: string | null;
        numar?: string | null;
        bloc?: string | null;
        scara?: string | null;
        etaj?: string | null;
        apartament?: string | null;
        localitate?: string | null;
        judet?: string | null;
        codPostal?: string | null;
        zonaFiscala?: string | null;
      }
    | null
) {
  if (!address) return null;

  return {
    strada: address.strada ?? null,
    numar: address.numar ?? null,
    bloc: address.bloc ?? null,
    scara: address.scara ?? null,
    etaj: address.etaj ?? null,
    apartament: address.apartament ?? null,
    localitate: address.localitate ?? null,
    judet: address.judet ?? null,
    codPostal: address.codPostal ?? null,
    zonaFiscala: address.zonaFiscala ?? null,
  };
}

function getLandAuditSnapshot(
  land: {
    id: string;
    contribuabilId: string;
    adresaId?: string | null;
    zona: string;
    numarCadastral: string | null;
    numarCarteFunciara: string | null;
    categorie: string;
    suprafataMp: unknown;
    suprafataHa: unknown;
    cotaParte: unknown;
    tipActProprietate: string | null;
    nrActProprietate: string | null;
    dataActProprietate: Date | null;
    dataDobandire: Date;
    dataInstrainare: Date | null;
    isCultReligios?: boolean;
    status?: string | null;
  },
  address?: Parameters<typeof getAddressAuditSnapshot>[0]
) {
  return {
    id: land.id,
    contribuabilId: land.contribuabilId,
    adresaId: land.adresaId ?? null,
    zona: land.zona,
    numarCadastral: land.numarCadastral,
    numarCarteFunciara: land.numarCarteFunciara,
    categorie: land.categorie,
    suprafataMp: Number(land.suprafataMp),
    suprafataHa: land.suprafataHa == null ? null : Number(land.suprafataHa),
    cotaParte: Number(land.cotaParte),
    tipActProprietate: land.tipActProprietate ?? null,
    nrActProprietate: land.nrActProprietate ?? null,
    dataActProprietate: serializeDate(land.dataActProprietate),
    dataDobandire: serializeDate(land.dataDobandire),
    dataInstrainare: serializeDate(land.dataInstrainare),
    isCultReligios: land.isCultReligios ?? false,
    status: land.status ?? null,
    adresa: getAddressAuditSnapshot(address ?? null),
  };
}

// ============================================================================
// LIST / SEARCH
// ============================================================================

export interface TerenListParams {
  query?: string;
  page?: number;
  perPage?: number;
  zona?: string;
  categorie?: string;
  contribuabilId?: string;
}

export async function getTerenuri(params: TerenListParams = {}) {
  const session = await auth();
  if (!session?.user?.tenantId) throw new Error("No tenant context");
  await setTenantContext(session.user.tenantId);

  const page = params.page ?? 1;
  const perPage = params.perPage ?? 20;
  const skip = (page - 1) * perPage;

  const where: Prisma.ProprietateTerenWhereInput = {
    tenantId: session.user.tenantId,
    deletedAt: null,
  };

  if (params.zona) where.zona = params.zona;
  if (params.categorie) where.categorie = params.categorie;
  if (params.contribuabilId) where.contribuabilId = params.contribuabilId;

  if (params.query) {
    where.OR = [
      { numarCadastral: { contains: params.query, mode: "insensitive" } },
      { numarCarteFunciara: { contains: params.query, mode: "insensitive" } },
      {
        contribuabil: {
          OR: [
            { nume: { contains: params.query, mode: "insensitive" } },
            { prenume: { contains: params.query, mode: "insensitive" } },
          ],
        },
      },
      {
        adresa: {
          strada: { contains: params.query, mode: "insensitive" },
        },
      },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.proprietateTeren.findMany({
      where,
      include: {
        contribuabil: {
          select: { id: true, nume: true, prenume: true, tip: true },
        },
        adresa: true,
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: perPage,
    }),
    prisma.proprietateTeren.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    perPage,
    totalPages: Math.ceil(total / perPage),
  };
}

// ============================================================================
// GET BY ID
// ============================================================================

export async function getTerenById(id: string) {
  const session = await auth();
  if (!session?.user?.tenantId) throw new Error("No tenant context");
  await setTenantContext(session.user.tenantId);

  return prisma.proprietateTeren.findFirst({
    where: { id, tenantId: session.user.tenantId, deletedAt: null },
    include: {
      contribuabil: {
        select: { id: true, nume: true, prenume: true, tip: true },
      },
      adresa: true,
    },
  });
}

// ============================================================================
// CREATE
// ============================================================================

export async function createTeren(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const session = await auth();
  if (!session?.user?.tenantId)
    return { success: false, error: "No tenant context" };
  await setTenantContext(session.user.tenantId);

  try {
    const contribuabilId = formData.get("contribuabilId") as string;
    if (!contribuabilId)
      return { success: false, error: "Contribuabilul este obligatoriu" };

    // Validate required fields
    const categorie = formData.get("categorie") as string;
    const suprafataMpRaw = formData.get("suprafataMp") as string;
    const dataDobandireRaw = formData.get("dataDobandire") as string;

    if (!categorie || !suprafataMpRaw || !dataDobandireRaw) {
      return {
        success: false,
        error:
          "Categoria, suprafața (mp) și data dobândirii sunt obligatorii",
      };
    }

    // Create address if location data provided
    let adresaId: string | undefined;
    const localitate = formData.get("localitate") as string;
    const judet = formData.get("judet") as string;

    if (localitate && judet) {
      const adresa = await prisma.adresa.create({
        data: {
          tenantId: session.user.tenantId,
          strada: (formData.get("strada") as string) || undefined,
          numar: (formData.get("numar_adresa") as string) || undefined,
          bloc: (formData.get("bloc") as string) || undefined,
          scara: (formData.get("scara") as string) || undefined,
          etaj: (formData.get("etaj") as string) || undefined,
          apartament: (formData.get("apartament") as string) || undefined,
          localitate,
          judet,
          codPostal: (formData.get("codPostal") as string) || undefined,
          zonaFiscala: (formData.get("zona") as string) || undefined,
        },
      });
      adresaId = adresa.id;
    }

    const suprafataMp = parseFloat(suprafataMpRaw);

    const teren = await prisma.proprietateTeren.create({
      data: {
        tenantId: session.user.tenantId,
        contribuabilId,
        adresaId: adresaId || undefined,
        zona: (formData.get("zona") as string) || "A",
        numarCadastral:
          (formData.get("numarCadastral") as string) || undefined,
        numarCarteFunciara:
          (formData.get("numarCarteFunciara") as string) || undefined,
        categorie,
        suprafataMp,
        suprafataHa: formData.get("suprafataHa")
          ? parseFloat(formData.get("suprafataHa") as string)
          : suprafataMp / 10000,
        cotaParte: parseFloat(formData.get("cotaParte") as string) || 100,
        tipActProprietate:
          (formData.get("tipActProprietate") as string) || undefined,
        nrActProprietate:
          (formData.get("nrActProprietate") as string) || undefined,
        dataActProprietate: formData.get("dataActProprietate")
          ? new Date(formData.get("dataActProprietate") as string)
          : undefined,
        dataDobandire: new Date(dataDobandireRaw),
        dataInstrainare: formData.get("dataInstrainare")
          ? new Date(formData.get("dataInstrainare") as string)
          : undefined,
        isCultReligios: formData.get("isCultReligios") === "on",
      },
      include: { adresa: true },
    });

    await writeAuditLog({
      tenantId: session.user.tenantId,
      userId: session.user.id,
      action: "create",
      entityType: "proprietate_teren",
      entityId: teren.id,
      newValues: getLandAuditSnapshot(teren, teren.adresa),
    });

    revalidatePath("/proprietati/terenuri");
    revalidatePath(`/contribuabili/${contribuabilId}`);
    return { success: true, data: { id: teren.id } };
  } catch (error) {
    console.error("Error creating teren:", error);
    return { success: false, error: "Eroare la adăugarea terenului" };
  }
}

// ============================================================================
// UPDATE
// ============================================================================

export async function updateTeren(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.tenantId)
    return { success: false, error: "No tenant context" };
  await setTenantContext(session.user.tenantId);

  try {
    const existing = await prisma.proprietateTeren.findFirst({
      where: { id, tenantId: session.user.tenantId, deletedAt: null },
      include: { adresa: true },
    });
    if (!existing)
      return { success: false, error: "Terenul nu a fost găsit" };

    // Update the address if address fields are provided
    if (existing.adresaId && (formData.get("localitate") || formData.get("strada"))) {
      await prisma.adresa.update({
        where: { id: existing.adresaId },
        data: {
          strada: (formData.get("strada") as string) || undefined,
          numar: (formData.get("numar_adresa") as string) || undefined,
          bloc: (formData.get("bloc") as string) || undefined,
          scara: (formData.get("scara") as string) || undefined,
          etaj: (formData.get("etaj") as string) || undefined,
          apartament: (formData.get("apartament") as string) || undefined,
          localitate: (formData.get("localitate") as string) || undefined,
          judet: (formData.get("judet") as string) || undefined,
          codPostal: (formData.get("codPostal") as string) || undefined,
          zonaFiscala: (formData.get("zona") as string) || undefined,
        },
      });
    }

    const suprafataMp = formData.get("suprafataMp")
      ? parseFloat(formData.get("suprafataMp") as string)
      : Number(existing.suprafataMp);

    const updated = await prisma.proprietateTeren.update({
      where: { id },
      data: {
        zona: (formData.get("zona") as string) || existing.zona,
        numarCadastral: (formData.get("numarCadastral") as string) || null,
        numarCarteFunciara:
          (formData.get("numarCarteFunciara") as string) || null,
        categorie:
          (formData.get("categorie") as string) || existing.categorie,
        suprafataMp,
        suprafataHa: formData.get("suprafataHa")
          ? parseFloat(formData.get("suprafataHa") as string)
          : suprafataMp / 10000,
        cotaParte:
          parseFloat(formData.get("cotaParte") as string) ||
          Number(existing.cotaParte),
        tipActProprietate:
          (formData.get("tipActProprietate") as string) || null,
        nrActProprietate:
          (formData.get("nrActProprietate") as string) || null,
        dataActProprietate: formData.get("dataActProprietate")
          ? new Date(formData.get("dataActProprietate") as string)
          : null,
        dataDobandire: formData.get("dataDobandire")
          ? new Date(formData.get("dataDobandire") as string)
          : existing.dataDobandire,
        dataInstrainare: formData.get("dataInstrainare")
          ? new Date(formData.get("dataInstrainare") as string)
          : null,
        status: (formData.get("status") as string) || existing.status,
        isCultReligios: formData.get("isCultReligios") === "on",
      },
      include: { adresa: true },
    });

    await writeAuditLog({
      tenantId: session.user.tenantId,
      userId: session.user.id,
      action: "update",
      entityType: "proprietate_teren",
      entityId: updated.id,
      oldValues: getLandAuditSnapshot(existing, existing.adresa),
      newValues: getLandAuditSnapshot(updated, updated.adresa),
    });

    revalidatePath("/proprietati/terenuri");
    revalidatePath(`/proprietati/terenuri/${id}`);
    revalidatePath(`/contribuabili/${existing.contribuabilId}`);
    return { success: true };
  } catch (error) {
    console.error("Error updating teren:", error);
    return { success: false, error: "Eroare la actualizarea terenului" };
  }
}

// ============================================================================
// DELETE (soft)
// ============================================================================

export async function deleteTeren(id: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.tenantId)
    return { success: false, error: "No tenant context" };
  await setTenantContext(session.user.tenantId);

  try {
    const existing = await prisma.proprietateTeren.findFirst({
      where: { id, tenantId: session.user.tenantId, deletedAt: null },
      include: { adresa: true },
    });
    if (!existing)
      return { success: false, error: "Terenul nu a fost găsit" };

    await prisma.proprietateTeren.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await writeAuditLog({
      tenantId: session.user.tenantId,
      userId: session.user.id,
      action: "delete",
      entityType: "proprietate_teren",
      entityId: existing.id,
      oldValues: getLandAuditSnapshot(existing, existing.adresa),
    });

    revalidatePath("/proprietati/terenuri");
    revalidatePath(`/contribuabili/${existing.contribuabilId}`);
    return { success: true };
  } catch (error) {
    console.error("Error deleting teren:", error);
    return { success: false, error: "Eroare la ștergerea terenului" };
  }
}
