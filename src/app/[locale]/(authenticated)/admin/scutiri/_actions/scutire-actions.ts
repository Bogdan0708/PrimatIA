"use server";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-utils";
import { setTenantContext } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

// ============================================================================
// EXEMPTION RULES — LIST
// ============================================================================

export async function getScutiriReguli(
  params: { isActive?: boolean; taxType?: string } = {}
) {
  const session = await requireAdmin();
  if (!session?.user?.tenantId) throw new Error("No tenant context");
  await setTenantContext(session.user.tenantId);

  const where: Prisma.ScutireRegulaWhereInput = { tenantId: session.user.tenantId };
  if (params.isActive !== undefined) where.isActive = params.isActive;
  if (params.taxType) where.taxTypes = { has: params.taxType };

  return prisma.scutireRegula.findMany({
    where,
    include: {
      _count: { select: { scutiriContribuabil: true } },
    },
    orderBy: [{ isActive: "desc" }, { nameRo: "asc" }],
  });
}

// ============================================================================
// EXEMPTION RULES — GET BY ID
// ============================================================================

export async function getScutireRegulaById(id: string) {
  const session = await requireAdmin();
  if (!session?.user?.tenantId) throw new Error("No tenant context");
  await setTenantContext(session.user.tenantId);

  return prisma.scutireRegula.findFirst({
    where: { id, tenantId: session.user.tenantId },
    include: {
      scutiriContribuabil: {
        include: {
          contribuabil: {
            select: { id: true, nume: true, prenume: true, cnpHash: true, cui: true },
          },
          approvedBy: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
        orderBy: { fiscalYear: "desc" },
      },
    },
  });
}

// ============================================================================
// EXEMPTION RULES — CREATE
// ============================================================================

export async function createScutireRegula(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdmin();
  if (!session?.user?.tenantId)
    return { success: false, error: "No tenant context" };
  await setTenantContext(session.user.tenantId);

  try {
    const nameRo = formData.get("nameRo") as string;
    const legalBasis = formData.get("legalBasis") as string;
    const discountPercent = parseFloat(
      formData.get("discountPercent") as string
    );

    if (!nameRo || !legalBasis) {
      return {
        success: false,
        error: "Denumirea si temeiul legal sunt obligatorii",
      };
    }

    if (discountPercent < 0 || discountPercent > 100) {
      return {
        success: false,
        error: "Procentul de reducere trebuie sa fie intre 0 si 100",
      };
    }

    // Parse tax types from comma-separated or multi-select
    const taxTypesRaw = formData.get("taxTypes") as string;
    const taxTypes = taxTypesRaw
      ? taxTypesRaw.split(",").map((t) => t.trim()).filter(Boolean)
      : [];

    // Parse conditions JSON
    let conditions: Prisma.InputJsonValue = {};
    const conditionsRaw = formData.get("conditions") as string;
    if (conditionsRaw) {
      try {
        conditions = JSON.parse(conditionsRaw);
      } catch {
        return { success: false, error: "Format JSON invalid pentru conditii" };
      }
    }

    // Parse required documents array
    const requiredDocsRaw = formData.get("requiredDocuments") as string;
    const requiredDocuments: string[] = requiredDocsRaw
      ? requiredDocsRaw.split(",").map((d) => d.trim()).filter(Boolean)
      : [];

    const regula = await prisma.scutireRegula.create({
      data: {
        tenantId: session.user.tenantId,
        nameRo,
        nameEn: (formData.get("nameEn") as string) || undefined,
        legalBasis,
        taxTypes,
        discountPercent,
        conditions,
        requiredDocuments,
        autoRenewable: formData.get("autoRenewable") === "true",
        isActive: true,
        validFrom: formData.get("validFrom")
          ? new Date(formData.get("validFrom") as string)
          : undefined,
        validTo: formData.get("validTo")
          ? new Date(formData.get("validTo") as string)
          : undefined,
      },
    });

    revalidatePath("/admin/scutiri");
    return { success: true, data: { id: regula.id } };
  } catch (error) {
    console.error("Error creating scutire regula:", error);
    return { success: false, error: "Eroare la crearea regulii de scutire" };
  }
}

// ============================================================================
// EXEMPTION RULES — UPDATE
// ============================================================================

export async function updateScutireRegula(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!session?.user?.tenantId)
    return { success: false, error: "No tenant context" };
  await setTenantContext(session.user.tenantId);

  try {
    const existing = await prisma.scutireRegula.findFirst({
      where: { id, tenantId: session.user.tenantId },
    });
    if (!existing)
      return { success: false, error: "Regula de scutire nu a fost gasita" };

    const discountPercent = parseFloat(
      formData.get("discountPercent") as string
    );
    if (discountPercent < 0 || discountPercent > 100) {
      return {
        success: false,
        error: "Procentul de reducere trebuie sa fie intre 0 si 100",
      };
    }

    const taxTypesRaw = formData.get("taxTypes") as string;
    const taxTypes = taxTypesRaw
      ? taxTypesRaw.split(",").map((t) => t.trim()).filter(Boolean)
      : [];

    let conditions: Prisma.InputJsonValue = existing.conditions as Prisma.InputJsonValue;
    const conditionsRaw = formData.get("conditions") as string;
    if (conditionsRaw) {
      try {
        conditions = JSON.parse(conditionsRaw);
      } catch {
        return { success: false, error: "Format JSON invalid pentru conditii" };
      }
    }

    const requiredDocsRaw = formData.get("requiredDocuments") as string;
    const requiredDocuments: string[] = requiredDocsRaw
      ? requiredDocsRaw.split(",").map((d) => d.trim()).filter(Boolean)
      : existing.requiredDocuments;

    await prisma.scutireRegula.update({
      where: { id },
      data: {
        nameRo: formData.get("nameRo") as string,
        nameEn: (formData.get("nameEn") as string) || null,
        legalBasis: formData.get("legalBasis") as string,
        taxTypes,
        discountPercent,
        conditions,
        requiredDocuments,
        autoRenewable: formData.get("autoRenewable") === "true",
        validFrom: formData.get("validFrom")
          ? new Date(formData.get("validFrom") as string)
          : null,
        validTo: formData.get("validTo")
          ? new Date(formData.get("validTo") as string)
          : null,
      },
    });

    revalidatePath("/admin/scutiri");
    revalidatePath(`/admin/scutiri/${id}`);
    return { success: true };
  } catch (error) {
    console.error("Error updating scutire regula:", error);
    return {
      success: false,
      error: "Eroare la actualizarea regulii de scutire",
    };
  }
}

