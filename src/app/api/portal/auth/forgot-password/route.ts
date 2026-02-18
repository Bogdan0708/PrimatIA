import { NextRequest, NextResponse } from "next/server";
import { requestCitizenPasswordReset } from "@/lib/password-reset";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = typeof body?.email === "string" ? body.email : "";

    const tenantId = request.headers.get("x-tenant-id") || (await getDefaultTenantId());

    if (email && tenantId) {
      try {
        await requestCitizenPasswordReset(tenantId, email);
      } catch (error) {
        console.error("Citizen forgot-password email send failed:", error);
      }
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: true });
  }
}

async function getDefaultTenantId(): Promise<string | null> {
  const tenant = await prisma.tenant.findFirst({
    where: { status: { in: ["active", "trial"] }, deletedAt: null },
    select: { id: true },
  });
  return tenant?.id || null;
}
