import { z } from "zod";

// ============================================================================
// Helpers
// ============================================================================

/**
 * Validate Romanian CNP (Cod Numeric Personal).
 * 13 digits with control digit validation.
 */
export function validateCnp(cnp: string): boolean {
  if (!/^\d{13}$/.test(cnp)) return false;
  const control = [2, 7, 9, 1, 4, 6, 3, 5, 8, 2, 7, 9];
  const digits = cnp.split("").map(Number);
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += digits[i] * control[i];
  }
  let remainder = sum % 11;
  if (remainder === 10) remainder = 1;
  return remainder === digits[12];
}

/**
 * Validate Romanian CUI (Cod Unic de Identificare).
 * 2-10 digits with optional "RO" prefix.
 */
export function validateCui(cui: string): boolean {
  const cleaned = cui.replace(/^RO/i, "").trim();
  if (!/^\d{2,10}$/.test(cleaned)) return false;
  const control = [7, 5, 3, 2, 1, 7, 5, 3, 2];
  const digits = cleaned.split("").map(Number);
  // Pad to 9 digits from left
  while (digits.length < 9) digits.unshift(0);
  // Control digit is last digit of cleaned
  const checkDigit = parseInt(cleaned[cleaned.length - 1]);
  const numWithoutCheck = cleaned.slice(0, -1);
  const nums = numWithoutCheck.split("").map(Number);
  while (nums.length < 9) nums.unshift(0);
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += nums[i] * control[i];
  }
  let result = (sum * 10) % 11;
  if (result === 10) result = 0;
  return result === checkDigit;
}

// ============================================================================
// Authentication Schemas
// ============================================================================

export const strongPasswordSchema = z
  .string()
  .min(8, "Parola trebuie să aibă cel puțin 8 caractere")
  .regex(/[a-z]/, "Parola trebuie să conțină cel puțin o literă mică")
  .regex(/[A-Z]/, "Parola trebuie să conțină cel puțin o literă mare")
  .regex(/[0-9]/, "Parola trebuie să conțină cel puțin o cifră");

// ============================================================================
// Address Schema
// ============================================================================

export const adresaSchema = z.object({
  strada: z.string().max(255).optional().nullable(),
  numar: z.string().max(20).optional().nullable(),
  bloc: z.string().max(20).optional().nullable(),
  scara: z.string().max(10).optional().nullable(),
  etaj: z.string().max(10).optional().nullable(),
  apartament: z.string().max(10).optional().nullable(),
  localitate: z.string().min(1, "Localitatea este obligatorie").max(100),
  judet: z.string().min(1, "Județul este obligatoriu").max(50),
  codPostal: z.string().max(10).optional().nullable(),
  zonaFiscala: z.enum(["A", "B", "C", "D"]).optional().nullable(),
});

export type AdresaInput = z.infer<typeof adresaSchema>;

// ============================================================================
// Contribuabil Schemas
// ============================================================================

export const contribuabilBaseSchema = z.object({
  tip: z.enum(["PF", "PJ"]),
  nume: z.string().min(1, "Numele este obligatoriu").max(255),
  prenume: z.string().max(255).optional().nullable(),
  telefon: z.string().max(50).optional().nullable(),
  email: z.string().email("Email invalid").max(255).optional().nullable().or(z.literal("")),
  codRol: z.string().max(50).optional().nullable(),
  nrDosarFiscal: z.string().max(50).optional().nullable(),
  limbaPreferata: z.enum(["ro", "en", "hu"]).optional().default("ro"),
  status: z.enum(["activ", "inactiv", "decedat", "radiat"]).optional().default("activ"),
  note: z.string().optional().nullable(),
});

export const contribuabilPfSchema = contribuabilBaseSchema.extend({
  tip: z.literal("PF"),
  cnp: z.string().refine((val) => !val || validateCnp(val), { message: "CNP invalid" }).optional().nullable(),
  prenume: z.string().min(1, "Prenumele este obligatoriu").max(255),
});

export const contribuabilPjSchema = contribuabilBaseSchema.extend({
  tip: z.literal("PJ"),
  cui: z.string().refine((val) => !val || validateCui(val), { message: "CUI invalid" }).optional().nullable(),
  reprezentantLegal: z.string().max(255).optional().nullable(),
  nrRegistruComert: z.string().max(50).optional().nullable(),
});

export const contribuabilSchema = z.discriminatedUnion("tip", [
  contribuabilPfSchema,
  contribuabilPjSchema,
]);

