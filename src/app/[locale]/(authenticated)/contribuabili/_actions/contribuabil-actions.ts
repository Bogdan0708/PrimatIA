"use server";

import { prisma, withTenantScope } from "@/lib/db";
import { auth } from "@/lib/auth";
import { encryptCnp, hashCnp } from "@/lib/crypto";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";

// Type for the result of actions
type ActionResult<T = void> = { success: true; data?: T } | { success: false; error: string };

// ============================================================================
// LIST / SEARCH
// ============================================================================

export interface ContribuabilListParams {
  query?: string;
  page?: number;
  perPage?: number;
  tip?: "PF" | "PJ";
  status?: string;
}

export interface ContribuabilListResult {
  items: Array<{
    id: string;
    tip: string;
    nume: string;
    prenume: string | null;
    cui: string | null;
    telefon: string | null;
    email: string | null;
    codRol: string | null;
    status: string;
    createdAt: Date;
  }>;
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export async function getContribuabili(params: ContribuabilListParams = {}): Promise<ContribuabilListResult> {
  const session = await auth();
  if (!session?.user?.tenantId) throw new Error("No tenant context");

  return withTenantScope(session.user.tenantId, async () => {
    const page = params.page ?? 1;
    const perPage = params.perPage ?? 20;
    const skip = (page - 1) * perPage;

    const where: Prisma.ContribuabilWhereInput = {
      tenantId: session.user.tenantId,
      deletedAt: null,
    };

    if (params.tip) where.tip = params.tip;
    if (params.status) where.status = params.status;

    const normalizedQuery = params.query?.trim();
    if (normalizedQuery) {
      const orConditions: Prisma.ContribuabilWhereInput[] = [
        { nume: { contains: normalizedQuery, mode: "insensitive" } },
        { prenume: { contains: normalizedQuery, mode: "insensitive" } },
        { cui: { contains: normalizedQuery, mode: "insensitive" } },
        { codRol: { contains: normalizedQuery, mode: "insensitive" } },
        { email: { contains: normalizedQuery, mode: "insensitive" } },
      ];
      if (/^\d{13}$/.test(normalizedQuery)) {
        orConditions.push({
          cnpHash: hashCnp(normalizedQuery, session.user.tenantId),
        });
      }
      where.OR = orConditions;
    }

    const [items, total] = await Promise.all([
      prisma.contribuabil.findMany({
        where,
        select: {
          id: true,
          tip: true,
          nume: true,
          prenume: true,
          cui: true,
          telefon: true,
          email: true,
          codRol: true,
          status: true,
          createdAt: true,
        },
        orderBy: { nume: "asc" },
        skip,
        take: perPage,
      }),
      prisma.contribuabil.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      perPage,
      totalPages: Math.ceil(total / perPage),
    };
  });
}

// ============================================================================
// GET BY ID (with fiscal summary)
// ============================================================================

export async function getContribuabilById(id: string) {
  const session = await auth();
  if (!session?.user?.tenantId) throw new Error("No tenant context");

  return withTenantScope(session.user.tenantId, async () => {
    const contribuabil = await prisma.contribuabil.findFirst({
      where: { id, tenantId: session.user.tenantId, deletedAt: null },
      include: {
        adresaDomiciliu: true,
        adresaCorespondenta: true,
        proprietatiCladiri: {
          where: { deletedAt: null },
          include: { adresa: true },
          orderBy: { createdAt: "desc" },
        },
        proprietatiTerenuri: {
          where: { deletedAt: null },
          include: { adresa: true },
          orderBy: { createdAt: "desc" },
        },
        proprietatiVehicule: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
        },
        impozite: {
          orderBy: [{ fiscalYear: "desc" }, { createdAt: "desc" }],
          include: { taxType: true },
        },
        plati: {
          orderBy: { dataPlata: "desc" },
          take: 20,
        },
        scutiri: {
          include: { scutireRegula: true },
          orderBy: { fiscalYear: "desc" },
        },
      },
    });

    if (!contribuabil) return null;

    // Calculate fiscal summary
    const totalTaxes = contribuabil.impozite.reduce(
      (sum, i) => sum + Number(i.sumaDatorata),
      0
    );
    const totalPaid = contribuabil.impozite.reduce(
      (sum, i) => sum + Number(i.sumaPlatita),
      0
    );
    const totalPenalties = contribuabil.impozite.reduce(
      (sum, i) => sum + Number(i.sumaPenalitati),
      0
    );
    const totalOutstanding = totalTaxes + totalPenalties - totalPaid;

    return {
      ...contribuabil,
      fiscalSummary: {
        totalBuildings: contribuabil.proprietatiCladiri.length,
        totalLand: contribuabil.proprietatiTerenuri.length,
        totalVehicles: contribuabil.proprietatiVehicule.length,
        totalTaxes,
        totalPaid,
        totalPenalties,
        totalOutstanding,
      },
    };
  });
}

// ============================================================================
// CREATE
// ============================================================================

export async function createContribuabil(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const session = await auth();
  if (!session?.user?.tenantId) return { success: false, error: "No tenant context" };

  try {
    return await withTenantScope(session.user.tenantId, async () => {
      const tip = formData.get("tip") as string;
      const nume = formData.get("nume") as string;
      const prenume = formData.get("prenume") as string | null;
      const cnpRaw = formData.get("cnp") as string | null;
      const cui = formData.get("cui") as string | null;
      const telefon = formData.get("telefon") as string | null;
      const email = formData.get("email") as string | null;
      const codRol = formData.get("codRol") as string | null;
      const nrDosarFiscal = formData.get("nrDosarFiscal") as string | null;
      const reprezentantLegal = formData.get("reprezentantLegal") as string | null;
      const nrRegistruComert = formData.get("nrRegistruComert") as string | null;
      const limbaPreferata = (formData.get("limbaPreferata") as string) || "ro";
      const note = formData.get("note") as string | null;

      if (!tip || !nume) {
        return { success: false, error: "Numele și tipul sunt obligatorii" };
      }

      // Handle CNP encryption
      let cnpEncrypted: Uint8Array<ArrayBuffer> | undefined;
      let cnpHashValue: string | undefined;
      if (cnpRaw && tip === "PF") {
        const buf = encryptCnp(cnpRaw);
        cnpEncrypted = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength) as Uint8Array<ArrayBuffer>;
        cnpHashValue = hashCnp(cnpRaw, session.user.tenantId);
      }

      // Handle address
      let adresaDomiciliuId: string | undefined;
      const strada = formData.get("strada") as string | null;
      const localitate = formData.get("localitate") as string | null;
      const judet = formData.get("judet") as string | null;

      if (localitate && judet) {
        const adresa = await prisma.adresa.create({
          data: {
            tenantId: session.user.tenantId,
            strada: strada || undefined,
            numar: (formData.get("numar") as string) || undefined,
            bloc: (formData.get("bloc") as string) || undefined,
            scara: (formData.get("scara") as string) || undefined,
            etaj: (formData.get("etaj") as string) || undefined,
            apartament: (formData.get("apartament") as string) || undefined,
            sat: (formData.get("sat") as string) || undefined,
            localitate,
            judet,
            codPostal: (formData.get("codPostal") as string) || undefined,
            zonaFiscala: (formData.get("zonaFiscala") as string) || undefined,
          },
        });
        adresaDomiciliuId = adresa.id;
      }

      const contribuabil = await prisma.contribuabil.create({
        data: {
          tenantId: session.user.tenantId,
          tip,
          nume,
          prenume: prenume || undefined,
          cnp: cnpEncrypted,
          cnpHash: cnpHashValue,
          cui: cui || undefined,
          telefon: telefon || undefined,
          email: email || undefined,
          codRol: codRol || undefined,
          nrDosarFiscal: nrDosarFiscal || undefined,
          reprezentantLegal: reprezentantLegal || undefined,
          nrRegistruComert: nrRegistruComert || undefined,
          limbaPreferata,
          note: note || undefined,
          adresaDomiciliuId,
        },
      });

      await writeAuditLog({
        tenantId: session.user.tenantId,
        userId: session.user.id,
        action: "create",
        entityType: "contribuabil",
        entityId: contribuabil.id,
        newValues: {
          id: contribuabil.id,
          tip: contribuabil.tip,
          nume: contribuabil.nume,
          prenume: contribuabil.prenume,
          cui: contribuabil.cui,
          email: contribuabil.email,
          telefon: contribuabil.telefon,
          status: contribuabil.status,
        },
      });

      revalidatePath("/contribuabili");
      return { success: true, data: { id: contribuabil.id } } as ActionResult<{ id: string }>;
    });
  } catch (error) {
    console.error("Error creating contribuabil:", error);
    return { success: false, error: "Eroare la crearea contribuabilului" };
  }
}

