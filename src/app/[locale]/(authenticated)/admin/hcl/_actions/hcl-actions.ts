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
// HCL DECISIONS — LIST
// ============================================================================

export async function getHclDecisions(
  params: { fiscalYear?: number; status?: string } = {}
) {
  const session = await requireAdmin();
  if (!session?.user?.tenantId) throw new Error("No tenant context");
  await setTenantContext(session.user.tenantId);

  const where: Prisma.HclDecisionWhereInput = { tenantId: session.user.tenantId };
  if (params.fiscalYear) where.fiscalYear = params.fiscalYear;
  if (params.status) where.status = params.status;

  return prisma.hclDecision.findMany({
    where,
    include: { _count: { select: { taxRateTables: true } } },
    orderBy: [{ fiscalYear: "desc" }, { createdAt: "desc" }],
  });
}

// ============================================================================
// HCL DECISIONS — GET BY ID
// ============================================================================

export async function getHclDecisionById(id: string) {
  const session = await requireAdmin();
  if (!session?.user?.tenantId) throw new Error("No tenant context");
  await setTenantContext(session.user.tenantId);

  return prisma.hclDecision.findFirst({
    where: { id, tenantId: session.user.tenantId },
    include: {
      taxRateTables: { orderBy: [{ taxType: "asc" }, { zona: "asc" }] },
    },
  });
}

// ============================================================================
// HCL DECISIONS — CREATE
// ============================================================================

export async function createHclDecision(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdmin();
  if (!session?.user?.tenantId)
    return { success: false, error: "No tenant context" };
  await setTenantContext(session.user.tenantId);

  try {
    const hcl = await prisma.hclDecision.create({
      data: {
        tenantId: session.user.tenantId,
        hclNumber: formData.get("hclNumber") as string,
        hclDate: new Date(formData.get("hclDate") as string),
        fiscalYear: parseInt(formData.get("fiscalYear") as string),
        title: (formData.get("title") as string) || undefined,
        inflationIndex: formData.get("inflationIndex")
          ? parseFloat(formData.get("inflationIndex") as string)
          : undefined,
        bonificatieProcent: formData.get("bonificatieProcent")
          ? parseFloat(formData.get("bonificatieProcent") as string)
          : undefined,
        validFrom: new Date(formData.get("validFrom") as string),
        validTo: formData.get("validTo")
          ? new Date(formData.get("validTo") as string)
          : undefined,
        approvedBy: (formData.get("approvedBy") as string) || undefined,
        status: "draft",
      },
    });

    revalidatePath("/admin/hcl");
    return { success: true, data: { id: hcl.id } };
  } catch (error) {
    console.error("Error creating HCL:", error);
    return { success: false, error: "Eroare la crearea HCL" };
  }
}

// ============================================================================
// HCL DECISIONS — UPDATE
// ============================================================================

export async function updateHclDecision(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!session?.user?.tenantId)
    return { success: false, error: "No tenant context" };
  await setTenantContext(session.user.tenantId);

  try {
    await prisma.hclDecision.update({
      where: { id },
      data: {
        hclNumber: formData.get("hclNumber") as string,
        hclDate: new Date(formData.get("hclDate") as string),
        fiscalYear: parseInt(formData.get("fiscalYear") as string),
        title: (formData.get("title") as string) || null,
        inflationIndex: formData.get("inflationIndex")
          ? parseFloat(formData.get("inflationIndex") as string)
          : null,
        bonificatieProcent: formData.get("bonificatieProcent")
          ? parseFloat(formData.get("bonificatieProcent") as string)
          : null,
        validFrom: new Date(formData.get("validFrom") as string),
        validTo: formData.get("validTo")
          ? new Date(formData.get("validTo") as string)
          : null,
        approvedBy: (formData.get("approvedBy") as string) || null,
      },
    });

    revalidatePath("/admin/hcl");
    revalidatePath(`/admin/hcl/${id}`);
    return { success: true };
  } catch (error) {
    console.error("Error updating HCL:", error);
    return { success: false, error: "Eroare la actualizarea HCL" };
  }
}

// ============================================================================
// HCL DECISIONS — ACTIVATE (with supersede logic)
// ============================================================================

export async function activateHclDecision(id: string): Promise<ActionResult<{ warning?: string }>> {
  const session = await requireAdmin();
  if (!session?.user?.tenantId)
    return { success: false, error: "No tenant context" };
  await setTenantContext(session.user.tenantId);

  try {
    const hcl = await prisma.hclDecision.findFirst({
      where: { id, tenantId: session.user.tenantId },
    });
    if (!hcl) return { success: false, error: "HCL not found" };

    // Compliance warning: Art. 491 requires inflation indexing
    const hasInflationIndex = hcl.inflationIndex != null &&
      Number(hcl.inflationIndex) > 0 &&
      Number(hcl.inflationIndex) !== 1;
    if (!hasInflationIndex) {
      console.warn(
        `[COMPLIANCE] HCL ${hcl.hclNumber} for fiscal year ${hcl.fiscalYear} ` +
        `has no inflation index set. Art. 491 Cod Fiscal requires annual indexation ` +
        `with the rate communicated by MFP. This may result in audit findings.`
      );
    }

    // Supersede any existing active HCL for same fiscal year
    await prisma.hclDecision.updateMany({
      where: {
        tenantId: session.user.tenantId,
        fiscalYear: hcl.fiscalYear,
        status: "active",
        id: { not: id },
      },
      data: { status: "superseded" },
    });

    await prisma.hclDecision.update({
      where: { id },
      data: { status: "active" },
    });

    revalidatePath("/admin/hcl");

    if (!hasInflationIndex) {
      return {
        success: true,
        data: {
          warning: `HCL ${hcl.hclNumber} nu are indicele de inflație configurat. ` +
            `Conform art. 491 Cod Fiscal, indexarea anuală cu rata inflației este obligatorie.`,
        },
      };
    }

    return { success: true };
  } catch (error) {
    console.error("Error activating HCL:", error);
    return { success: false, error: "Eroare la activarea HCL" };
  }
}

