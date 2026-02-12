/**
 * PatrimVen XML export types for DUKIntegrator compatibility.
 * Forms: F3001 (properties), F3002 (vehicles), F3003 (other taxes), F3101 (fiscal certificates).
 */

export interface PatrimVenAddress {
  Judet: string;
  Localitate: string;
  Strada?: string;
  Numar?: string;
  Bloc?: string;
  Scara?: string;
  Etaj?: string;
  Apartament?: string;
  CodPostal?: string;
}

export interface PatrimVenPerson {
  Tip: "PF" | "PJ";
  CNP?: string;
  CUI?: string;
  Nume: string;
  Prenume?: string;
  Adresa: PatrimVenAddress;
}

// F3001 — Property Declarations
export interface F3001Cladire {
  TipCladire: string; // PatrimVen code
  SuprafataC: number;
  ValoareImpozabila: number;
  AnConstructie: number;
  Destinatie: string;
  Zona: string;
  Adresa: PatrimVenAddress;
}

export interface F3001Teren {
  CategorieTeren: string; // PatrimVen code
  Suprafata: number;
  Zona: string;
  Adresa: PatrimVenAddress;
}

export interface F3001Data {
  Contribuabil: PatrimVenPerson;
  Cladiri: F3001Cladire[];
  Terenuri: F3001Teren[];
}

// F3002 — Vehicle Declarations
export interface F3002Vehicul {
  NrInmatriculare?: string;
  SerieSasiu?: string;
  TipVehicul: string; // PatrimVen code
  Marca?: string;
  Model?: string;
  CapacitateCilindrica?: number;
  AnFabricatie: number;
  PutereKw?: number;
  MasaTotala?: number;
}

export interface F3002Data {
  Contribuabil: PatrimVenPerson;
  Vehicule: F3002Vehicul[];
}

// F3003 — Other Local Taxes
export interface F3003Taxa {
  TipTaxa: string;
  Descriere: string;
  SumaStabilita: number;
  SumaIncasata: number;
}

export interface F3003Data {
  Contribuabil: PatrimVenPerson;
  Taxe: F3003Taxa[];
}

// F3101 — Fiscal Certificates
export interface F3101Impozit {
  TipImpozit: string;
  AnFiscal: number;
  SumaImpozit: number;
  SumaPlatita: number;
  SumaRestanta: number;
}

export interface F3101Data {
  Contribuabil: PatrimVenPerson;
  Impozite: F3101Impozit[];
  TotalRestanta: number;
}

// Export metadata
export interface PatrimVenExportMeta {
  formType: "F3001" | "F3002" | "F3003" | "F3101";
  fiscalYear: number;
  tenantCui: string;
  tenantSiruta: string;
  generatedAt: string;
  recordCount: number;
}