export type ContribuabilInput = z.infer<typeof contribuabilSchema>;

// ============================================================================
// Property Schemas
// ============================================================================

export const cladireSchema = z.object({
  contribuabilId: z.string().uuid(),
  adresaId: z.string().uuid().optional(),
  zona: z.enum(["A", "B", "C", "D"]).default("A"),
  numarCadastral: z.string().max(50).optional().nullable(),
  numarCarteFunciara: z.string().max(50).optional().nullable(),
  destinatie: z.enum(["rezidentiala", "nerezidentiala", "mixta"]),
  tipConstructie: z.enum(["cadre_beton", "pereti_caramida", "lemn", "alte_materiale"]),
  anConstructie: z.number().int().min(1800).max(new Date().getFullYear()),
  suprafataConstruita: z.number().positive("Suprafața trebuie să fie pozitivă"),
  suprafataUtila: z.number().positive().optional().nullable(),
  suprafataDesfasurata: z.number().positive().optional().nullable(),
  nrEtaje: z.number().int().min(1).default(1),
  valoareImpozabila: z.number().min(0).optional().nullable(),
  valoareInventar: z.number().min(0).optional().nullable(),
  suprafataRezidentiala: z.number().min(0).optional().nullable(),
  suprafataNerezidentiala: z.number().min(0).optional().nullable(),
  cotaParte: z.number().min(0).max(100).default(100),
  nrProprietari: z.number().int().min(1).default(1),
  tipActProprietate: z.string().max(50).optional().nullable(),
  nrActProprietate: z.string().max(50).optional().nullable(),
  dataActProprietate: z.coerce.date().optional().nullable(),
  dataDobandire: z.coerce.date(),
  dataInstrainare: z.coerce.date().optional().nullable(),
  // Inline address for creation
  adresa: adresaSchema.optional(),
});

export type CladireInput = z.infer<typeof cladireSchema>;

export const terenSchema = z.object({
  contribuabilId: z.string().uuid(),
  adresaId: z.string().uuid().optional().nullable(),
  zona: z.enum(["A", "B", "C", "D"]).default("A"),
  numarCadastral: z.string().max(50).optional().nullable(),
  numarCarteFunciara: z.string().max(50).optional().nullable(),
  categorie: z.string().min(1, "Categoria este obligatorie"),
  suprafataMp: z.number().positive("Suprafața trebuie să fie pozitivă"),
  suprafataHa: z.number().positive().optional().nullable(),
  cotaParte: z.number().min(0).max(100).default(100),
  tipActProprietate: z.string().max(50).optional().nullable(),
  nrActProprietate: z.string().max(50).optional().nullable(),
  dataActProprietate: z.coerce.date().optional().nullable(),
  dataDobandire: z.coerce.date(),
  dataInstrainare: z.coerce.date().optional().nullable(),
  adresa: adresaSchema.optional(),
});

export type TerenInput = z.infer<typeof terenSchema>;

export const vehiculSchema = z.object({
  contribuabilId: z.string().uuid(),
  numarInmatriculare: z.string().max(20).optional().nullable(),
  serieSasiu: z.string().max(50).optional().nullable(),
  nrCarteIdentitate: z.string().max(50).optional().nullable(),
  tipVehicul: z.enum(["autoturism", "autobuz", "camion", "motocicleta", "tractor", "remorca"]),
  marca: z.string().max(100).optional().nullable(),
  model: z.string().max(100).optional().nullable(),
  anFabricatie: z.number().int().min(1900).max(new Date().getFullYear() + 1),
  cilindreeCmc: z.number().int().positive().optional().nullable(),
  putereKw: z.number().positive().optional().nullable(),
  masaTotalaKg: z.number().int().positive().optional().nullable(),
  nrLocuri: z.number().int().positive().optional().nullable(),
  normaPoluare: z.enum(["non_euro", "euro_1", "euro_2", "euro_3", "euro_4", "euro_5", "euro_6"]).optional().nullable(),
  tipCombustibil: z.enum(["benzina", "motorina", "electric", "hybrid", "gpl"]).optional().nullable(),
  dataDobandire: z.coerce.date(),
  dataInstrainare: z.coerce.date().optional().nullable(),
});

export type VehiculInput = z.infer<typeof vehiculSchema>;

// ============================================================================
// HCL & Rate Table Schemas
// ============================================================================

