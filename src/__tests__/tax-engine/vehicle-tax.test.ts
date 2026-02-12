import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  VehicleTaxInput,
  HclDecisionContext,
  ExemptionContext,
} from "@/lib/tax-engine/types";

vi.mock("@/lib/db", () => ({
  prisma: {
    taxRateTable: {
      findFirst: vi.fn(),
    },
  },
}));

import { calculateVehicleTax } from "@/lib/tax-engine/vehicle-tax";
import { prisma } from "@/lib/db";

const mockedFindFirst = vi.mocked(prisma.taxRateTable.findFirst);

// --- Helpers ---

function makeHcl(overrides?: Partial<HclDecisionContext>): HclDecisionContext {
  return {
    id: "hcl-2024",
    fiscalYear: 2024,
    ...overrides,
  };
}

function makeInput(overrides?: Partial<VehicleTaxInput>): VehicleTaxInput {
  return {
    vehicleId: "veh-1",
    contribuabilId: "ctb-1",
    tenantId: "tenant-1",
    fiscalYear: 2024,
    tipVehicul: "autoturism",
    cilindreeCmc: 1500,
    normaPoluare: "euro_4",
    anFabricatie: 2018,
    dataDobandire: new Date(2020, 0, 1),
    ...overrides,
  };
}

/**
 * Mock a vehicle rate entry. The vehicle findVehicleRate returns the raw
 * Prisma result, so we include an `id` and `rateValue` that the
 * calculator reads via Number(entry.rateValue).
 */
function mockVehicleRate(rateValue: number, category?: string) {
  mockedFindFirst.mockResolvedValueOnce({
    id: "rate-veh-1",
    tenantId: "tenant-1",
    hclDecisionId: "hcl-2024",
    taxType: "impozit_mijloace_transport",
    rateType: "fixed",
    rateValue,
    unit: null,
    minRate: null,
    maxRate: null,
    category: category ?? "autoturism_sub_1600",
    zona: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  } as any);
}

// --- Tests ---

