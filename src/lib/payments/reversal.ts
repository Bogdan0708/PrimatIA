/**
 * Payment reversal (storno) logic.
 *
 * Reverses a recorded payment by:
 * 1. Marking the original Plata as reversed
 * 2. Reversing each PlataDistributie (restoring amounts on Impozit records)
 * 3. Creating a negative storno Plata record for audit trail
 */

import { prisma } from "@/lib/db";
import { Decimal } from "@prisma/client/runtime/library";

export interface ReversalInput {
  plataId: string;
  tenantId: string;
  reversedById: string;
  reason: string;
}

export interface ReversalResult {
  success: boolean;
  error?: string;
  stornoPlataId?: string;
}

export async function reversePayment(input: ReversalInput): Promise<ReversalResult> {
  const { plataId, tenantId, reversedById, reason } = input;

  try {
    // Execute reversal in a transaction with row-level lock to prevent races
    const stornoPlata = await prisma.$transaction(async (tx) => {
      // Lock the row and check status atomically — prevents concurrent reversals
      const locked = await tx.$queryRaw<Array<{ id: string; reversal_status: string | null }>>`
        SELECT id, reversal_status FROM plati
        WHERE id = ${plataId} AND tenant_id = ${tenantId}
        FOR UPDATE
      `;

      if (locked.length === 0) {
        throw new Error("Payment not found");
      }

      if (locked[0].reversal_status === "reversed") {
        throw new Error("Payment already reversed");
      }

      // Fetch distributions inside the transaction (row is locked)
      const plata = await tx.plata.findUniqueOrThrow({
        where: { id: plataId },
        include: { platiDistributie: true },
      });

      // 1. Mark original payment as reversed
      await tx.plata.update({
        where: { id: plataId },
        data: {
          reversalStatus: "reversed",
          reversedAt: new Date(),
          reversedById,
          reversalReason: reason,
        },
      });

      // 2. Reverse each distribution — restore amounts on Impozit records
      for (const dist of plata.platiDistributie) {
        const tax = await tx.impozit.findUnique({ where: { id: dist.impozitId } });
        if (!tax) continue;

        const reversedAmount = new Decimal(dist.sumaDebit).plus(dist.sumaPenalitati);
        const newPaid = new Decimal(tax.sumaPlatita).minus(reversedAmount);
        const totalOwed = new Decimal(tax.sumaDatorata).plus(tax.sumaPenalitati);

        let newStatus = tax.status;
        if (newPaid.lte(0)) {
          newStatus = "calculat";
        } else if (newPaid.lt(totalOwed)) {
          newStatus = "partial_platit";
        }

        await tx.impozit.update({
          where: { id: dist.impozitId },
          data: {
            sumaPlatita: Decimal.max(newPaid, new Decimal(0)),
            status: newStatus,
          },
        });
      }

      // 3. Create storno record (negative payment for audit trail)
      const storno = await tx.plata.create({
        data: {
          tenantId,
          contribuabilId: plata.contribuabilId,
          suma: new Decimal(plata.suma).negated(),
          dataPlata: new Date(),
          modalitate: "storno",
          nota: `Storno: ${reason}`,
          originalPlataId: plataId,
          inregistratDeId: reversedById,
          distribuit: true,
        },
      });

      // 4. Create audit log entry
      await tx.auditLog.create({
        data: {
          tenantId,
          action: "payment_reversed",
          entityType: "plata",
          entityId: plataId,
          userId: reversedById,
          oldValues: { suma: plata.suma.toString(), status: "active" },
          newValues: { suma: plata.suma.toString(), status: "reversed", reason, stornoId: storno.id },
        },
      });

      return storno;
    });

    return { success: true, stornoPlataId: stornoPlata.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Reversal failed";
    if (message === "Payment not found" || message === "Payment already reversed") {
      return { success: false, error: message };
    }
    throw error;
  }
}
