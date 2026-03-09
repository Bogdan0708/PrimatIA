import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: authMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: {},
  withTenantScope: vi.fn(),
}));

import { POST } from "@/app/api/payments/bank-transfer/confirm/route";

describe("POST /api/payments/bank-transfer/confirm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows primaria_admin to reach request validation", async () => {
    authMock.mockResolvedValueOnce({
      user: {
        id: "user-1",
        tenantId: "tenant-1",
        role: "primaria_admin",
      },
    });

    const response = await POST(
      new Request("http://localhost/api/payments/bank-transfer/confirm", {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
      }) as never
    );

    expect(response.status).toBe(400);
  });

  it("rejects unauthorized roles before processing", async () => {
    authMock.mockResolvedValueOnce({
      user: {
        id: "user-2",
        tenantId: "tenant-1",
        role: "cetatean",
      },
    });

    const response = await POST(
      new Request("http://localhost/api/payments/bank-transfer/confirm", {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
      }) as never
    );

    expect(response.status).toBe(403);
  });
});
