/**
 * Auto-Generated Official Documents System
 * Triggers document generation based on business events.
 */

import { prisma, setTenantContext } from "@/lib/db";
import {
  generateDecizieImpunere,
  generateSomatie,
  generateCertificatAtestare,
  generateChitanta,
} from "./generator";

export type GeneratableDocType =
  | "decizie"
  | "chitanta"
  | "certificat"
  | "somatie"
  | "titlu_executoriu";

export interface GenerateRequest {
  type: GeneratableDocType;
  entityId: string;
  tenantId: string;
  options?: {
    fiscalYear?: number;
    purpose?: string;
  };
}

export interface BatchRequest {
  type: "decizie" | "somatie";
  tenantId: string;
  filters?: {
    year?: number;
    overdueDays?: number;
  };
}

export interface BatchResult {
  total: number;
  success: number;
  failed: number;
  errors: Array<{ entityId: string; error: string }>;
}

// ============================================================================
// Single Document Generation
// ============================================================================

export async function generateDocument(req: GenerateRequest): Promise<string> {
  await setTenantContext(req.tenantId);
  const year = req.options?.fiscalYear || new Date().getFullYear();

  switch (req.type) {
    case "decizie":
      return generateDecizieImpunere(req.tenantId, req.entityId, year);

    case "chitanta":
      return generateChitanta(req.tenantId, req.entityId);

    case "certificat":
      return generateCertificatAtestare(
        req.tenantId,
        req.entityId,
        req.options?.purpose || "tranzacții imobiliare"
      );

    case "somatie":
      return generateSomatie(req.tenantId, req.entityId);

    case "titlu_executoriu":
      // Titlu executoriu uses the same somatie generator with different metadata
      // For now, generate as somatie with enhanced template
      return generateSomatie(req.tenantId, req.entityId);

    default:
      throw new Error(`Unknown document type: ${req.type}`);
  }
}

// ============================================================================
// Batch Document Generation
// ============================================================================

export async function generateBatch(req: BatchRequest): Promise<BatchResult> {
  await setTenantContext(req.tenantId);
  const result: BatchResult = { total: 0, success: 0, failed: 0, errors: [] };

  if (req.type === "decizie") {
    const year = req.filters?.year || new Date().getFullYear();

    // Find all contribuabili with taxes for the given year
    const contribuabili = await prisma.contribuabil.findMany({
      where: {
        tenantId: req.tenantId,
        deletedAt: null,
        impozite: {
          some: { fiscalYear: year },
        },
      },
      select: { id: true },
    });

    result.total = contribuabili.length;

    for (const c of contribuabili) {
      try {
        await generateDecizieImpunere(req.tenantId, c.id, year);
        result.success++;
      } catch (error: unknown) {
        result.failed++;
        result.errors.push({
          entityId: c.id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  } else if (req.type === "somatie") {
    const overdueDays = req.filters?.overdueDays || 30;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - overdueDays);

    // Find all somatii that are pending
    const somatii = await prisma.somatie.findMany({
      where: {
        tenantId: req.tenantId,
        status: { in: ["generata", "trimisa"] },
        createdAt: { lte: cutoffDate },
      },
      select: { id: true },
    });

    result.total = somatii.length;

    for (const s of somatii) {
      try {
        await generateSomatie(req.tenantId, s.id);
        result.success++;
      } catch (error: unknown) {
        result.failed++;
        result.errors.push({
          entityId: s.id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  }

  return result;
}

// ============================================================================
// Recent Generated Documents
// ============================================================================

export async function getRecentDocuments(
  tenantId: string,
  limit: number = 20
) {
  return prisma.document.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      contribuabil: {
        select: { id: true, nume: true, prenume: true },
      },
    },
  });
}
