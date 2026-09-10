import { prisma, withTenantScope } from "@/lib/db";

interface WriteAuditLogParams {
  tenantId: string;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  oldValues?: unknown;
  newValues?: unknown;
}

/** Romanian fiscal law retention period (7 years). */
const AUDIT_RETENTION_YEARS = 7;

export async function writeAuditLog(params: WriteAuditLogParams): Promise<void> {
  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + AUDIT_RETENTION_YEARS);

  await withTenantScope(params.tenantId, async () => {
    await prisma.auditLog.create({
      data: {
        tenantId: params.tenantId,
        userId: params.userId ?? null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId ?? null,
        oldValues: params.oldValues ?? undefined,
        newValues: params.newValues ?? undefined,
        expiresAt,
      },
    });
  });
}
