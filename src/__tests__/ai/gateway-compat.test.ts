import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// We need a fresh module for each test since getLLMConfig reads process.env at call time.
// Import type only here; actual function is imported dynamically or directly.
import type { LLMProvider } from "@/lib/ai/config";
import { getLLMConfig } from "@/lib/ai/config";

// All AI-related env vars that getLLMConfig inspects
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
];

/**
 * Helper: clear every AI-related env var so tests start from a clean slate.
 */
function clearAIEnvVars() {
  for (const key of AI_ENV_VARS) {
    vi.stubEnv(key, "");
    delete process.env[key];
  }
}

describe("getLLMConfig", () => {
  beforeEach(() => {
    clearAIEnvVars();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // ── 1. Return shape ─────────────────────────────────────────────────
  describe("return shape", () => {
    it("always returns an object with provider and model", () => {
      const config = getLLMConfig();
      expect(config).toHaveProperty("provider");
      expect(config).toHaveProperty("model");
      expect(typeof config.provider).toBe("string");
      expect(typeof config.model).toBe("string");
    });

    it("provider is one of the valid LLMProvider values", () => {
      const valid: LLMProvider[] = [
        "gateway",
        "claude",
        "openai",
        "lm_studio",
        "none",
      ];
      const config = getLLMConfig();
      expect(valid).toContain(config.provider);
    });
  });

  // ── 2. Default provider (no env vars) ───────────────────────────────
  describe("default provider", () => {
    it('returns provider "none" when no env vars are set', () => {
      const config = getLLMConfig();
      expect(config.provider).toBe("none");
      expect(config.model).toBe("none");
    });

    it("does not set apiKey or baseUrl for the none provider", () => {
      const config = getLLMConfig();
      expect(config.apiKey).toBeUndefined();
      expect(config.baseUrl).toBeUndefined();
    });
  });

  // ── 3. Individual provider configs ──────────────────────────────────
  describe("gateway provider", () => {
    it("selects gateway when AI_GATEWAY_URL and AI_GATEWAY_KEY are set", () => {
      vi.stubEnv("AI_GATEWAY_URL", "https://gateway.example.com");
      vi.stubEnv("AI_GATEWAY_KEY", "gw-key-123");

      const config = getLLMConfig();
      expect(config.provider).toBe("gateway");
      expect(config.baseUrl).toBe("https://gateway.example.com");
      expect(config.apiKey).toBe("gw-key-123");
    });

    it('defaults model and gatewayProvider to "gemini"', () => {
      vi.stubEnv("AI_GATEWAY_URL", "https://gateway.example.com");
      vi.stubEnv("AI_GATEWAY_KEY", "gw-key-123");

      const config = getLLMConfig();
      expect(config.model).toBe("gemini");
      expect(config.gatewayProvider).toBe("gemini");
    });

    it("respects AI_GATEWAY_MODEL override", () => {
      vi.stubEnv("AI_GATEWAY_URL", "https://gateway.example.com");
      vi.stubEnv("AI_GATEWAY_KEY", "gw-key-123");
      vi.stubEnv("AI_GATEWAY_MODEL", "claude-sonnet");

      const config = getLLMConfig();
      expect(config.model).toBe("claude-sonnet");
      expect(config.gatewayProvider).toBe("claude-sonnet");
    });

    it("respects AI_GATEWAY_PROVIDER override independently of model", () => {
      vi.stubEnv("AI_GATEWAY_URL", "https://gateway.example.com");
      vi.stubEnv("AI_GATEWAY_KEY", "gw-key-123");
      vi.stubEnv("AI_GATEWAY_MODEL", "my-model");
      vi.stubEnv("AI_GATEWAY_PROVIDER", "anthropic");

      const config = getLLMConfig();
      expect(config.model).toBe("my-model");
      expect(config.gatewayProvider).toBe("anthropic");
    });
  });

  describe("claude provider", () => {
    it("selects claude when ANTHROPIC_API_KEY is set", () => {
      vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");

      const config = getLLMConfig();
      expect(config.provider).toBe("claude");
      expect(config.apiKey).toBe("sk-ant-test");
    });

    it("defaults model to claude-sonnet-4-20250514", () => {
      vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");

      const config = getLLMConfig();
      expect(config.model).toBe("claude-sonnet-4-20250514");
    });

    it("respects ANTHROPIC_MODEL override", () => {
      vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
      vi.stubEnv("ANTHROPIC_MODEL", "claude-haiku-3");

      const config = getLLMConfig();
      expect(config.model).toBe("claude-haiku-3");
    });

    it("does not set baseUrl or gatewayProvider", () => {
      vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");

      const config = getLLMConfig();
      expect(config.baseUrl).toBeUndefined();
      expect(config.gatewayProvider).toBeUndefined();
    });
  });

  describe("openai provider", () => {
    it("selects openai when OPENAI_API_KEY is set", () => {
      vi.stubEnv("OPENAI_API_KEY", "sk-openai-test");

      const config = getLLMConfig();
      expect(config.provider).toBe("openai");
      expect(config.apiKey).toBe("sk-openai-test");
    });

    it("defaults model to gpt-4o", () => {
      vi.stubEnv("OPENAI_API_KEY", "sk-openai-test");

      const config = getLLMConfig();
      expect(config.model).toBe("gpt-4o");
    });

    it("respects OPENAI_MODEL override", () => {
      vi.stubEnv("OPENAI_API_KEY", "sk-openai-test");
      vi.stubEnv("OPENAI_MODEL", "gpt-4-turbo");

      const config = getLLMConfig();
      expect(config.model).toBe("gpt-4-turbo");
    });
  });

  describe("lm_studio provider", () => {
    it("selects lm_studio when LM_STUDIO_URL is set", () => {
      vi.stubEnv("LM_STUDIO_URL", "http://localhost:1234/v1");

      const config = getLLMConfig();
      expect(config.provider).toBe("lm_studio");
      expect(config.baseUrl).toBe("http://localhost:1234/v1");
    });

    it('defaults model to "local-model"', () => {
      vi.stubEnv("LM_STUDIO_URL", "http://localhost:1234/v1");

      const config = getLLMConfig();
      expect(config.model).toBe("local-model");
    });

    it("respects LM_STUDIO_MODEL override", () => {
      vi.stubEnv("LM_STUDIO_URL", "http://localhost:1234/v1");
      vi.stubEnv("LM_STUDIO_MODEL", "mistral-7b");

      const config = getLLMConfig();
      expect(config.model).toBe("mistral-7b");
    });

    it("does not set apiKey", () => {
      vi.stubEnv("LM_STUDIO_URL", "http://localhost:1234/v1");

      const config = getLLMConfig();
      expect(config.apiKey).toBeUndefined();
    });
  });

  // ── 4. Fallback chain: gateway > claude > openai > lm_studio > none ─
  describe("fallback chain priority", () => {
    it("prefers gateway over all other providers", () => {
      vi.stubEnv("AI_GATEWAY_URL", "https://gateway.example.com");
      vi.stubEnv("AI_GATEWAY_KEY", "gw-key");
      vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
      vi.stubEnv("OPENAI_API_KEY", "sk-openai-test");
      vi.stubEnv("LM_STUDIO_URL", "http://localhost:1234/v1");

      const config = getLLMConfig();
      expect(config.provider).toBe("gateway");
    });

    it("prefers claude over openai and lm_studio", () => {
      vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
      vi.stubEnv("OPENAI_API_KEY", "sk-openai-test");
      vi.stubEnv("LM_STUDIO_URL", "http://localhost:1234/v1");

      const config = getLLMConfig();
      expect(config.provider).toBe("claude");
    });

    it("prefers openai over lm_studio", () => {
      vi.stubEnv("OPENAI_API_KEY", "sk-openai-test");
      vi.stubEnv("LM_STUDIO_URL", "http://localhost:1234/v1");

      const config = getLLMConfig();
      expect(config.provider).toBe("openai");
    });

    it("falls back to lm_studio when no API keys are set", () => {
      vi.stubEnv("LM_STUDIO_URL", "http://localhost:1234/v1");

      const config = getLLMConfig();
      expect(config.provider).toBe("lm_studio");
    });

    it('falls back to "none" when nothing is configured', () => {
      const config = getLLMConfig();
      expect(config.provider).toBe("none");
    });
  });

  // ── 5. Partial config ──────────────────────────────────────────────
  describe("partial config handling", () => {
    it("does not select gateway when only AI_GATEWAY_URL is set (missing key)", () => {
      vi.stubEnv("AI_GATEWAY_URL", "https://gateway.example.com");
      // AI_GATEWAY_KEY intentionally not set

      const config = getLLMConfig();
      expect(config.provider).not.toBe("gateway");
    });

    it("does not select gateway when only AI_GATEWAY_KEY is set (missing URL)", () => {
      vi.stubEnv("AI_GATEWAY_KEY", "gw-key-123");
      // AI_GATEWAY_URL intentionally not set

      const config = getLLMConfig();
      expect(config.provider).not.toBe("gateway");
    });

    it("falls through to claude when gateway is partially configured", () => {
      vi.stubEnv("AI_GATEWAY_URL", "https://gateway.example.com");
      // Missing AI_GATEWAY_KEY
      vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");

      const config = getLLMConfig();
      expect(config.provider).toBe("claude");
    });

    it('falls through to "none" when gateway is partially configured and nothing else is set', () => {
      vi.stubEnv("AI_GATEWAY_URL", "https://gateway.example.com");
      // Missing AI_GATEWAY_KEY, no other providers

      const config = getLLMConfig();
      expect(config.provider).toBe("none");
    });
  });

  // ── 6. Provider override via AI_PROVIDER env var ───────────────────
  // Note: The current implementation does not support AI_PROVIDER override.
  // These tests document the current behavior (env var is ignored) and
  // serve as a specification for when this feature is added.
  describe("AI_PROVIDER env var override", () => {
    it("currently does not override automatic detection (documenting behavior)", () => {
      vi.stubEnv("AI_PROVIDER", "openai");
      vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
      vi.stubEnv("OPENAI_API_KEY", "sk-openai-test");

      const config = getLLMConfig();
      // Current behavior: AI_PROVIDER is not consulted; fallback chain picks claude
      expect(config.provider).toBe("claude");
    });

    it("AI_PROVIDER alone does not activate a provider without its credentials", () => {
      vi.stubEnv("AI_PROVIDER", "claude");
      // No ANTHROPIC_API_KEY set

      const config = getLLMConfig();
      expect(config.provider).toBe("none");
    });
  });
});
