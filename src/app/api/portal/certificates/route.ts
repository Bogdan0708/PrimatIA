import { NextRequest, NextResponse } from "next/server";
import { getCitizenFromRequest } from "@/lib/portal-auth";
import { prisma, setTenantContext } from "@/lib/db";
import { getRequestLogContext, logError, logWarn } from "@/lib/logger";

export async function POST(request: NextRequest) {
  const logContext = getRequestLogContext(request);
  const citizen = await getCitizenFromRequest(request);
  if (!citizen) {
    logWarn({
      message: "Portal certificate request rejected because citizen was not authenticated",
      ...logContext,
    });
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { contribuabilId, tipCertificat, scop, nrExemplare } = body;

    if (!contribuabilId || !tipCertificat) {
      return NextResponse.json(
        { error: "contribuabilId and tipCertificat are required" },
        { status: 400 }
      );
    }

    await setTenantContext(citizen.tenantId);

    // Verify citizen has access to this contribuabil
    const link = await prisma.citizenContribuabilLink.findFirst({
      where: {
        citizenUserId: citizen.sub,
        contribuabilId,
        isActive: true,
      },
    });

    if (!link) {
      logWarn({
        message: "Portal certificate request rejected because citizen lacks contribuabil access",
        ...logContext,
        tenantId: citizen.tenantId,
        citizenUserId: citizen.sub,
        contribuabilId,
      });
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const request_ = await prisma.certificateRequest.create({
      data: {
        tenantId: citizen.tenantId,
        citizenUserId: citizen.sub,
        contribuabilId,
        tipCertificat,
        scop: scop || null,
        nrExemplare: nrExemplare || 1,
        status: "pending",
      },
    });

    return NextResponse.json({ success: true, requestId: request_.id });
  } catch (error) {
    logError(
      {
        message: "Portal certificate request failed unexpectedly",
        ...logContext,
        tenantId: citizen.tenantId,
        citizenUserId: citizen.sub,
      },
      error
    );
    return NextResponse.json(
      { error: "Failed to create request" },
      { status: 500 }
    );
  }
}