// ============================================================================
// EXEMPTION RULES — TOGGLE ACTIVE
// ============================================================================

export async function toggleScutireRegula(id: string): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!session?.user?.tenantId)
    return { success: false, error: "No tenant context" };
  await setTenantContext(session.user.tenantId);

  try {
    const existing = await prisma.scutireRegula.findFirst({
      where: { id, tenantId: session.user.tenantId },
    });
    if (!existing)
      return { success: false, error: "Regula de scutire nu a fost gasita" };

    await prisma.scutireRegula.update({
      where: { id },
      data: { isActive: !existing.isActive },
    });

    revalidatePath("/admin/scutiri");
    return { success: true };
  } catch (error) {
    console.error("Error toggling scutire regula:", error);
    return { success: false, error: "Eroare la modificarea starii regulii" };
  }
}

// ============================================================================
// APPLIED EXEMPTIONS — LIST FOR TAXPAYER
// ============================================================================

export async function getScutiriContribuabil(
  contribuabilId: string,
  fiscalYear?: number
) {
  const session = await requireAdmin();
  if (!session?.user?.tenantId) throw new Error("No tenant context");
  await setTenantContext(session.user.tenantId);

  const where: Prisma.ScutireContribuabilWhereInput = {
    tenantId: session.user.tenantId,
    contribuabilId,
  };
  if (fiscalYear) where.fiscalYear = fiscalYear;

  return prisma.scutireContribuabil.findMany({
    where,
    include: {
      scutireRegula: {
        select: {
          id: true,
          nameRo: true,
          legalBasis: true,
          discountPercent: true,
          taxTypes: true,
        },
      },
      approvedBy: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
    orderBy: [{ fiscalYear: "desc" }, { createdAt: "desc" }],
  });
}

// ============================================================================
// APPLIED EXEMPTIONS — APPLY TO TAXPAYER
// ============================================================================

export async function applyScutire(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdmin();
  if (!session?.user?.tenantId)
    return { success: false, error: "No tenant context" };
  await setTenantContext(session.user.tenantId);

  try {
    const contribuabilId = formData.get("contribuabilId") as string;
    const scutireRegulaId = formData.get("scutireRegulaId") as string;
    const fiscalYear = parseInt(formData.get("fiscalYear") as string);

    if (!contribuabilId || !scutireRegulaId || !fiscalYear) {
      return {
        success: false,
        error: "Contribuabilul, regula si anul fiscal sunt obligatorii",
      };
    }

    // Verify the exemption rule exists and is active
    const regula = await prisma.scutireRegula.findFirst({
      where: {
        id: scutireRegulaId,
        tenantId: session.user.tenantId,
        isActive: true,
      },
    });
    if (!regula) {
      return {
        success: false,
        error: "Regula de scutire nu exista sau este inactiva",
      };
    }

    // Check for duplicate application in the same fiscal year
    const existing = await prisma.scutireContribuabil.findFirst({
      where: {
        tenantId: session.user.tenantId,
        contribuabilId,
        scutireRegulaId,
        fiscalYear,
        status: { in: ["pending", "approved"] },
      },
    });
    if (existing) {
      return {
        success: false,
        error: "Aceasta scutire este deja aplicata pentru anul fiscal selectat",
      };
    }

    // Parse verified documents JSON
    let documenteVerificate: Prisma.JsonArray = [];
    const docsRaw = formData.get("documenteVerificate") as string;
    if (docsRaw) {
      try {
        documenteVerificate = JSON.parse(docsRaw) as Prisma.JsonArray;
      } catch {
        documenteVerificate = [];
      }
    }

    const scutire = await prisma.scutireContribuabil.create({
      data: {
        tenantId: session.user.tenantId,
        contribuabilId,
        scutireRegulaId,
        fiscalYear,
        validFrom: new Date(formData.get("validFrom") as string),
        validTo: formData.get("validTo")
          ? new Date(formData.get("validTo") as string)
          : undefined,
        proprietateType:
          (formData.get("proprietateType") as string) || undefined,
        proprietateId: (formData.get("proprietateId") as string) || undefined,
        documenteVerificate,
        note: (formData.get("note") as string) || undefined,
        status: "pending",
      },
    });

    revalidatePath(`/contribuabili/${contribuabilId}`);
    revalidatePath("/admin/scutiri");
    return { success: true, data: { id: scutire.id } };
  } catch (error) {
    console.error("Error applying scutire:", error);
    return { success: false, error: "Eroare la aplicarea scutirii" };
  }
}

// ============================================================================
// APPLIED EXEMPTIONS — APPROVE
// ============================================================================

export async function approveScutire(id: string): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!session?.user?.tenantId)
    return { success: false, error: "No tenant context" };
  await setTenantContext(session.user.tenantId);

  try {
    const existing = await prisma.scutireContribuabil.findFirst({
      where: { id, tenantId: session.user.tenantId },
    });
    if (!existing)
      return { success: false, error: "Scutirea nu a fost gasita" };

    if (existing.status !== "pending") {
      return {
        success: false,
        error: `Nu se poate aproba o scutire cu statutul "${existing.status}"`,
      };
    }

    await prisma.scutireContribuabil.update({
      where: { id },
      data: {
        status: "approved",
        approvedById: session.user.id,
        approvedAt: new Date(),
      },
    });

    revalidatePath(`/contribuabili/${existing.contribuabilId}`);
    revalidatePath("/admin/scutiri");
    return { success: true };
  } catch (error) {
    console.error("Error approving scutire:", error);
    return { success: false, error: "Eroare la aprobarea scutirii" };
  }
}

// ============================================================================
// APPLIED EXEMPTIONS — REJECT
// ============================================================================

export async function rejectScutire(
  id: string,
  note?: string
): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!session?.user?.tenantId)
    return { success: false, error: "No tenant context" };
  await setTenantContext(session.user.tenantId);

  try {
    const existing = await prisma.scutireContribuabil.findFirst({
      where: { id, tenantId: session.user.tenantId },
    });
    if (!existing)
      return { success: false, error: "Scutirea nu a fost gasita" };

    if (existing.status !== "pending") {
      return {
        success: false,
        error: `Nu se poate respinge o scutire cu statutul "${existing.status}"`,
      };
    }

    await prisma.scutireContribuabil.update({
      where: { id },
      data: {
        status: "rejected",
        approvedById: session.user.id,
        approvedAt: new Date(),
        note: note || existing.note,
      },
    });

    revalidatePath(`/contribuabili/${existing.contribuabilId}`);
    revalidatePath("/admin/scutiri");
    return { success: true };
  } catch (error) {
    console.error("Error rejecting scutire:", error);
    return { success: false, error: "Eroare la respingerea scutirii" };
  }
}