describe("calculateVehicleTax", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calculates car (autoturism) 1500cc: bracket sub_1600, ceil(1500/200)=8 units * rate", async () => {
    const ratePerUnit = 8; // 8 lei per 200cc bracket
    mockVehicleRate(ratePerUnit, "autoturism_sub_1600");

    const result = await calculateVehicleTax(
      makeInput({ cilindreeCmc: 1500, normaPoluare: "euro_4" }),
      makeHcl(),
      []
    );

    expect(result.bazaImpozabila).toBe(1500);
    expect(result.rataAplicata).toBe(8);
    // ceil(1500/200) = 8 units, 8 * 8 = 64 lei
    // euro_4 adjustment = 1.0, so 64 * 1.0 = 64
    // full year: 64 * 12/12 = 64
    expect(result.sumaCalculata).toBe(64);
    expect(result.sumaDatorata).toBe(64);
    expect(result.nrLuni).toBe(12);
  });

  it("calculates car 2500cc: bracket 2001_2600", async () => {
    const ratePerUnit = 18;
    mockVehicleRate(ratePerUnit, "autoturism_2001_2600");

    const result = await calculateVehicleTax(
      makeInput({ cilindreeCmc: 2500, normaPoluare: "euro_4" }),
      makeHcl(),
      []
    );

    expect(result.bazaImpozabila).toBe(2500);
    // ceil(2500/200) = 13 units, 13 * 18 = 234
    expect(result.sumaCalculata).toBe(234);

    // Verify the lookup used the correct category
    expect(mockedFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          category: "autoturism_2001_2600",
        }),
      })
    );
  });

  it("calculates motorcycle (motocicleta) 250cc: bracket 201_500, flat rate", async () => {
    const flatRate = 50; // flat rate for 201-500cc motorcycle
    mockVehicleRate(flatRate, "motocicleta_201_500");

    const result = await calculateVehicleTax(
      makeInput({
        tipVehicul: "motocicleta",
        cilindreeCmc: 250,
        normaPoluare: "euro_4",
      }),
      makeHcl(),
      []
    );

    expect(result.bazaImpozabila).toBe(250);
    // Motorcycles use flat rate (not per 200cc)
    // sumaCalculata = rataAplicata = 50, euro_4 adj = 1.0
    expect(result.sumaCalculata).toBe(50);
  });

  it("calculates bus (autobuz) 40 seats: per-seat rate", async () => {
    const ratePerSeat = 5; // 5 lei per seat
    mockVehicleRate(ratePerSeat, "autobuz");

    const result = await calculateVehicleTax(
      makeInput({
        tipVehicul: "autobuz",
        nrLocuri: 40,
        cilindreeCmc: undefined,
        normaPoluare: "euro_4",
      }),
      makeHcl(),
      []
    );

    expect(result.bazaImpozabila).toBe(40); // nr seats
    expect(result.rataAplicata).toBe(5);
    // 40 * 5 = 200, euro_4 = 1.0
    expect(result.sumaCalculata).toBe(200);
  });

  it("calculates truck (camion) 12000kg: per-ton rate", async () => {
    const ratePerTon = 30; // 30 lei per ton
    mockVehicleRate(ratePerTon, "camion");

    const result = await calculateVehicleTax(
      makeInput({
        tipVehicul: "camion",
        masaTotalaKg: 12000,
        cilindreeCmc: undefined,
        normaPoluare: "euro_4",
      }),
      makeHcl(),
      []
    );

    // 12000 kg / 1000 = 12 tons
    expect(result.bazaImpozabila).toBe(12);
    expect(result.rataAplicata).toBe(30);
    // 12 * 30 = 360, euro_4 = 1.0
    expect(result.sumaCalculata).toBe(360);
  });

  it("calculates tractor: flat rate", async () => {
    const flatRate = 120;
    mockVehicleRate(flatRate, "tractor");

    const result = await calculateVehicleTax(
      makeInput({
        tipVehicul: "tractor",
        cilindreeCmc: undefined,
        normaPoluare: "euro_4",
      }),
      makeHcl(),
      []
    );

    expect(result.bazaImpozabila).toBe(1); // flat rate, base = 1
    expect(result.rataAplicata).toBe(120);
    // sumaCalculata = 120
    expect(result.sumaCalculata).toBe(120);
  });

  describe("Euro norm adjustments", () => {
    it("non_euro: 1.5x surcharge", async () => {
      mockVehicleRate(8, "autoturism_sub_1600");

      const result = await calculateVehicleTax(
        makeInput({ cilindreeCmc: 1500, normaPoluare: "non_euro" }),
        makeHcl(),
        []
      );

      // 8 units * 8 = 64, * 1.5 = 96
      expect(result.sumaCalculata).toBe(96);
    });

    it("euro_6: 0.9x discount", async () => {
      mockVehicleRate(10, "autoturism_sub_1600");

      const result = await calculateVehicleTax(
        makeInput({ cilindreeCmc: 1500, normaPoluare: "euro_6" }),
        makeHcl(),
        []
      );

      // 8 units * 10 = 80, * 0.9 = 72
      expect(result.sumaCalculata).toBe(72);
    });

    it("euro_4: 1.0x (no adjustment)", async () => {
      mockVehicleRate(10, "autoturism_sub_1600");

      const result = await calculateVehicleTax(
        makeInput({ cilindreeCmc: 1500, normaPoluare: "euro_4" }),
        makeHcl(),
        []
      );

      // 8 units * 10 = 80, * 1.0 = 80
      expect(result.sumaCalculata).toBe(80);
    });

    it("defaults to euro_4 (1.0x) when normaPoluare is undefined", async () => {
      mockVehicleRate(10, "autoturism_sub_1600");

      const result = await calculateVehicleTax(
        makeInput({ cilindreeCmc: 1500, normaPoluare: undefined }),
        makeHcl(),
        []
      );

      // 8 * 10 = 80, * 1.0 = 80
      expect(result.sumaCalculata).toBe(80);
    });
  });

  it("prorates for partial year: acquired Aug 1 -> 4 months (Sep-Dec)", async () => {
    mockVehicleRate(8, "autoturism_sub_1600");

    const result = await calculateVehicleTax(
      makeInput({
        cilindreeCmc: 1500,
        normaPoluare: "euro_4",
        dataDobandire: new Date(2024, 7, 1), // Aug 1, 2024
      }),
      makeHcl(),
      []
    );

    // Tax starts Sep 1. Sep-Dec = 4 months.
    expect(result.nrLuni).toBe(4);
    // 8 * 8 = 64 (full year), 64 * 4/12 = 21.333 -> roundToLei = 21
    expect(result.sumaCalculata).toBe(21);
  });

  it("applies exemptions to vehicle tax", async () => {
    mockVehicleRate(8, "autoturism_sub_1600");

    const exemptions: ExemptionContext[] = [
      { discountPercent: 100, ruleId: "rule-1", ruleName: "Handicap gr. I" },
    ];

    const result = await calculateVehicleTax(
      makeInput({ cilindreeCmc: 1500, normaPoluare: "euro_4" }),
      makeHcl(),
      exemptions
    );

    // sumaCalculata = 64
    // sumaScutire = round(64 * 1.0) = 64
    expect(result.sumaScutire).toBe(64);
    expect(result.sumaDatorata).toBe(0);
  });

  it("throws an error when no rate is found for the vehicle category", async () => {
    mockedFindFirst.mockResolvedValueOnce(null);

    await expect(
      calculateVehicleTax(
        makeInput({ cilindreeCmc: 1500 }),
        makeHcl(),
        []
      )
    ).rejects.toThrow(/No rate for vehicle/);
  });

  it("calculates bonificatie and installments", async () => {
    mockVehicleRate(10, "autoturism_sub_1600");

    const result = await calculateVehicleTax(
      makeInput({ cilindreeCmc: 1500, normaPoluare: "euro_4" }),
      makeHcl(),
      []
    );

    // sumaCalculata = 80, sumaDatorata = 80
    expect(result.sumaDatorata).toBe(80);
    // bonificatie = round(80 * 0.1) = 8
    expect(result.bonificatie).toBe(8);
    // installments: half = floor(80/2) = 40, rata1 = 80-40 = 40
    expect(result.rata1).toBe(40);
    expect(result.rata2).toBe(40);
  });
});
