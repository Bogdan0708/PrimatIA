import { NextRequest, NextResponse } from "next/server";
import { getMockGatewayProvider } from "@/lib/payments/payment-gateway";
import { prisma, withTenantScope } from "@/lib/db";
import { generateDocumentNumber } from "@/lib/formatting";
import { getCitizenFromRequest } from "@/lib/portal-auth";
import { getOutstanding, getStatusAfterPayment } from "@/lib/tax-engine/liability-utils";
import { Prisma } from "@prisma/client";

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

    // Load DB payment first; idempotency is determined by DB record state
    const onlinePayment = await prisma.onlinePayment.findFirst({
      where: { gatewayRef },
    });

    if (!onlinePayment) {
      return NextResponse.json(
        { error: "Payment record not found" },
        { status: 404 }
      );
    }

    if (
      onlinePayment.citizenUserId !== citizen.sub ||
      onlinePayment.tenantId !== citizen.tenantId
    ) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const selectedDebts = onlinePayment.selectedDebts as Array<{ impozitId: string; amount: number }>;

    return await withTenantScope(onlinePayment.tenantId, async () => {
      const [lockedPayment] = await prisma.$queryRaw<
        Array<{ status: string; plataId: string | null }>
      >(
        Prisma.sql`SELECT status, "plataId" FROM "OnlinePayment" WHERE id = ${onlinePayment.id} FOR UPDATE`
      );

      if (!lockedPayment) {
        return NextResponse.json(
          { error: "Payment record not found" },
          { status: 404 }
        );
      }

      if (lockedPayment.status === "confirmed") {
        return NextResponse.json({ success: true, plataId: lockedPayment.plataId });
      }

      // Confirm at gateway after DB lock. Treat already-confirmed gateway status as success.
      const mock = getMockGatewayProvider();
      const confirmed = await mock.confirmMockPayment(gatewayRef);
      if (!confirmed) {
        const gatewayStatus = await mock.getPaymentStatus(gatewayRef);
        if (gatewayStatus.status !== "confirmed") {
          return NextResponse.json(
            { error: "Payment not found or already processed" },
            { status: 400 }
          );
        }
      }

      // Validate selected debts before mutating payment/tax records
      if (selectedDebts && selectedDebts.length > 0) {
        const ids = selectedDebts.map((d) => d.impozitId);
        await prisma.$queryRaw`SELECT id FROM "Impozit" WHERE id::text = ANY(${ids}) FOR UPDATE`;

        for (const debt of selectedDebts) {
          const impozit = await prisma.impozit.findUnique({
            where: { id: debt.impozitId },
          });

          if (!impozit) {
            return NextResponse.json(
              { error: `Debt ${debt.impozitId} not found` },
              { status: 404 }
            );
          }

          const remaining = getOutstanding(impozit);
          if (debt.amount > remaining + 0.01) {
            return NextResponse.json(
              {
                error: `Overpayment on debt ${debt.impozitId}: paying ${debt.amount}, remaining ${remaining.toFixed(2)}`,
              },
              { status: 400 }
            );
          }
        }
      }

      // Generate chitanță number atomically
      const year = new Date().getFullYear();
      const seqResult = await prisma.$queryRaw<Array<{ next_val: bigint }>>(
        Prisma.sql`INSERT INTO "ChitantaSequence" ("tenantId", "year", "currentVal")
                   VALUES (${onlinePayment.tenantId}::uuid, ${year}, 1)
                   ON CONFLICT ("tenantId", "year")
                   DO UPDATE SET "currentVal" = "ChitantaSequence"."currentVal" + 1
                   RETURNING "currentVal" AS next_val`
      );
      const seqNum = Number(seqResult[0].next_val);
      const nrChitanta = generateDocumentNumber("CHT", year, seqNum);

      // Create actual Plata record
      const plata = await prisma.plata.create({
        data: {
          tenantId: onlinePayment.tenantId,
          contribuabilId: onlinePayment.contribuabilId,
          suma: onlinePayment.suma,
          dataPlata: new Date(),
          modalitate: "card",
          nrChitanta,
          gatewayRef: gatewayRef,
          distribuit: false,
        },
      });

      // Update online payment status
      await prisma.onlinePayment.update({
        where: { id: onlinePayment.id },
        data: {
          status: "confirmed",
          confirmedAt: new Date(),
          plataId: plata.id,
          gatewayResponse: { confirmed: true, transactionId: `TXN-${gatewayRef}` },
        },
      });

      // Auto-distribute payment to debts
      if (selectedDebts && selectedDebts.length > 0) {
        for (const debt of selectedDebts) {
          await prisma.plataDistributie.create({
            data: {
              tenantId: onlinePayment.tenantId,
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
          tenantId: onlinePayment.tenantId,
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

      return NextResponse.json({ success: true, plataId: plata.id });
    });
  } catch (error) {
    console.error("Payment confirmation error:", error);
    return NextResponse.json(
      { error: "Failed to confirm payment" },
      { status: 500 }
    );
  }
}
