import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { getCitizenFromRequestMock, withTenantScopeMock, prismaMock, writeAuditLogMock } =
  vi.hoisted(() => ({
    getCitizenFromRequestMock: vi.fn(),
    withTenantScopeMock: vi.fn(),
    prismaMock: {
      gdprErasureRequest: {
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      notificare: {
        deleteMany: vi.fn(),
        findMany: vi.fn(),
      },
      citizenUser: {
        findUnique: vi.fn(),
      },
      citizenContribuabilLink: {
        findMany: vi.fn(),
      },
      contribuabil: {
        findMany: vi.fn(),
      },
      proprietateCladire: {
        findMany: vi.fn(),
      },
      proprietateTeren: {
        findMany: vi.fn(),
      },
      proprietateVehicul: {
        findMany: vi.fn(),
      },
      impozit: {
        findMany: vi.fn(),
      },
      plata: {
        findMany: vi.fn(),
      },
      onlinePayment: {
        findMany: vi.fn(),
      },
      document: {
        findMany: vi.fn(),
      },
      consimtamant: {
        findMany: vi.fn(),
      },
    },
    writeAuditLogMock: vi.fn(),
  }));

vi.mock("@/lib/portal-auth", () => ({
  getCitizenFromRequest: getCitizenFromRequestMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
  withTenantScope: withTenantScopeMock,
}));

vi.mock("@/lib/rate-limit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rate-limit")>(
    "@/lib/rate-limit"
  );
  return {
    ...actual,
    checkSharedRateLimit: vi.fn(async () => ({
      allowed: true,
      limit: 1,
      remaining: 0,
      retryAfterSeconds: 0,
    })),
  };
});

vi.mock("@/lib/audit", () => ({
  writeAuditLog: writeAuditLogMock,
}));

const CITIZEN = {
  sub: "citizen-1",
  email: "cetatean@example.ro",
  tenantId: "tenant-1",
  firstName: "Ion",
  lastName: "Popescu",
  role: "cetatean" as const,
  isCitizen: true as const,
};

describe("GDPR routes write an audit-log entry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCitizenFromRequestMock.mockResolvedValue(CITIZEN);
    withTenantScopeMock.mockImplementation(async (_tenantId: string, callback: () => Promise<unknown>) =>
      callback()
    );
  });

  it("POST /api/portal/gdpr/erasure calls writeAuditLog once with gdpr.erasure.requested", async () => {
    const { POST } = await import("@/app/api/portal/gdpr/erasure/route");

    prismaMock.gdprErasureRequest.findFirst.mockResolvedValueOnce(null);
    prismaMock.gdprErasureRequest.create.mockResolvedValueOnce({
      id: "erasure-1",
      status: "pending",
    });
    prismaMock.notificare.deleteMany.mockResolvedValueOnce({ count: 2 });

    const response = await POST(
      new NextRequest("http://localhost/api/portal/gdpr/erasure", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: "nu mai folosesc serviciul" }),
      })
    );

    expect(response.status).toBe(200);
    expect(writeAuditLogMock).toHaveBeenCalledTimes(1);
    expect(writeAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-1",
        userId: "citizen-1",
        action: "gdpr.erasure.requested",
        entityType: "gdpr_erasure_request",
        entityId: "erasure-1",
      })
    );

    // No PII (name, email, reason text) leaked into the audit payload.
    const call = writeAuditLogMock.mock.calls[0][0];
    const serialized = JSON.stringify(call);
    expect(serialized).not.toMatch(/nu mai folosesc/);
    expect(serialized).not.toMatch(CITIZEN.email);
  });

  it("does not call writeAuditLog when an erasure request already exists", async () => {
    const { POST } = await import("@/app/api/portal/gdpr/erasure/route");

    prismaMock.gdprErasureRequest.findFirst.mockResolvedValueOnce({
      id: "erasure-existing",
      status: "pending",
    });

    const response = await POST(
      new NextRequest("http://localhost/api/portal/gdpr/erasure", {
        method: "POST",
      })
    );

    expect(response.status).toBe(200);
    expect(writeAuditLogMock).not.toHaveBeenCalled();
  });

  it("POST /api/portal/gdpr/data-export calls writeAuditLog once with gdpr.export.generated", async () => {
    const { POST } = await import("@/app/api/portal/gdpr/data-export/route");

    prismaMock.citizenUser.findUnique.mockResolvedValueOnce({
      id: "citizen-1",
      email: CITIZEN.email,
      firstName: "Ion",
      lastName: "Popescu",
      phone: null,
      emailVerified: true,
      limbaPreferata: "ro",
      createdAt: new Date(),
      lastLoginAt: null,
    });
    prismaMock.citizenContribuabilLink.findMany.mockResolvedValueOnce([]);
    prismaMock.contribuabil.findMany.mockResolvedValueOnce([]);
    prismaMock.proprietateCladire.findMany.mockResolvedValueOnce([]);
    prismaMock.proprietateTeren.findMany.mockResolvedValueOnce([]);
    prismaMock.proprietateVehicul.findMany.mockResolvedValueOnce([]);
    prismaMock.impozit.findMany.mockResolvedValueOnce([]);
    prismaMock.plata.findMany.mockResolvedValueOnce([]);
    prismaMock.onlinePayment.findMany.mockResolvedValueOnce([]);
    prismaMock.document.findMany.mockResolvedValueOnce([]);
    prismaMock.consimtamant.findMany.mockResolvedValueOnce([]);
    prismaMock.notificare.findMany.mockResolvedValueOnce([]);

    const response = await POST(
      new NextRequest("http://localhost/api/portal/gdpr/data-export", {
        method: "POST",
      })
    );

    expect(response.status).toBe(200);
    expect(writeAuditLogMock).toHaveBeenCalledTimes(1);
    expect(writeAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-1",
        userId: "citizen-1",
        action: "gdpr.export.generated",
        entityType: "citizen_user",
        entityId: "citizen-1",
      })
    );

    // ids only — no PII (name/email) in the audit payload itself.
    const call = writeAuditLogMock.mock.calls[0][0];
    const serialized = JSON.stringify(call);
    expect(serialized).not.toMatch(CITIZEN.email);
    expect(serialized).not.toMatch(/Popescu/);
  });
});
