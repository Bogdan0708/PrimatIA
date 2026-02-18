"use server";

import { prisma, setTenantContext } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-utils";
import { revalidatePath } from "next/cache";
import {
  generateF3001,
  generateF3002,
  generateF3003,
  generateF3101,
  validateXml,
} from "@/lib/patrimven";
import { uploadFile, buildDocumentPath } from "@/lib/storage";
import { DEFAULT_MAPPINGS } from "@/lib/patrimven/code-mappings";

type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

export type PatrimVenFormType = "F3001" | "F3002" | "F3003" | "F3101";

// ============================================================================
// EXPORT — Generate and store
// ============================================================================

export async function triggerPatrimvenExport(
  formType: PatrimVenFormType,
  fiscalYear: number
): Promise<ActionResult<{ exportJobId: string }>> {
  const session = await requireAdmin();
  if (!session?.user?.tenantId)
    return { success: false, error: "No tenant context" };
  await setTenantContext(session.user.tenantId);

  try {
    // Create export job record
    const job = await prisma.exportJob.create({
      data: {
        tenantId: session.user.tenantId,
        tip: `patrimven_${formType.toLowerCase()}`,
        parametri: { formType, fiscalYear },
        status: "processing",
        requestedById: session.user.id,
      },
    });

    // Generate XML
    let xml: string;

    switch (formType) {
      case "F3001": {
        const r = await generateF3001(session.user.tenantId, fiscalYear);
        xml = r.xml;
        break;
      }
      case "F3002": {
        const r = await generateF3002(session.user.tenantId, fiscalYear);
        xml = r.xml;
        break;
      }
      case "F3003": {
        const r = await generateF3003(session.user.tenantId, fiscalYear);
        xml = r.xml;
        break;
      }
      case "F3101": {
        const r = await generateF3101(session.user.tenantId, fiscalYear);
        xml = r.xml;
        break;
      }
    }

    // Validate
    const validation = validateXml(xml, formType);

    // Upload to MinIO
    const buffer = Buffer.from(xml, "utf-8");
    const filename = `${formType}_${fiscalYear}_${Date.now()}.xml`;
    const path = buildDocumentPath(
      session.user.tenantId,
      "patrimven",
      filename
    );
    const fileUrl = await uploadFile(path, buffer, "application/xml");

    // Update job
    await prisma.exportJob.update({
      where: { id: job.id },
      data: {
        status: validation.valid ? "completed" : "completed_with_warnings",
        progress: 100,
        fileUrl,
        fileSizeBytes: buffer.length,
        completedAt: new Date(),
        ...(validation.errors.length > 0 && {
          errorMessage: validation.errors.join("; "),
        }),
      },
    });

    revalidatePath("/admin/patrimven");
    return {
      success: true,
      data: { exportJobId: job.id },
    };
  } catch (error) {
    console.error("Error generating PatrimVen export:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Eroare la exportul PatrimVen",
    };
  }
}

// ============================================================================
// EXPORT JOBS — List
// ============================================================================

export interface ExportJobListResult {
  items: Array<{
    id: string;
    tip: string;
    parametri: unknown;
    status: string;
    progress: number;
    fileUrl: string | null;
    fileSizeBytes: number | null;
    errorMessage: string | null;
    requestedBy: string | null;
    createdAt: Date;
    completedAt: Date | null;
  }>;
  total: number;
}

export async function getExportJobs(
  page = 1,
  perPage = 20
): Promise<ExportJobListResult> {
  const session = await requireAdmin();
  if (!session?.user?.tenantId) throw new Error("No tenant context");
  await setTenantContext(session.user.tenantId);

  const where = { tenantId: session.user.tenantId };
  const skip = (page - 1) * perPage;

  const [items, total] = await Promise.all([
    prisma.exportJob.findMany({
      where,
      include: {
        requestedBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: perPage,
    }),
    prisma.exportJob.count({ where }),
  ]);

  const mapped: ExportJobListResult["items"] = items.map((j) => ({
    id: j.id,
    tip: j.tip,
    parametri: j.parametri,
    status: j.status,
    progress: j.progress,
    fileUrl: j.fileUrl,
    fileSizeBytes: j.fileSizeBytes ? Number(j.fileSizeBytes) : null,
    errorMessage: j.errorMessage,
    requestedBy: j.requestedBy
      ? `${j.requestedBy.firstName} ${j.requestedBy.lastName}`
      : null,
    createdAt: j.createdAt,
    completedAt: j.completedAt,
  }));

  return { items: mapped, total };
}

// ============================================================================
// CODE MAPPINGS — Seed defaults
// ============================================================================

export async function seedCodeMappings(): Promise<ActionResult<{ count: number }>> {
  const session = await requireAdmin();
  if (!session?.user?.tenantId)
    return { success: false, error: "No tenant context" };

  try {
    let count = 0;

    for (const [entityType, mappings] of Object.entries(DEFAULT_MAPPINGS)) {
      for (const [internalCode, patrimvenCode] of Object.entries(mappings)) {
        await prisma.patrimvenCodeMapping.upsert({
          where: {
            entityType_internalCode: { entityType, internalCode },
          },
          update: { patrimvenCode },
          create: { entityType, internalCode, patrimvenCode },
        });
        count++;
      }
    }

    revalidatePath("/admin/patrimven");
    return { success: true, data: { count } };
  } catch (error) {
    console.error("Error seeding code mappings:", error);
    return { success: false, error: "Eroare la salvarea mapărilor" };
  }
}

// ============================================================================
// CODE MAPPINGS — List
// ============================================================================

export async function getCodeMappings(): Promise<
  Array<{
    id: string;
    entityType: string;
    internalCode: string;
    patrimvenCode: string;
    descriptionRo: string | null;
  }>
> {
  const mappings = await prisma.patrimvenCodeMapping.findMany({
    orderBy: [{ entityType: "asc" }, { internalCode: "asc" }],
  });

  return mappings.map((m) => ({
    id: m.id,
    entityType: m.entityType,
    internalCode: m.internalCode,
    patrimvenCode: m.patrimvenCode,
    descriptionRo: m.descriptionRo,
  }));
}

// ============================================================================
// CODE MAPPINGS — Update
// ============================================================================

export async function updateCodeMapping(
  id: string,
  patrimvenCode: string
): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!session?.user?.tenantId)
    return { success: false, error: "No tenant context" };

  try {
    await prisma.patrimvenCodeMapping.update({
      where: { id },
      data: { patrimvenCode },
    });

    revalidatePath("/admin/patrimven");
    return { success: true };
  } catch (error) {
    console.error("Error updating code mapping:", error);
    return { success: false, error: "Eroare la actualizarea mapării" };
  }
}