// ============================================================================
// RATE TABLE — CREATE ENTRY
// ============================================================================

export async function createRateTableEntry(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdmin();
  if (!session?.user?.tenantId)
    return { success: false, error: "No tenant context" };
  await setTenantContext(session.user.tenantId);

  try {
    const rateValue = parseFloat(formData.get("rateValue") as string);
    const minRate = formData.get("minRate")
      ? parseFloat(formData.get("minRate") as string)
      : null;
    const maxRate = formData.get("maxRate")
      ? parseFloat(formData.get("maxRate") as string)
      : null;

    // Validate legal bounds
    if (minRate !== null && rateValue < minRate) {
      return {
        success: false,
        error: `Rata ${rateValue} este sub minimul legal ${minRate}`,
      };
    }
    if (maxRate !== null && rateValue > maxRate) {
      return {
        success: false,
        error: `Rata ${rateValue} depaseste maximul legal ${maxRate}`,
      };
    }

    const entry = await prisma.taxRateTable.create({
      data: {
        tenantId: session.user.tenantId,
        hclDecisionId: formData.get("hclDecisionId") as string,
        taxType: formData.get("taxType") as string,
        category: (formData.get("category") as string) || undefined,
        zona: (formData.get("zona") as string) || undefined,
        rang: formData.get("rang")
          ? parseInt(formData.get("rang") as string)
          : undefined,
        rateType: (formData.get("rateType") as string) || "percent",
        rateValue,
        unit: (formData.get("unit") as string) || undefined,
        minRate: minRate ?? undefined,
        maxRate: maxRate ?? undefined,
        descriptionRo: (formData.get("descriptionRo") as string) || undefined,
        legalArticle: (formData.get("legalArticle") as string) || undefined,
      },
    });

    const hclDecisionId = formData.get("hclDecisionId") as string;
    revalidatePath(`/admin/hcl/${hclDecisionId}`);
    return { success: true, data: { id: entry.id } };
  } catch (error) {
    console.error("Error creating rate table entry:", error);
    return { success: false, error: "Eroare la adaugarea ratei" };
  }
}

// ============================================================================
// RATE TABLE — UPDATE ENTRY
// ============================================================================

export async function updateRateTableEntry(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!session?.user?.tenantId)
    return { success: false, error: "No tenant context" };
  await setTenantContext(session.user.tenantId);

  try {
    const rateValue = parseFloat(formData.get("rateValue") as string);
    const minRate = formData.get("minRate")
      ? parseFloat(formData.get("minRate") as string)
      : null;
    const maxRate = formData.get("maxRate")
      ? parseFloat(formData.get("maxRate") as string)
      : null;

    if (minRate !== null && rateValue < minRate) {
      return {
        success: false,
        error: `Rata ${rateValue} este sub minimul legal ${minRate}`,
      };
    }
    if (maxRate !== null && rateValue > maxRate) {
      return {
        success: false,
        error: `Rata ${rateValue} depaseste maximul legal ${maxRate}`,
      };
    }

    await prisma.taxRateTable.update({
      where: { id },
      data: {
        taxType: formData.get("taxType") as string,
        category: (formData.get("category") as string) || null,
        zona: (formData.get("zona") as string) || null,
        rang: formData.get("rang")
          ? parseInt(formData.get("rang") as string)
          : null,
        rateType: (formData.get("rateType") as string) || "percent",
        rateValue,
        unit: (formData.get("unit") as string) || null,
        minRate,
        maxRate,
        descriptionRo: (formData.get("descriptionRo") as string) || null,
        legalArticle: (formData.get("legalArticle") as string) || null,
      },
    });

    const hclDecisionId = formData.get("hclDecisionId") as string;
    revalidatePath(`/admin/hcl/${hclDecisionId}`);
    return { success: true };
  } catch (error) {
    console.error("Error updating rate table entry:", error);
    return { success: false, error: "Eroare la actualizarea ratei" };
  }
}

// ============================================================================
// RATE TABLE — DELETE ENTRY
// ============================================================================

export async function deleteRateTableEntry(
  id: string,
  hclDecisionId: string
): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!session?.user?.tenantId)
    return { success: false, error: "No tenant context" };
  await setTenantContext(session.user.tenantId);

  try {
    await prisma.taxRateTable.delete({ where: { id } });
    revalidatePath(`/admin/hcl/${hclDecisionId}`);
    return { success: true };
  } catch (error) {
    console.error("Error deleting rate table entry:", error);
    return { success: false, error: "Eroare la stergerea ratei" };
  }
}
