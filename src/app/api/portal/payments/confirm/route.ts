import { NextRequest, NextResponse } from "next/server";
import { getMockGatewayProvider } from "@/lib/payments/payment-gateway";
import { prisma, withTenantScope } from "@/lib/db";
import { generateDocumentNumber } from "@/lib/formatting";
import { getCitizenFromRequest } from "@/lib/portal-auth";
import { getStatusAfterPayment } from "@/lib/tax-engine/liability-utils";
import { Prisma } from "@prisma/client";
import {
  allowedFromStatusesFor,
  assertOnlinePaymentTransition,
  isOnlinePaymentStatus,
} from "@/lib/payments/online-payment-state-machine";

export async function POST(request: NextRequest) {
  const paymentMode =
    process.env.PAYMENT_MODE ??
    (process.env.NODE_ENV === "production" ? "stripe" : "mock");
  if (paymentMode !== "mock") {
    return NextResponse.json(
      { error: "Mock payment confirmation is disabled" },
      { status: 403 }
    );
  }

  const citizen = await getCitizenFromRequest(request);
  if (!citizen) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { gatewayRef } = body;

    if (!gatewayRef) {
      return NextResponse.json(
        { error: "gatewayRef is required" },
        { status: 400 }
      );
    }

    const mock = getMockGatewayProvider();

    const processResult = await withTenantScope(citizen.tenantId, async () => {
      const onlinePayment = await prisma.onlinePayment.findFirst({
        where: { tenantId: citizen.tenantId, gatewayRef },
      });

      if (!onlinePayment) {
        return { kind: "not_found" as const };
      }

      if (onlinePayment.citizenUserId !== citizen.sub) {
        return { kind: "forbidden" as const };
      }

      if (!isOnlinePaymentStatus(onlinePayment.status)) {
        return {
          kind: "invalid_state" as const,
          message: `Unsupported payment status: ${onlinePayment.status}`,
        };
      }

      try {
        assertOnlinePaymentTransition(onlinePayment.status, "confirmed", gatewayRef);
      } catch (error) {
        return {
          kind: "invalid_state" as const,
          message:
            error instanceof Error
              ? error.message
              : "Payment is already processed or in an invalid state.",
        };
      }

      const confirmed = await mock.confirmMockPayment(gatewayRef);
      if (!confirmed) {
        return {
          kind: "invalid_state" as const,
          message: "Payment not found or already processed.",
        };
      }

      const transition = await prisma.onlinePayment.updateMany({
        where: {
          id: onlinePayment.id,
          tenantId: citizen.tenantId,
          status: { in: allowedFromStatusesFor("confirmed") },
        },
        data: {
          status: "confirmed",
          confirmedAt: new Date(),
          gatewayResponse: { confirmed: true, transactionId: `TXN-${gatewayRef}` },
        },
      });

      if (transition.count !== 1) {
        return {
          kind: "invalid_state" as const,
          message: "Payment is already processed or in an invalid state.",
        };
      }

      // Generate chitanță number atomically
      const year = new Date().getFullYear();
      const seqResult = await prisma.$queryRaw<Array<{ next_val: bigint }>>(
        Prisma.sql`INSERT INTO "ChitantaSequence" ("tenantId", "year", "currentVal")
                   VALUES (${citizen.tenantId}, ${year}, 1)
                   ON CONFLICT ("tenantId", "year")
                   DO UPDATE SET "currentVal" = "ChitantaSequence"."currentVal" + 1
                   RETURNING "currentVal" AS next_val`
      );
      const seqNum = Number(seqResult[0].next_val);
      const nrChitanta = generateDocumentNumber("CHT", year, seqNum);

      // Create actual Plata record
      const plata = await prisma.plata.create({
        data: {
          tenantId: citizen.tenantId,
          contribuabilId: onlinePayment.contribuabilId,
          suma: onlinePayment.suma,
          dataPlata: new Date(),
          modalitate: "card",
          nrChitanta,
          gatewayRef,
          distribuit: false,
        },
      });

      await prisma.onlinePayment.update({
        where: { id: onlinePayment.id },
        data: {
          plataId: plata.id,
        },
      });

      // Auto-distribute payment to debts
      const selectedDebts = onlinePayment.selectedDebts as Array<{ impozitId: string; amount: number }>;
      if (selectedDebts && selectedDebts.length > 0) {
        for (const debt of selectedDebts) {
          await prisma.plataDistributie.create({
            data: {
              tenantId: citizen.tenantId,
              plataId: plata.id,
              impozitId: debt.impozitId,
              sumaDebit: debt.amount,
              sumaPenalitati: 0,
            },
          });

          const impozit = await prisma.impozit.findUnique({
            where: { id: debt.impozitId },
          });

          if (impozit) {
            const newPaid = Number(impozit.sumaPlatita) + debt.amount;
            const newStatus = getStatusAfterPayment(impozit, debt.amount, impozit.status);

            await prisma.impozit.update({
              where: { id: debt.impozitId },
              data: {
                sumaPlatita: newPaid,
                status: newStatus,
              },
            });
          }
        }

        await prisma.plata.update({
          where: { id: plata.id },
          data: { distribuit: true },
        });
      }

      // Generate chitanță document
      await prisma.document.create({
        data: {
          tenantId: citizen.tenantId,
          contribuabilId: onlinePayment.contribuabilId,
          tip: "chitanta",
          numarDocument: nrChitanta,
          dataDocument: new Date(),
          dataJson: {
            plataId: plata.id,
            suma: Number(onlinePayment.suma),
            modalitate: "card",
            gatewayRef,
            items: selectedDebts,
          },
          status: "generat",
        },
      });

      return { kind: "processed" as const, plataId: plata.id };
    });

    if (processResult.kind === "not_found") {
      return NextResponse.json({ error: "Payment record not found" }, { status: 404 });
    }

    if (processResult.kind === "forbidden") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    if (processResult.kind === "invalid_state") {
      return NextResponse.json({ error: processResult.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, plataId: processResult.plataId });
  } catch (error) {
    console.error("Payment confirmation error:", error);
    return NextResponse.json(
      { error: "Failed to confirm payment" },
      { status: 500 }
    );
  }
}
