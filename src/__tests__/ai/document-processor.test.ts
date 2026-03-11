import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { processDocument } from "@/lib/ocr/document-processor";

describe("Document Processor - Gateway Integration", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.AI_GATEWAY_URL;
    delete process.env.AI_GATEWAY_KEY;
    
    global.fetch = vi.fn();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("should use AI Gateway for structured extraction when enabled", async () => {
    process.env.AI_GATEWAY_URL = "https://gateway.example.com";
    process.env.AI_GATEWAY_KEY = "master-key-123";
    process.env.AI_GATEWAY_PROVIDER = "gemini";
    process.env.AI_GATEWAY_MODEL = "gemini-2.0-flash";
    process.env.TENANT_ID = "tenant-1";

    // Mock OCR text that regex might partially miss
    const ocrText = "NUME: POPESCU PRENUME: ION CNP: 1900101123456";
    
    // Mock Gateway response
    const mockResponse = {
      choices: [{ 
        message: { 
          content: `\`\`\`json
{"nume": "POPESCU", "prenume": "ION", "cnp": "1900101123456"}
\`\`\`` 
        } 
      }]
    };

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as unknown as Response);

    const result = await processDocument(ocrText, "carte_identitate", true);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("https://gateway.example.com/v1/chat/completions"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Authorization": "Bearer master-key-123",
          "x-tenant-id": "tenant-1",
        }),
        body: expect.stringContaining('"provider":"gemini"'),
      })
    );

    const numeField = result.fields.find(f => f.key === "nume");
    expect(numeField?.value).toBe("POPESCU");
  });

  it("should only use regex extraction when useAi is false", async () => {
    const ocrText = "NUME: POPESCU PRENUME: ION CNP: 1900101123456";
    
    const result = await processDocument(ocrText, "carte_identitate", false);

    expect(global.fetch).not.toHaveBeenCalled();
    const cnpField = result.fields.find(f => f.key === "cnp");
    expect(cnpField?.value).toBe("1900101123456");
  });
});