export const hclDecisionSchema = z.object({
  hclNumber: z.string().min(1, "Numărul HCL este obligatoriu").max(20),
  hclDate: z.coerce.date(),
  fiscalYear: z.number().int().min(2020).max(2100),
  title: z.string().optional().nullable(),
  inflationIndex: z.number().min(0).max(10).optional().nullable(),
  validFrom: z.coerce.date(),
  validTo: z.coerce.date().optional().nullable(),
  approvedBy: z.string().max(255).optional().nullable(),
});

export type HclDecisionInput = z.infer<typeof hclDecisionSchema>;

export const taxRateTableSchema = z.object({
  hclDecisionId: z.string().uuid(),
  taxType: z.string().min(1, "Tipul de impozit este obligatoriu").max(50),
  category: z.string().max(50).optional().nullable(),
  zona: z.enum(["A", "B", "C", "D"]).optional().nullable(),
  rang: z.number().int().min(0).max(5).optional().nullable(),
  rateType: z.enum(["percent", "fixed", "per_unit"]).default("percent"),
  rateValue: z.number().min(0, "Rata trebuie să fie pozitivă"),
  unit: z.string().max(20).optional().nullable(),
  minRate: z.number().min(0).optional().nullable(),
  maxRate: z.number().min(0).optional().nullable(),
  descriptionRo: z.string().optional().nullable(),
  legalArticle: z.string().max(50).optional().nullable(),
}).refine(
  (data) => {
    if (data.minRate != null && data.rateValue < data.minRate) return false;
    if (data.maxRate != null && data.rateValue > data.maxRate) return false;
    return true;
  },
  { message: "Rata este în afara limitelor legale", path: ["rateValue"] }
);

export type TaxRateTableInput = z.infer<typeof taxRateTableSchema>;

// ============================================================================
// Exemption Schemas
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- JSON conditions field requires flexible schema
export const scutireRegulaSchema = z.object({
  nameRo: z.string().min(1, "Denumirea este obligatorie").max(255),
  nameEn: z.string().max(255).optional().nullable(),
  legalBasis: z.string().min(1, "Temeiul legal este obligatoriu").max(100),
  taxTypes: z.array(z.string()).min(1, "Selectați cel puțin un tip de impozit"),
  discountPercent: z.number().min(0).max(100),
  conditions: z.any().default({}),
  requiredDocuments: z.array(z.string()).default([]),
  autoRenewable: z.boolean().default(false),
  isActive: z.boolean().default(true),
  validFrom: z.coerce.date().optional().nullable(),
  validTo: z.coerce.date().optional().nullable(),
});

export type ScutireRegulaInput = z.infer<typeof scutireRegulaSchema>;

export const scutireContribuabilSchema = z.object({
  contribuabilId: z.string().uuid(),
  scutireRegulaId: z.string().uuid(),
  proprietateType: z.string().max(20).optional().nullable(),
  proprietateId: z.string().uuid().optional().nullable(),
  fiscalYear: z.number().int().min(2020).max(2100),
  validFrom: z.coerce.date(),
  validTo: z.coerce.date().optional().nullable(),
  documenteVerificate: z.array(z.record(z.string(), z.unknown())).default([]),
  note: z.string().optional().nullable(),
});

export type ScutireContribuabilInput = z.infer<typeof scutireContribuabilSchema>;

// ============================================================================
// Payment Schemas
// ============================================================================

export const plataSchema = z.object({
  contribuabilId: z.string().uuid(),
  suma: z.number().positive("Suma trebuie să fie pozitivă"),
  dataPlata: z.coerce.date(),
  modalitate: z.enum(["numerar", "virament", "mandat_postal", "ghiseul_ro", "card"]),
  nrChitanta: z.string().max(50).optional().nullable(),
  nrDocument: z.string().max(50).optional().nullable(),
  nota: z.string().optional().nullable(),
});

export type PlataInput = z.infer<typeof plataSchema>;

// ============================================================================
// Import Schema
// ============================================================================

export const importBatchSchema = z.object({
  entityType: z.enum(["contribuabil", "cladire", "teren", "vehicul", "sold"]),
});

export type ImportBatchInput = z.infer<typeof importBatchSchema>;

// ============================================================================
// Search & Filter Schemas
// ============================================================================

export const searchParamsSchema = z.object({
  query: z.string().optional().default(""),
  page: z.coerce.number().int().min(1).optional().default(1),
  perPage: z.coerce.number().int().min(1).max(100).optional().default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).optional().default("asc"),
  tip: z.enum(["PF", "PJ"]).optional(),
  status: z.string().optional(),
  fiscalYear: z.coerce.number().int().optional(),
});

export type SearchParams = z.infer<typeof searchParamsSchema>;
