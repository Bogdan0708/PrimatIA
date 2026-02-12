/**
 * Data types for document generation.
 * All data passed to PDF templates is pre-formatted.
 */

export interface TenantInfo {
  name: string;
  cui: string;
  address: string;
  county: string;
  phone?: string;
  email?: string;
  website?: string;
  logoUrl?: string;
}

export interface ContribuabilInfo {
  id: string;
  tip: "PF" | "PJ";
  nume: string;
  prenume?: string | null;
  cnpMasked?: string; // last 4 visible: *********1234
  cui?: string | null;
  codRol?: string | null;
  nrDosarFiscal?: string | null;
  adresa: string;
}

export interface ImpozitLine {
  taxTypeName: string;
  propertyDescription: string;
  bazaImpozabila: string; // pre-formatted
  rataAplicata: string;
  sumaCalculata: string;
  sumaScutire: string;
  sumaDatorata: string;
}

export interface InstallmentInfo {
  rata1: string;
  rata1Scadenta: string;
  rata2: string;
  rata2Scadenta: string;
  bonificatie: string;
}

// Decizie de impunere
export interface DecizieImpunereData {
  tenant: TenantInfo;
  contribuabil: ContribuabilInfo;
  fiscalYear: number;
  documentNumber: string;
  documentDate: string;
  hclNumber: string;
  hclDate: string;
  lines: ImpozitLine[];
  totalDatorat: string;
  installments: InstallmentInfo;
  legalBasis: string;
}

// Somație
export interface SomatieData {
  tenant: TenantInfo;
  contribuabil: ContribuabilInfo;
  documentNumber: string;
  documentDate: string;
  debts: Array<{
    description: string;
    fiscalYear: number;
    sumaDebit: string;
    sumaPenalitati: string;
    sumaTotala: string;
  }>;
  totalDebit: string;
  totalPenalitati: string;
  totalSuma: string;
  termenPlata: string; // 15 days deadline
  legalBasis: string;
}

// Certificat de atestare fiscală
export interface CertificatAtestareData {
  tenant: TenantInfo;
  contribuabil: ContribuabilInfo;
  documentNumber: string;
  documentDate: string;
  purpose: string; // scopul eliberării
  taxes: Array<{
    taxType: string;
    fiscalYear: number;
    sumaDatorata: string;
    sumaPlatita: string;
    sumaRestanta: string;
  }>;
  totalRestanta: string;
  hasDebts: boolean;
  validUntil: string;
}

// Chitanță
export interface ChitantaData {
  tenant: TenantInfo;
  contribuabil: ContribuabilInfo;
  documentNumber: string;
  documentDate: string;
  suma: string;
  sumaInLitere: string; // amount in words
  modalitate: string;
  distributions: Array<{
    description: string;
    fiscalYear: number;
    sumaDebit: string;
    sumaPenalitati: string;
  }>;
  casierName: string;
}

// Borderou de încasări
export interface BordeRouIncasariData {
  tenant: TenantInfo;
  documentDate: string;
  documentNumber: string;
  casierName: string;
  payments: Array<{
    nrCrt: number;
    nrChitanta: string;
    contribuabilName: string;
    modalitate: string;
    suma: string;
  }>;
  totalNumerar: string;
  totalVirament: string;
  totalGeneral: string;
}
