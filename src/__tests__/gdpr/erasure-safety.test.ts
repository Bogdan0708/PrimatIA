import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Structural test: verify that the erasure route does NOT delete
 * consimtamant (consent) records immediately. This is a safety
 * invariant — consent records are shared per contribuabil, and
 * deleting them on one citizen's request would revoke consent
 * for all linked citizens.
 */
describe("GDPR erasure route safety invariants", () => {
  const routePath = join(
    process.cwd(),
    "src/app/api/portal/gdpr/erasure/route.ts"
  );
  const routeSource = readFileSync(routePath, "utf-8");

  it("does NOT delete consimtamant records immediately", () => {
    // The route must not contain consimtamant.deleteMany or consimtamant.delete
    expect(routeSource).not.toMatch(/consimtamant\.deleteMany/);
    expect(routeSource).not.toMatch(/consimtamant\.delete\b/);
  });

  it("does delete notifications (per-citizen, safe)", () => {
    expect(routeSource).toMatch(/notificare\.deleteMany/);
  });

  it("creates an erasure request with pending status", () => {
    expect(routeSource).toMatch(/gdprErasureRequest\.create/);
    expect(routeSource).toMatch(/status:\s*"pending"/);
  });

  it("checks for existing pending/approved requests to prevent duplicates", () => {
    expect(routeSource).toMatch(/gdprErasureRequest\.findFirst/);
    expect(routeSource).toMatch(/status.*in.*\["pending",\s*"approved"\]/);
  });

  it("rate limits per citizen.sub, not just per IP", () => {
    expect(routeSource).toMatch(/keySuffix:\s*citizen\.sub/);
  });
});

describe("GDPR data-export route safety invariants", () => {
  const routePath = join(
    process.cwd(),
    "src/app/api/portal/gdpr/data-export/route.ts"
  );
  const routeSource = readFileSync(routePath, "utf-8");

  it("rate limits per citizen.sub, not just per IP", () => {
    expect(routeSource).toMatch(/keySuffix:\s*citizen\.sub/);
  });

  it("does not mutate or delete any data", () => {
    // Data export should be read-only
    expect(routeSource).not.toMatch(/\.delete\b/);
    expect(routeSource).not.toMatch(/\.deleteMany/);
    expect(routeSource).not.toMatch(/\.update\b/);
    expect(routeSource).not.toMatch(/\.updateMany/);
    expect(routeSource).not.toMatch(/\.create\b/);
    expect(routeSource).not.toMatch(/\.createMany/);
  });
});
