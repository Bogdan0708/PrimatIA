import { XMLBuilder } from "fast-xml-parser";
import { prisma, setTenantContext } from "@/lib/db";
import { decryptCnp } from "@/lib/crypto";
import { formatDate } from "@/lib/formatting";
import type {
  PatrimVenAddress,
  PatrimVenPerson,
  F3001Data,
  F3002Data,
  F3003Data,
  F3101Data,
  PatrimVenExportMeta,
} from "./types";

const builder = new XMLBuilder({
  format: true,
  indentBy: "  ",
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  suppressBooleanAttributes: false,
});

// ============================================================================
// Helper: resolve PatrimVen code from mappings table
// ============================================================================

async function resolveCode(
  entityType: string,
  internalCode: string
): Promise<string> {
  const mapping = await prisma.patrimvenCodeMapping.findUnique({
    where: { entityType_internalCode: { entityType, internalCode } },
  });
  return mapping?.patrimvenCode ?? internalCode;
}

// ============================================================================
// Helper: build address from Prisma adresa record
// ============================================================================

function buildAddress(adresa: {
  judet: string;
  localitate: string;
  strada?: string | null;
  numar?: string | null;
  bloc?: string | null;
  scara?: string | null;
  etaj?: string | null;
  apartament?: string | null;
  codPostal?: string | null;
}): PatrimVenAddress {
  return {
    Judet: adresa.judet,
    Localitate: adresa.localitate,
    ...(adresa.strada && { Strada: adresa.strada }),
    ...(adresa.numar && { Numar: adresa.numar }),
    ...(adresa.bloc && { Bloc: adresa.bloc }),
    ...(adresa.scara && { Scara: adresa.scara }),
    ...(adresa.etaj && { Etaj: adresa.etaj }),
    ...(adresa.apartament && { Apartament: adresa.apartament }),
    ...(adresa.codPostal && { CodPostal: adresa.codPostal }),
  };
}

// ============================================================================
// Helper: build person data
// ============================================================================

async function buildPerson(
  contribuabil: {
    tip: string;
    cnp: Uint8Array | null;
    cui: string | null;
    nume: string;
    prenume: string | null;
    adresaDomiciliu: {
      judet: string;
      localitate: string;
      strada: string | null;
      numar: string | null;
      bloc: string | null;
      scara: string | null;
      etaj: string | null;
      apartament: string | null;
      codPostal: string | null;
    } | null;
  }
): Promise<PatrimVenPerson> {
  let cnp: string | undefined;
  if (contribuabil.cnp) {
    try {
      cnp = decryptCnp(Buffer.from(contribuabil.cnp));
    } catch {
      cnp = undefined;
    }
  }

  const defaultAddress: PatrimVenAddress = { Judet: "-", Localitate: "-" };

  return {
    Tip: contribuabil.tip as "PF" | "PJ",
    ...(cnp && { CNP: cnp }),
    ...(contribuabil.cui && { CUI: contribuabil.cui }),
    Nume: contribuabil.nume,
    ...(contribuabil.prenume && { Prenume: contribuabil.prenume }),
    Adresa: contribuabil.adresaDomiciliu
      ? buildAddress(contribuabil.adresaDomiciliu)
      : defaultAddress,
  };
}

// ============================================================================
// F3001 — Property Declarations (buildings + land)
// ============================================================================

export async function generateF3001(
  tenantId: string,
  fiscalYear: number
): Promise<{ xml: string; meta: PatrimVenExportMeta }> {
  await setTenantContext(tenantId);
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });

  const contribuabili = await prisma.contribuabil.findMany({
    where: { tenantId, deletedAt: null },
    include: {
      adresaDomiciliu: true,
      proprietatiCladiri: {
        where: { deletedAt: null, status: "activ" },
        include: { adresa: true },
      },
      proprietatiTerenuri: {
        where: { deletedAt: null, status: "activ" },
        include: { adresa: true },
      },
    },
  });

  const records: F3001Data[] = [];

  for (const c of contribuabili) {
    if (c.proprietatiCladiri.length === 0 && c.proprietatiTerenuri.length === 0) continue;

    const person = await buildPerson(c);

    const cladiri = await Promise.all(
      c.proprietatiCladiri.map(async (cl) => ({
        TipCladire: await resolveCode("tip_constructie", cl.tipConstructie),
        SuprafataC: Number(cl.suprafataConstruita),
        ValoareImpozabila: Number(cl.valoareImpozabila ?? 0),
        AnConstructie: cl.anConstructie,
        Destinatie: await resolveCode("destinatie", cl.destinatie),
        Zona: cl.zona,
        Adresa: cl.adresa ? buildAddress(cl.adresa) : person.Adresa,
      }))
    );

    const terenuri = await Promise.all(
      c.proprietatiTerenuri.map(async (t) => ({
        CategorieTeren: await resolveCode("categorie_teren", t.categorie),
        Suprafata: Number(t.suprafataMp),
        Zona: t.zona,
        Adresa: t.adresa ? buildAddress(t.adresa) : person.Adresa,
      }))
    );

    records.push({ Contribuabil: person, Cladiri: cladiri, Terenuri: terenuri });
  }

  const xmlObj = {
    "?xml": { "@_version": "1.0", "@_encoding": "UTF-8" },
    PatrimVen: {
      "@_formType": "F3001",
      "@_anFiscal": fiscalYear,
      "@_cuiUAT": tenant.cui || "",
      "@_sirutaUAT": tenant.sirutaCode || "",
      "@_dataGenerare": formatDate(new Date()),
      Declaratii: {
        Declaratie: records.map((r) => ({
          Contribuabil: r.Contribuabil,
          Proprietati: {
            ...(r.Cladiri.length > 0 && { Cladire: r.Cladiri }),
            ...(r.Terenuri.length > 0 && { Teren: r.Terenuri }),
          },
        })),
      },
    },
  };

  return {
    xml: builder.build(xmlObj),
    meta: {
      formType: "F3001",
      fiscalYear,
      tenantCui: tenant.cui || "",
      tenantSiruta: tenant.sirutaCode || "",
      generatedAt: new Date().toISOString(),
      recordCount: records.length,
    },
  };
}

