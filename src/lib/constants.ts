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

// Phase 2 additions

export const BUILDING_DESTINATIONS = ["rezidentiala", "nerezidentiala", "mixta"] as const;
export type BuildingDestination = (typeof BUILDING_DESTINATIONS)[number];

export const BUILDING_CONSTRUCTION_TYPES = [
  "cadre_beton",
  "pereti_caramida",
  "lemn",
  "alte_materiale",
] as const;
export type BuildingConstructionType = (typeof BUILDING_CONSTRUCTION_TYPES)[number];

export const LAND_CATEGORIES = [
  "intravilan_curti",
  "intravilan_arabil",
  "intravilan_pasuni",
  "intravilan_paduri",
  "intravilan_ape",
  "intravilan_drumuri",
  "intravilan_neproductiv",
  "extravilan_arabil",
  "extravilan_pasuni",
  "extravilan_paduri",
  "extravilan_ape",
  "extravilan_drumuri",
  "extravilan_neproductiv",
] as const;
export type LandCategory = (typeof LAND_CATEGORIES)[number];

export const VEHICLE_TYPES = [
  "autoturism",
  "autobuz",
  "camion",
  "motocicleta",
  "tractor",
  "remorca",
] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

export const EURO_NORMS = ["non_euro", "euro_1", "euro_2", "euro_3", "euro_4", "euro_5", "euro_6"] as const;
export type EuroNorm = (typeof EURO_NORMS)[number];

export const FUEL_TYPES = ["benzina", "motorina", "electric", "hybrid", "gpl"] as const;
export type FuelType = (typeof FUEL_TYPES)[number];

export const CONTRIBUABIL_STATUSES = ["activ", "inactiv", "decedat", "radiat"] as const;
export type ContribuabilStatus = (typeof CONTRIBUABIL_STATUSES)[number];

export const PROPERTY_STATUSES = ["activ", "instrainat", "demolat", "radiat", "casat"] as const;
export type PropertyStatus = (typeof PROPERTY_STATUSES)[number];

export const HCL_STATUSES = ["draft", "active", "superseded"] as const;
export type HclStatus = (typeof HCL_STATUSES)[number];

export const TAX_STATUSES = ["calculat", "emis", "partial_platit", "platit", "executare"] as const;
export type TaxStatus = (typeof TAX_STATUSES)[number];

export const IMPORT_STATUSES = ["pending", "uploading", "validating", "importing", "completed", "failed", "rolled_back"] as const;
export type ImportStatus = (typeof IMPORT_STATUSES)[number];

export const EXEMPTION_TYPES = ["obligatorie", "discretionara"] as const;
export type ExemptionType = (typeof EXEMPTION_TYPES)[number];

export const EXEMPTION_STATUSES = ["pending", "approved", "rejected", "expired"] as const;
export type ExemptionStatus = (typeof EXEMPTION_STATUSES)[number];

export const OWNERSHIP_ACT_TYPES = [
  "contract_vanzare",
  "mostenire",
  "donatie",
  "hotarare_judecatoreasca",
  "act_administrativ",
  "altele",
] as const;
export type OwnershipActType = (typeof OWNERSHIP_ACT_TYPES)[number];

export const RATE_TYPES = ["percent", "fixed", "per_unit"] as const;
export type RateType = (typeof RATE_TYPES)[number];
