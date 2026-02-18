import { NextRequest, NextResponse } from "next/server";
import { requestStaffPasswordReset } from "@/lib/password-reset";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = typeof body?.email === "string" ? body.email : "";

    if (email) {
      try {
        await requestStaffPasswordReset(email);
      } catch (error) {
        console.error("Staff forgot-password email send failed:", error);
      }
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: true });
  }
}
