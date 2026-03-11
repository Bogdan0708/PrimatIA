#!/usr/bin/env node

const gatewayUrl = process.env.AI_GATEWAY_URL;
const gatewayKey = process.env.AI_GATEWAY_KEY;
const tenantId = process.env.TENANT_ID;
const provider = process.env.AI_GATEWAY_PROVIDER || "gemini";
const model = process.env.AI_GATEWAY_MODEL || "gemini-2.0-flash";

if (!gatewayUrl || !gatewayKey || !tenantId) {
  console.error(
    "[ai-smoke] AI_GATEWAY_URL, AI_GATEWAY_KEY, and TENANT_ID must be set.",
  );
  process.exit(1);
}

const baseUrl = gatewayUrl.replace(/\/+$/, "");
const response = await fetch(`${baseUrl}/v1/chat/completions`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${gatewayKey}`,
    "x-tenant-id": tenantId,
  },
  body: JSON.stringify({
    provider,
    model,
    max_tokens: 120,
    messages: [
      {
        role: "system",
        content: "Raspunde concis in limba romana.",
      },
      {
        role: "user",
        content: "Ce este impozitul pe cladiri?",
      },
    ],
  }),
  signal: AbortSignal.timeout(15_000),
});

const payload = await response.json().catch(() => null);

if (!response.ok) {
  console.error("[ai-smoke] Gateway request failed", {
    status: response.status,
    payload,
  });
  process.exit(1);
}

const answer = payload?.choices?.[0]?.message?.content;
if (typeof answer !== "string" || !answer.trim()) {
  console.error("[ai-smoke] Gateway returned no assistant content", { payload });
  process.exit(1);
}

if (payload?.tenant_id && payload.tenant_id !== tenantId) {
  console.error("[ai-smoke] Gateway tenant_id mismatch", {
    expected: tenantId,
    actual: payload.tenant_id,
  });
  process.exit(1);
}

console.log("[ai-smoke] OK", {
  provider: payload?.provider || provider,
  model: payload?.model || model,
  tenantId: payload?.tenant_id || tenantId,
});
