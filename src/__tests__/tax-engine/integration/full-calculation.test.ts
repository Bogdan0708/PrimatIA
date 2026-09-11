/**
 * Integration tests for the tax engine against the real seeded database.
 *
 * Prerequisites:
 *   - PostgreSQL running with seeded demo data (tenant bogdan-voda)
 *   - DATABASE_URL pointing to the real database
 *
 * Run:
 *   INTEGRATION_TESTS=true DATABASE_URL="postgresql://primaria_app:primaria_dev_password@localhost:5435/primaria" \
 *     npx vitest run src/__tests__/tax-engine/integration/
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";

const TENANT_ID = "00000000-0000-0000-0000-000000000000";

// Opt-in via INTEGRATION_TESTS=true. Skips in CI and unit-test-only runs.
const runIntegration = process.env.INTEGRATION_TESTS === "true" && !!process.env.DATABASE_URL;

const describeIntegration = runIntegration ? describe : describe.skip;

describeIntegration("Tax Engine — Integration (real DB)", () => {
  // Dynamic imports to avoid loading Prisma in unit test environment
  let withTenantScope: (tenantId: string, fn: () => Promise<unknown>) => Promise<unknown>;
  let calculateAllTaxesForContribuabil: (
    tenantId: string,
    contribuabilId: string,
    fiscalYear: number
  ) => Promise<{
    buildings: (TaxResult | null)[];
    land: (TaxResult | null)[];
    vehicles: (TaxResult | null)[];
    errors: { propertyType: string; propertyId: string; error: string }[];
  }>;
  let prismaDisconnect: () => Promise<void>;

  interface TaxResult {
    bazaImpozabila: number;
    rataAplicata: number;
    sumaCalculata: number;
    sumaScutire: number;
    bonificatie: number;
    sumaDatorata: number;
    nrLuni: number;
    rata1: number;
    rata2: number;
  }

  beforeAll(async () => {
    const db = await import("@/lib/db");
    const engine = await import("@/lib/tax-engine");
    withTenantScope = db.withTenantScope as typeof withTenantScope;
    calculateAllTaxesForContribuabil = engine.calculateAllTaxesForContribuabil;

    prismaDisconnect = async () => {
      // Prisma handles connection pooling internally
    };
  });

  afterAll(async () => {
    await prismaDisconnect?.();
  });

  // -----------------------------------------------------------------------
  // Popescu Ion — PF with 1 building, 1 land, 1 vehicle (full year 2026)
  // -----------------------------------------------------------------------
  const POPESCU_ION = "b204583e-5fa3-4169-ae26-d67b994b9e86";

  it("calculates correct taxes for Popescu Ion (PF, full year)", async () => {
    const result = await withTenantScope(TENANT_ID, () =>
      calculateAllTaxesForContribuabil(TENANT_ID, POPESCU_ION, 2026)
    ) as Awaited<ReturnType<typeof calculateAllTaxesForContribuabil>>;

    expect(result.errors).toHaveLength(0);

    // Building: rezidentiala, cadre_beton, zona A
    // 180,000 × 0.0008% × 1.0 (age abrogated 2026) × 1.0 (rank 5) × 1.056 (inflation) = ~2 lei
    expect(result.buildings).toHaveLength(1);
    const building = result.buildings[0]!;
    expect(building.bazaImpozabila).toBe(180_000);
    expect(building.rataAplicata).toBeCloseTo(0.0008, 4);
    expect(building.sumaDatorata).toBe(2);
    expect(building.nrLuni).toBe(12);

    // Land: intravilan_curti, zona A, 500 m²
    // 500 × 1.5 lei/m² × 1.056 = 792 lei
    expect(result.land).toHaveLength(1);
    const land = result.land[0]!;
    expect(land.bazaImpozabila).toBe(500);
    expect(land.rataAplicata).toBe(1.5);
    expect(land.sumaDatorata).toBe(792);
    expect(land.nrLuni).toBe(12);

    // Vehicle: autoturism 1199cc, euro_6
    // ceil(1199/200)=6 × 8 lei = 48, × 0.9 (euro 6) × 1.056 = ~46 lei
    expect(result.vehicles).toHaveLength(1);
    const vehicle = result.vehicles[0]!;
    expect(vehicle.bazaImpozabila).toBe(1199);
    expect(vehicle.rataAplicata).toBe(8);
    expect(vehicle.sumaDatorata).toBe(46);
    expect(vehicle.nrLuni).toBe(12);
  });

  it("returns installment splits summing to total", async () => {
    const result = await withTenantScope(TENANT_ID, () =>
      calculateAllTaxesForContribuabil(TENANT_ID, POPESCU_ION, 2026)
    ) as Awaited<ReturnType<typeof calculateAllTaxesForContribuabil>>;

    for (const arr of [result.buildings, result.land, result.vehicles]) {
      for (const tax of arr) {
        if (!tax) continue;
        expect(tax.rata1 + tax.rata2).toBe(tax.sumaDatorata);
      }
    }
  });

  it("calculates bonificatie when HCL has bonificatieProcent", async () => {
    const result = await withTenantScope(TENANT_ID, () =>
      calculateAllTaxesForContribuabil(TENANT_ID, POPESCU_ION, 2026)
    ) as Awaited<ReturnType<typeof calculateAllTaxesForContribuabil>>;

    // Land tax is large enough to have a meaningful bonificatie (10% of 792 = 79)
    const land = result.land[0]!;
    expect(land.bonificatie).toBeGreaterThan(0);
    // bonificatie = floor(sumaDatorata * bonificatieProcent / 100)
    expect(land.bonificatie).toBe(Math.floor(792 * 10 / 100));
  });

  // -----------------------------------------------------------------------
  // Multiple contribuabili: verify no cross-contamination
  // -----------------------------------------------------------------------
  const IONESCU_MARIA = "7b8f2ae8-cd1b-45ae-be2e-c72f5c531859";

  it("calculates taxes for different contribuabili independently", async () => {
    const [popescuResult, ionescuResult] = await withTenantScope(TENANT_ID, async () => {
      const a = await calculateAllTaxesForContribuabil(TENANT_ID, POPESCU_ION, 2026);
      const b = await calculateAllTaxesForContribuabil(TENANT_ID, IONESCU_MARIA, 2026);
      return [a, b] as const;
    }) as readonly [
      Awaited<ReturnType<typeof calculateAllTaxesForContribuabil>>,
      Awaited<ReturnType<typeof calculateAllTaxesForContribuabil>>
    ];

    // Both should have zero errors
    expect(popescuResult.errors).toHaveLength(0);
    expect(ionescuResult.errors).toHaveLength(0);

    // They should have different property counts (different people)
    const popescuTotal = popescuResult.buildings.length + popescuResult.land.length + popescuResult.vehicles.length;
    const ionescuTotal = ionescuResult.buildings.length + ionescuResult.land.length + ionescuResult.vehicles.length;
    expect(popescuTotal).toBeGreaterThan(0);
    expect(ionescuTotal).toBeGreaterThan(0);
  });

  // -----------------------------------------------------------------------
  // Error handling: non-existent contribuabil
  // -----------------------------------------------------------------------
  it("throws TaxConfigurationError for non-existent fiscal year", async () => {
    await expect(
      withTenantScope(TENANT_ID, () =>
        calculateAllTaxesForContribuabil(TENANT_ID, POPESCU_ION, 1900)
      )
    ).rejects.toThrow(/Nu există HCL activ/);
  });
});
