import { NextRequest, NextResponse } from "next/server";
import { requestCitizenPasswordReset } from "@/lib/password-reset";
import { resolveTenantIdFromHeaders } from "@/lib/tenant-resolution";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = typeof body?.email === "string" ? body.email : "";

    // Tenant identity must be derived server-side from trusted context.
    const tenantId = await resolveTenantIdFromHeaders(request.headers);

    if (email && tenantId) {
      try {
        await requestCitizenPasswordReset(tenantId, email);
      } catch (error) {
        console.error("Citizen forgot-password email send failed:", error);
      }
    }

    // Always return success to prevent email enumeration
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: true });
  }
}
