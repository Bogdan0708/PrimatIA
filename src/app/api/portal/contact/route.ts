import { NextRequest, NextResponse } from "next/server";
import { getCitizenFromRequest } from "@/lib/portal-auth";
import { prisma, withTenantScope } from "@/lib/db";
import { resolveTenantIdFromHeaders } from "@/lib/tenant-resolution";
import { logger } from "@/lib/logger";

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

    // Authenticated tenant is read from JWT; anonymous requests derive tenant from domain.
    const tenantId = citizen?.tenantId ?? await resolveTenantIdFromHeaders(request.headers);
    if (!tenantId) {
      return NextResponse.json(
        { error: "Tenant could not be resolved for this domain." },
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
    logger.error({ err: error }, "Contact form error:");
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}
