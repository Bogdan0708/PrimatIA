"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { setTenantContext } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

// Type for the result of actions
type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

// ============================================================================
// LIST / SEARCH
// ============================================================================

export interface VehiculListParams {
  query?: string;
  page?: number;
  perPage?: number;
  tipVehicul?: string;
  contribuabilId?: string;
}

export async function getVehicule(params: VehiculListParams = {}) {
  const session = await auth();
  if (!session?.user?.tenantId) throw new Error("No tenant context");
  await setTenantContext(session.user.tenantId);

  const page = params.page ?? 1;
  const perPage = params.perPage ?? 20;
  const skip = (page - 1) * perPage;

  const where: Prisma.ProprietateVehiculWhereInput = {
    tenantId: session.user.tenantId,
    deletedAt: null,
  };

  if (params.tipVehicul) where.tipVehicul = params.tipVehicul;
  if (params.contribuabilId) where.contribuabilId = params.contribuabilId;

  if (params.query) {
    where.OR = [
      {
        numarInmatriculare: {
          contains: params.query,
          mode: "insensitive",
        },
      },
      { serieSasiu: { contains: params.query, mode: "insensitive" } },
      { marca: { contains: params.query, mode: "insensitive" } },
      { model: { contains: params.query, mode: "insensitive" } },
      {
        nrCarteIdentitate: {
          contains: params.query,
          mode: "insensitive",
        },
      },
      {
        contribuabil: {
          OR: [
            { nume: { contains: params.query, mode: "insensitive" } },
            { prenume: { contains: params.query, mode: "insensitive" } },
          ],
        },
      },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.proprietateVehicul.findMany({
      where,
      include: {
        contribuabil: {
          select: { id: true, nume: true, prenume: true, tip: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: perPage,
    }),
    prisma.proprietateVehicul.count({ where }),
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

export async function getVehiculById(id: string) {
  const session = await auth();
  if (!session?.user?.tenantId) throw new Error("No tenant context");
  await setTenantContext(session.user.tenantId);

  return prisma.proprietateVehicul.findFirst({
    where: { id, tenantId: session.user.tenantId, deletedAt: null },
    include: {
      contribuabil: {
        select: { id: true, nume: true, prenume: true, tip: true },
      },
    },
  });
}

// ============================================================================
// CREATE
// ============================================================================

export async function createVehicul(
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
    const tipVehicul = formData.get("tipVehicul") as string;
    const anFabricatieRaw = formData.get("anFabricatie") as string;
    const dataDobandireRaw = formData.get("dataDobandire") as string;

    if (!tipVehicul || !anFabricatieRaw || !dataDobandireRaw) {
      return {
        success: false,
        error:
          "Tipul vehiculului, anul fabricației și data dobândirii sunt obligatorii",
      };
    }

    const vehicul = await prisma.proprietateVehicul.create({
      data: {
        tenantId: session.user.tenantId,
        contribuabilId,
        numarInmatriculare:
          (formData.get("numarInmatriculare") as string) || undefined,
        serieSasiu: (formData.get("serieSasiu") as string) || undefined,
        nrCarteIdentitate:
          (formData.get("nrCarteIdentitate") as string) || undefined,
        tipVehicul,
        marca: (formData.get("marca") as string) || undefined,
        model: (formData.get("model") as string) || undefined,
        anFabricatie: parseInt(anFabricatieRaw),
        cilindreeCmc: formData.get("cilindreeCmc")
          ? parseInt(formData.get("cilindreeCmc") as string)
          : undefined,
        putereKw: formData.get("putereKw")
          ? parseFloat(formData.get("putereKw") as string)
          : undefined,
        masaTotalaKg: formData.get("masaTotalaKg")
          ? parseInt(formData.get("masaTotalaKg") as string)
          : undefined,
        nrLocuri: formData.get("nrLocuri")
          ? parseInt(formData.get("nrLocuri") as string)
          : undefined,
        normaPoluare:
          (formData.get("normaPoluare") as string) || undefined,
        tipCombustibil:
          (formData.get("tipCombustibil") as string) || undefined,
        dataDobandire: new Date(dataDobandireRaw),
        dataInstrainare: formData.get("dataInstrainare")
          ? new Date(formData.get("dataInstrainare") as string)
          : undefined,
      },
    });

    revalidatePath("/proprietati/vehicule");
    revalidatePath(`/contribuabili/${contribuabilId}`);
    return { success: true, data: { id: vehicul.id } };
  } catch (error) {
    console.error("Error creating vehicul:", error);
    return { success: false, error: "Eroare la adăugarea vehiculului" };
  }
}

// ============================================================================
// UPDATE
// ============================================================================

export async function updateVehicul(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.tenantId)
    return { success: false, error: "No tenant context" };
  await setTenantContext(session.user.tenantId);

  try {
    const existing = await prisma.proprietateVehicul.findFirst({
      where: { id, tenantId: session.user.tenantId, deletedAt: null },
    });
    if (!existing)
      return { success: false, error: "Vehiculul nu a fost găsit" };

    await prisma.proprietateVehicul.update({
      where: { id },
      data: {
        numarInmatriculare:
          (formData.get("numarInmatriculare") as string) || null,
        serieSasiu: (formData.get("serieSasiu") as string) || null,
        nrCarteIdentitate:
          (formData.get("nrCarteIdentitate") as string) || null,
        tipVehicul:
          (formData.get("tipVehicul") as string) || existing.tipVehicul,
        marca: (formData.get("marca") as string) || null,
        model: (formData.get("model") as string) || null,
        anFabricatie:
          parseInt(formData.get("anFabricatie") as string) ||
          existing.anFabricatie,
        cilindreeCmc: formData.get("cilindreeCmc")
          ? parseInt(formData.get("cilindreeCmc") as string)
          : null,
        putereKw: formData.get("putereKw")
          ? parseFloat(formData.get("putereKw") as string)
          : null,
        masaTotalaKg: formData.get("masaTotalaKg")
          ? parseInt(formData.get("masaTotalaKg") as string)
          : null,
        nrLocuri: formData.get("nrLocuri")
          ? parseInt(formData.get("nrLocuri") as string)
          : null,
        normaPoluare: (formData.get("normaPoluare") as string) || null,
        tipCombustibil:
          (formData.get("tipCombustibil") as string) || null,
        dataDobandire: formData.get("dataDobandire")
          ? new Date(formData.get("dataDobandire") as string)
          : existing.dataDobandire,
        dataInstrainare: formData.get("dataInstrainare")
          ? new Date(formData.get("dataInstrainare") as string)
          : null,
        status: (formData.get("status") as string) || existing.status,
      },
    });

    revalidatePath("/proprietati/vehicule");
    revalidatePath(`/proprietati/vehicule/${id}`);
    revalidatePath(`/contribuabili/${existing.contribuabilId}`);
    return { success: true };
  } catch (error) {
    console.error("Error updating vehicul:", error);
    return { success: false, error: "Eroare la actualizarea vehiculului" };
  }
}

// ============================================================================
// DELETE (soft)
// ============================================================================

export async function deleteVehicul(id: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.tenantId)
    return { success: false, error: "No tenant context" };
  await setTenantContext(session.user.tenantId);

  try {
    const existing = await prisma.proprietateVehicul.findFirst({
      where: { id, tenantId: session.user.tenantId, deletedAt: null },
    });
    if (!existing)
      return { success: false, error: "Vehiculul nu a fost găsit" };

    await prisma.proprietateVehicul.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    revalidatePath("/proprietati/vehicule");
    revalidatePath(`/contribuabili/${existing.contribuabilId}`);
    return { success: true };
  } catch (error) {
    console.error("Error deleting vehicul:", error);
    return { success: false, error: "Eroare la ștergerea vehiculului" };
  }
}
