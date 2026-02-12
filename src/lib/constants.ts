export const LOCALES = ["ro", "en", "hu"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "ro";

export const ROLES = [
  "super_admin",
  "primaria_admin",
  "operator",
  "contabil",
  "cetatean",
] as const;
export type Role = (typeof ROLES)[number];

export const TENANT_STATUSES = [
  "trial",
  "active",
  "suspended",
  "cancelled",
] as const;
export type TenantStatus = (typeof TENANT_STATUSES)[number];

export const COMMUNE_TYPES = ["comuna", "oras", "municipiu"] as const;
export type CommuneType = (typeof COMMUNE_TYPES)[number];

export const COMMUNE_RANKS = [0, 1, 2, 3, 4, 5] as const;
export type CommuneRank = (typeof COMMUNE_RANKS)[number];

export const FISCAL_ZONES = ["A", "B", "C", "D"] as const;
export type FiscalZone = (typeof FISCAL_ZONES)[number];

export const TAX_CATEGORIES = [
  "cladiri",
  "teren",
  "vehicule",
  "alte_taxe",
] as const;

export const CONTRIBUABIL_TYPES = ["PF", "PJ"] as const;
export type ContribuabilType = (typeof CONTRIBUABIL_TYPES)[number];

export const PAYMENT_METHODS = [
  "numerar",
  "virament",
  "mandat_postal",
  "ghiseul_ro",
  "card",
] as const;

export const DOCUMENT_TYPES = [
  "decizie_impunere",
  "adeverinta_fiscala",
  "certificat_atestare",
  "somatie",
  "titlu_executoriu",
  "borderou_incasari",
] as const;
