import { afterEach, describe, expect, it, vi } from "vitest";

import { resolvePortalTenant } from "@/lib/portal-auth";

describe("resolvePortalTenant", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("prefers the injected tenant header", async () => {
    vi.stubEnv("TENANT_ID", "tenant-from-env");

    const request = new Request("http://localhost/api/portal/auth/login", {
      headers: {
        "x-tenant-id": "tenant-from-header",
      },
    });

    await expect(resolvePortalTenant(request as never)).resolves.toBe(
      "tenant-from-header"
    );
  });

  it("falls back to TENANT_ID when no header is present", async () => {
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
