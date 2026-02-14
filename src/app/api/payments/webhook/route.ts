import { NextRequest, NextResponse } from "next/server";
import { getStripeClient } from "@/lib/stripe";
import { prisma, setTenantContext } from "@/lib/db";
import { generateDocumentNumber } from "@/lib/formatting";
import { Prisma } from "@prisma/client";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET not configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  let event;
  try {
    event = getStripeClient().webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    if (session.payment_status !== "paid") {
      return NextResponse.json({ received: true });
    }

    const gatewayRef = session.id;
    const metadata = session.metadata;

    if (!metadata?.tenantId || !metadata?.contribuabilId) {
      console.error("Missing metadata in Stripe session:", gatewayRef);
      return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
    }

    try {
      // Find the OnlinePayment record
      const onlinePayment = await prisma.onlinePayment.findFirst({
        where: { gatewayRef },
      });

      if (!onlinePayment) {
        console.error("OnlinePayment not found for ref:", gatewayRef);
        return NextResponse.json({ error: "Payment not found" }, { status: 404 });
      }

      // Skip if already processed
      if (onlinePayment.status === "confirmed") {
        return NextResponse.json({ received: true });
      }

      // Fix #3: Server-side amount validation — verify payment matches actual debts
      const selectedDebts = onlinePayment.selectedDebts as Array<{ impozitId: string; amount: number }>;
      if (selectedDebts && selectedDebts.length > 0) {
        const expectedTotal = selectedDebts.reduce((sum, d) => sum + d.amount, 0);
        const paidAmount = Number(onlinePayment.suma);
        if (Math.abs(paidAmount - expectedTotal) > 0.01) {
          console.error(
            `Amount mismatch for ref ${gatewayRef}: paid=${paidAmount}, expected=${expectedTotal}`
          );
          return NextResponse.json({ error: "Amount mismatch" }, { status: 400 });
        }

        // Validate each debt exists and the amount doesn't exceed what's owed
        for (const debt of selectedDebts) {
          const impozit = await prisma.impozit.findUnique({
            where: { id: debt.impozitId },
          });
          if (!impozit) {
            console.error(`Impozit ${debt.impozitId} not found for ref ${gatewayRef}`);
            return NextResponse.json({ error: "Invalid debt reference" }, { status: 400 });
          }
          const remaining = Number(impozit.sumaDatorata) - Number(impozit.sumaPlatita);
          if (debt.amount > remaining + 0.01) {
            console.error(
              `Overpayment on impozit ${debt.impozitId}: paying ${debt.amount}, remaining ${remaining}`
            );
            return NextResponse.json({ error: "Overpayment detected" }, { status: 400 });
          }
        }
      }

      await setTenantContext(metadata.tenantId);

      // Fix #2: Wrap all DB writes in a transaction
      // Fix #1: Atomic chitanță number via SELECT FOR UPDATE
      await prisma.$transaction(async (tx) => {
        // Generate chitanță number atomically using row lock
        const year = new Date().getFullYear();
        const seqResult = await tx.$queryRaw<Array<{ next_val: bigint }>>(
          Prisma.sql`INSERT INTO "ChitantaSequence" ("tenantId", "year", "currentVal")
                     VALUES (${metadata.tenantId}, ${year}, 1)
                     ON CONFLICT ("tenantId", "year")
                     DO UPDATE SET "currentVal" = "ChitantaSequence"."currentVal" + 1
                     RETURNING "currentVal" AS next_val`
        );
        const seqNum = Number(seqResult[0].next_val);
        const nrChitanta = generateDocumentNumber("CHT", year, seqNum);

        // Create the actual Plata record
        const plata = await tx.plata.create({
          data: {
            tenantId: metadata.tenantId,
            contribuabilId: metadata.contribuabilId,
            suma: onlinePayment.suma,
            dataPlata: new Date(),
            modalitate: "card",
            nrChitanta,
            ghiseulRoRef: gatewayRef,
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
              transactionId: session.payment_intent as string,
              stripeSessionId: session.id,
            },
          },
        });

        // Auto-distribute payment to debts
        if (selectedDebts && selectedDebts.length > 0) {
          for (const debt of selectedDebts) {
            await tx.plataDistributie.create({
              data: {
                tenantId: metadata.tenantId,
                plataId: plata.id,
                impozitId: debt.impozitId,
                sumaDebit: debt.amount,
                sumaPenalitati: 0,
              },
            });

            // Update the impozit's paid amount
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

          // Mark the payment as distributed
          await tx.plata.update({
            where: { id: plata.id },
            data: { distribuit: true },
          });
        }

        // Generate chitanță document
        await tx.document.create({
          data: {
            tenantId: metadata.tenantId,
            contribuabilId: metadata.contribuabilId,
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
      });
    } catch (error) {
      console.error("Error processing Stripe webhook:", error);
      return NextResponse.json({ error: "Processing failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
