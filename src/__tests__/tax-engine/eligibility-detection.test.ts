import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireAdminMock,
  withTenantScopeMock,
  revalidatePathMock,
  prismaMock,
} = vi.hoisted(() => ({
  requireAdminMock: vi.fn(),
  withTenantScopeMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  prismaMock: {
    scutireRegula: {
      findMany: vi.fn(),
    },
    contribuabil: {
      findMany: vi.fn(),
    },
    scutireContribuabil: {
      findMany: vi.fn(),
      createMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth-utils", () => ({
  requireAdmin: requireAdminMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
  setTenantContext: vi.fn(),
  withTenantScope: withTenantScopeMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("@/lib/ai/anomaly-detection", () => ({
  clearAnomalyCache: vi.fn(),
}));

vi.mock("@/lib/tax-engine", async () => {
  const actual = await vi.importActual<typeof import("@/lib/tax-engine")>(
    "@/lib/tax-engine"
  );
  return {
    ...actual,
    calculateAllTaxesForContribuabil: vi.fn(),
    resolveActiveHcl: vi.fn(),
  };
});

import { runEligibilityDetection } from "@/app/[locale]/(authenticated)/admin/calcul/_actions/calcul-actions";

describe("runEligibilityDetection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminMock.mockResolvedValue({
      user: { id: "user-1", tenantId: "tenant-1" },
    });
    // withTenantScope executes the callback directly
    withTenantScopeMock.mockImplementation(
      (_tenantId: string, fn: () => Promise<unknown>) => fn()
    );
  });

  it("creates pending detections and skips existing records", async () => {
    prismaMock.scutireRegula.findMany.mockResolvedValue([
      {
        id: "rule-disabled",
        nameRo: "Handicap",
        conditions: {
          scope: "taxpayer",
          requires: ["handicapGrav"],
          autoApprove: false,
        },
        discountPercent: 100,
      },
      {
        id: "rule-cult",
        nameRo: "Cult religios",
        conditions: {
          scope: "property",
          propertyType: "cladire",
          requires: "isCultReligios",
          autoApprove: true,
        },
        discountPercent: 100,
      },
      {
        id: "rule-pensioner",
        nameRo: "Pensionar",
        conditions: {
          scope: "taxpayer",
          requires: ["pensionar"],
          autoApprove: false,
        },
        discountPercent: 50,
      },
    ]);

    prismaMock.contribuabil.findMany.mockResolvedValue([
      {
        id: "c-1",
        tip: "PF",
        handicapGrav: true,
        handicapCertNr: "CERT-123",
        handicapCertExp: new Date("2099-01-01"),
        veteranRazboi: false,
        vaduvaVeteran: false,
        erouRevolutie: false,
        organizatieNonpro: false,
        pensionar: true,
        proprietatiCladiri: [
          { id: "b-1", isCultReligios: true, isMonumentIstoric: false },
        ],
        proprietatiTerenuri: [],
      },
    ]);

    // Pre-loaded existing exemptions: cult religios already exists
    prismaMock.scutireContribuabil.findMany.mockResolvedValue([
      {
        contribuabilId: "c-1",
        scutireRegulaId: "rule-cult",
        proprietateType: "cladire",
        proprietateId: "b-1",
      },
    ]);

    prismaMock.scutireContribuabil.createMany.mockResolvedValue({ count: 2 });

    const result = await runEligibilityDetection(2026);

    expect(result.success).toBe(true);
    if (!result.success || !result.data) throw new Error("expected success result");

    expect(result.data.checked).toBe(1);
    expect(result.data.detected).toBe(2); // handicap + pensioner
    expect(result.data.skipped).toBe(1); // cult religios already exists
    expect(result.data.errors).toBe(0);

    // Verify createMany was called with the 2 detected records
    expect(prismaMock.scutireContribuabil.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          tenantId: "tenant-1",
          contribuabilId: "c-1",
          scutireRegulaId: "rule-disabled",
          status: "pending",
          note: "Detectat automat — handicapGrav",
        }),
        expect.objectContaining({
          tenantId: "tenant-1",
          contribuabilId: "c-1",
          scutireRegulaId: "rule-pensioner",
          status: "pending",
          note: "Detectat automat — pensionar",
        }),
      ]),
      skipDuplicates: true,
    });
  });

  it("does not detect handicap eligibility when the certificate is expired", async () => {
    prismaMock.scutireRegula.findMany.mockResolvedValue([
      {
        id: "rule-disabled",
        nameRo: "Handicap",
        conditions: {
          scope: "taxpayer",
          requires: ["handicapGrav"],
          autoApprove: false,
        },
        discountPercent: 100,
      },
    ]);

    prismaMock.contribuabil.findMany.mockResolvedValue([
      {
        id: "c-1",
        tip: "PF",
        handicapGrav: true,
        handicapCertNr: "CERT-OLD",
        handicapCertExp: new Date("2020-01-01"),
        veteranRazboi: false,
        vaduvaVeteran: false,
        erouRevolutie: false,
        organizatieNonpro: false,
        pensionar: false,
        proprietatiCladiri: [],
        proprietatiTerenuri: [],
      },
    ]);

    // No existing exemptions
    prismaMock.scutireContribuabil.findMany.mockResolvedValue([]);

    const result = await runEligibilityDetection(2026);

    expect(result.success).toBe(true);
    if (!result.success || !result.data) throw new Error("expected success result");

    expect(result.data.detected).toBe(0);
    expect(prismaMock.scutireContribuabil.createMany).not.toHaveBeenCalled();
  });
});
