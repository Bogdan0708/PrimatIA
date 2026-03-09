import { NextRequest, NextResponse } from "next/server";
import { getCitizenFromRequest } from "@/lib/portal-auth";
import { prisma, setTenantContext } from "@/lib/db";
import { getRequestLogContext, logError, logWarn } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const logContext = getRequestLogContext(request);
  const citizen = await getCitizenFromRequest(request);
  if (!citizen) {
    logWarn({
      message: "Portal profile fetch rejected because citizen was not authenticated",
      ...logContext,
    });
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  await setTenantContext(citizen.tenantId);

  const user = await prisma.citizenUser.findUnique({
    where: { id: citizen.sub },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      limbaPreferata: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Get email consent
  const links = await prisma.citizenContribuabilLink.findMany({
    where: { citizenUserId: citizen.sub, isActive: true },
    select: { contribuabilId: true },
  });

  let emailNotifications = false;
  if (links.length > 0) {
    const consent = await prisma.consimtamant.findFirst({
      where: {
        contribuabilId: links[0].contribuabilId,
        canal: "email",
        consimtamant: true,
      },
    });
    emailNotifications = !!consent;
  }

  return NextResponse.json({
    ...user,
    phone: user.phone || "",
    emailNotifications,
  });
}

export async function PUT(request: NextRequest) {
  const logContext = getRequestLogContext(request);
  const citizen = await getCitizenFromRequest(request);
  if (!citizen) {
    logWarn({
      message: "Portal profile update rejected because citizen was not authenticated",
      ...logContext,
    });
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { firstName, lastName, phone, limbaPreferata, emailNotifications } = body;

    await setTenantContext(citizen.tenantId);

    await prisma.citizenUser.update({
      where: { id: citizen.sub },
      data: {
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        phone: phone || null,
        limbaPreferata: limbaPreferata || "ro",
      },
    });

    // Update email consent for all linked contribuabili
    const links = await prisma.citizenContribuabilLink.findMany({
      where: { citizenUserId: citizen.sub, isActive: true },
      select: { contribuabilId: true },
    });

    for (const link of links) {
      await prisma.consimtamant.upsert({
        where: {
          tenantId_contribuabilId_canal: {
            tenantId: citizen.tenantId,
            contribuabilId: link.contribuabilId,
            canal: "email",
          },
        },
        update: {
          consimtamant: emailNotifications,
          dataAcord: emailNotifications ? new Date() : undefined,
          dataRetragere: !emailNotifications ? new Date() : undefined,
          sursa: "portal",
        },
        create: {
          tenantId: citizen.tenantId,
          contribuabilId: link.contribuabilId,
          canal: "email",
          consimtamant: emailNotifications,
          dataAcord: emailNotifications ? new Date() : undefined,
          sursa: "portal",
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logError(
      {
        message: "Portal profile update failed unexpectedly",
        ...logContext,
        tenantId: citizen.tenantId,
        citizenUserId: citizen.sub,
      },
      error
    );
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}
