import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  LandTaxInput,
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

import { calculateLandTax } from "@/lib/tax-engine/land-tax";
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

function makeInput(overrides?: Partial<LandTaxInput>): LandTaxInput {
  return {
    landId: "land-1",
    contribuabilId: "ctb-1",
    tenantId: "tenant-1",
    fiscalYear: 2024,
    categorie: "intravilan_curti",
    suprafataMp: 500,
    zona: "A",
    cotaParte: 100,
    dataDobandire: new Date(2020, 0, 1), // Before fiscal year -> full year
    ...overrides,
  };
}

function mockLandRate(
  rateValue: number,
  unit: string | null = "lei/mp",
  extras?: Record<string, unknown>
) {
  mockedFindFirst.mockResolvedValueOnce({
    id: "rate-land-1",
    tenantId: "tenant-1",
    hclDecisionId: "hcl-2024",
    taxType: "impozit_teren_curti",
    rateType: "fixed",
    rateValue,
    unit,
    minRate: null,
    maxRate: null,
    category: "intravilan_curti",
    zona: "A",
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...extras,
  } as unknown as TaxRateTable);
}

// --- Tests ---

describe("calculateLandTax", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calculates intravilan curti tax in lei/mp: 500mp * 1.5 lei/mp = 750 lei", async () => {
    mockLandRate(1.5, "lei/mp");

    const result = await calculateLandTax(makeInput(), makeHcl(), []);

    expect(result.bazaImpozabila).toBe(500);
    expect(result.rataAplicata).toBe(1.5);
    // 500 * 1.5 = 750
    expect(result.sumaCalculata).toBe(750);
    expect(result.sumaDatorata).toBe(750);
    expect(result.nrLuni).toBe(12);
  });

  it("calculates intravilan curti tax in lei/ha: (500/10000) * 7500 = 375 lei", async () => {
    mockLandRate(7500, "lei/ha");

    const result = await calculateLandTax(makeInput(), makeHcl(), []);

    expect(result.bazaImpozabila).toBe(500);
    // (500/10000) * 7500 = 375
    expect(result.sumaCalculata).toBe(375);
    expect(result.sumaDatorata).toBe(375);
  });

  it("uses impozit_teren_extravilan tax type for extravilan categories", async () => {
    mockedFindFirst.mockResolvedValueOnce({
      id: "rate-ext-1",
      tenantId: "tenant-1",
      hclDecisionId: "hcl-2024",
      taxType: "impozit_teren_extravilan",
      rateType: "fixed",
      rateValue: 50,
      unit: "lei/ha",
      minRate: null,
      maxRate: null,
      category: "extravilan_arabil",
      zona: "A",
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    } as unknown as TaxRateTable);

    const result = await calculateLandTax(
      makeInput({ categorie: "extravilan_arabil", suprafataMp: 20000 }),
      makeHcl(),
      []
    );

    // Verify the query was made with the correct tax type
    expect(mockedFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          taxType: "impozit_teren_extravilan",
          category: "extravilan_arabil",
        }),
      })
    );

    // (20000/10000) * 50 = 100
    expect(result.sumaCalculata).toBe(100);
  });

  it("uses impozit_teren_curti tax type for curti categories", async () => {
    mockLandRate(2.0, "lei/mp");

    await calculateLandTax(
      makeInput({ categorie: "intravilan_curti" }),
      makeHcl(),
      []
    );

    expect(mockedFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          taxType: "impozit_teren_curti",
        }),
      })
    );
  });

  it("uses impozit_teren_intravilan for non-curti intravilan categories", async () => {
    mockedFindFirst.mockResolvedValueOnce({
      id: "rate-intra-1",
      tenantId: "tenant-1",
      hclDecisionId: "hcl-2024",
      taxType: "impozit_teren_intravilan",
      rateType: "fixed",
      rateValue: 1.0,
      unit: "lei/mp",
      minRate: null,
      maxRate: null,
      category: "intravilan_arabil",
      zona: "A",
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    } as unknown as TaxRateTable);

    await calculateLandTax(
      makeInput({ categorie: "intravilan_arabil" }),
      makeHcl(),
      []
    );

    expect(mockedFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          taxType: "impozit_teren_intravilan",
        }),
      })
    );
  });

  it("prorates for partial year: acquired May 1 -> 7 months (Jun-Dec)", async () => {
    mockLandRate(2.0, "lei/mp");

    const result = await calculateLandTax(
      makeInput({ dataDobandire: new Date(2024, 4, 1) }), // May 1, 2024
      makeHcl(),
      []
    );

    // Tax starts June 1. Jun-Dec = 7 months.
    expect(result.nrLuni).toBe(7);
    // 500 * 2.0 * (7/12) = 583.333... -> roundToLei = 583
    expect(result.sumaCalculata).toBe(583);
  });

  it("prorates for partial disposal: disposed Sept 15 -> 9 months (Jan-Sep)", async () => {
    mockLandRate(2.0, "lei/mp");

    const result = await calculateLandTax(
      makeInput({
        dataDobandire: new Date(2020, 0, 1), // Full year start
        dataInstrainare: new Date(2024, 8, 15), // Sept 15, 2024
      }),
      makeHcl(),
      []
    );

    // Disposal in September -> end of September. Jan-Sep = 9 months.
    expect(result.nrLuni).toBe(9);
    // 500 * 2.0 * (9/12) = 750
    expect(result.sumaCalculata).toBe(750);
  });

  it("applies co-ownership at 50%", async () => {
    mockLandRate(2.0, "lei/mp");

    const result = await calculateLandTax(
      makeInput({ cotaParte: 50 }),
      makeHcl(),
      []
    );

    // 500 * 2.0 * (50/100) * (12/12) = 500
    expect(result.sumaCalculata).toBe(500);
    expect(result.sumaDatorata).toBe(500);
  });

  it("applies a single exemption at 25% discount", async () => {
    mockLandRate(2.0, "lei/mp");

    const exemptions: ExemptionContext[] = [
      {
        discountPercent: 25,
        ruleId: "rule-1",
        ruleName: "Zona defavorizata",
        taxTypes: ["impozit_teren_intravilan"],
      },
    ];

    const result = await calculateLandTax(makeInput(), makeHcl(), exemptions);

    // sumaCalculata = 500 * 2.0 = 1000
    // sumaScutire = round(1000 * 0.25) = 250
    expect(result.sumaCalculata).toBe(1000);
    expect(result.sumaScutire).toBe(250);
    expect(result.sumaDatorata).toBe(750);
  });

  it("caps multiple exemptions so sumaDatorata does not go below zero", async () => {
    mockLandRate(2.0, "lei/mp");

    const exemptions: ExemptionContext[] = [
      {
        discountPercent: 80,
        ruleId: "rule-1",
        ruleName: "Exemption A",
        taxTypes: ["impozit_teren_intravilan"],
      },
      {
        discountPercent: 80,
        ruleId: "rule-2",
        ruleName: "Exemption B",
        taxTypes: ["impozit_teren_intravilan"],
      },
    ];

    const result = await calculateLandTax(makeInput(), makeHcl(), exemptions);

    // sumaCalculata = 1000
    // exemption1 = round(1000 * 0.80) = 800
    // exemption2 = round(1000 * 0.80) = 800
    // total = 1600, capped at 1000
    expect(result.sumaScutire).toBe(1000);
    expect(result.sumaDatorata).toBe(0);
  });

  it("throws an error when no rate table entry is found", async () => {
    mockedFindFirst.mockResolvedValueOnce(null);
    mockedFindFirst.mockResolvedValueOnce(null);

    await expect(
      calculateLandTax(makeInput(), makeHcl(), [])
    ).rejects.toThrow(/No rate table entry found for land tax/);
  });

  it("calculates bonificatie and installments correctly", async () => {
    mockLandRate(2.0, "lei/mp");

    const result = await calculateLandTax(makeInput(), makeHcl(), []);

    // sumaCalculata = 500 * 2.0 = 1000
    expect(result.sumaDatorata).toBe(1000);
    // bonificatie = round(1000 * 0.10) = 100
    expect(result.bonificatie).toBe(100);
    // installments: half = floor(1000/2) = 500, rata1 = 1000-500 = 500, rata2 = 500
    expect(result.rata1).toBe(500);
    expect(result.rata2).toBe(500);
    expect(result.rata1Scadenta).toEqual(new Date(2024, 2, 31));
    expect(result.rata2Scadenta).toEqual(new Date(2024, 8, 30));
  });

  it("handles lei/ha unit conversion correctly for small areas", async () => {
    mockLandRate(10000, "lei/ha");

    const result = await calculateLandTax(
      makeInput({ suprafataMp: 250 }),
      makeHcl(),
      []
    );

    // (250/10000) * 10000 = 250
    expect(result.sumaCalculata).toBe(250);
  });
});
