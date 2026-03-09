import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { generateRAGResponse } from "@/lib/ai/knowledge-base";

describe("AI Knowledge Base - Gateway Integration", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    // Clear all potential providers
    delete process.env.AI_GATEWAY_URL;
    delete process.env.AI_GATEWAY_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.LM_STUDIO_URL;
    
    global.fetch = vi.fn();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("should use AI Gateway when configured", async () => {
    process.env.AI_GATEWAY_URL = "https://gateway.example.com";
    process.env.AI_GATEWAY_KEY = "master-key-123";
    process.env.AI_GATEWAY_PROVIDER = "gemini";
    process.env.AI_GATEWAY_MODEL = "gemini-2.0-flash";
    process.env.TENANT_ID = "tenant-1";

    const mockResponse = {
      choices: [{ message: { content: "Răspuns de la gateway" } }],
      usage: { total_tokens: 100 }
    };

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as unknown as Response);

    const result = await generateRAGResponse("Cum plătesc?");

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("https://gateway.example.com/v1/chat/completions"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Authorization": "Bearer master-key-123",
          "Content-Type": "application/json",
          "x-tenant-id": "tenant-1",
        }),
        body: expect.stringContaining('"provider":"gemini"'),
      })
    );

    expect(result.answer).toBe("Răspuns de la gateway");
    expect(result.usedLLM).toBe(true);
  });

  it("should fall back to keyword search when no provider is configured", async () => {
    // No env vars set
    const result = await generateRAGResponse("Salut");
    
    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.usedLLM).toBe(false);
    expect(result.answer).toContain("Îmi pare rău");
  });
});
