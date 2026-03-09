import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-utils";
import { processDocument, type DocumentType } from "@/lib/ocr/document-processor";
import { logger, getRequestLogContext } from "@/lib/logger";

const VALID_TYPES: DocumentType[] = [
  'carte_identitate',
  'certificat_auto',
  'act_proprietate',
  'certificat_urbanism',
];

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  DOCX_MIME,
]);

function hasSignature(bytes: Uint8Array, signature: number[]): boolean {
  if (bytes.length < signature.length) return false;
  return signature.every((value, index) => bytes[index] === value);
}

function isLikelyDocx(fileName: string, bytes: Uint8Array): boolean {
  const lowerName = fileName.toLowerCase();
  if (!lowerName.endsWith(".docx")) {
    return false;
  }

  const zipSignature =
    hasSignature(bytes, [0x50, 0x4b, 0x03, 0x04]) ||
    hasSignature(bytes, [0x50, 0x4b, 0x05, 0x06]) ||
    hasSignature(bytes, [0x50, 0x4b, 0x07, 0x08]);
  if (!zipSignature) {
    return false;
  }

  const body = Buffer.from(bytes);
  return (
    body.includes(Buffer.from("[Content_Types].xml")) &&
    body.includes(Buffer.from("word/"))
  );
}

function detectMimeFromMagicBytes(fileName: string, bytes: Uint8Array): string | null {
  if (hasSignature(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    return "application/pdf";
  }
  if (hasSignature(bytes, [0xff, 0xd8, 0xff])) {
    return "image/jpeg";
  }
  if (hasSignature(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }
  if (isLikelyDocx(fileName, bytes)) {
    return DOCX_MIME;
  }
  return null;
}

function allowedFileTypesMessage(): string {
  return "Allowed file types: PDF, JPG, PNG, DOCX.";
}

export async function POST(request: NextRequest) {
  const session = await requireAdmin();
  const logContext = getRequestLogContext(request, {
    tenantId: session.user.tenantId,
    userId: session.user.id,
  });

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
        if (file.size === 0) {
          return NextResponse.json(
            { error: "Uploaded file is empty." },
            { status: 400 }
          );
        }

        if (file.size > MAX_FILE_SIZE_BYTES) {
          return NextResponse.json(
            { error: "File too large. Maximum allowed size is 10MB." },
            { status: 413 }
          );
        }

        const fileBytes = new Uint8Array(await file.arrayBuffer());
        const detectedMime = detectMimeFromMagicBytes(file.name, fileBytes);

        if (!detectedMime || !ALLOWED_UPLOAD_MIME_TYPES.has(detectedMime)) {
          return NextResponse.json(
            {
              error: `Unsupported file type. ${allowedFileTypesMessage()}`,
            },
            { status: 400 }
          );
        }

        // OCR extraction is out of scope here; keep existing behavior and force AI mode.
        text = await file.text();
        useAi = true;
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
    logger.error(
      {
        ...logContext,
        err: error,
      },
      "Document processing failed unexpectedly"
    );
    const message = error instanceof Error ? error.message : "Processing failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
