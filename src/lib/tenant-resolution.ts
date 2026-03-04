import { prisma } from "@/lib/db";

const TENANT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TENANT_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,99}$/;
const RESERVED_SUBDOMAINS = new Set(["www", "api", "admin", "app"]);
const HOST_CACHE_TTL_MS = 5 * 60 * 1000;

type HostCacheEntry = {
  tenantId: string | null;
  expiresAt: number;
};

const hostTenantCache = new Map<string, HostCacheEntry>();

let parsedHostMap: Record<string, string> | null = null;

function normalizeHost(rawHost: string | null): string | null {
  if (!rawHost) return null;

  const trimmed = rawHost.trim().toLowerCase();
  if (!trimmed) return null;

  const firstHost = trimmed.split(",")[0]?.trim();
  if (!firstHost) return null;

  try {
    return new URL(`http://${firstHost}`).hostname.replace(/\.$/, "");
  } catch {
    return firstHost.replace(/:\d+$/, "").replace(/\.$/, "");
  }
}

function sanitizeTenantId(value: string | null | undefined): string | null {
  if (!value) return null;
  const candidate = value.trim();
  return TENANT_ID_PATTERN.test(candidate) ? candidate : null;
}

function sanitizeTenantSlug(value: string | null | undefined): string | null {
  if (!value) return null;
  const candidate = value.trim().toLowerCase();
  if (!TENANT_SLUG_PATTERN.test(candidate)) return null;
  if (RESERVED_SUBDOMAINS.has(candidate)) return null;
  return candidate;
}

function isLocalHost(host: string): boolean {
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "[::1]"
  );
}

function parseTenantHostMap(): Record<string, string> {
  if (parsedHostMap) return parsedHostMap;

  const raw = process.env.TENANT_HOST_MAP;
  if (!raw) {
    parsedHostMap = {};
    return parsedHostMap;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      parsedHostMap = {};
      return parsedHostMap;
    }

    parsedHostMap = Object.entries(parsed).reduce<Record<string, string>>(
      (acc, [host, tenantId]) => {
        const normalizedHost = normalizeHost(host);
        const normalizedTenantId =
          typeof tenantId === "string" ? sanitizeTenantId(tenantId) : null;
        if (normalizedHost && normalizedTenantId) {
          acc[normalizedHost] = normalizedTenantId;
        }
        return acc;
      },
      {}
    );
    return parsedHostMap;
  } catch (error) {
    console.error("Invalid TENANT_HOST_MAP JSON:", error);
    parsedHostMap = {};
    return parsedHostMap;
  }
}

function resolveTenantSlugFromHost(host: string): string | null {
  if (isLocalHost(host)) {
    return sanitizeTenantSlug(process.env.TENANT_DEV_SLUG ?? null);
  }

  const baseDomain = process.env.TENANT_BASE_DOMAIN?.trim().toLowerCase();
  if (!baseDomain) return null;

  const suffix = `.${baseDomain}`;
  if (!host.endsWith(suffix)) return null;

  const candidate = host.slice(0, -suffix.length);
  if (!candidate || candidate.includes(".")) return null;

  return sanitizeTenantSlug(candidate);
}

export async function resolveTenantIdFromHeaders(headers: Headers): Promise<string | null> {
  const staticTenantId = sanitizeTenantId(process.env.TENANT_ID ?? null);
  if (staticTenantId) return staticTenantId;

  const host = normalizeHost(
    headers.get("x-forwarded-host") ?? headers.get("host")
  );
  if (!host) return null;

  const hostMap = parseTenantHostMap();
  const mappedTenantId = sanitizeTenantId(hostMap[host]);
  if (mappedTenantId) return mappedTenantId;

  const now = Date.now();
  const cached = hostTenantCache.get(host);
  if (cached && cached.expiresAt > now) {
    return cached.tenantId;
  }

  const slug = resolveTenantSlugFromHost(host);
  if (!slug) {
    hostTenantCache.set(host, { tenantId: null, expiresAt: now + HOST_CACHE_TTL_MS });
    return null;
  }

  const tenant = await prisma.tenant.findFirst({
    where: {
      slug,
      deletedAt: null,
      status: { in: ["active", "trial"] },
    },
    select: { id: true },
  });

  const tenantId = tenant?.id ?? null;
  hostTenantCache.set(host, { tenantId, expiresAt: now + HOST_CACHE_TTL_MS });
  return tenantId;
}
