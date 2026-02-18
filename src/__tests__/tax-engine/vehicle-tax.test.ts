import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  VehicleTaxInput,
  HclDecisionContext,
  ExemptionContext,
} from "@/lib/tax-engine/types";
import type { TaxRateTable } from "@prisma/client";

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
  } as unknown as TaxRateTable);
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

  describe("Truck axle-weight calculator (Art. 470)", () => {
    it("C2 pneumatic, 14.5t -> 148 lei", async () => {
      const result = await calculateVehicleTax(
        makeInput({
          tipVehicul: "camion",
          masaTotalaKg: 14500,
          nrAxe: 2,
          tipSuspensie: "pneumatic",
          cilindreeCmc: undefined,
          normaPoluare: "euro_4",
        }),
        makeHcl(),
        []
      );

      expect(result.bazaImpozabila).toBe(14.5);
      expect(result.rataAplicata).toBe(148);
      expect(result.sumaCalculata).toBe(148);
      expect(result.rateTableId).toBe("weight_table_camion_C2_pneumatic");
    });

    it("C2 other (mechanical), 16t -> 988 lei", async () => {
      const result = await calculateVehicleTax(
        makeInput({
          tipVehicul: "camion",
          masaTotalaKg: 16000,
          nrAxe: 2,
          tipSuspensie: "other",
          cilindreeCmc: undefined,
          normaPoluare: "euro_4",
        }),
        makeHcl(),
        []
      );

      expect(result.bazaImpozabila).toBe(16);
      expect(result.rataAplicata).toBe(988);
      expect(result.sumaCalculata).toBe(988);
    });

    it("C3 pneumatic, 20t -> 352 lei", async () => {
      const result = await calculateVehicleTax(
        makeInput({
          tipVehicul: "camion",
          masaTotalaKg: 20000,
          nrAxe: 3,
          tipSuspensie: "pneumatic",
          cilindreeCmc: undefined,
          normaPoluare: "euro_4",
        }),
        makeHcl(),
        []
      );

      expect(result.bazaImpozabila).toBe(20);
      expect(result.rataAplicata).toBe(352);
      expect(result.sumaCalculata).toBe(352);
    });

    it("C4 other, 30t -> 3201 lei", async () => {
      const result = await calculateVehicleTax(
        makeInput({
          tipVehicul: "camion",
          masaTotalaKg: 30000,
          nrAxe: 5,
          tipSuspensie: "other",
          cilindreeCmc: undefined,
          normaPoluare: "euro_4",
        }),
        makeHcl(),
        []
      );

      expect(result.bazaImpozabila).toBe(30);
      expect(result.rataAplicata).toBe(3201);
      expect(result.sumaCalculata).toBe(3201);
    });

    it("C4 pneumatic, 26t -> 855 lei", async () => {
      const result = await calculateVehicleTax(
        makeInput({
          tipVehicul: "camion",
          masaTotalaKg: 26000,
          nrAxe: 4,
          tipSuspensie: "pneumatic",
          cilindreeCmc: undefined,
          normaPoluare: "euro_4",
        }),
        makeHcl(),
        []
      );

      expect(result.bazaImpozabila).toBe(26);
      expect(result.rataAplicata).toBe(855);
      expect(result.sumaCalculata).toBe(855);
    });

    it("prorates truck tax for partial year", async () => {
      const result = await calculateVehicleTax(
        makeInput({
          tipVehicul: "camion",
          masaTotalaKg: 14500,
          nrAxe: 2,
          tipSuspensie: "pneumatic",
          cilindreeCmc: undefined,
          normaPoluare: "euro_4",
          dataDobandire: new Date(2024, 5, 1), // June 1 -> 6 months (Jul-Dec)
        }),
        makeHcl(),
        []
      );

      expect(result.nrLuni).toBe(6);
      // 148 * 6/12 = 74
      expect(result.sumaCalculata).toBe(74);
    });

    it("does not apply euro norm to weight-table trucks", async () => {
      const result = await calculateVehicleTax(
        makeInput({
          tipVehicul: "camion",
          masaTotalaKg: 14500,
          nrAxe: 2,
          tipSuspensie: "pneumatic",
          cilindreeCmc: undefined,
          normaPoluare: "non_euro", // would be 1.5x if applied
        }),
        makeHcl(),
        []
      );

      // Should still be 148, not 148 * 1.5
      expect(result.sumaCalculata).toBe(148);
    });

    it("falls back to DB rate when nrAxe not provided", async () => {
      mockVehicleRate(30, "camion");

      const result = await calculateVehicleTax(
        makeInput({
          tipVehicul: "camion",
          masaTotalaKg: 12000,
          cilindreeCmc: undefined,
          normaPoluare: "euro_4",
          // no nrAxe → legacy path
        }),
        makeHcl(),
        []
      );

      expect(result.bazaImpozabila).toBe(12);
      expect(result.rataAplicata).toBe(30);
      expect(result.sumaCalculata).toBe(360);
    });
  });

  describe("Trailer axle-weight calculator (Art. 470)", () => {
    it("R2 pneumatic, 22t -> 166 lei", async () => {
      const result = await calculateVehicleTax(
        makeInput({
          tipVehicul: "remorca",
          masaTotalaKg: 22000,
          nrAxe: 2,
          tipSuspensie: "pneumatic",
          cilindreeCmc: undefined,
          normaPoluare: "euro_4",
        }),
        makeHcl(),
        []
      );

      expect(result.bazaImpozabila).toBe(22);
      expect(result.rataAplicata).toBe(166);
      expect(result.sumaCalculata).toBe(166);
      expect(result.rateTableId).toBe("weight_table_remorca_R2_pneumatic");
    });

    it("R3 other, 30t -> 616 lei", async () => {
      const result = await calculateVehicleTax(
        makeInput({
          tipVehicul: "remorca",
          masaTotalaKg: 30000,
          nrAxe: 3,
          tipSuspensie: "other",
          cilindreeCmc: undefined,
          normaPoluare: "euro_4",
        }),
        makeHcl(),
        []
      );

      expect(result.bazaImpozabila).toBe(30);
      expect(result.rataAplicata).toBe(616);
      expect(result.sumaCalculata).toBe(616);
    });

    it("R4 pneumatic, 35t -> 751 lei", async () => {
      const result = await calculateVehicleTax(
        makeInput({
          tipVehicul: "remorca",
          masaTotalaKg: 35000,
          nrAxe: 4,
          tipSuspensie: "pneumatic",
          cilindreeCmc: undefined,
          normaPoluare: "euro_4",
        }),
        makeHcl(),
        []
      );

      expect(result.bazaImpozabila).toBe(35);
      expect(result.rataAplicata).toBe(751);
      expect(result.sumaCalculata).toBe(751);
    });

    it("R1 (1 axle) small trailer -> 0 lei", async () => {
      const result = await calculateVehicleTax(
        makeInput({
          tipVehicul: "remorca",
          masaTotalaKg: 5000,
          nrAxe: 1,
          tipSuspensie: "pneumatic",
          cilindreeCmc: undefined,
          normaPoluare: "euro_4",
        }),
        makeHcl(),
        []
      );

      expect(result.bazaImpozabila).toBe(5);
      expect(result.sumaCalculata).toBe(0);
    });
  });
});
