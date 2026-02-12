"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { setTenantContext } from "@/lib/db";
import { revalidatePath } from "next/cache";

// Type for the result of actions
type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

// ============================================================================
// LIST / SEARCH
// ============================================================================

export interface CladireListParams {
  query?: string;
  page?: number;
  perPage?: number;
  zona?: string;
  destinatie?: string;
  contribuabilId?: string;
}

export async function getCladiri(params: CladireListParams = {}) {
  const session = await auth();
  if (!session?.user?.tenantId) throw new Error("No tenant context");
  await setTenantContext(session.user.tenantId);

  const page = params.page ?? 1;
  const perPage = params.perPage ?? 20;
  const skip = (page - 1) * perPage;

  const where: Record<string, unknown> = {
    tenantId: session.user.tenantId,
    deletedAt: null,
  };

  if (params.zona) where.zona = params.zona;
  if (params.destinatie) where.destinatie = params.destinatie;
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
    prisma.proprietateCladire.findMany({
      where: where as any,
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
    prisma.proprietateCladire.count({ where: where as any }),
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

export async function getCladireById(id: string) {
  const session = await auth();
  if (!session?.user?.tenantId) throw new Error("No tenant context");
  await setTenantContext(session.user.tenantId);

  return prisma.proprietateCladire.findFirst({
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

export async function createCladire(
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
    const destinatie = formData.get("destinatie") as string;
    const tipConstructie = formData.get("tipConstructie") as string;
    const anConstructieRaw = formData.get("anConstructie") as string;
    const suprafataConstrRaw = formData.get("suprafataConstruita") as string;
    const dataDobandireRaw = formData.get("dataDobandire") as string;

    if (!destinatie || !tipConstructie || !anConstructieRaw || !suprafataConstrRaw || !dataDobandireRaw) {
      return {
        success: false,
        error: "Destinația, tipul construcției, anul construcției, suprafața construită și data dobândirii sunt obligatorii",
      };
    }

    // Create address first
    const localitate = formData.get("localitate") as string;
    const judet = formData.get("judet") as string;
    if (!localitate || !judet)
      return {
        success: false,
        error: "Localitatea și județul sunt obligatorii",
      };

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

    const cladire = await prisma.proprietateCladire.create({
      data: {
        tenantId: session.user.tenantId,
        contribuabilId,
        adresaId: adresa.id,
        zona: (formData.get("zona") as string) || "A",
        numarCadastral:
          (formData.get("numarCadastral") as string) || undefined,
        numarCarteFunciara:
          (formData.get("numarCarteFunciara") as string) || undefined,
        destinatie,
        tipConstructie,
        anConstructie: parseInt(anConstructieRaw),
        suprafataConstruita: parseFloat(suprafataConstrRaw),
        suprafataUtila: formData.get("suprafataUtila")
          ? parseFloat(formData.get("suprafataUtila") as string)
          : undefined,
        suprafataDesfasurata: formData.get("suprafataDesfasurata")
          ? parseFloat(formData.get("suprafataDesfasurata") as string)
          : undefined,
        nrEtaje: parseInt(formData.get("nrEtaje") as string) || 1,
        valoareImpozabila: formData.get("valoareImpozabila")
          ? parseFloat(formData.get("valoareImpozabila") as string)
          : undefined,
        valoareInventar: formData.get("valoareInventar")
          ? parseFloat(formData.get("valoareInventar") as string)
          : undefined,
        suprafataRezidentiala: formData.get("suprafataRezidentiala")
          ? parseFloat(formData.get("suprafataRezidentiala") as string)
          : undefined,
        suprafataNerezidentiala: formData.get("suprafataNerezidentiala")
          ? parseFloat(formData.get("suprafataNerezidentiala") as string)
          : undefined,
        cotaParte: parseFloat(formData.get("cotaParte") as string) || 100,
        nrProprietari: parseInt(formData.get("nrProprietari") as string) || 1,
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
      },
    });

    revalidatePath("/proprietati/cladiri");
    revalidatePath(`/contribuabili/${contribuabilId}`);
    return { success: true, data: { id: cladire.id } };
  } catch (error) {
    console.error("Error creating cladire:", error);
    return { success: false, error: "Eroare la adăugarea clădirii" };
  }
}

// ============================================================================
// UPDATE
// ============================================================================

export async function updateCladire(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.tenantId)
    return { success: false, error: "No tenant context" };
  await setTenantContext(session.user.tenantId);

  try {
    const existing = await prisma.proprietateCladire.findFirst({
      where: { id, tenantId: session.user.tenantId, deletedAt: null },
    });
    if (!existing)
      return { success: false, error: "Clădirea nu a fost găsită" };

    // Update the address if address fields are provided
    if (formData.get("localitate") || formData.get("strada")) {
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

    await prisma.proprietateCladire.update({
      where: { id },
      data: {
        zona: (formData.get("zona") as string) || existing.zona,
        numarCadastral: (formData.get("numarCadastral") as string) || null,
        numarCarteFunciara:
          (formData.get("numarCarteFunciara") as string) || null,
        destinatie:
          (formData.get("destinatie") as string) || existing.destinatie,
        tipConstructie:
          (formData.get("tipConstructie") as string) ||
          existing.tipConstructie,
        anConstructie:
          parseInt(formData.get("anConstructie") as string) ||
          existing.anConstructie,
        suprafataConstruita:
          parseFloat(formData.get("suprafataConstruita") as string) ||
          Number(existing.suprafataConstruita),
        suprafataUtila: formData.get("suprafataUtila")
          ? parseFloat(formData.get("suprafataUtila") as string)
          : null,
        suprafataDesfasurata: formData.get("suprafataDesfasurata")
          ? parseFloat(formData.get("suprafataDesfasurata") as string)
          : null,
        nrEtaje:
          parseInt(formData.get("nrEtaje") as string) || existing.nrEtaje,
        valoareImpozabila: formData.get("valoareImpozabila")
          ? parseFloat(formData.get("valoareImpozabila") as string)
          : null,
        valoareInventar: formData.get("valoareInventar")
          ? parseFloat(formData.get("valoareInventar") as string)
          : null,
        suprafataRezidentiala: formData.get("suprafataRezidentiala")
          ? parseFloat(formData.get("suprafataRezidentiala") as string)
          : null,
        suprafataNerezidentiala: formData.get("suprafataNerezidentiala")
          ? parseFloat(formData.get("suprafataNerezidentiala") as string)
          : null,
        cotaParte:
          parseFloat(formData.get("cotaParte") as string) ||
          Number(existing.cotaParte),
        nrProprietari:
          parseInt(formData.get("nrProprietari") as string) ||
          existing.nrProprietari,
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
      },
    });

    revalidatePath("/proprietati/cladiri");
    revalidatePath(`/proprietati/cladiri/${id}`);
    revalidatePath(`/contribuabili/${existing.contribuabilId}`);
    return { success: true };
  } catch (error) {
    console.error("Error updating cladire:", error);
    return { success: false, error: "Eroare la actualizarea clădirii" };
  }
}

// ============================================================================
// DELETE (soft)
// ============================================================================

export async function deleteCladire(id: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.tenantId)
    return { success: false, error: "No tenant context" };
  await setTenantContext(session.user.tenantId);

  try {
    const existing = await prisma.proprietateCladire.findFirst({
      where: { id, tenantId: session.user.tenantId, deletedAt: null },
    });
    if (!existing)
      return { success: false, error: "Clădirea nu a fost găsită" };

    await prisma.proprietateCladire.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    revalidatePath("/proprietati/cladiri");
    revalidatePath(`/contribuabili/${existing.contribuabilId}`);
    return { success: true };
  } catch (error) {
    console.error("Error deleting cladire:", error);
    return { success: false, error: "Eroare la ștergerea clădirii" };
  }
}
