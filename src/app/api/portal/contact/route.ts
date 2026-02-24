import { NextRequest, NextResponse } from "next/server";
import { getCitizenFromRequest, resolvePortalTenant } from "@/lib/portal-auth";
import { prisma, withTenantScope } from "@/lib/db";

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

    const tenantId = citizen?.tenantId || await resolvePortalTenant(request);
    if (!tenantId) {
      return NextResponse.json(
        { error: "Tenant identification required" },
        { status: 400 }
      );
    }

    await withTenantScope(tenantId, async () => {
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

