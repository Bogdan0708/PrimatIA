import { NextRequest, NextResponse } from "next/server";
import { requestCitizenPasswordReset } from "@/lib/password-reset";
import { resolvePortalTenant } from "@/lib/portal-auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = typeof body?.email === "string" ? body.email : "";

    const tenantId = await resolvePortalTenant(request);

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

