import { NextRequest, NextResponse } from "next/server";
import { getCitizenFromRequest } from "@/lib/portal-auth";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const citizen = await getCitizenFromRequest(request);
    const body = await request.json();
    const { name, email, phone, subject, message } = body;

    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { error: "Name, email, subject, and message are required" },
        { status: 400 }
      );
    }

    // Resolve tenant
    const tenantId = citizen?.tenantId || await getDefaultTenantId();
    if (!tenantId) {
      return NextResponse.json(
        { error: "Tenant not found" },
        { status: 400 }
      );
    }

    await prisma.contactMessage.create({
      data: {
        tenantId,
        citizenUserId: citizen?.sub || null,
        name,
        email,
        phone: phone || null,
        subject,
        message,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Contact form error:", error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}

async function getDefaultTenantId(): Promise<string | null> {
  const tenant = await prisma.tenant.findFirst({
    where: { status: { in: ["active", "trial"] }, deletedAt: null },
    select: { id: true },
  });
  return tenant?.id || null;
}
