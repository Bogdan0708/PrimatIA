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

export async function writeAuditLog(params: WriteAuditLogParams): Promise<void> {
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
      },
    });
  });
}
