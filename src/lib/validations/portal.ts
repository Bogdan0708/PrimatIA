import { z } from "zod";

// Portal auth
export const portalLoginSchema = z.object({
  email: z.string().email("Adresa de email este invalidă").max(255),
  password: z.string().min(1, "Parola este obligatorie").max(255),
});

// Shared debt item schema (matches PaymentItem + SelectedDebtItemSchema)
const debtItemSchema = z.object({
  impozitId: z.string().uuid("impozitId invalid"),
  amount: z.number().positive("Suma trebuie să fie pozitivă"),
  description: z.string().max(255).default(""),
});

// Payment initiation (portal online payments)
export const paymentInitiateSchema = z.object({
  contribuabilId: z.string().uuid("contribuabilId invalid"),
  items: z.array(debtItemSchema).min(1, "Cel puțin un element este necesar"),
});

// Bank transfer initiation
export const bankTransferSchema = z.object({
  contribuabilId: z.string().uuid("contribuabilId invalid"),
  items: z.array(debtItemSchema).min(1, "Cel puțin un element este necesar"),
});

// Payment reversal (staff)
export const paymentReversalSchema = z.object({
  plataId: z.string().uuid("plataId invalid"),
  reason: z.string().min(1, "Motivul este obligatoriu").max(500),
});
