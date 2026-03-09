import { z } from "zod";
import { prisma } from "@/lib/db";
import { getOutstanding } from "@/lib/tax-engine/liability-utils";

const SelectedDebtItemSchema = z.object({
  impozitId: z.string().uuid(),
  amount: z.number().positive().finite(),
  description: z.string().trim().max(255).optional(),
});

const SelectedDebtItemsSchema = z
  .array(SelectedDebtItemSchema)
  .min(1, "At least one debt must be selected")
  .max(100, "Too many debts selected");

const PAYABLE_TAX_STATUSES = ["calculat", "emis", "partial_platit", "executare"] as const;

export interface ValidatedPaymentItem {
  impozitId: string;
  amount: number;
  description: string;
}

export class SelectedDebtValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SelectedDebtValidationError";
  }
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function getTaxLabel(taxType: { code: string; name: unknown }, fiscalYear: number): string {
  const localizedName =
    typeof taxType.name === "object" && taxType.name !== null
      ? (taxType.name as Record<string, string>).ro
      : null;
  return `${localizedName || taxType.code} ${fiscalYear}`;
}

function parseSelectedDebts(items: unknown) {
  const parsed = SelectedDebtItemsSchema.safeParse(items);
  if (!parsed.success) {
    throw new SelectedDebtValidationError("Selected debts payload is invalid");
  }

  const uniqueIds = new Set(parsed.data.map((item) => item.impozitId));
  if (uniqueIds.size !== parsed.data.length) {
    throw new SelectedDebtValidationError("Duplicate debts are not allowed");
  }

  return parsed.data.map((item) => ({
    impozitId: item.impozitId,
    amount: roundCurrency(item.amount),
  }));
}

export async function validateSelectedDebtsForContribuabil(params: {
  tenantId: string;
  contribuabilId: string;
  items: unknown;
}): Promise<{ items: ValidatedPaymentItem[]; totalAmount: number }> {
  const requestedItems = parseSelectedDebts(params.items);
  const debtIds = requestedItems.map((item) => item.impozitId);

  const debts = await prisma.impozit.findMany({
    where: {
      tenantId: params.tenantId,
      contribuabilId: params.contribuabilId,
      id: { in: debtIds },
      status: { in: [...PAYABLE_TAX_STATUSES] },
    },
    include: {
      taxType: {
        select: { code: true, name: true },
      },
    },
  });

  if (debts.length !== debtIds.length) {
    throw new SelectedDebtValidationError("One or more selected debts are invalid");
  }

  const debtMap = new Map(debts.map((debt) => [debt.id, debt]));

  const validatedItems = requestedItems.map((item) => {
    const debt = debtMap.get(item.impozitId);
    if (!debt) {
      throw new SelectedDebtValidationError("One or more selected debts are invalid");
    }

    const outstanding = roundCurrency(getOutstanding(debt));
    if (outstanding <= 0) {
      throw new SelectedDebtValidationError("Selected debt is already settled");
    }

    if (item.amount > outstanding + 0.01) {
      throw new SelectedDebtValidationError("Selected amount exceeds outstanding balance");
    }

    return {
      impozitId: item.impozitId,
      amount: item.amount,
      description: getTaxLabel(debt.taxType, debt.fiscalYear),
    };
  });

  return {
    items: validatedItems,
    totalAmount: roundCurrency(
      validatedItems.reduce((sum, item) => sum + item.amount, 0)
    ),
  };
}
