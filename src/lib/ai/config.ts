/**
 * Shared AI Configuration for PrimărIA
 */

export type LLMProvider = "gateway" | "none";

export interface LLMConfig {
  provider: LLMProvider;
  apiKey?: string;
  baseUrl?: string;
  model: string;
  gatewayProvider?: string;
  gatewayTenantId?: string;
}

const GATEWAY_PROVIDER_ALIASES = new Set(["gemini", "claude", "openai", "groq"]);
const DEFAULT_GATEWAY_PROVIDER = "gemini";
const DEFAULT_GATEWAY_MODEL = "gemini-2.0-flash";

export function getLLMConfig(): LLMConfig {
  if (process.env.AI_GATEWAY_URL && process.env.AI_GATEWAY_KEY) {
    const configuredProvider = process.env.AI_GATEWAY_PROVIDER?.trim();
    const configuredModel = process.env.AI_GATEWAY_MODEL?.trim();
    const aliasedProvider =
      !configuredProvider && configuredModel && GATEWAY_PROVIDER_ALIASES.has(configuredModel)
        ? configuredModel
        : undefined;

    return {
      provider: "gateway",
      baseUrl: process.env.AI_GATEWAY_URL,
      apiKey: process.env.AI_GATEWAY_KEY,
      model:
        configuredModel && !aliasedProvider
          ? configuredModel
          : DEFAULT_GATEWAY_MODEL,
      gatewayProvider: configuredProvider || aliasedProvider || DEFAULT_GATEWAY_PROVIDER,
      gatewayTenantId: process.env.TENANT_ID || undefined,
    };
  }

  return { provider: "none", model: "none" };
}

export function getGatewayHeaders(config: LLMConfig): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.apiKey}`,
  };

  if (config.gatewayTenantId) {
    headers["x-tenant-id"] = config.gatewayTenantId;
  }

  return headers;
}
