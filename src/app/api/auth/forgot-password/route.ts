import { NextRequest, NextResponse } from "next/server";
import { requestStaffPasswordReset } from "@/lib/password-reset";
import { getRequestLogContext, logError, logWarn } from "@/lib/logger";

export async function POST(request: NextRequest) {
  const logContext = getRequestLogContext(request);
  try {
    const body = await request.json();
    const email = typeof body?.email === "string" ? body.email : "";

    if (email) {
      try {
        await requestStaffPasswordReset(email);
      } catch (error) {
        logError(
          {
            message: "Staff forgot-password request failed while sending reset email",
            ...logContext,
          },
          error
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    // Silence error to prevent enumeration, but log for monitoring
    logWarn({
      message: "Malformed forgot-password request body",
      ...logContext,
      err: error,
    });
    return NextResponse.json({ success: true });
  }
}
