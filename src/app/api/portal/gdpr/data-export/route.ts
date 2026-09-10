import { NextRequest, NextResponse } from "next/server";
import { getCitizenFromRequest } from "@/lib/portal-auth";
import { prisma, withTenantScope } from "@/lib/db";
import {
  checkSharedRateLimit,
  createRateLimitExceededResponse,
  withRateLimitHeaders,
} from "@/lib/rate-limit";
import { getRequestLogContext, logError, logWarn } from "@/lib/logger";

/**
 * POST /api/portal/gdpr/data-export
 *
 * GDPR Art. 15 — Data Subject Access Request.
 * Returns all personal data the platform holds for the authenticated citizen.
 */
export async function POST(request: NextRequest) {
  const logContext = getRequestLogContext(request);

  const citizen = await getCitizenFromRequest(request);
  if (!citizen) {
    logWarn({
      message: "GDPR data export rejected: not authenticated",
      ...logContext,
    });
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Rate limit per citizen (not per IP) — 1 export per hour
  const rateLimit = await checkSharedRateLimit({
    request,
    bucket: "portal-gdpr-export",
    limit: 1,
    windowMs: 60 * 60 * 1000,
    keySuffix: citizen.sub,
  });
  if (!rateLimit.allowed) {
    return createRateLimitExceededResponse(rateLimit);
  }

  try {
    const data = await withTenantScope(citizen.tenantId, async () => {
      // 1. Citizen profile
      const profile = await prisma.citizenUser.findUnique({
        where: { id: citizen.sub },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          emailVerified: true,
          limbaPreferata: true,
          createdAt: true,
          lastLoginAt: true,
        },
      });

      // 2. Linked contribuabili with full details
      const links = await prisma.citizenContribuabilLink.findMany({
        where: { citizenUserId: citizen.sub },
        select: {
          id: true,
          contribuabilId: true,
          linkType: true,
          isActive: true,
          verifiedAt: true,
          createdAt: true,
        },
      });

      const contribuabilIds = links.map((l) => l.contribuabilId);

      const contribuabili = await prisma.contribuabil.findMany({
        where: { id: { in: contribuabilIds } },
        select: {
          id: true,
          tip: true,
          nume: true,
          prenume: true,
          cui: true,
          telefon: true,
          email: true,
          status: true,
          dataInregistrare: true,
          createdAt: true,
        },
      });

      // 3. Properties
      const buildings = await prisma.proprietateCladire.findMany({
        where: { contribuabilId: { in: contribuabilIds }, deletedAt: null },
        select: {
          id: true,
          contribuabilId: true,
          destinatie: true,
          tipConstructie: true,
          anConstructie: true,
          suprafataConstruita: true,
          zona: true,
          adresa: true,
          cotaParte: true,
          status: true,
          dataDobandire: true,
          dataInstrainare: true,
          createdAt: true,
        },
      });

      const land = await prisma.proprietateTeren.findMany({
        where: { contribuabilId: { in: contribuabilIds }, deletedAt: null },
        select: {
          id: true,
          contribuabilId: true,
          categorie: true,
          suprafataMp: true,
          zona: true,
          adresa: true,
          cotaParte: true,
          status: true,
          dataDobandire: true,
          dataInstrainare: true,
          createdAt: true,
        },
      });

      const vehicles = await prisma.proprietateVehicul.findMany({
        where: { contribuabilId: { in: contribuabilIds }, deletedAt: null },
        select: {
          id: true,
          contribuabilId: true,
          tipVehicul: true,
          marca: true,
          model: true,
          anFabricatie: true,
          numarInmatriculare: true,
          cilindreeCmc: true,
          status: true,
          dataDobandire: true,
          dataInstrainare: true,
          createdAt: true,
        },
      });

      // 4. Tax records
      const taxes = await prisma.impozit.findMany({
        where: { contribuabilId: { in: contribuabilIds } },
        select: {
          id: true,
          contribuabilId: true,
          fiscalYear: true,
          proprietateType: true,
          bazaImpozabila: true,
          rataAplicata: true,
          sumaCalculata: true,
          sumaDatorata: true,
          sumaPlatita: true,
          status: true,
          createdAt: true,
        },
      });

      // 5. Payments
      const payments = await prisma.plata.findMany({
        where: { contribuabilId: { in: contribuabilIds } },
        select: {
          id: true,
          contribuabilId: true,
          suma: true,
          dataPlata: true,
          modalitate: true,
          nrChitanta: true,
          createdAt: true,
        },
      });

      const onlinePayments = await prisma.onlinePayment.findMany({
        where: { citizenUserId: citizen.sub },
        select: {
          id: true,
          contribuabilId: true,
          suma: true,
          status: true,
          gatewayRef: true,
          initiatedAt: true,
        },
      });

      // 6. Documents
      const documents = await prisma.document.findMany({
        where: { contribuabilId: { in: contribuabilIds } },
        select: {
          id: true,
          contribuabilId: true,
          tip: true,
          numarDocument: true,
          dataDocument: true,
          status: true,
          createdAt: true,
        },
      });

      // 7. Consents
      const consents = await prisma.consimtamant.findMany({
        where: { contribuabilId: { in: contribuabilIds } },
        select: {
          id: true,
          contribuabilId: true,
          canal: true,
          consimtamant: true,
          dataAcord: true,
          dataRetragere: true,
          sursa: true,
        },
      });

      // 8. Notifications
      const notifications = await prisma.notificare.findMany({
        where: { citizenUserId: citizen.sub },
        select: {
          id: true,
          canal: true,
          subject: true,
          status: true,
          sentAt: true,
          createdAt: true,
        },
      });

      return {
        exportedAt: new Date().toISOString(),
        profile,
        links,
        contribuabili,
        properties: { buildings, land, vehicles },
        taxes,
        payments: { offline: payments, online: onlinePayments },
        documents,
        consents,
        notifications,
      };
    });

    return withRateLimitHeaders(
      NextResponse.json({ success: true, data }),
      rateLimit
    );
  } catch (error) {
    logError(
      {
        message: "GDPR data export failed",
        ...logContext,
        tenantId: citizen.tenantId,
        citizenUserId: citizen.sub,
      },
      error
    );
    return withRateLimitHeaders(
      NextResponse.json({ error: "Export failed" }, { status: 500 }),
      rateLimit
    );
  }
}