// ============================================================================
// F3002 — Vehicle Declarations
// ============================================================================

export async function generateF3002(
  tenantId: string,
  fiscalYear: number
): Promise<{ xml: string; meta: PatrimVenExportMeta }> {
  await setTenantContext(tenantId);
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });

  const contribuabili = await prisma.contribuabil.findMany({
    where: { tenantId, deletedAt: null },
    include: {
      adresaDomiciliu: true,
      proprietatiVehicule: {
        where: { deletedAt: null, status: "activ" },
      },
    },
  });

  const records: F3002Data[] = [];

  for (const c of contribuabili) {
    if (c.proprietatiVehicule.length === 0) continue;

    const person = await buildPerson(c);

    const vehicule = await Promise.all(
      c.proprietatiVehicule.map(async (v) => ({
        NrInmatriculare: v.numarInmatriculare || undefined,
        SerieSasiu: v.serieSasiu || undefined,
        TipVehicul: await resolveCode("tip_vehicul", v.tipVehicul),
        Marca: v.marca || undefined,
        Model: v.model || undefined,
        CapacitateCilindrica: v.cilindreeCmc || undefined,
        AnFabricatie: v.anFabricatie,
        PutereKw: v.putereKw ? Number(v.putereKw) : undefined,
        MasaTotala: v.masaTotalaKg || undefined,
      }))
    );

    records.push({ Contribuabil: person, Vehicule: vehicule });
  }

  const xmlObj = {
    "?xml": { "@_version": "1.0", "@_encoding": "UTF-8" },
    PatrimVen: {
      "@_formType": "F3002",
      "@_anFiscal": fiscalYear,
      "@_cuiUAT": tenant.cui || "",
      "@_sirutaUAT": tenant.sirutaCode || "",
      "@_dataGenerare": formatDate(new Date()),
      Declaratii: {
        Declaratie: records.map((r) => ({
          Contribuabil: r.Contribuabil,
          Vehicule: { Vehicul: r.Vehicule },
        })),
      },
    },
  };

  return {
    xml: builder.build(xmlObj),
    meta: {
      formType: "F3002",
      fiscalYear,
      tenantCui: tenant.cui || "",
      tenantSiruta: tenant.sirutaCode || "",
      generatedAt: new Date().toISOString(),
      recordCount: records.length,
    },
  };
}

// ============================================================================
// F3003 — Other Local Taxes
// ============================================================================

