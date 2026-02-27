import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-utils";
import { processDocument, type DocumentType } from "@/lib/ocr/document-processor";

const VALID_TYPES: DocumentType[] = [
  'carte_identitate',
  'certificat_auto',
  'act_proprietate',
  'certificat_urbanism',
];

export async function POST(request: NextRequest) {
  await requireAdmin();

  try {
    const contentType = request.headers.get("content-type") || "";

    let text: string;
    let documentType: DocumentType;
    let useAi = false;

    if (contentType.includes("multipart/form-data")) {
      // File upload
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      const pastedText = formData.get("text") as string | null;
      const type = formData.get("documentType") as string;
      useAi = formData.get("useAi") === "true";

      if (!VALID_TYPES.includes(type as DocumentType)) {
        return NextResponse.json({ error: "Invalid document type" }, { status: 400 });
      }
      documentType = type as DocumentType;

      if (pastedText && pastedText.trim().length > 0) {
        text = pastedText.trim();
      } else if (file) {
        // For text-based files, read as text
        // For images/PDFs, we'd need OCR — fallback to AI extraction
        if (file.type.startsWith("text/") || file.name.endsWith(".txt")) {
          text = await file.text();
        } else {
          return NextResponse.json(
            { error: "unsupported_file_type" },
            { status: 415 }
          );
        }
      } else {
        return NextResponse.json({ error: "No file or text provided" }, { status: 400 });
      }
    } else {
      // JSON input
      const body = await request.json();
      text = body.text;
      documentType = body.documentType;
      useAi = body.useAi || false;

      if (!text || !documentType) {
        return NextResponse.json({ error: "text and documentType are required" }, { status: 400 });
      }

      if (!VALID_TYPES.includes(documentType)) {
        return NextResponse.json({ error: "Invalid document type" }, { status: 400 });
      }
    }

    const result = await processDocument(text, documentType, useAi);

    let aiProvider: string | null = null;
    if (useAi) {
      const { getLLMConfig } = await import("@/lib/ai/config");
      const llmConfig = getLLMConfig();
      aiProvider = llmConfig.provider !== "none" ? llmConfig.provider : null;
    }

    return NextResponse.json({
      success: true,
      data: result,
      usedAi: useAi && aiProvider !== null,
      aiProvider,
    });
  } catch (error: unknown) {
    console.error("Document processing error:", error);
    const message = error instanceof Error ? error.message : "Processing failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
