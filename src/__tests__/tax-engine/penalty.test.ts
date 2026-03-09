import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    impozit: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    penalitate: {
      findFirst: vi.fn(),
      createMany: vi.fn(),
      aggregate: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";
import { calculatePenalties } from "@/lib/tax-engine/penalty";

const mockedImpozitFindUnique = vi.mocked(prisma.impozit.findUnique);
const mockedImpozitUpdate = vi.mocked(prisma.impozit.update);
const mockedPenaltyFindFirst = vi.mocked(prisma.penalitate.findFirst);
const mockedPenaltyCreateMany = vi.mocked(prisma.penalitate.createMany);
const mockedPenaltyAggregate = vi.mocked(prisma.penalitate.aggregate);

describe("calculatePenalties", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedPenaltyFindFirst.mockResolvedValue(null as never);
    mockedPenaltyCreateMany.mockResolvedValue({ count: 0 } as never);
    mockedPenaltyAggregate.mockResolvedValue({
      _sum: { sumaPenalizare: 0.2 },
    } as never);
    mockedImpozitUpdate.mockResolvedValue({} as never);
  });

  it("starts from the second installment when the first installment is already fully paid", async () => {
    mockedImpozitFindUnique.mockResolvedValueOnce({
      id: "imp-1",
      sumaDatorata: 100,
      sumaPlatita: 50,
      rata1: 50,
      rata2: 50,
      rata1Scadenta: new Date("2026-03-31"),
      rata2Scadenta: new Date("2026-09-30"),
    } as never);

    const result = await calculatePenalties(
      "tenant-1",
      "imp-1",
      new Date("2026-10-02")
    );

    expect(result.newRecords).toBe(2);
    expect(mockedPenaltyCreateMany).toHaveBeenCalledTimes(1);

    const payload = mockedPenaltyCreateMany.mock.calls[0]?.[0];
    const records = Array.isArray(payload?.data) ? payload.data : [];

    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({
      dataCalcul: new Date("2026-10-01"),
      sumaRestanta: 50,
    });
    expect(records[1]).toMatchObject({
      dataCalcul: new Date("2026-10-02"),
      sumaRestanta: 50,
    });
  });

  it("uses only the first overdue installment before the second due date", async () => {
    mockedImpozitFindUnique.mockResolvedValueOnce({
      id: "imp-2",
      sumaDatorata: 100,
      sumaPlatita: 0,
      rata1: 40,
      rata2: 60,
      rata1Scadenta: new Date("2026-03-31"),
      rata2Scadenta: new Date("2026-09-30"),
    } as never);

    const result = await calculatePenalties(
      "tenant-1",
      "imp-2",
      new Date("2026-04-02")
    );

    expect(result.newRecords).toBe(2);

    const payload = mockedPenaltyCreateMany.mock.calls[0]?.[0];
    const records = Array.isArray(payload?.data) ? payload.data : [];

    expect(records[0]).toMatchObject({
      dataCalcul: new Date("2026-04-01"),
      sumaRestanta: 40,
    });
    expect(records[1]).toMatchObject({
      dataCalcul: new Date("2026-04-02"),
      sumaRestanta: 40,
    });
  });
});
