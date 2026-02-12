"use server";

import { prisma, setTenantContext } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { generateSomatie } from "@/lib/documents";

type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

// ============================================================================
// SOMATII — LIST
// ============================================================================

export interface SomatieListParams {
  page?: number;
  perPage?: number;
  status?: string;
  contribuabilId?: string;
}

export interface SomatieListResult {
  items: Array<{
    id: string;
    contribuabilId: string;
    contribuabilName: string;
    tip: string;
    numar: string;
    dataEmitere: Date;
    sumaDebit: number;
    sumaPenalitati: number;
    sumaTotala: number;
    termenPlata: Date;
    status: string;
    dataComunicare: Date | null;
    confirmarePrimire: boolean;
  }>;
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export async function getSomatii(
  params: SomatieListParams = {}
): Promise<SomatieListResult> {
  const session = await auth();
  if (!session?.user?.tenantId) throw new Error("No tenant context");
  await setTenantContext(session.user.tenantId);

  const page = params.page ?? 1;
  const perPage = params.perPage ?? 20;
  const skip = (page - 1) * perPage;

  const where: Record<string, unknown> = { tenantId: session.user.tenantId };
  if (params.status) where.status = params.status;
  if (params.contribuabilId) where.contribuabilId = params.contribuabilId;

  const [items, total] = await Promise.all([
    prisma.somatie.findMany({
      where: where as any,
      include: {
        contribuabil: { select: { id: true, nume: true, prenume: true } },
      },
      orderBy: { dataEmitere: "desc" },
      skip,
      take: perPage,
    }),
    prisma.somatie.count({ where: where as any }),
  ]);

  return {
    items: items.map((s) => ({
      id: s.id,
      contribuabilId: s.contribuabilId,
      contribuabilName: `${s.contribuabil.nume}${s.contribuabil.prenume ? ` ${s.contribuabil.prenume}` : ""}`,
      tip: s.tip,
      numar: s.numar,
      dataEmitere: s.dataEmitere,
      sumaDebit: Number(s.sumaDebit),
      sumaPenalitati: Number(s.sumaPenalitati),
      sumaTotala: Number(s.sumaTotala),
      termenPlata: s.termenPlata,
      status: s.status,
      dataComunicare: s.dataComunicare,
      confirmarePrimire: s.confirmarePrimire,
    })),
    total,
    page,
    perPage,
    totalPages: Math.ceil(total / perPage),
  };
}

// ============================================================================
// SOMATII — CREATE (manual, single taxpayer)
// ============================================================================

export async function createSomatie(
  contribuabilId: string
): Promise<ActionResult<{ somatieId: string; documentId: string }>> {
  const session = await auth();
  if (!session?.user?.tenantId)
    return { success: false, error: "No tenant context" };
  await setTenantContext(session.user.tenantId);

  try {
    // Get all overdue taxes for this taxpayer
    const overdueTaxes = await prisma.impozit.findMany({
      where: {
        tenantId: session.user.tenantId,
        contribuabilId,
        status: { in: ["calculat", "emis", "partial_platit"] },
      },
    });

    // Filter to actually overdue (past deadline)
    const now = new Date();
    const overdueFiltered = overdueTaxes.filter((t) => {
      const paid = Number(t.sumaPlatita);
      const owed = Number(t.sumaDatorata) + Number(t.sumaPenalitati);
      if (paid >= owed) return false;
      // Check if past any deadline
      return t.rata1Scadenta < now || t.rata2Scadenta < now;
    });

    if (overdueFiltered.length === 0) {
      return { success: false, error: "Contribuabilul nu are restanțe scadente" };
    }

    const sumaDebit = overdueFiltered.reduce((s, t) => {
      const owed = Number(t.sumaDatorata) - Number(t.sumaPlatita);
      return s + Math.max(0, owed);
    }, 0);

    const sumaPenalitati = overdueFiltered.reduce(
      (s, t) => s + Number(t.sumaPenalitati),
      0
    );

    // Generate somatie number
    const count = await prisma.somatie.count({
      where: { tenantId: session.user.tenantId },
    });

    const termenPlata = new Date();
    termenPlata.setDate(termenPlata.getDate() + 15);

    const somatie = await prisma.somatie.create({
      data: {
        tenantId: session.user.tenantId,
        contribuabilId,
        tip: "somatie",
        numar: `SM-${new Date().getFullYear()}-${(count + 1).toString().padStart(6, "0")}`,
        dataEmitere: new Date(),
        sumaDebit,
        sumaPenalitati,
        sumaTotala: sumaDebit + sumaPenalitati,
        termenPlata,
        status: "emis",
        somatiiImpozite: {
          create: overdueFiltered.map((t) => ({ impozitId: t.id })),
        },
      },
    });

    // Update tax statuses to executare
    await prisma.impozit.updateMany({
      where: { id: { in: overdueFiltered.map((t) => t.id) } },
      data: { status: "executare" },
    });

    // Generate PDF
    const documentId = await generateSomatie(
      session.user.tenantId,
      somatie.id
    );

    revalidatePath("/somatii");
    revalidatePath(`/contribuabili/${contribuabilId}`);
    return { success: true, data: { somatieId: somatie.id, documentId } };
  } catch (error) {
    console.error("Error creating somatie:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Eroare la crearea somației",
    };
  }
}

// ============================================================================
// SOMATII — UPDATE STATUS
// ============================================================================

export async function updateSomatieStatus(
  somatieId: string,
  status: string,
  dataComunicare?: string,
  modalitateComunicare?: string
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.tenantId)
    return { success: false, error: "No tenant context" };
  await setTenantContext(session.user.tenantId);

  try {
    await prisma.somatie.update({
      where: { id: somatieId },
      data: {
        status,
        ...(dataComunicare && { dataComunicare: new Date(dataComunicare) }),
        ...(modalitateComunicare && { modalitateComunicare }),
        ...(status === "comunicat" && { confirmarePrimire: false }),
        ...(status === "confirmat" && { confirmarePrimire: true }),
      },
    });

    revalidatePath("/somatii");
    return { success: true };
  } catch (error) {
    console.error("Error updating somatie:", error);
    return { success: false, error: "Eroare la actualizarea somației" };
  }
}
