/** Synthetic PostgreSQL integration suite. Never run against an existing application DB.
 * Run migrations with the owner role; run tests with a separate NOSUPERUSER NOBYPASSRLS role.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";

const enabled = process.env.INTEGRATION_TESTS === "true";
const integration = enabled ? describe : describe.skip;
const tenantA = randomUUID();
const tenantB = randomUUID();
const taxpayerA = randomUUID();
const taxpayerB = randomUUID();

integration("Tax engine and two-tenant PostgreSQL isolation", () => {
  let db: typeof import("@/lib/db");
  let calculate: typeof import("@/lib/tax-engine").calculateAllTaxesForContribuabil;

  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? "");
    if (!['localhost', '127.0.0.1', 'postgres'].includes(url.hostname) || url.pathname !== '/primaria_test') {
      throw new Error("Integration tests require the isolated local primaria_test database");
    }
    db = await import("@/lib/db");
    calculate = (await import("@/lib/tax-engine")).calculateAllTaxesForContribuabil;
    const [role] = await db.prisma.$queryRaw<{ rolsuper: boolean; rolbypassrls: boolean }[]>`
      SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`;
    expect(role).toEqual({ rolsuper: false, rolbypassrls: false });
    for (const [tenantId, taxpayerId, area] of [[tenantA, taxpayerA, 500], [tenantB, taxpayerB, 200]] as const) {
      await db.prisma.tenant.create({ data: { id: tenantId, name: "Synthetic integration fixture", slug: tenantId, county: "Test" } });
      await db.withTenantScope(tenantId, async () => {
        await db.prisma.contribuabil.create({ data: { id: taxpayerId, tenantId, tip: "PF", nume: "Synthetic taxpayer" } });
        const hcl = await db.prisma.hclDecision.create({ data: {
          tenantId, hclNumber: "TEST", hclDate: new Date("2025-01-01"), fiscalYear: 2026,
          validFrom: new Date("2026-01-01"), status: "active", inflationIndex: 1.056, bonificatieProcent: 10,
        } });
        await db.prisma.taxRateTable.create({ data: {
          tenantId, hclDecisionId: hcl.id, taxType: "impozit_teren_curti", category: "intravilan_curti", zona: "A",
          rateType: "per_unit", rateValue: 1.5, unit: "lei/mp",
        } });
        await db.prisma.proprietateTeren.create({ data: {
          tenantId, contribuabilId: taxpayerId, categorie: "intravilan_curti", suprafataMp: area,
          zona: "A", dataDobandire: new Date("2020-01-01"),
        } });
      });
    }
  });

  afterAll(async () => {
    if (!db) return;
    for (const tenantId of [tenantA, tenantB]) {
      await db.withTenantScope(tenantId, async () => {
        await db.prisma.proprietateTeren.deleteMany({ where: { tenantId } });
        await db.prisma.contribuabil.deleteMany({ where: { tenantId } });
        await db.prisma.taxRateTable.deleteMany({ where: { tenantId } });
        await db.prisma.hclDecision.deleteMany({ where: { tenantId } });
        await db.prisma.tenant.deleteMany({ where: { id: tenantId } });
      });
    }
    await db.prisma.$disconnect();
  });

  it("calculates deterministic land tax from database rates", async () => {
    const result = await db.withTenantScope(tenantA, () => calculate(tenantA, taxpayerA, 2026));
    expect(result.errors).toEqual([]);
    expect(result.land).toHaveLength(1);
    expect(result.land[0]).toMatchObject({ bazaImpozabila: 500, rataAplicata: 1.5, sumaDatorata: 792, nrLuni: 12 });
  });

  it("keeps installment splits equal to the amount due", async () => {
    const result = await db.withTenantScope(tenantA, () => calculate(tenantA, taxpayerA, 2026));
    expect(result.land).toHaveLength(1);
    expect(result.land[0]!.rata1 + result.land[0]!.rata2).toBe(792);
  });

  it("uses the stored discount rate", async () => {
    const result = await db.withTenantScope(tenantA, () => calculate(tenantA, taxpayerA, 2026));
    expect(result.land[0]!.bonificatie).toBe(79);
  });

  it("calculates different tenants concurrently without context leakage", async () => {
    const [a, b] = await Promise.all([
      db.withTenantScope(tenantA, () => calculate(tenantA, taxpayerA, 2026)),
      db.withTenantScope(tenantB, () => calculate(tenantB, taxpayerB, 2026)),
    ]);
    expect(a.errors).toEqual([]);
    expect(b.errors).toEqual([]);
    expect(a.land[0]!.sumaDatorata).toBe(792);
    expect(b.land[0]!.sumaDatorata).toBe(317);
  });

  it("rejects missing fiscal configuration", async () => {
    await expect(db.withTenantScope(tenantA, () => calculate(tenantA, taxpayerA, 1900))).rejects.toThrow(/Nu există HCL activ/);
  });

  it("filters unqualified reads and direct foreign IDs at the database", async () => {
    await db.withTenantScope(tenantA, async () => {
      expect((await db.prisma.contribuabil.findMany()).map(row => row.id)).toEqual([taxpayerA]);
      expect(await db.prisma.contribuabil.findUnique({ where: { id: taxpayerB } })).toBeNull();
      const rows = await db.prisma.$queryRaw<{ id: string }[]>`SELECT id FROM contribuabili`;
      expect(rows.map(row => row.id)).toEqual([taxpayerA]);
      expect(await db.prisma.contribuabil.updateMany({ where: { id: taxpayerB }, data: { nume: "Cross-tenant change" } })).toEqual({ count: 0 });
      expect(await db.prisma.contribuabil.deleteMany({ where: { id: taxpayerB } })).toEqual({ count: 0 });
    });
  });

  it("rejects inserting or moving rows into another tenant", async () => {
    await expect(db.withTenantScope(tenantA, () => db.prisma.contribuabil.create({ data: { tenantId: tenantB, tip: "PF", nume: "Forbidden" } }))).rejects.toThrow();
    await expect(db.withTenantScope(tenantA, () => db.prisma.contribuabil.update({ where: { id: taxpayerA }, data: { tenantId: tenantB } }))).rejects.toThrow();
  });

  it("fails closed after transaction context is released", async () => {
    await db.withTenantScope(tenantA, () => db.prisma.contribuabil.findMany());
    expect(await db.prisma.contribuabil.findMany()).toEqual([]);
  });

  it("enforces RLS on every table carrying tenant_id, including later migrations", async () => {
    const missing = await db.prisma.$queryRaw<{ relname: string }[]>`
      SELECT c.relname FROM pg_class c JOIN pg_attribute a ON c.oid = a.attrelid
      WHERE a.attname = 'tenant_id' AND c.relkind = 'r' AND c.relnamespace = 'public'::regnamespace
      AND (NOT c.relrowsecurity OR NOT c.relforcerowsecurity OR NOT EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid))`;
    expect(missing).toEqual([]);
  });
});