// ============================================================================
// UPDATE
// ============================================================================

export async function updateContribuabil(id: string, formData: FormData): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.tenantId) return { success: false, error: "No tenant context" };

  try {
    return await withTenantScope(session.user.tenantId, async () => {
      const existing = await prisma.contribuabil.findFirst({
        where: { id, tenantId: session.user.tenantId, deletedAt: null },
      });
      if (!existing) return { success: false, error: "Contribuabilul nu a fost găsit" } as ActionResult;

      const tip = formData.get("tip") as string;
      const nume = formData.get("nume") as string;
      const prenume = formData.get("prenume") as string | null;
      const cnpRaw = formData.get("cnp") as string | null;
      const cui = formData.get("cui") as string | null;
      const telefon = formData.get("telefon") as string | null;
      const email = formData.get("email") as string | null;
      const codRol = formData.get("codRol") as string | null;
      const nrDosarFiscal = formData.get("nrDosarFiscal") as string | null;
      const reprezentantLegal = formData.get("reprezentantLegal") as string | null;
      const nrRegistruComert = formData.get("nrRegistruComert") as string | null;
      const limbaPreferata = (formData.get("limbaPreferata") as string) || "ro";
      const statusVal = (formData.get("status") as string) || "activ";
      const note = formData.get("note") as string | null;

      const updateData: Prisma.ContribuabilUpdateInput = {
        tip,
        nume,
        prenume: prenume || null,
        cui: cui || null,
        telefon: telefon || null,
        email: email || null,
        codRol: codRol || null,
        nrDosarFiscal: nrDosarFiscal || null,
        reprezentantLegal: reprezentantLegal || null,
        nrRegistruComert: nrRegistruComert || null,
        limbaPreferata,
        status: statusVal,
        note: note || null,
      };

      // Handle CNP update
      if (cnpRaw && tip === "PF") {
        updateData.cnp = new Uint8Array(encryptCnp(cnpRaw)) as Uint8Array<ArrayBuffer>;
        updateData.cnpHash = hashCnp(cnpRaw, session.user.tenantId);
      }

      await prisma.contribuabil.update({
        where: { id },
        data: updateData,
      });

      await writeAuditLog({
        tenantId: session.user.tenantId,
        userId: session.user.id,
        action: "update",
        entityType: "contribuabil",
        entityId: id,
        oldValues: {
          tip: existing.tip,
          nume: existing.nume,
          prenume: existing.prenume,
          cui: existing.cui,
          email: existing.email,
          telefon: existing.telefon,
          status: existing.status,
        },
        newValues: {
          tip,
          nume,
          prenume: prenume || null,
          cui: cui || null,
          email: email || null,
          telefon: telefon || null,
          status: statusVal,
          limbaPreferata,
        },
      });

      revalidatePath("/contribuabili");
      revalidatePath(`/contribuabili/${id}`);
      return { success: true } as ActionResult;
    });
  } catch (error) {
    console.error("Error updating contribuabil:", error);
    return { success: false, error: "Eroare la actualizarea contribuabilului" };
  }
}

// ============================================================================
// DELETE (soft)
// ============================================================================

export async function deleteContribuabil(id: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.tenantId) return { success: false, error: "No tenant context" };

  try {
    return await withTenantScope(session.user.tenantId, async () => {
      const existing = await prisma.contribuabil.findFirst({
        where: { id, tenantId: session.user.tenantId, deletedAt: null },
      });
      if (!existing) return { success: false, error: "Contribuabilul nu a fost găsit" } as ActionResult;

      await prisma.contribuabil.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      await writeAuditLog({
        tenantId: session.user.tenantId,
        userId: session.user.id,
        action: "delete",
        entityType: "contribuabil",
        entityId: id,
        oldValues: {
          tip: existing.tip,
          nume: existing.nume,
          prenume: existing.prenume,
          cui: existing.cui,
          email: existing.email,
          telefon: existing.telefon,
          status: existing.status,
        },
        newValues: { deletedAt: new Date().toISOString() },
      });

      revalidatePath("/contribuabili");
      return { success: true } as ActionResult;
    });
  } catch (error) {
    console.error("Error deleting contribuabil:", error);
    return { success: false, error: "Eroare la ștergerea contribuabilului" };
  }
}
