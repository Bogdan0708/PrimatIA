import type {
  F3001Data,
  F3002Data,
  F3003Data,
  F3101Data,
  PatrimVenAddress,
  PatrimVenExportMeta,
  PatrimVenPerson,
} from "@/lib/patrimven/types";

/**
 * Synthetic fixtures for PatrimVen golden-file tests.
 *
 * - `RO12345674` passes the offline CUI checksum in
 *   `src/lib/anaf/cui-validator.ts` (body `1234567` -> check digit `4`,
 *   verified against the module's own algorithm). `RO12345678` (sometimes
 *   used as a placeholder elsewhere) does NOT pass and must never be used
 *   as a "valid" sample.
 * - CNP fields are opaque synthetic hash-like strings, not real CNPs. The
 *   builder never validates CNP format/checksum, only CUI.
 * - Commune SIRUTA `106464`, fiscal year `2026`.
 * - `generatedAt` is a fixed ISO timestamp so golden fixtures are
 *   deterministic; noon UTC keeps `formatDate` (local-time `dd.MM.yyyy`)
 *   on the same calendar day across any realistic CI/dev timezone.
 */

const ADDRESS_PJ: PatrimVenAddress = {
  Judet: "MM",
  Localitate: "Baia Mare",
  Strada: "Str. Victoriei",
  Numar: "10",
  CodPostal: "430001",
};

const ADDRESS_PF: PatrimVenAddress = {
  Judet: "MM",
  Localitate: "Sighetu Marmatiei",
  Strada: "Str. Bogdan Voda",
  Numar: "22",
  Bloc: "B2",
  Scara: "A",
  Etaj: "3",
  Apartament: "12",
  CodPostal: "435500",
};

export const DECLARANT_PJ: PatrimVenPerson = {
  Tip: "PJ",
  CUI: "RO12345674",
  Nume: "SC EXEMPLU PATRIMONIU SRL",
  Adresa: ADDRESS_PJ,
};

export const DECLARANT_PF: PatrimVenPerson = {
  Tip: "PF",
  CNP: "cnp-hash-9f1c2a3b4d5e6f708192a3b4c5d6e7f8",
  Nume: "Popescu",
  Prenume: "Ion",
  Adresa: ADDRESS_PF,
};

function makeMeta(
  formType: PatrimVenExportMeta["formType"],
  recordCount: number
): PatrimVenExportMeta {
  return {
    formType,
    fiscalYear: 2026,
    tenantCui: "4374028",
    tenantSiruta: "106464",
    generatedAt: "2026-01-15T12:00:00.000Z",
    recordCount,
  };
}

// ---------------------------------------------------------------------------
// F3001 — Property Declarations (buildings + land)
// ---------------------------------------------------------------------------

export const sampleF3001Records: F3001Data[] = [
  {
    Contribuabil: DECLARANT_PJ,
    Cladiri: [
      {
        TipCladire: "01",
        SuprafataC: 120.5,
        ValoareImpozabila: 350000,
        AnConstructie: 2005,
        Destinatie: "N",
        Zona: "A",
        Adresa: ADDRESS_PJ,
      },
      {
        TipCladire: "02",
        SuprafataC: 85,
        ValoareImpozabila: 180000,
        AnConstructie: 1998,
        Destinatie: "R",
        Zona: "B",
        Adresa: ADDRESS_PJ,
      },
    ],
    Terenuri: [
      {
        CategorieTeren: "01",
        Suprafata: 500,
        Zona: "A",
        Adresa: ADDRESS_PJ,
      },
    ],
  },
];

export const sampleF3001Meta = makeMeta("F3001", sampleF3001Records.length);

// ---------------------------------------------------------------------------
// F3002 — Vehicle Declarations
// ---------------------------------------------------------------------------

export const sampleF3002Records: F3002Data[] = [
  {
    Contribuabil: DECLARANT_PF,
    Vehicule: [
      {
        NrInmatriculare: "MM01ABC",
        SerieSasiu: "WVWZZZ1JZ3W000001",
        TipVehicul: "01",
        Marca: "Dacia",
        Model: "Logan",
        CapacitateCilindrica: 1461,
        AnFabricatie: 2018,
        PutereKw: 65,
        MasaTotala: 1600,
      },
      {
        NrInmatriculare: "MM02XYZ",
        SerieSasiu: "1HGCM82633A004352",
        TipVehicul: "04",
        Marca: "Yamaha",
        Model: "YBR125",
        CapacitateCilindrica: 125,
        AnFabricatie: 2020,
        PutereKw: 8,
        MasaTotala: 130,
      },
    ],
  },
];

export const sampleF3002Meta = makeMeta("F3002", sampleF3002Records.length);

// ---------------------------------------------------------------------------
// F3003 — Other Local Taxes
// ---------------------------------------------------------------------------

export const sampleF3003Records: F3003Data[] = [
  {
    Contribuabil: DECLARANT_PJ,
    Taxe: [
      {
        TipTaxa: "TF",
        Descriere: "Taxă firmă",
        SumaStabilita: 500,
        SumaIncasata: 500,
      },
      {
        TipTaxa: "TH",
        Descriere: "Taxă hotelieră",
        SumaStabilita: 1200,
        SumaIncasata: 800,
      },
      {
        TipTaxa: "TS",
        Descriere: "Taxă spectacole",
        SumaStabilita: 300,
        SumaIncasata: 0,
      },
    ],
  },
];

export const sampleF3003Meta = makeMeta("F3003", sampleF3003Records.length);

// ---------------------------------------------------------------------------
// F3101 — Fiscal Certificates
// ---------------------------------------------------------------------------

const f3101Impozite = [
  {
    TipImpozit: "IC_N",
    AnFiscal: 2026,
    SumaImpozit: 4200,
    SumaPlatita: 4200,
    SumaRestanta: 0,
  },
  {
    TipImpozit: "IT_I",
    AnFiscal: 2026,
    SumaImpozit: 650,
    SumaPlatita: 400,
    SumaRestanta: 250,
  },
];

export const sampleF3101Records: F3101Data[] = [
  {
    Contribuabil: DECLARANT_PJ,
    Impozite: f3101Impozite,
    TotalRestanta: f3101Impozite.reduce((s, i) => s + i.SumaRestanta, 0),
  },
];

export const sampleF3101Meta = makeMeta("F3101", sampleF3101Records.length);

// ---------------------------------------------------------------------------
// Declarant without CUI (natural person, identified by CNP only) — must
// pass through the CUI guard untouched (no throw).
// ---------------------------------------------------------------------------

export const sampleRecordWithoutCui: F3001Data = {
  Contribuabil: DECLARANT_PF,
  Cladiri: [],
  Terenuri: [
    {
      CategorieTeren: "02",
      Suprafata: 1200,
      Zona: "C",
      Adresa: ADDRESS_PF,
    },
  ],
};

// ---------------------------------------------------------------------------
// Invalid CUI (fails the offline checksum) — for the negative test.
// ---------------------------------------------------------------------------

export const sampleRecordWithInvalidCui: F3001Data = {
  ...sampleF3001Records[0],
  Contribuabil: {
    ...DECLARANT_PJ,
    CUI: "RO00000001",
  },
};
