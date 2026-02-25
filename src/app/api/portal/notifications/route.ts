import { NextRequest, NextResponse } from "next/server";
import { getCitizenFromRequest, resolvePortalTenant } from "@/lib/portal-auth";
import { prisma, setTenantContext } from "@/lib/db";
import { z } from "zod";

const NotificationActionSchema = z.object({
  action: z.enum(["mark_read", "mark_all_read"]),
  notificationId: z.string().uuid().optional(),
});

export async function GET(request: NextRequest) {
  const citizen = await getCitizenFromRequest(request);
  if (!citizen) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = await resolvePortalTenant(request);
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 400 });
  }
  await setTenantContext(tenantId);

  // Get the citizen's contribuabil IDs
  const links = await prisma.citizenContribuabilLink.findMany({
    where: { citizenUserId: citizen.sub, isActive: true },
    select: { contribuabilId: true },
  });
  const contribuabilIds = links.map((l) => l.contribuabilId);

  // Fetch in-app notifications for this citizen (last 20)
  const notifications = await prisma.notificare.findMany({
    where: {
      tenantId,
      canal: "in_app",
      OR: [
        { citizenUserId: citizen.sub },
        { contribuabilId: { in: contribuabilIds } },
      ],
    },
    select: {
      id: true,
      subject: true,
      bodyText: true,
      canal: true,
      triggerEvent: true,
      createdAt: true,
      sentAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  // Use sentAt as the "read at" marker — notificări with status "sent" have been read
  const mapped = notifications.map((n) => ({
    id: n.id,
    subject: n.subject,
    bodyText: n.bodyText,
    canal: n.canal,
    triggerEvent: n.triggerEvent,
    createdAt: n.createdAt.toISOString(),
    readAt: n.sentAt?.toISOString() ?? null,
  }));

  const unreadCount = mapped.filter((n) => !n.readAt).length;

  return NextResponse.json({ success: true, data: mapped, unreadCount });
}

export async function POST(request: NextRequest) {
  const citizen = await getCitizenFromRequest(request);
  if (!citizen) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = await resolvePortalTenant(request);
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 400 });
  }
  await setTenantContext(tenantId);

  const json = await request.json();
  const result = NotificationActionSchema.safeParse(json);
  if (!result.success) {
    return NextResponse.json({ error: "Invalid request body", details: result.error.format() }, { status: 400 });
  }
  const { action, notificationId } = result.data;

  const links = await prisma.citizenContribuabilLink.findMany({
    where: { citizenUserId: citizen.sub, isActive: true },
    select: { contribuabilId: true },
  });
  const contribuabilIds = links.map((l) => l.contribuabilId);

  if (action === "mark_read" && notificationId) {
    // Mark single notification as read (set sentAt)
    await prisma.notificare.updateMany({
      where: {
        id: notificationId,
        tenantId,
        canal: "in_app",
        sentAt: null,
        OR: [
          { citizenUserId: citizen.sub },
          { contribuabilId: { in: contribuabilIds } },
        ],
      },
      data: { sentAt: new Date(), status: "sent" },
    });
  } else if (action === "mark_all_read") {
    // Mark all unread notifications
    await prisma.notificare.updateMany({
      where: {
        tenantId,
        canal: "in_app",
        sentAt: null,
        OR: [
          { citizenUserId: citizen.sub },
          { contribuabilId: { in: contribuabilIds } },
        ],
      },
      data: { sentAt: new Date(), status: "sent" },
    });
  }

  return NextResponse.json({ success: true });
}
