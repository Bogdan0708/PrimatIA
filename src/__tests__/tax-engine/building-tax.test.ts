import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  BuildingTaxInput,
  HclDecisionContext,
  ExemptionContext,
} from "@/lib/tax-engine/types";
import type { TaxRateTable } from "@prisma/client";

// Mock the prisma client before importing the module under test
vi.mock("@/lib/db", () => ({
  prisma: {
    taxRateTable: {
      findFirst: vi.fn(),
    },
  },
}));

import { calculateBuildingTax } from "@/lib/tax-engine/building-tax";
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

function makeInput(overrides?: Partial<BuildingTaxInput>): BuildingTaxInput {
  return {
    buildingId: "bld-1",
    contribuabilId: "ctb-1",
    tenantId: "tenant-1",
    fiscalYear: 2024,
    destinatie: "rezidentiala",
    tipConstructie: "cadre_beton",
    anConstructie: 2010,
    suprafataConstruita: 100,
    valoareImpozabila: 120000,
    zona: "A",
    cotaParte: 100,
    dataDobandire: new Date(2020, 0, 1), // Jan 1 2020 (before fiscal year -> full year)
    ...overrides,
  };
}

function mockRateEntry(rateValue: number, extras?: Record<string, unknown>) {
  mockedFindFirst.mockResolvedValueOnce({
    id: "rate-1",
    tenantId: "tenant-1",
    hclDecisionId: "hcl-2024",
    taxType: "impozit_cladiri_rezidentiale",
    rateType: "percentage",
    rateValue,
    unit: null,
    minRate: null,
    maxRate: null,
    category: "cadre_beton",
    zona: "A",
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...extras,
  } as unknown as TaxRateTable);
}

// --- Tests ---

