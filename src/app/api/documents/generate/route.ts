import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-utils";
import { generateDocument, type GeneratableDocType } from "@/lib/documents/auto-generator";

const VALID_TYPES: GeneratableDocType[] = [
  "decizie", "chitanta", "certificat", "somatie", "titlu_executoriu",
];

export async function POST(request: NextRequest) {
  const session = await requireAdmin();
  const tenantId = session.user.tenantId;

  try {
    const body = await request.json();
    const { type, entityId, options } = body;

    if (!type || !entityId) {
      return NextResponse.json(
        { error: "type and entityId are required" },
        { status: 400 }
      );
    }

    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${VALID_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    const documentId = await generateDocument({
      type,
      entityId,
      tenantId,
      options,
    });

    return NextResponse.json({ success: true, documentId });
  } catch (error: unknown) {
    console.error("Document generation error:", error);
    const message = error instanceof Error ? error.message : "Generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
