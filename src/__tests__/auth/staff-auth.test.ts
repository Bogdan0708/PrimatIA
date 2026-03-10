import { beforeEach, describe, expect, it, vi } from "vitest";

const { compareMock, verifyTotpCodeMock, decryptStringMock, prismaMock } = vi.hoisted(() => ({
  compareMock: vi.fn(),
  verifyTotpCodeMock: vi.fn(),
  decryptStringMock: vi.fn(),
  prismaMock: {
    tenantUser: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("bcryptjs", () => ({
  compare: compareMock,
}));

vi.mock("@/lib/totp", () => ({
  verifyTotpCode: verifyTotpCodeMock,
}));

vi.mock("@/lib/crypto", () => ({
  decryptString: decryptStringMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
  withTenantScope: (_tenantId: string, fn: () => unknown) => fn(),
}));

import { authorizeStaffCredentials } from "@/lib/staff-auth";

describe("authorizeStaffCredentials", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    decryptStringMock.mockReturnValue("decrypted-secret");
  });

  it("authenticates password-only users", async () => {
    prismaMock.tenantUser.findFirst.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      role: "operator",
      tenantId: "tenant-1",
      firstName: "Ana",
      lastName: "Pop",
      passwordHash: "hash",
      loginAttempts: 0,
      lockedUntil: null,
      totpSecret: null,
      tenant: { status: "active" },
    });
    compareMock.mockResolvedValue(true);
    prismaMock.tenantUser.update.mockResolvedValue({});

    const result = await authorizeStaffCredentials({
      email: "user@example.com",
      password: "password",
      tenantId: "tenant-1",
    });

    expect(result).toEqual(
      expect.objectContaining({
        id: "user-1",
        tenantId: "tenant-1",
        role: "operator",
      })
    );
    expect(prismaMock.tenantUser.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          email: "user@example.com",
          tenantId: "tenant-1",
        }),
      })
    );
    expect(verifyTotpCodeMock).not.toHaveBeenCalled();
  });

  it("requires a valid TOTP code when configured", async () => {
    prismaMock.tenantUser.findFirst.mockResolvedValue({
      id: "user-2",
      email: "admin@example.com",
      role: "primaria_admin",
      tenantId: "tenant-1",
      firstName: "Ion",
      lastName: "Ionescu",
      passwordHash: "hash",
      loginAttempts: 1,
      lockedUntil: null,
      totpSecret: "SECRET123",
      tenant: { status: "active" },
    });
    compareMock.mockResolvedValue(true);
    verifyTotpCodeMock.mockReturnValue(false);

    const result = await authorizeStaffCredentials({
      email: "admin@example.com",
      password: "password",
      totpCode: "123456",
      tenantId: "tenant-1",
    });

    expect(result).toBeNull();
    expect(decryptStringMock).toHaveBeenCalledWith("SECRET123");
    expect(verifyTotpCodeMock).toHaveBeenCalledWith("decrypted-secret", "123456");
    expect(prismaMock.tenantUser.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-2" },
        data: expect.objectContaining({ loginAttempts: 2 }),
      })
    );
  });
});
