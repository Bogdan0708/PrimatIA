import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getCitizenFromRequest } from "@/lib/portal-auth";
import { prisma, setTenantContext } from "@/lib/db";
import { getPresignedUrl } from "@/lib/storage";
import { logger, getRequestLogContext } from "@/lib/logger";

/**
 * GET /api/documents/[id]/download
 *
 * Serves document downloads for both staff and citizen portal users.
 * Redirects to a MinIO presigned URL.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: documentId } = await params;
  const logContext = getRequestLogContext(request);

  // Try staff auth first, then citizen auth
  const staffSession = await auth();
  const citizenSession = !staffSession?.user
    ? await getCitizenFromRequest(request)
    : null;

  if (!staffSession?.user && !citizenSession) {
    logger.warn(
      { ...logContext, entityId: documentId },
      "Document download rejected because no authenticated session was present"
    );
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = staffSession?.user?.tenantId ?? citizenSession!.tenantId;
  await setTenantContext(tenantId);

  const doc = await prisma.document.findFirst({
    where: { id: documentId, tenantId },
  });

  if (!doc?.fileUrl) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  // For citizen users, verify they own the document
  if (citizenSession) {
    const link = await prisma.citizenContribuabilLink.findFirst({
      where: {
        citizenUserId: citizenSession.sub,
        tenantId,
      },
      select: { contribuabilId: true },
    });

    if (!link || doc.contribuabilId !== link.contribuabilId) {
      logger.warn(
        {
          ...logContext,
          tenantId,
          citizenUserId: citizenSession.sub,
          entityId: documentId,
        },
        "Citizen document download rejected because ownership check failed"
      );
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
  }

  try {
    const url = await getPresignedUrl(doc.fileUrl);
    return NextResponse.redirect(url);
  } catch (error) {
    logger.error(
      {
        ...logContext,
        tenantId,
        userId: staffSession?.user?.id,
        citizenUserId: citizenSession?.sub,
        entityId: documentId,
        err: error,
      },
      "Document download failed while generating presigned URL"
    );
    return NextResponse.json(
      { error: "Failed to generate download URL" },
      { status: 500 }
    );
  }
}
