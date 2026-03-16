import { afterEach, describe, expect, it, vi } from "vitest";

import { getPortalJwtSecret, resolvePortalTenant } from "@/lib/portal-auth";

describe("resolvePortalTenant", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("ignores x-tenant-id header (security: prevents tenant spoofing)", async () => {
    vi.stubEnv("TENANT_ID", "tenant-from-env");

    const request = new Request("http://localhost/api/portal/auth/login", {
      headers: {
        "x-tenant-id": "attacker-controlled-tenant",
      },
    });

    // Should use env var, NOT the header
    await expect(resolvePortalTenant(request as never)).resolves.toBe(
      "tenant-from-env"
    );
  });

  it("uses TENANT_ID env var for tenant resolution", async () => {
    vi.stubEnv("TENANT_ID", "tenant-from-env");

    const request = new Request("http://localhost/api/portal/auth/login");

    await expect(resolvePortalTenant(request as never)).resolves.toBe(
      "tenant-from-env"
    );
  });

  it("fails closed when tenant context is missing", async () => {
    vi.stubEnv("TENANT_ID", "");

    const request = new Request("http://localhost/api/portal/auth/login");

    await expect(resolvePortalTenant(request as never)).resolves.toBeNull();
  });
});

describe("getPortalJwtSecret", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses dedicated citizen secret before any staff secret", () => {
    vi.stubEnv("CITIZEN_JWT_SECRET", "citizen-secret");
    vi.stubEnv("JWT_SECRET", "legacy-citizen-secret");
    vi.stubEnv("NEXTAUTH_SECRET", "staff-secret");

    expect(new TextDecoder().decode(getPortalJwtSecret())).toBe("citizen-secret");
  });

  it("does not fall back to NEXTAUTH_SECRET", () => {
    vi.stubEnv("CITIZEN_JWT_SECRET", "");
    vi.stubEnv("JWT_SECRET", "");
    vi.stubEnv("NEXTAUTH_SECRET", "staff-secret");

    expect(() => getPortalJwtSecret()).toThrow(
      "CITIZEN_JWT_SECRET (or JWT_SECRET) must be configured"
    );
  });
});
