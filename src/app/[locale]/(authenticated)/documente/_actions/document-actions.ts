"use server";

import { prisma, setTenantContext } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import {
  generateDecizieImpunere,
  generateCertificatAtestare,
  generateChitanta,
  generateBordeRouIncasari,
} from "@/lib/documents";
import { downloadFile, getPresignedUrl } from "@/lib/storage";

type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

// ============================================================================
// DOCUMENTS — LIST
// ============================================================================

export interface DocumentListParams {
  page?: number;
  perPage?: number;
  tip?: string;
  contribuabilId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface DocumentListResult {
  items: Array<{
    id: string;
    tip: string;
    numarDocument: string;
    dataDocument: Date;
    contribuabilId: string | null;
    contribuabilName: string | null;
    fileUrl: string | null;
    fileSizeBytes: number | null;
    semnat: boolean;
    status: string;
    createdAt: Date;
  }>;
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export async function getDocuments(
  params: DocumentListParams = {}
): Promise<DocumentListResult> {
  const session = await auth();
  if (!session?.user?.tenantId) throw new Error("No tenant context");
  await setTenantContext(session.user.tenantId);

  const page = params.page ?? 1;
  const perPage = params.perPage ?? 20;
  const skip = (page - 1) * perPage;

  const where: Record<string, unknown> = { tenantId: session.user.tenantId };
  if (params.tip) where.tip = params.tip;
  if (params.contribuabilId) where.contribuabilId = params.contribuabilId;

  if (params.dateFrom || params.dateTo) {
    const dateFilter: Record<string, Date> = {};
    if (params.dateFrom) dateFilter.gte = new Date(params.dateFrom);
    if (params.dateTo) dateFilter.lte = new Date(params.dateTo);
    where.dataDocument = dateFilter;
  }

  const [items, total] = await Promise.all([
    prisma.document.findMany({
      where: where as any,
      include: {
        contribuabil: { select: { id: true, nume: true, prenume: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: perPage,
    }),
    prisma.document.count({ where: where as any }),
  ]);

  return {
    items: items.map((d) => ({
      id: d.id,
      tip: d.tip,
      numarDocument: d.numarDocument,
      dataDocument: d.dataDocument,
      contribuabilId: d.contribuabilId,
      contribuabilName: d.contribuabil
        ? `${d.contribuabil.nume}${d.contribuabil.prenume ? ` ${d.contribuabil.prenume}` : ""}`
        : null,
      fileUrl: d.fileUrl,
      fileSizeBytes: d.fileSizeBytes ? Number(d.fileSizeBytes) : null,
      semnat: d.semnat,
      status: d.status,
      createdAt: d.createdAt,
    })),
    total,
    page,
    perPage,
    totalPages: Math.ceil(total / perPage),
  };
}

// ============================================================================
// DOCUMENTS — GENERATE DECIZIE DE IMPUNERE
// ============================================================================

export async function generateDecizieAction(
  contribuabilId: string,
  fiscalYear: number
): Promise<ActionResult<{ documentId: string }>> {
  const session = await auth();
  if (!session?.user?.tenantId)
    return { success: false, error: "No tenant context" };

  try {
    const documentId = await generateDecizieImpunere(
      session.user.tenantId,
      contribuabilId,
      fiscalYear
    );
    revalidatePath("/documente");
    revalidatePath(`/contribuabili/${contribuabilId}`);
    return { success: true, data: { documentId } };
  } catch (error) {
    console.error("Error generating decizie:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Eroare la generarea deciziei",
    };
  }
}

// ============================================================================
// DOCUMENTS — GENERATE CERTIFICAT ATESTARE FISCALA
// ============================================================================

export async function generateCertificatAction(
  contribuabilId: string,
  purpose?: string
): Promise<ActionResult<{ documentId: string }>> {
  const session = await auth();
  if (!session?.user?.tenantId)
    return { success: false, error: "No tenant context" };

  try {
    const documentId = await generateCertificatAtestare(
      session.user.tenantId,
      contribuabilId,
      purpose
    );
    revalidatePath("/documente");
    return { success: true, data: { documentId } };
  } catch (error) {
    console.error("Error generating certificat:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Eroare la generarea certificatului",
    };
  }
}

// ============================================================================
// DOCUMENTS — GENERATE CHITANTA
// ============================================================================

export async function generateChitantaAction(
  plataId: string
): Promise<ActionResult<{ documentId: string }>> {
  const session = await auth();
  if (!session?.user?.tenantId)
    return { success: false, error: "No tenant context" };

  try {
    const documentId = await generateChitanta(session.user.tenantId, plataId);
    revalidatePath("/documente");
    return { success: true, data: { documentId } };
  } catch (error) {
    console.error("Error generating chitanta:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Eroare la generarea chitanței",
    };
  }
}

// ============================================================================
// DOCUMENTS — GENERATE BORDEROU INCASARI
// ============================================================================

export async function generateBordeRouAction(
  date: string
): Promise<ActionResult<{ documentId: string }>> {
  const session = await auth();
  if (!session?.user?.tenantId)
    return { success: false, error: "No tenant context" };

  try {
    const documentId = await generateBordeRouIncasari(
      session.user.tenantId,
      new Date(date),
      session.user.id
    );
    revalidatePath("/documente");
    return { success: true, data: { documentId } };
  } catch (error) {
    console.error("Error generating borderou:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Eroare la generarea borderoului",
    };
  }
}

// ============================================================================
// DOCUMENTS — DOWNLOAD
// ============================================================================

export async function getDocumentDownloadUrl(
  documentId: string
): Promise<ActionResult<{ url: string }>> {
  const session = await auth();
  if (!session?.user?.tenantId)
    return { success: false, error: "No tenant context" };
  await setTenantContext(session.user.tenantId);

  const doc = await prisma.document.findFirst({
    where: { id: documentId, tenantId: session.user.tenantId },
  });
  if (!doc?.fileUrl) return { success: false, error: "Document nu a fost găsit" };

  try {
    const url = await getPresignedUrl(doc.fileUrl);
    return { success: true, data: { url } };
  } catch (error) {
    console.error("Error getting download URL:", error);
    return { success: false, error: "Eroare la generarea link-ului de descărcare" };
  }
}

// ============================================================================
// DOCUMENTS — DOWNLOAD RAW (for API route)
// ============================================================================

export async function getDocumentBuffer(
  documentId: string,
  tenantId: string
): Promise<{ buffer: Buffer; filename: string } | null> {
  await setTenantContext(tenantId);

  const doc = await prisma.document.findFirst({
    where: { id: documentId, tenantId },
  });
  if (!doc?.fileUrl) return null;

  const buffer = await downloadFile(doc.fileUrl);
  return { buffer, filename: `${doc.numarDocument}.pdf` };
}
