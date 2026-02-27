import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    contribuabil: { findMany: vi.fn() },
    proprietateCladire: { findMany: vi.fn() },
    proprietateTeren: { findMany: vi.fn() },
    proprietateVehicul: { findMany: vi.fn() },
    impozit: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/db";
import { clearAnomalyCache, detectAnomalies } from "@/lib/ai/anomaly-detection";

const mockedContribuabilFindMany = vi.mocked(prisma.contribuabil.findMany);
const mockedCladireFindMany = vi.mocked(prisma.proprietateCladire.findMany);
const mockedTerenFindMany = vi.mocked(prisma.proprietateTeren.findMany);
const mockedVehiculFindMany = vi.mocked(prisma.proprietateVehicul.findMany);
const mockedImpozitFindMany = vi.mocked(prisma.impozit.findMany);

describe("anomaly detection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAnomalyCache("tenant-1");

    mockedContribuabilFindMany.mockResolvedValue([] as any);
    mockedCladireFindMany.mockResolvedValue([]);
    mockedTerenFindMany.mockResolvedValue([]);
    mockedVehiculFindMany.mockResolvedValue([]);
  });

  it("does not create PF/PJ false-positive outliers when groups are separated by taxpayer type", async () => {
    const taxes = [
      { id: "t1", contribuabilId: "pf1", sumaDatorata: 120, proprietateType: "cladire", contribuabil: { tip: "PF", nume: "PF1", prenume: null } },
      { id: "t2", contribuabilId: "pf2", sumaDatorata: 118, proprietateType: "cladire", contribuabil: { tip: "PF", nume: "PF2", prenume: null } },
      { id: "t3", contribuabilId: "pf3", sumaDatorata: 121, proprietateType: "cladire", contribuabil: { tip: "PF", nume: "PF3", prenume: null } },
      { id: "t4", contribuabilId: "pf4", sumaDatorata: 122, proprietateType: "cladire", contribuabil: { tip: "PF", nume: "PF4", prenume: null } },
      { id: "t5", contribuabilId: "pf5", sumaDatorata: 119, proprietateType: "cladire", contribuabil: { tip: "PF", nume: "PF5", prenume: null } },
      { id: "t6", contribuabilId: "pj1", sumaDatorata: 50000, proprietateType: "cladire", contribuabil: { tip: "PJ", nume: "PJ1", prenume: null } },
      { id: "t7", contribuabilId: "pj2", sumaDatorata: 52000, proprietateType: "cladire", contribuabil: { tip: "PJ", nume: "PJ2", prenume: null } },
      { id: "t8", contribuabilId: "pj3", sumaDatorata: 51000, proprietateType: "cladire", contribuabil: { tip: "PJ", nume: "PJ3", prenume: null } },
      { id: "t9", contribuabilId: "pj4", sumaDatorata: 50500, proprietateType: "cladire", contribuabil: { tip: "PJ", nume: "PJ4", prenume: null } },
      { id: "t10", contribuabilId: "pj5", sumaDatorata: 51500, proprietateType: "cladire", contribuabil: { tip: "PJ", nume: "PJ5", prenume: null } },
    ];
    mockedImpozitFindMany.mockResolvedValue(taxes as any);

    const anomalies = await detectAnomalies("tenant-1");
    const outliers = anomalies.filter((a) => a.type === "outlier_amount");

    expect(outliers).toHaveLength(0);
  });

  it("uses contribuabilId as outlier entityId so profile links target valid taxpayer routes", async () => {
    const taxes = [
      { id: "imp-a1", contribuabilId: "c1", sumaDatorata: 100, proprietateType: "teren", contribuabil: { tip: "PF", nume: "A", prenume: null } },
      { id: "imp-a2", contribuabilId: "c2", sumaDatorata: 100, proprietateType: "teren", contribuabil: { tip: "PF", nume: "B", prenume: null } },
      { id: "imp-a3", contribuabilId: "c3", sumaDatorata: 100, proprietateType: "teren", contribuabil: { tip: "PF", nume: "C", prenume: null } },
      { id: "imp-a4", contribuabilId: "c4", sumaDatorata: 100, proprietateType: "teren", contribuabil: { tip: "PF", nume: "D", prenume: null } },
      { id: "imp-a5", contribuabilId: "c5", sumaDatorata: 100, proprietateType: "teren", contribuabil: { tip: "PF", nume: "E", prenume: null } },
      { id: "imp-outlier", contribuabilId: "c-outlier", sumaDatorata: 2000, proprietateType: "teren", contribuabil: { tip: "PF", nume: "Out", prenume: null } },
    ];
    mockedImpozitFindMany.mockResolvedValue(taxes as any);

    const anomalies = await detectAnomalies("tenant-1");
    const outlier = anomalies.find((a) => a.type === "outlier_amount");

    expect(outlier).toBeDefined();
    expect(outlier?.entityType).toBe("contribuabil");
    expect(outlier?.entityId).toBe("c-outlier");
    expect(outlier?.description).toContain("imp-outl");
  });
});
