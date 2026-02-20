import { NextRequest, NextResponse } from "next/server";
import { requestCitizenPasswordReset } from "@/lib/password-reset";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = typeof body?.email === "string" ? body.email : "";

    // Tenant must be explicitly identified (P0-SEC-3)
    const tenantId = request.headers.get("x-tenant-id");

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

// getDefaultTenantId removed — was a cross-tenant bypass (P0-SEC-3).
