import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireAdminMock,
  setTenantContextMock,
  revalidatePathMock,
  prismaMock,
} = vi.hoisted(() => ({
  requireAdminMock: vi.fn(),
  setTenantContextMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  prismaMock: {
    importBatch: {
      findFirst: vi.fn(),
    },
    importRowLedger: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth-utils", () => ({
  requireAdmin: requireAdminMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
  setTenantContext: setTenantContextMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

import {
  createImportBatch,
  getRollbackPreview,
  previewImportBatch,
} from "@/app/[locale]/(authenticated)/admin/import/_actions/import-actions";

describe("import actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminMock.mockResolvedValue({
      user: { id: "user-1", tenantId: "tenant-1" },
    });
    setTenantContextMock.mockResolvedValue(undefined);
  });

  it("returns preview validation errors for invalid rows", async () => {
    const fd = new FormData();
    fd.set("entityType", "contribuabil");
    fd.set("file", new File(['tip,nume,cnp\nXX,,1234567890123\n'], "test.csv"));

    const result = await previewImportBatch(fd);
    expect(result.success).toBe(true);
    if (!result.success || !result.data) throw new Error("expected success");

    expect(result.data.validationErrorCount).toBeGreaterThan(0);
    expect(result.data.validationErrors.some((e) => e.field === "tip")).toBe(true);
    expect(result.data.validationErrors.some((e) => e.field === "nume")).toBe(true);
  });

  it("requires explicit confirmation before import", async () => {
    const fd = new FormData();
    fd.set("entityType", "contribuabil");
    fd.set("file", new File(["tip,nume\nPF,Popescu\n"], "test.csv"));
    fd.set("mapping", JSON.stringify({ tip: "tip", nume: "nume" }));

    const result = await createImportBatch(fd);
    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected failure");
    expect(result.error).toContain("Confirmarea explicita");
  });

  it("builds rollback preview counts by entity", async () => {
    prismaMock.importBatch.findFirst.mockResolvedValue({
      id: "batch-1",
      status: "completed",
    });
    prismaMock.importRowLedger.findMany.mockResolvedValue([
      { entityType: "contribuabil", entityRecordId: "c-1" },
      { entityType: "proprietate_cladire", entityRecordId: "b-1" },
      { entityType: "proprietate_teren", entityRecordId: "t-1" },
      { entityType: "proprietate_vehicul", entityRecordId: "v-1" },
      { entityType: "contribuabil", entityRecordId: "c-2" },
    ]);

    const result = await getRollbackPreview("batch-1");
    expect(result.success).toBe(true);
    if (!result.success || !result.data) throw new Error("expected success");

    expect(result.data.importedRecords).toBe(5);
    expect(result.data.countsByEntity.contribuabil).toBe(2);
    expect(result.data.countsByEntity.proprietate_cladire).toBe(1);
    expect(result.data.countsByEntity.proprietate_teren).toBe(1);
    expect(result.data.countsByEntity.proprietate_vehicul).toBe(1);
    expect(result.data.canRollback).toBe(true);
  });
});
