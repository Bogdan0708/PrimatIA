"use server";

import { prisma, withTenantScope } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

function parseTargetImpozitIds(formData: FormData): string[] {
  const explicitValues = formData
    .getAll("targetImpozitIds")
    .flatMap((value) => String(value).split(","))
    .map((value) => value.trim())
    .filter(Boolean);

  return Array.from(new Set(explicitValues));
}

// ============================================================================
// PAYMENTS — LIST
// ============================================================================

export interface PlataListParams {
  contribuabilId?: string;
  page?: number;
  perPage?: number;
  dateFrom?: string;
  dateTo?: string;
  modalitate?: string;
}

export interface PlataListResult {
  items: Array<{
    id: string;
    contribuabilId: string;
    contribuabil: { id: string; nume: string; prenume: string | null; cui: string | null };
    suma: number;
    dataPlata: Date;
    modalitate: string;
    nrChitanta: string | null;
    nrDocument: string | null;
    distribuit: boolean;
    createdAt: Date;
  }>;
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export async function getPlati(
  params: PlataListParams = {}
): Promise<PlataListResult> {
  const session = await auth();
  if (!session?.user?.tenantId) throw new Error("No tenant context");

  return withTenantScope(session.user.tenantId, async () => {
    const page = params.page ?? 1;
    const perPage = params.perPage ?? 20;
    const skip = (page - 1) * perPage;

    const where: Prisma.PlataWhereInput = { tenantId: session.user.tenantId };
    if (params.contribuabilId) where.contribuabilId = params.contribuabilId;
    if (params.modalitate) where.modalitate = params.modalitate;

    if (params.dateFrom || params.dateTo) {
      const dataPlataFilter: Record<string, Date> = {};
      if (params.dateFrom) dataPlataFilter.gte = new Date(params.dateFrom);
      if (params.dateTo) dataPlataFilter.lte = new Date(params.dateTo);
      where.dataPlata = dataPlataFilter;
    }

    const [items, total] = await Promise.all([
      prisma.plata.findMany({
        where,
        include: {
          contribuabil: {
            select: { id: true, nume: true, prenume: true, cui: true },
          },
        },
        orderBy: { dataPlata: "desc" },
        skip,
        take: perPage,
      }),
      prisma.plata.count({ where }),
    ]);

    return {
      items: items.map((p) => ({
        id: p.id,
        contribuabilId: p.contribuabilId,
        contribuabil: p.contribuabil,
        suma: Number(p.suma),
        dataPlata: p.dataPlata,
        modalitate: p.modalitate,
        nrChitanta: p.nrChitanta,
        nrDocument: p.nrDocument,
        distribuit: p.distribuit,
        createdAt: p.createdAt,
      })),
      total,
      page,
      perPage,
      totalPages: Math.ceil(total / perPage),
    };
  });
}

// ============================================================================
// PAYMENTS — GET BY ID
// ============================================================================

export async function getPlataById(id: string) {
  const session = await auth();
  if (!session?.user?.tenantId) throw new Error("No tenant context");

  return withTenantScope(session.user.tenantId, async () => {
    const plata = await prisma.plata.findFirst({
      where: { id, tenantId: session.user.tenantId },
      include: {
        contribuabil: {
          select: { id: true, nume: true, prenume: true, cui: true, codRol: true },
        },
        inregistratDe: {
          select: { id: true, firstName: true, lastName: true },
        },
        platiDistributie: {
          include: {
            impozit: {
              include: {
                taxType: { select: { code: true, name: true } },
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!plata) return null;

    return {
      ...plata,
      suma: Number(plata.suma),
      platiDistributie: plata.platiDistributie.map((d) => ({
        ...d,
        sumaDebit: Number(d.sumaDebit),
        sumaPenalitati: Number(d.sumaPenalitati),
      })),
    };
  });
}

// ============================================================================
// PAYMENTS — CREATE WITH AUTO-DISTRIBUTION
// ============================================================================

export async function createPlata(
  formData: FormData
): Promise<ActionResult<{ id: string; distributed: boolean; remainder: number }>> {
  const session = await auth();
  if (!session?.user?.tenantId)
    return { success: false, error: "No tenant context" };

  try {
    return await withTenantScope(session.user.tenantId, async () => {
      const contribuabilId = formData.get("contribuabilId") as string;
      const suma = parseFloat(formData.get("suma") as string);
      const modalitate = formData.get("modalitate") as string;
      const dataPlata = formData.get("dataPlata") as string;
      const targetImpozitIds = parseTargetImpozitIds(formData);

      if (!contribuabilId || !suma || !modalitate || !dataPlata) {
        return {
          success: false as const,
          error: "Contribuabilul, suma, modalitatea si data platii sunt obligatorii",
        };
      }

      if (suma <= 0) {
        return { success: false as const, error: "Suma trebuie sa fie pozitiva" };
      }

      // Verify the taxpayer exists
      const contribuabil = await prisma.contribuabil.findFirst({
        where: {
          id: contribuabilId,
          tenantId: session.user.tenantId,
          deletedAt: null,
        },
      });
      if (!contribuabil) {
        return { success: false as const, error: "Contribuabilul nu a fost gasit" };
      }

      // Create the payment record
      const plata = await prisma.plata.create({
        data: {
          tenantId: session.user.tenantId,
          contribuabilId,
          suma,
          dataPlata: new Date(dataPlata),
          modalitate,
          nrChitanta: (formData.get("nrChitanta") as string) || undefined,
          nrDocument: (formData.get("nrDocument") as string) || undefined,
          gatewayRef: (formData.get("ghiseulRoRef") as string) || undefined,
          nota: (formData.get("nota") as string) || undefined,
          inregistratDeId: session.user.id,
          distribuit: false,
        },
      });

      // Auto-distribute payment to outstanding debts (already inside withTenantScope)
      const remainder = await distributePayment(
        session.user.tenantId,
        plata.id,
        contribuabilId,
        suma,
        targetImpozitIds
      );

      revalidatePath(`/contribuabili/${contribuabilId}`);
      revalidatePath("/plati");
      return {
        success: true as const,
        data: { id: plata.id, distributed: true, remainder },
      };
    });
  } catch (error) {
    console.error("Error creating plata:", error);
    return { success: false, error: "Eroare la inregistrarea platii" };
  }
}

// ============================================================================
// PAYMENT AUTO-DISTRIBUTION LOGIC
// Per Cod Procedura Fiscala: oldest debts first, penalties before principal
// NOTE: This function MUST be called from within a withTenantScope() context.
// The prisma proxy will route queries through the tenant-scoped transaction.
// ============================================================================

/**
 * Distribute a payment across outstanding taxes.
 * Per Cod Procedura Fiscala Art. 165:
 * - If targetImpozitIds is provided, taxpayer designates which debts to pay.
 * - If not provided, FIFO applies: oldest debts first, penalties before principal.
 */
async function distributePayment(
  tenantId: string,
  plataId: string,
  contribuabilId: string,
  amount: number,
  targetImpozitIds?: string[]
): Promise<number> {
  // Get outstanding taxes — filtered by designation or FIFO-ordered (Art. 165 CPF)
  const outstandingTaxes = await prisma.impozit.findMany({
    where: {
      tenantId,
      contribuabilId,
      status: { in: ["calculat", "emis", "partial_platit", "executare"] },
      ...(targetImpozitIds && targetImpozitIds.length > 0
        ? { id: { in: targetImpozitIds } }
        : {}),
    },
    orderBy: [{ fiscalYear: "asc" }, { rata1Scadenta: "asc" }],
  });

  let remaining = amount;
  const distributions: Array<{
    impozitId: string;
    sumaDebit: number;
    sumaPenalitati: number;
  }> = [];

  for (const tax of outstandingTaxes) {
    if (remaining <= 0) break;

    const totalDebt = Number(tax.sumaDatorata);
    const totalPenalties = Number(tax.sumaPenalitati);
    const alreadyPaid = Number(tax.sumaPlatita);
    const totalOwed = totalDebt + totalPenalties;
    const outstanding = totalOwed - alreadyPaid;

    if (outstanding <= 0) continue;

    const toApply = Math.min(remaining, outstanding);

    const penaltiesCoveredSoFar = Math.min(alreadyPaid, totalPenalties);
    const penaltiesRemaining = totalPenalties - penaltiesCoveredSoFar;

    const toPenalties = Math.min(toApply, Math.max(0, penaltiesRemaining));
    const toDebit = toApply - toPenalties;

    distributions.push({
      impozitId: tax.id,
      sumaDebit: toDebit,
      sumaPenalitati: toPenalties,
    });

    const newPaid = alreadyPaid + toApply;
    const newStatus =
      newPaid >= totalOwed
        ? "platit"
        : newPaid > 0
          ? "partial_platit"
          : tax.status;

    await prisma.impozit.update({
      where: { id: tax.id },
      data: {
        sumaPlatita: newPaid,
        status: newStatus,
      },
    });

    remaining -= toApply;
  }

  if (distributions.length > 0) {
    await prisma.plataDistributie.createMany({
      data: distributions.map((d) => ({
        tenantId,
        plataId,
        impozitId: d.impozitId,
        sumaDebit: d.sumaDebit,
        sumaPenalitati: d.sumaPenalitati,
      })),
    });
  }

  await prisma.plata.update({
    where: { id: plataId },
    data: { distribuit: true },
  });

  return Math.max(0, remaining);
}

// ============================================================================
// PAYMENTS — RE-DISTRIBUTE (for manual correction)
// ============================================================================

export async function redistributePlata(id: string, targetImpozitIds?: string[]): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.tenantId)
    return { success: false, error: "No tenant context" };

  try {
    return await withTenantScope(session.user.tenantId, async () => {
      const plata = await prisma.plata.findFirst({
        where: { id, tenantId: session.user.tenantId },
        include: { platiDistributie: true },
      });
      if (!plata) return { success: false as const, error: "Plata nu a fost gasita" };

      // Reverse existing distributions
      for (const dist of plata.platiDistributie) {
        const totalReversed = Number(dist.sumaDebit) + Number(dist.sumaPenalitati);
        const impozit = await prisma.impozit.findUnique({
          where: { id: dist.impozitId },
        });
        if (impozit) {
          const newPaid = Math.max(0, Number(impozit.sumaPlatita) - totalReversed);
          const totalOwed = Number(impozit.sumaDatorata) + Number(impozit.sumaPenalitati);
          const newStatus =
            newPaid >= totalOwed
              ? "platit"
              : newPaid > 0
                ? "partial_platit"
                : "emis";

          await prisma.impozit.update({
            where: { id: impozit.id },
            data: { sumaPlatita: newPaid, status: newStatus },
          });
        }
      }

      await prisma.plataDistributie.deleteMany({
        where: { plataId: id },
      });

      await distributePayment(
        session.user.tenantId,
        id,
        plata.contribuabilId,
        Number(plata.suma),
        targetImpozitIds
      );

      revalidatePath(`/contribuabili/${plata.contribuabilId}`);
      revalidatePath("/plati");
      revalidatePath(`/plati/${id}`);
      return { success: true as const };
    });
  } catch (error) {
    console.error("Error redistributing plata:", error);
    return { success: false, error: "Eroare la redistribuirea platii" };
  }
}
