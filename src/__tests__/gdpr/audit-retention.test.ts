import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma before importing audit module
vi.mock("@/lib/db", () => {
  const mockCreate = vi.fn().mockResolvedValue({});
  return {
    prisma: {
      auditLog: { create: mockCreate },
    },
    withTenantScope: vi.fn((_tenantId: string, fn: () => Promise<unknown>) => fn()),
  };
});

import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/db";

const mockedCreate = vi.mocked(prisma.auditLog.create);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("writeAuditLog", () => {
  it("sets expiresAt to approximately 7 years from now", async () => {
    await writeAuditLog({
      tenantId: "tenant-1",
      userId: "user-1",
      action: "test_action",
      entityType: "test",
      entityId: "entity-1",
    });

    expect(mockedCreate).toHaveBeenCalledOnce();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const callData = mockedCreate.mock.calls[0][0].data as any;

    expect(callData.tenantId).toBe("tenant-1");
    expect(callData.action).toBe("test_action");
    expect(callData.expiresAt).toBeInstanceOf(Date);

    // Verify expiresAt is ~7 years from now (within 1 minute tolerance)
    const now = new Date();
    const expectedExpiry = new Date(now);
    expectedExpiry.setFullYear(expectedExpiry.getFullYear() + 7);

    const expiresAt = callData.expiresAt as Date;
    const diffMs = Math.abs(expiresAt.getTime() - expectedExpiry.getTime());
    expect(diffMs).toBeLessThan(60_000); // within 1 minute
  });

  it("passes null for optional fields when not provided", async () => {
    await writeAuditLog({
      tenantId: "tenant-1",
      action: "create",
      entityType: "user",
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const callData = mockedCreate.mock.calls[0][0].data as any;
    expect(callData.userId).toBeNull();
    expect(callData.entityId).toBeNull();
  });
});
