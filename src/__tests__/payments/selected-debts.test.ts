import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    impozit: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";
import {
  SelectedDebtValidationError,
  validateSelectedDebtsForContribuabil,
} from "@/lib/payments/selected-debts";

const mockedFindMany = vi.mocked(prisma.impozit.findMany);

describe("validateSelectedDebtsForContribuabil", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts debts that belong to the requested contribuabil and tenant", async () => {
    mockedFindMany.mockResolvedValueOnce([
      {
        id: "550e8400-e29b-41d4-a716-446655440001",
        tenantId: "tenant-1",
        contribuabilId: "550e8400-e29b-41d4-a716-446655440010",
        fiscalYear: 2026,
        sumaDatorata: 100,
        sumaPenalitati: 10,
        sumaPlatita: 20,
        taxType: { code: "impozit_cladiri", name: { ro: "Impozit cladiri" } },
      },
    ] as never);

    const result = await validateSelectedDebtsForContribuabil({
      tenantId: "tenant-1",
      contribuabilId: "550e8400-e29b-41d4-a716-446655440010",
      items: [
        {
          impozitId: "550e8400-e29b-41d4-a716-446655440001",
          amount: 90,
          description: "tampered by client",
        },
      ],
    });

    expect(result.totalAmount).toBe(90);
    expect(result.items).toEqual([
      {
        impozitId: "550e8400-e29b-41d4-a716-446655440001",
        amount: 90,
        description: "Impozit cladiri 2026",
      },
    ]);
  });

  it("rejects debts outside the requested contribuabil scope", async () => {
    mockedFindMany.mockResolvedValueOnce([] as never);

    await expect(
      validateSelectedDebtsForContribuabil({
        tenantId: "tenant-1",
        contribuabilId: "550e8400-e29b-41d4-a716-446655440010",
        items: [
          {
            impozitId: "550e8400-e29b-41d4-a716-446655440099",
            amount: 50,
          },
        ],
      })
    ).rejects.toThrow(SelectedDebtValidationError);
  });

  it("rejects amounts above the current outstanding balance", async () => {
    mockedFindMany.mockResolvedValueOnce([
      {
        id: "550e8400-e29b-41d4-a716-446655440001",
        tenantId: "tenant-1",
        contribuabilId: "550e8400-e29b-41d4-a716-446655440010",
        fiscalYear: 2026,
        sumaDatorata: 100,
        sumaPenalitati: 0,
        sumaPlatita: 25,
        taxType: { code: "impozit_teren", name: { ro: "Impozit teren" } },
      },
    ] as never);

    await expect(
      validateSelectedDebtsForContribuabil({
        tenantId: "tenant-1",
        contribuabilId: "550e8400-e29b-41d4-a716-446655440010",
        items: [
          {
            impozitId: "550e8400-e29b-41d4-a716-446655440001",
            amount: 80,
          },
        ],
      })
    ).rejects.toThrow("Selected amount exceeds outstanding balance");
  });
});