describe("calculateBuildingTax", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calculates residential building tax: 120000 * 0.1% * age(1.0) * full year * cotaParte(100%) = 120 lei", async () => {
    mockRateEntry(0.1);

    const result = await calculateBuildingTax(makeInput(), makeHcl(), []);

    expect(result.bazaImpozabila).toBe(120000);
    expect(result.rataAplicata).toBe(0.1);
    // 120000 * (0.1/100) * 1.0 * (100/100) * (12/12) = 120
    expect(result.sumaCalculata).toBe(120);
    expect(result.sumaScutire).toBe(0);
    expect(result.sumaDatorata).toBe(120);
    expect(result.nrLuni).toBe(12);
    expect(result.hclDecisionId).toBe("hcl-2024");
    expect(result.rateTableId).toBe("rate-1");
  });

  it("uses valoareInventar for non-residential (PJ) buildings", async () => {
    mockRateEntry(0.5, {
      taxType: "impozit_cladiri_nerezidentiale",
    });

    const result = await calculateBuildingTax(
      makeInput({
        destinatie: "nerezidentiala",
        valoareInventar: 500000,
        valoareImpozabila: 200000,
      }),
      makeHcl(),
      []
    );

    // Non-residential uses valoareInventar
    expect(result.bazaImpozabila).toBe(500000);
    // 500000 * (0.5/100) * 1.0 * (100/100) * (12/12) = 2500
    expect(result.sumaCalculata).toBe(2500);
    expect(result.sumaDatorata).toBe(2500);
  });

  it("uses the configured HCL rate for revalued PJ buildings instead of a hardcoded fallback", async () => {
    mockRateEntry(1.3, {
      taxType: "impozit_cladiri_nerezidentiale",
      maxRate: 1.5,
    });

    const result = await calculateBuildingTax(
      makeInput({
        destinatie: "nerezidentiala",
        tipContribuabil: "PJ",
        valoareInventar: 200000,
        dataUltimeiReevaluari: new Date(2023, 5, 1),
      }),
      makeHcl(),
      []
    );

    expect(result.rataAplicata).toBe(1.3);
    expect(result.sumaCalculata).toBe(2600);
  });

  it("splits mixed-use buildings proportionally between residential and non-residential areas", async () => {
    mockedFindFirst
      .mockResolvedValueOnce({
        id: "rate-res",
        tenantId: "tenant-1",
        hclDecisionId: "hcl-2024",
        taxType: "impozit_cladiri_rezidentiale",
        rateType: "percentage",
        rateValue: 0.1,
        unit: null,
        minRate: null,
        maxRate: null,
        category: "cadre_beton",
        zona: "A",
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      } as unknown as TaxRateTable)
      .mockResolvedValueOnce({
        id: "rate-nonres",
        tenantId: "tenant-1",
        hclDecisionId: "hcl-2024",
        taxType: "impozit_cladiri_nerezidentiale",
        rateType: "percentage",
        rateValue: 1.0,
        unit: null,
        minRate: null,
        maxRate: 1.5,
        category: "cadre_beton",
        zona: "A",
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      } as unknown as TaxRateTable);

    const result = await calculateBuildingTax(
      makeInput({
        destinatie: "mixta",
        valoareImpozabila: 100000,
        suprafataRezidentiala: 60,
        suprafataNerezidentiala: 40,
      }),
      makeHcl(),
      []
    );

    expect(result.bazaImpozabila).toBe(100000);
    expect(result.rataAplicata).toBeCloseTo(0.46, 5);
    expect(result.sumaCalculata).toBe(460);
    expect(result.rateTableId).toBe("rate-res");
  });

  describe("building age coefficient", () => {
    it("applies coefficient 0.85 for buildings older than 100 years (1920)", async () => {
      mockRateEntry(0.1);

      const result = await calculateBuildingTax(
        makeInput({ anConstructie: 1920 }),
        makeHcl(),
        []
      );

      // age = 2024 - 1920 = 104 > 100 -> coeff 0.85
      // 120000 * 0.001 * 0.85 = 102
      expect(result.sumaCalculata).toBe(102);
    });

    it("applies coefficient 0.90 for buildings 50-100 years old (1970)", async () => {
      mockRateEntry(0.1);

      const result = await calculateBuildingTax(
        makeInput({ anConstructie: 1970 }),
        makeHcl(),
        []
      );

      // age = 2024 - 1970 = 54 > 50 -> coeff 0.90
      // 120000 * 0.001 * 0.90 = 108
      expect(result.sumaCalculata).toBe(108);
    });

    it("applies coefficient 0.95 for buildings 30-50 years old (1993)", async () => {
      mockRateEntry(0.1);

      const result = await calculateBuildingTax(
        makeInput({ anConstructie: 1993 }),
        makeHcl(),
        []
      );

      // age = 2024 - 1993 = 31 > 30 -> coeff 0.95
      // 120000 * 0.001 * 0.95 = 114
      expect(result.sumaCalculata).toBe(114);
    });

    it("applies coefficient 1.0 for buildings under 30 years old (2010)", async () => {
      mockRateEntry(0.1);

      const result = await calculateBuildingTax(
        makeInput({ anConstructie: 2010 }),
        makeHcl(),
        []
      );

      // age = 2024 - 2010 = 14, not > 30 -> coeff 1.0
      // 120000 * 0.001 * 1.0 = 120
      expect(result.sumaCalculata).toBe(120);
    });

    it("ignores age coefficients for fiscal year 2026+ (Legea 239/2025)", async () => {
      mockRateEntry(0.1);

      const result = await calculateBuildingTax(
        makeInput({ anConstructie: 1920, fiscalYear: 2026 }),
        makeHcl({ id: "hcl-2026", fiscalYear: 2026 }),
        []
      );

      // age = 2026 - 1920 = 106 > 100, but coefficients abrogated for 2026
      // So: 120000 * 0.001 * 1.0 (no reduction) = 120
      expect(result.sumaCalculata).toBe(120);
    });
  });

  it("prorates for partial year: acquired June 15 -> 6 taxable months (Jul-Dec)", async () => {
    mockRateEntry(0.1);

    const result = await calculateBuildingTax(
      makeInput({
        dataDobandire: new Date(2024, 5, 15), // June 15, 2024
      }),
      makeHcl(),
      []
    );

    // Tax starts from July 1. Jul-Dec = 6 months.
    expect(result.nrLuni).toBe(6);
    // 120000 * 0.001 * 1.0 * (100/100) * (6/12) = 60
    expect(result.sumaCalculata).toBe(60);
    expect(result.sumaDatorata).toBe(60);
  });

  it("applies co-ownership at 50%", async () => {
    mockRateEntry(0.1);

    const result = await calculateBuildingTax(
      makeInput({ cotaParte: 50 }),
      makeHcl(),
      []
    );

    // 120000 * 0.001 * 1.0 * (50/100) * (12/12) = 60
    expect(result.sumaCalculata).toBe(60);
    expect(result.sumaDatorata).toBe(60);
  });

  it("calculates bonificatie as 10% of sumaDatorata", async () => {
    mockRateEntry(0.1);

    const result = await calculateBuildingTax(makeInput(), makeHcl(), []);

    // sumaDatorata = 120, bonificatie = round(120 * 0.1) = 12
    expect(result.bonificatie).toBe(12);
  });

  it("applies the HCL inflation coefficient when configured", async () => {
    mockRateEntry(0.1);

    const result = await calculateBuildingTax(
      makeInput(),
      makeHcl({ inflationIndex: 1.05 }),
      []
    );

    expect(result.sumaCalculata).toBe(126);
    expect(result.sumaDatorata).toBe(126);
    expect(result.bonificatie).toBe(13);
  });

  it("splits installments: odd amount -> first installment gets remainder", async () => {
    // Use a value that yields an odd sumaDatorata
    mockRateEntry(0.1);

    const result = await calculateBuildingTax(
      makeInput({ valoareImpozabila: 130000 }),
      makeHcl(),
      []
    );

    // 130000 * 0.001 * 1.0 * (100/100) * (12/12) = 130
    expect(result.sumaDatorata).toBe(130);
    // half = floor(130/2) = 65, rata1 = 130 - 65 = 65, rata2 = 65
    expect(result.rata1).toBe(65);
    expect(result.rata2).toBe(65);

    // For a truly odd amount, test with 131
    mockRateEntry(0.1);
    const result2 = await calculateBuildingTax(
      makeInput({ valoareImpozabila: 131000 }),
      makeHcl(),
      []
    );

    // 131000 * 0.001 = 131 lei
    expect(result2.sumaDatorata).toBe(131);
    // half = floor(131/2) = 65, rata1 = 131 - 65 = 66, rata2 = 65
    expect(result2.rata1).toBe(66);
    expect(result2.rata2).toBe(65);
  });

  it("installment due dates are March 31 and September 30", async () => {
    mockRateEntry(0.1);

    const result = await calculateBuildingTax(makeInput(), makeHcl(), []);

    expect(result.rata1Scadenta).toEqual(new Date(2024, 2, 31)); // March 31, 2024
    expect(result.rata2Scadenta).toEqual(new Date(2024, 8, 30)); // September 30, 2024
  });

  it("applies a single exemption at 50% discount", async () => {
    mockRateEntry(0.1);

    const exemptions: ExemptionContext[] = [
      { discountPercent: 50, ruleId: "rule-1", ruleName: "Handicap gr. I" },
    ];

    const result = await calculateBuildingTax(
      makeInput(),
      makeHcl(),
      exemptions
    );

    // sumaCalculata = 120
    // sumaScutire = round(120 * 50/100) = 60
    expect(result.sumaCalculata).toBe(120);
    expect(result.sumaScutire).toBe(60);
    expect(result.sumaDatorata).toBe(60);
  });

  it("caps multiple exemptions at 100% (cannot go negative)", async () => {
    mockRateEntry(0.1);

    const exemptions: ExemptionContext[] = [
      { discountPercent: 70, ruleId: "rule-1", ruleName: "Handicap gr. I" },
      { discountPercent: 50, ruleId: "rule-2", ruleName: "Veteran de razboi" },
    ];

    const result = await calculateBuildingTax(
      makeInput(),
      makeHcl(),
      exemptions
    );

    // sumaCalculata = 120
    // exemption1 = round(120 * 0.70) = 84
    // exemption2 = round(120 * 0.50) = 60
    // total exemptions = 84 + 60 = 144, but capped at sumaCalculata = 120
    expect(result.sumaCalculata).toBe(120);
    expect(result.sumaScutire).toBe(120);
    expect(result.sumaDatorata).toBe(0);
  });

  it("throws an error when no rate table entry is found", async () => {
    // Neither primary nor fallback query returns a result
    mockedFindFirst.mockResolvedValueOnce(null);
    mockedFindFirst.mockResolvedValueOnce(null);

    await expect(
      calculateBuildingTax(makeInput(), makeHcl(), [])
    ).rejects.toThrow(
      /No rate table entry found for building tax/
    );
  });

  it("uses fallback rate entry when primary lookup returns null", async () => {
    // Primary returns null, fallback returns a result
    mockedFindFirst.mockResolvedValueOnce(null);
    mockedFindFirst.mockResolvedValueOnce({
      id: "rate-fallback",
      tenantId: "tenant-1",
      hclDecisionId: "hcl-2024",
      taxType: "impozit_cladiri_rezidentiale",
      rateType: "percentage",
      rateValue: 0.08,
      unit: null,
      minRate: null,
      maxRate: null,
      category: null,
      zona: "A",
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    } as unknown as TaxRateTable);

    const result = await calculateBuildingTax(makeInput(), makeHcl(), []);

    expect(result.rateTableId).toBe("rate-fallback");
    // 120000 * (0.08/100) * 1.0 = 96
    expect(result.sumaCalculata).toBe(96);
  });
});