export async function generateF3003(
  tenantId: string,
  fiscalYear: number
): Promise<{ xml: string; meta: PatrimVenExportMeta }> {
  await setTenantContext(tenantId);
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });

  // Get taxes that are NOT buildings/land/vehicles
  const otherTaxTypes = await prisma.taxTypeRegistry.findMany({
    where: {
      category: "alte_taxe",
      isActive: true,
    },
  });

  const otherTypeIds = otherTaxTypes.map((t) => t.id);

  const impozite = await prisma.impozit.findMany({
    where: {
      tenantId,
      fiscalYear,
      taxTypeId: { in: otherTypeIds },
    },
    include: {
      contribuabil: { include: { adresaDomiciliu: true } },
      taxType: true,
    },
  });

  // Group by contribuabil
  const grouped = new Map<string, { contribuabil: typeof impozite[0]["contribuabil"]; taxes: typeof impozite }>();
  for (const imp of impozite) {
    const existing = grouped.get(imp.contribuabilId);
    if (existing) {
      existing.taxes.push(imp);
    } else {
      grouped.set(imp.contribuabilId, { contribuabil: imp.contribuabil, taxes: [imp] });
    }
  }

  const records: F3003Data[] = [];
  for (const [, { contribuabil, taxes }] of Array.from(grouped)) {
    const person = await buildPerson(contribuabil);
    const taxe = await Promise.all(
      taxes.map(async (t: (typeof impozite)[number]) => ({
        TipTaxa: await resolveCode("tip_impozit", t.taxType.code),
        Descriere: typeof t.taxType.name === "object"
          ? (t.taxType.name as Record<string, string>).ro || t.taxType.code
          : t.taxType.code,
        SumaStabilita: Number(t.sumaDatorata),
        SumaIncasata: Number(t.sumaPlatita),
      }))
    );
    records.push({ Contribuabil: person, Taxe: taxe });
  }

  const xmlObj = {
    "?xml": { "@_version": "1.0", "@_encoding": "UTF-8" },
    PatrimVen: {
      "@_formType": "F3003",
      "@_anFiscal": fiscalYear,
      "@_cuiUAT": tenant.cui || "",
      "@_sirutaUAT": tenant.sirutaCode || "",
      "@_dataGenerare": formatDate(new Date()),
      Declaratii: {
        Declaratie: records.map((r) => ({
          Contribuabil: r.Contribuabil,
          Taxe: { Taxa: r.Taxe },
        })),
      },
    },
  };

  return {
    xml: builder.build(xmlObj),
    meta: {
      formType: "F3003",
      fiscalYear,
      tenantCui: tenant.cui || "",
      tenantSiruta: tenant.sirutaCode || "",
      generatedAt: new Date().toISOString(),
      recordCount: records.length,
    },
  };
}

// ============================================================================
// F3101 — Fiscal Certificates
// ============================================================================

export async function generateF3101(
  tenantId: string,
  fiscalYear: number
): Promise<{ xml: string; meta: PatrimVenExportMeta }> {
  await setTenantContext(tenantId);
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });

  const contribuabili = await prisma.contribuabil.findMany({
    where: { tenantId, deletedAt: null },
    include: {
      adresaDomiciliu: true,
      impozite: {
        where: { fiscalYear },
        include: { taxType: true },
      },
    },
  });

  const records: F3101Data[] = [];

  for (const c of contribuabili) {
    if (c.impozite.length === 0) continue;

    const person = await buildPerson(c);

    const impoziteData = await Promise.all(
      c.impozite.map(async (imp) => {
        const restanta = Number(imp.sumaDatorata) + Number(imp.sumaPenalitati) - Number(imp.sumaPlatita);
        return {
          TipImpozit: await resolveCode("tip_impozit", imp.taxType.code),
          AnFiscal: imp.fiscalYear,
          SumaImpozit: Number(imp.sumaDatorata),
          SumaPlatita: Number(imp.sumaPlatita),
          SumaRestanta: Math.max(0, restanta),
        };
      })
    );

    const totalRestanta = impoziteData.reduce((s, i) => s + i.SumaRestanta, 0);

    records.push({
      Contribuabil: person,
      Impozite: impoziteData,
      TotalRestanta: totalRestanta,
    });
  }

  const xmlObj = {
    "?xml": { "@_version": "1.0", "@_encoding": "UTF-8" },
    PatrimVen: {
      "@_formType": "F3101",
      "@_anFiscal": fiscalYear,
      "@_cuiUAT": tenant.cui || "",
      "@_sirutaUAT": tenant.sirutaCode || "",
      "@_dataGenerare": formatDate(new Date()),
      Certificate: {
        Certificat: records.map((r) => ({
          Contribuabil: r.Contribuabil,
          Impozite: { Impozit: r.Impozite },
          TotalRestanta: r.TotalRestanta,
        })),
      },
    },
  };

  return {
    xml: builder.build(xmlObj),
    meta: {
      formType: "F3101",
      fiscalYear,
      tenantCui: tenant.cui || "",
      tenantSiruta: tenant.sirutaCode || "",
      generatedAt: new Date().toISOString(),
      recordCount: records.length,
    },
  };
}

// ============================================================================
// XSD Validation stub
// ============================================================================

export function validateXml(xml: string, formType: string): { valid: boolean; errors: string[] } {
  void formType;
  // Stub: actual XSD validation requires ANAF-provided XSD schema files.
  // When XSD files are available, integrate with a library like libxmljs or fast-xml-parser's validator.
  const errors: string[] = [];

  if (!xml.includes("<?xml")) {
    errors.push("Missing XML declaration");
  }
  if (!xml.includes("PatrimVen")) {
    errors.push("Missing PatrimVen root element");
  }
  if (!xml.includes("formType")) {
    errors.push("Missing formType attribute");
  }

  return { valid: errors.length === 0, errors };
}
