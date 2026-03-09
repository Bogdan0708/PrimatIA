import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  requireAuthenticatedStaffMock,
  getStaffTotpStatusMock,
  createPendingTotpSetupTokenMock,
  verifyPendingTotpSetupTokenMock,
  auditStaffTotpChangeMock,
  prismaMock,
  verifyTotpCodeMock,
  generateTotpSecretMock,
  buildOtpAuthUrlMock,
} = vi.hoisted(() => ({
  requireAuthenticatedStaffMock: vi.fn(),
  getStaffTotpStatusMock: vi.fn(),
  createPendingTotpSetupTokenMock: vi.fn(),
  verifyPendingTotpSetupTokenMock: vi.fn(),
  auditStaffTotpChangeMock: vi.fn(),
  prismaMock: {
    tenantUser: {
      update: vi.fn(),
    },
  },
  verifyTotpCodeMock: vi.fn(),
  generateTotpSecretMock: vi.fn(),
  buildOtpAuthUrlMock: vi.fn(),
}));

vi.mock("@/app/api/auth/totp/_lib", () => ({
  requireAuthenticatedStaff: requireAuthenticatedStaffMock,
  getStaffTotpStatus: getStaffTotpStatusMock,
  createPendingTotpSetupToken: createPendingTotpSetupTokenMock,
  verifyPendingTotpSetupToken: verifyPendingTotpSetupTokenMock,
  auditStaffTotpChange: auditStaffTotpChangeMock,
  getTotpSetupCookieName: () => "staff-totp-setup",
}));

vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/totp", () => ({
  verifyTotpCode: verifyTotpCodeMock,
  generateTotpSecret: generateTotpSecretMock,
  buildOtpAuthUrl: buildOtpAuthUrlMock,
  formatTotpSecret: (value: string) => value,
}));

import { POST as setupTotp } from "@/app/api/auth/totp/setup/route";
import { POST as enableTotp } from "@/app/api/auth/totp/enable/route";
import { POST as disableTotp } from "@/app/api/auth/totp/disable/route";

describe("staff TOTP routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAuthenticatedStaffMock.mockResolvedValue({
      user: {
        id: "user-1",
        tenantId: "tenant-1",
        role: "operator",
      },
    });
  });

  it("starts TOTP setup for authenticated staff", async () => {
    getStaffTotpStatusMock.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      totpSecret: null,
    });
    generateTotpSecretMock.mockReturnValue("SECRET123");
    buildOtpAuthUrlMock.mockReturnValue("otpauth://totp/test");
    createPendingTotpSetupTokenMock.mockResolvedValue("pending-token");

    const response = await setupTotp();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual(
      expect.objectContaining({
        success: true,
        secret: "SECRET123",
        otpauthUrl: "otpauth://totp/test",
      })
    );
    expect(response.cookies.get("staff-totp-setup")?.value).toBe("pending-token");
  });

  it("enables TOTP after verifying the pending secret and code", async () => {
    verifyPendingTotpSetupTokenMock.mockResolvedValue({
      userId: "user-1",
      tenantId: "tenant-1",
      secret: "SECRET123",
    });
    getStaffTotpStatusMock.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      totpSecret: null,
    });
    verifyTotpCodeMock.mockReturnValue(true);
    prismaMock.tenantUser.update.mockResolvedValue({});

    const response = await enableTotp(
      new NextRequest("http://localhost/api/auth/totp/enable", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: "staff-totp-setup=pending-token",
        },
        body: JSON.stringify({ code: "123456" }),
      })
    );

    expect(response.status).toBe(200);
    expect(prismaMock.tenantUser.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { totpSecret: "SECRET123" },
    });
    expect(auditStaffTotpChangeMock).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      userId: "user-1",
      action: "enable",
    });
  });

  it("disables TOTP when the submitted code is valid", async () => {
    getStaffTotpStatusMock.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      totpSecret: "SECRET123",
    });
    verifyTotpCodeMock.mockReturnValue(true);
    prismaMock.tenantUser.update.mockResolvedValue({});

    const response = await disableTotp(
      new NextRequest("http://localhost/api/auth/totp/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "123456" }),
      })
    );

    expect(response.status).toBe(200);
    expect(prismaMock.tenantUser.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { totpSecret: null },
    });
    expect(auditStaffTotpChangeMock).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      userId: "user-1",
      action: "disable",
    });
  });
});
