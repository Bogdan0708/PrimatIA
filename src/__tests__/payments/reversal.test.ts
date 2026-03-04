import { describe, it, expect, vi, beforeEach } from "vitest";
import { Decimal } from "@prisma/client/runtime/library";

// vi.mock factory must not reference outside variables (hoisted)
vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}));

import { reversePayment, type ReversalInput } from "@/lib/payments/reversal";
import { prisma } from "@/lib/db";

const baseInput: ReversalInput = {
  plataId: "plata-001",
  tenantId: "tenant-001",
  reversedById: "user-001",
  reason: "Eroare la înregistrare",
};

describe("reversePayment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when payment is not found", async () => {
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
      return (fn as (tx: unknown) => Promise<unknown>)({
        $queryRaw: async () => [],
        plata: { findUniqueOrThrow: vi.fn(), update: vi.fn(), create: vi.fn() },
        impozit: { findUnique: vi.fn() },
        auditLog: { create: vi.fn() },
      });
    });

    const result = await reversePayment(baseInput);
    expect(result).toEqual({ success: false, error: "Payment not found" });
  });

  it("returns error when payment is already reversed", async () => {
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
      return (fn as (tx: unknown) => Promise<unknown>)({
        $queryRaw: async () => [{ id: "plata-001", reversal_status: "reversed" }],
        plata: { findUniqueOrThrow: vi.fn(), update: vi.fn(), create: vi.fn() },
        impozit: { findUnique: vi.fn() },
        auditLog: { create: vi.fn() },
      });
    });

    const result = await reversePayment(baseInput);
    expect(result).toEqual({ success: false, error: "Payment already reversed" });
  });

  it("creates storno record and returns success", async () => {
    const stornoId = "storno-001";

    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
      return (fn as (tx: unknown) => Promise<unknown>)({
        $queryRaw: async () => [{ id: "plata-001", reversal_status: null }],
        plata: {
          findUniqueOrThrow: vi.fn().mockResolvedValue({
            id: "plata-001",
            contribuabilId: "contrib-001",
            suma: new Decimal("100.00"),
            platiDistributie: [
              {
                impozitId: "impozit-001",
                sumaDebit: new Decimal("80.00"),
                sumaPenalitati: new Decimal("20.00"),
              },
            ],
          }),
          update: vi.fn(),
          create: vi.fn().mockResolvedValue({ id: stornoId }),
        },
        impozit: {
          findUnique: vi.fn().mockResolvedValue({
            id: "impozit-001",
            sumaPlatita: new Decimal("100.00"),
            sumaDatorata: new Decimal("200.00"),
            sumaPenalitati: new Decimal("20.00"),
            status: "partial_platit",
          }),
          update: vi.fn(),
        },
        auditLog: { create: vi.fn() },
      });
    });

    const result = await reversePayment(baseInput);
    expect(result).toEqual({ success: true, stornoPlataId: stornoId });
  });

  it("sets tax status to calculat when paid amount goes to zero", async () => {
    let impozitUpdateData: { sumaPlatita?: Decimal; status?: string } | undefined;

    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
      return (fn as (tx: unknown) => Promise<unknown>)({
        $queryRaw: async () => [{ id: "plata-001", reversal_status: null }],
        plata: {
          findUniqueOrThrow: vi.fn().mockResolvedValue({
            id: "plata-001",
            contribuabilId: "contrib-001",
            suma: new Decimal("100.00"),
            platiDistributie: [
              {
                impozitId: "impozit-001",
                sumaDebit: new Decimal("100.00"),
                sumaPenalitati: new Decimal("0.00"),
              },
            ],
          }),
          update: vi.fn(),
          create: vi.fn().mockResolvedValue({ id: "storno-001" }),
        },
        impozit: {
          findUnique: vi.fn().mockResolvedValue({
            id: "impozit-001",
            sumaPlatita: new Decimal("100.00"),
            sumaDatorata: new Decimal("200.00"),
            sumaPenalitati: new Decimal("0.00"),
            status: "partial_platit",
          }),
          update: vi.fn().mockImplementation(({ data }: { data: typeof impozitUpdateData }) => {
            impozitUpdateData = data;
          }),
        },
        auditLog: { create: vi.fn() },
      });
    });

    await reversePayment(baseInput);
    expect(impozitUpdateData?.status).toBe("calculat");
    expect(impozitUpdateData?.sumaPlatita?.toString()).toBe("0");
  });

  it("propagates unexpected errors", async () => {
    vi.mocked(prisma.$transaction).mockRejectedValue(new Error("DB connection lost"));

    await expect(reversePayment(baseInput)).rejects.toThrow("DB connection lost");
  });
});
