import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma, withTenantScope } from "@/lib/db";
import { generateDocumentNumber } from "@/lib/formatting";
import { Prisma } from "@prisma/client";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || !["admin", "operator"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { onlinePaymentId, confirmedAmount, bankReference } = body;

    if (!onlinePaymentId || !confirmedAmount || !bankReference) {
      return NextResponse.json(
        { error: "onlinePaymentId, confirmedAmount, and bankReference are required" },
        { status: 400 }
      );
    }

    const onlinePayment = await prisma.onlinePayment.findUnique({
      where: { id: onlinePaymentId },
    });

    if (!onlinePayment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    if (onlinePayment.tenantId !== session.user.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (onlinePayment.status !== "initiated" && onlinePayment.status !== "pending") {
      return NextResponse.json(
        { error: `Payment is in '${onlinePayment.status}' status, expected 'initiated' or 'pending'` },
        { status: 400 }
      );
    }

    // Validate amount matches (with small tolerance)
    if (Math.abs(Number(onlinePayment.suma) - confirmedAmount) > 0.01) {
      return NextResponse.json(
        { error: `Amount mismatch: expected ${onlinePayment.suma}, got ${confirmedAmount}` },
        { status: 400 }
      );
    }

    const tenantId = onlinePayment.tenantId;
    const selectedDebts = onlinePayment.selectedDebts as Array<{ impozitId: string; amount: number }> | null;

    // Use withTenantScope to ensure SET LOCAL + all queries share one transaction.
    // This replaces the old setTenantContext() + $transaction() pattern.
    await withTenantScope(tenantId, async () => {
      const tx = prisma; // prisma proxy routes to the withTenantScope transaction
      // Lock the OnlinePayment row to prevent double-confirm (idempotency)
      const [lockedPayment] = await tx.$queryRaw<Array<{ status: string }>>(
        Prisma.sql`SELECT status FROM "OnlinePayment" WHERE id = ${onlinePayment.id} FOR UPDATE`
      );
      if (lockedPayment.status !== "initiated" && lockedPayment.status !== "pending") {
        throw new Error(`Payment already processed (status: ${lockedPayment.status})`);
      }

      // Lock and validate debts inside transaction to prevent concurrent modifications
      if (selectedDebts && selectedDebts.length > 0) {
        const ids = selectedDebts.map((d) => d.impozitId);
        await tx.$queryRaw`SELECT id FROM "Impozit" WHERE id::text = ANY(${ids}) FOR UPDATE`;

        for (const debt of selectedDebts) {
          const impozit = await tx.impozit.findUnique({ where: { id: debt.impozitId } });
          if (!impozit) throw new Error(`Impozit ${debt.impozitId} not found`);
          const remaining = Number(impozit.sumaDatorata) - Number(impozit.sumaPlatita);
          if (debt.amount > remaining + 0.01) {
            throw new Error(`Overpayment on impozit ${debt.impozitId}: paying ${debt.amount}, remaining ${remaining}`);
          }
        }
      }

      // Generate chitanță number atomically
      const year = new Date().getFullYear();
      const seqResult = await tx.$queryRaw<Array<{ next_val: bigint }>>(
        Prisma.sql`INSERT INTO "ChitantaSequence" ("tenantId", "year", "currentVal")
                   VALUES (${tenantId}, ${year}, 1)
                   ON CONFLICT ("tenantId", "year")
                   DO UPDATE SET "currentVal" = "ChitantaSequence"."currentVal" + 1
                   RETURNING "currentVal" AS next_val`
      );
      const seqNum = Number(seqResult[0].next_val);
      const nrChitanta = generateDocumentNumber("CHT", year, seqNum);

      // Create Plata record
      const plata = await tx.plata.create({
        data: {
          tenantId,
          contribuabilId: onlinePayment.contribuabilId,
          suma: onlinePayment.suma,
          dataPlata: new Date(),
          modalitate: "virament",
          nrChitanta,
          gatewayRef: bankReference,
          distribuit: false,
        },
      });

      // Update OnlinePayment status
      await tx.onlinePayment.update({
        where: { id: onlinePayment.id },
        data: {
          status: "confirmed",
          confirmedAt: new Date(),
          plataId: plata.id,
          gatewayResponse: {
            confirmed: true,
            bankReference,
            confirmedBy: session.user.id,
          },
        },
      });

      // Distribute payment to debts
      if (selectedDebts && selectedDebts.length > 0) {
        for (const debt of selectedDebts) {
          await tx.plataDistributie.create({
            data: {
              tenantId,
              plataId: plata.id,
              impozitId: debt.impozitId,
              sumaDebit: debt.amount,
              sumaPenalitati: 0,
            },
          });

          const impozit = await tx.impozit.findUnique({
            where: { id: debt.impozitId },
          });

          if (impozit) {
            const newPaid = Number(impozit.sumaPlatita) + debt.amount;
            const totalOwed = Number(impozit.sumaDatorata);
            const newStatus = newPaid >= totalOwed ? "platit" : "partial_platit";

            await tx.impozit.update({
              where: { id: debt.impozitId },
              data: {
                sumaPlatita: newPaid,
                status: newStatus,
              },
            });
          }
        }

        await tx.plata.update({
          where: { id: plata.id },
          data: { distribuit: true },
        });
      }

      // Generate chitanță document
      await tx.document.create({
        data: {
          tenantId,
          contribuabilId: onlinePayment.contribuabilId,
          tip: "chitanta",
          numarDocument: nrChitanta,
          dataDocument: new Date(),
          dataJson: {
            plataId: plata.id,
            suma: Number(onlinePayment.suma),
            modalitate: "virament",
            bankReference,
            items: selectedDebts,
          },
          status: "generat",
        },
      });
    });  // end withTenantScope

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Bank transfer confirmation error:", error);
    return NextResponse.json({ error: "Confirmation failed" }, { status: 500 });
  }
}
