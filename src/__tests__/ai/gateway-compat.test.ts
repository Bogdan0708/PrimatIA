import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import type { LLMProvider } from "@/lib/ai/config";
import { getLLMConfig, getGatewayHeaders } from "@/lib/ai/config";

const AI_ENV_VARS = [
  "AI_PROVIDER",
  "AI_GATEWAY_URL",
  "AI_GATEWAY_KEY",
  "AI_GATEWAY_MODEL",
  "AI_GATEWAY_PROVIDER",
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_MODEL",
  "OPENAI_API_KEY",
  "OPENAI_MODEL",
  "LM_STUDIO_URL",
  "LM_STUDIO_MODEL",
  "TENANT_ID",
] as const;

function clearAIEnvVars() {
  for (const key of AI_ENV_VARS) {
    vi.stubEnv(key, "");
    delete process.env[key];
  }
}

describe("getLLMConfig and getGatewayHeaders", () => {
  beforeEach(() => {
    clearAIEnvVars();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("only exposes gateway or none as valid providers", () => {
    const valid: LLMProvider[] = ["gateway", "none"];
    expect(valid).toContain(getLLMConfig().provider);
  });

  it('returns provider "none" when the gateway is not fully configured', () => {
    expect(getLLMConfig()).toEqual({ provider: "none", model: "none" });

    vi.stubEnv("AI_GATEWAY_URL", "https://gateway.example.com");
    expect(getLLMConfig()).toEqual({ provider: "none", model: "none" });
  });

  it("selects gateway when AI_GATEWAY_URL and AI_GATEWAY_KEY are set", () => {
    vi.stubEnv("AI_GATEWAY_URL", "https://gateway.example.com");
    vi.stubEnv("AI_GATEWAY_KEY", "gw-key-123");

    const config = getLLMConfig();
    expect(config.provider).toBe("gateway");
    expect(config.baseUrl).toBe("https://gateway.example.com");
    expect(config.apiKey).toBe("gw-key-123");
    expect(config.gatewayProvider).toBe("gemini");
    expect(config.model).toBe("gemini-2.0-flash");
  });

  it("respects AI_GATEWAY_PROVIDER and AI_GATEWAY_MODEL overrides", () => {
    vi.stubEnv("AI_GATEWAY_URL", "https://gateway.example.com");
    vi.stubEnv("AI_GATEWAY_KEY", "gw-key-123");
    vi.stubEnv("AI_GATEWAY_PROVIDER", "gemini");
    vi.stubEnv("AI_GATEWAY_MODEL", "gemini-2.5-flash");

    const config = getLLMConfig();
    expect(config.gatewayProvider).toBe("gemini");
    expect(config.model).toBe("gemini-2.5-flash");
  });

  it("keeps the provider-alias compatibility shim for AI_GATEWAY_MODEL", () => {
    vi.stubEnv("AI_GATEWAY_URL", "https://gateway.example.com");
    vi.stubEnv("AI_GATEWAY_KEY", "gw-key-123");
    vi.stubEnv("AI_GATEWAY_MODEL", "gemini");

    const config = getLLMConfig();
    expect(config.gatewayProvider).toBe("gemini");
    expect(config.model).toBe("gemini-2.0-flash");
  });

  it("includes gatewayTenantId when TENANT_ID is set", () => {
    vi.stubEnv("AI_GATEWAY_URL", "https://gateway.example.com");
    vi.stubEnv("AI_GATEWAY_KEY", "gw-key-123");
    vi.stubEnv("TENANT_ID", "tenant-123");

    expect(getLLMConfig().gatewayTenantId).toBe("tenant-123");
  });

  it("ignores direct-provider env vars and does not activate a parallel AI path", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
    vi.stubEnv("OPENAI_API_KEY", "sk-openai-test");
    vi.stubEnv("LM_STUDIO_URL", "http://localhost:1234/v1");

    expect(getLLMConfig()).toEqual({ provider: "none", model: "none" });
  });

  it("returns correct gateway headers including Authorization and x-tenant-id", () => {
    const headers = getGatewayHeaders({
      provider: "gateway",
      baseUrl: "https://gateway.example.com",
      apiKey: "master-key",
      gatewayProvider: "gemini",
      model: "gemini-2.0-flash",
      gatewayTenantId: "tenant-1",
    });

    expect(headers).toEqual(
      expect.objectContaining({
        Authorization: "Bearer master-key",
        "Content-Type": "application/json",
        "x-tenant-id": "tenant-1",
      })
    );
  });
});
