/**
 * Shared AI Configuration for PrimărIA
 */

export type LLMProvider = "gateway" | "claude" | "openai" | "lm_studio" | "none";

export interface LLMConfig {
  provider: LLMProvider;
  apiKey?: string;
  baseUrl?: string;
  model: string;
  gatewayProvider?: string;
}

export function getLLMConfig(): LLMConfig {
  // AI Gateway (Preferred - GCP Deployed)
  if (process.env.AI_GATEWAY_URL && process.env.AI_GATEWAY_KEY) {
    return {
      provider: "gateway",
      baseUrl: process.env.AI_GATEWAY_URL,
      apiKey: process.env.AI_GATEWAY_KEY,
      model: process.env.AI_GATEWAY_MODEL || "gemini",
      gatewayProvider: process.env.AI_GATEWAY_PROVIDER || process.env.AI_GATEWAY_MODEL || "gemini",
    };
  }

  // Claude
  if (process.env.ANTHROPIC_API_KEY) {
    return {
      provider: "claude",
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514",
    };
  }

  // OpenAI / GPT-4o
  if (process.env.OPENAI_API_KEY) {
    return {
      provider: "openai",
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || "gpt-4o",
    };
  }

  // LM Studio (local)
  if (process.env.LM_STUDIO_URL) {
    return {
      provider: "lm_studio",
      baseUrl: process.env.LM_STUDIO_URL,
      model: process.env.LM_STUDIO_MODEL || "local-model",
    };
  }

  return { provider: "none", model: "none" };
}
