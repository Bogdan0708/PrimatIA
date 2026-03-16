import { Decimal } from "@prisma/client/runtime/library";

// Building destination types
export const BUILDING_DESTINATIONS = ["rezidentiala", "nerezidentiala", "mixta"] as const;
export type BuildingDestination = (typeof BUILDING_DESTINATIONS)[number];

// Building construction types
export const BUILDING_CONSTRUCTION_TYPES = [
  "cadre_beton",
  "pereti_caramida",
  "lemn",
  "alte_materiale",
] as const;
export type BuildingConstructionType = (typeof BUILDING_CONSTRUCTION_TYPES)[number];

// Land categories
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

// Vehicle types
export const VEHICLE_TYPES = [
  "autoturism",
  "autobuz",
  "camion",
  "motocicleta",
  "tractor",
  "remorca",
] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

// Euro pollution norms
export const EURO_NORMS = ["non_euro", "euro_1", "euro_2", "euro_3", "euro_4", "euro_5", "euro_6"] as const;
export type EuroNorm = (typeof EURO_NORMS)[number];

// Contribuabil statuses
export const CONTRIBUABIL_STATUSES = ["activ", "inactiv", "decedat", "radiat"] as const;
export type ContribuabilStatus = (typeof CONTRIBUABIL_STATUSES)[number];

// Property statuses
export const PROPERTY_STATUSES = ["activ", "instrainat", "demolat", "radiat", "casat"] as const;
export type PropertyStatus = (typeof PROPERTY_STATUSES)[number];

// HCL statuses
export const HCL_STATUSES = ["draft", "active", "superseded"] as const;
export type HclStatus = (typeof HCL_STATUSES)[number];

// Tax statuses
export const TAX_STATUSES = ["calculat", "emis", "partial_platit", "platit", "executare"] as const;
export type TaxStatus = (typeof TAX_STATUSES)[number];

// Import statuses
export const IMPORT_STATUSES = ["pending", "uploading", "validating", "importing", "completed", "failed", "rolled_back"] as const;
export type ImportStatus = (typeof IMPORT_STATUSES)[number];

// Exemption types
export const EXEMPTION_TYPES = ["obligatorie", "discretionara"] as const;
export type ExemptionType = (typeof EXEMPTION_TYPES)[number];

// Scutire statuses
export const EXEMPTION_STATUSES = ["pending", "approved", "rejected", "expired"] as const;
export type ExemptionStatus = (typeof EXEMPTION_STATUSES)[number];

// Input types for calculators
export interface BuildingTaxInput {
  buildingId: string;
  contribuabilId: string;
  tenantId: string;
  fiscalYear: number;
  destinatie: BuildingDestination;
  tipConstructie: string;
  anConstructie: number;
  suprafataConstruita: number;
  suprafataDesfasurata?: number;
  valoareImpozabila?: number;
  valoareInventar?: number; // PJ
  zona: string;
  cotaParte: number; // percentage 0-100
  dataDobandire: Date;
  dataInstrainare?: Date;
  // Mixed building
  suprafataRezidentiala?: number;
  suprafataNerezidentiala?: number;
  // Zone multiplier (Art. 457)
  communeRank?: CommuneRank;
  // PJ revaluation (Art. 460)
  tipContribuabil?: "PF" | "PJ";
  dataUltimeiReevaluari?: Date; // date of last revaluation for PJ
}

export interface LandTaxInput {
  landId: string;
  contribuabilId: string;
  tenantId: string;
  fiscalYear: number;
  categorie: string;
  suprafataMp: number;
  zona: string;
  cotaParte: number;
  dataDobandire: Date;
  dataInstrainare?: Date;
}

// Truck axle categories per Art. 470 Cod Fiscal
export const TRUCK_AXLE_CATEGORIES = ["C2", "C3", "C4"] as const;
export type TruckAxleCategory = (typeof TRUCK_AXLE_CATEGORIES)[number];

// Suspension types for trucks/trailers
export const SUSPENSION_TYPES = ["pneumatic", "other"] as const;
export type SuspensionType = (typeof SUSPENSION_TYPES)[number];

// Trailer axle categories
export const TRAILER_AXLE_CATEGORIES = ["R1", "R2", "R3", "R4"] as const;
export type TrailerAxleCategory = (typeof TRAILER_AXLE_CATEGORIES)[number];

// Commune ranks per Art. 457 for zone multipliers
export const COMMUNE_RANKS = [0, 1, 2, 3, 4, 5] as const;
export type CommuneRank = (typeof COMMUNE_RANKS)[number];

export interface VehicleTaxInput {
  vehicleId: string;
  contribuabilId: string;
  tenantId: string;
  fiscalYear: number;
  tipVehicul: string;
  cilindreeCmc?: number;
  putereKw?: number;
  masaTotalaKg?: number;
  nrLocuri?: number;
  nrAxe?: number; // number of axles for trucks/trailers
  tipSuspensie?: SuspensionType; // suspension type for trucks/trailers
  normaPoluare?: string;
  tipCombustibil?: string; // "benzina" | "motorina" | "electric" | "hybrid" | "gpl"
  emisiiCo2GKm?: number; // CO2 emissions in g/km (for hybrid reduction, Art. 470 alin. 3)
  anFabricatie: number;
  dataDobandire: Date;
  dataInstrainare?: Date;
}

export interface TaxRateEntry {
  id: string;
  rateType: string;
  rateValue: number;
  unit?: string;
  minRate?: number;
  maxRate?: number;
  category?: string;
  zona?: string;
}

export interface HclDecisionContext {
  id: string;
  fiscalYear: number;
  inflationIndex?: number;
  bonificatieProcent?: number; // 0-10%, defaults to BONIFICATIE_PERCENT if not set
}

export interface ExemptionContext {
  discountPercent: number;
  ruleId: string;
  ruleName: string;
}

export interface TaxCalculationResult {
  bazaImpozabila: number;
  rataAplicata: number;
  sumaCalculata: number; // Before exemptions
  sumaScutire: number;
  bonificatie: number; // Early payment discount
  sumaDatorata: number; // Final amount
  nrLuni: number; // Months in fiscal year
  rata1: number; // First installment
  rata1Scadenta: Date; // March 31
  rata2: number; // Second installment
  rata2Scadenta: Date; // September 30
  dataStartCalcul?: Date;
  dataStopCalcul?: Date;
  hclDecisionId: string;
  rateTableId: string;
}

// Penalty calculation (Cod Procedura Fiscala Art. 173-174)
export const PENALTY_DAILY_RATE = 0.0001; // 0.01% per day (penalitate de întârziere)
export const INTEREST_DAILY_RATE = 0.0002; // 0.02% per day (dobândă) — total accesorii: 0.03%/day
export const BONIFICATIE_PERCENT = 10; // Max 10% discount for full payment by March 31 (ceiling, HCL sets 0-10%)
export const BONIFICATIE_DEADLINE_MONTH = 3; // March
export const BONIFICATIE_DEADLINE_DAY = 31;

// Installment dates
export const INSTALLMENT_1_MONTH = 3; // March
export const INSTALLMENT_1_DAY = 31;
export const INSTALLMENT_2_MONTH = 9; // September
export const INSTALLMENT_2_DAY = 30;

// Re-export Decimal for downstream consumers
export type { Decimal };
