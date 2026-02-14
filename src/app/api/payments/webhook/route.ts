import { NextRequest, NextResponse } from "next/server";
import { getStripeClient } from "@/lib/stripe";
import { prisma, setTenantContext } from "@/lib/db";
import { generateDocumentNumber } from "@/lib/formatting";

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

      await setTenantContext(metadata.tenantId);

      // Generate chitanță number
      const year = new Date().getFullYear();
      const paymentCount = await prisma.plata.count({
        where: { tenantId: metadata.tenantId },
      });
      const nrChitanta = generateDocumentNumber("CHT", year, paymentCount + 1);

      // Create the actual Plata record
      const plata = await prisma.plata.create({
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
      await prisma.onlinePayment.update({
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
      const selectedDebts = onlinePayment.selectedDebts as Array<{ impozitId: string; amount: number }>;
      if (selectedDebts && selectedDebts.length > 0) {
        for (const debt of selectedDebts) {
          await prisma.plataDistributie.create({
            data: {
              tenantId: metadata.tenantId,
              plataId: plata.id,
              impozitId: debt.impozitId,
              sumaDebit: debt.amount,
              sumaPenalitati: 0,
            },
          });

          // Update the impozit's paid amount
          const impozit = await prisma.impozit.findUnique({
            where: { id: debt.impozitId },
          });

          if (impozit) {
            const newPaid = Number(impozit.sumaPlatita) + debt.amount;
            const totalOwed = Number(impozit.sumaDatorata);
            const newStatus = newPaid >= totalOwed ? "platit" : "partial_platit";

            await prisma.impozit.update({
              where: { id: debt.impozitId },
              data: {
                sumaPlatita: newPaid,
                status: newStatus,
              },
            });
          }
        }

        // Mark the payment as distributed
        await prisma.plata.update({
          where: { id: plata.id },
          data: { distribuit: true },
        });
      }

      // Generate chitanță document
      await prisma.document.create({
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
    } catch (error) {
      console.error("Error processing Stripe webhook:", error);
      return NextResponse.json({ error: "Processing failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
