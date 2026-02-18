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
          // For images/PDF: read as text fallback or use AI
          // In production, this would use an OCR service
          text = await file.text();
          useAi = true;
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

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    console.error("Document processing error:", error);
    const message = error instanceof Error ? error.message : "Processing failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
