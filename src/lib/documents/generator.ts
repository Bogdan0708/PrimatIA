import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import type { DocumentProps } from "@react-pdf/renderer";
import { prisma, setTenantContext } from "@/lib/db";
import { uploadFile, buildDocumentPath } from "@/lib/storage";
import { formatNumber, formatLei, formatDate, numberToWords, generateDocumentNumber } from "@/lib/formatting";
import { decryptCnp } from "@/lib/crypto";
import {
  DecizieImpunerePDF,
  SomatiePDF,
  CertificatAtestarePDF,
  ChitantaPDF,
  BordeRouIncasariPDF,
} from "./templates";
import type {
  TenantInfo,
  ContribuabilInfo,
  DecizieImpunereData,
  SomatieData,
  CertificatAtestareData,
  ChitantaData,
  BordeRouIncasariData,
} from "./types";
import { Prisma } from "@prisma/client";

// ============================================================================
// Helper: get tenant info for document header
// ============================================================================

async function getTenantInfo(tenantId: string): Promise<TenantInfo> {
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
  return {
    name: tenant.name,
    cui: tenant.cui || "",
    address: tenant.address || "",
    county: tenant.county,
    phone: tenant.phone || undefined,
    email: tenant.email || undefined,
    website: tenant.website || undefined,
    logoUrl: tenant.logoUrl || undefined,
  };
}

// ============================================================================
// Helper: get contribuabil info
// ============================================================================

async function getContribuabilInfo(
  contribuabilId: string
): Promise<ContribuabilInfo> {
  const c = await prisma.contribuabil.findUniqueOrThrow({
    where: { id: contribuabilId },
    include: { adresaDomiciliu: true },
  });

  let cnpMasked: string | undefined;
  if (c.cnp) {
    try {
      const decrypted = decryptCnp(Buffer.from(c.cnp));
      cnpMasked = "*".repeat(9) + decrypted.slice(9);
    } catch {
      cnpMasked = undefined;
    }
  }

  const adresa = c.adresaDomiciliu
    ? [
        c.adresaDomiciliu.strada,
        c.adresaDomiciliu.numar ? `nr. ${c.adresaDomiciliu.numar}` : null,
        c.adresaDomiciliu.bloc ? `bl. ${c.adresaDomiciliu.bloc}` : null,
        c.adresaDomiciliu.scara ? `sc. ${c.adresaDomiciliu.scara}` : null,
        c.adresaDomiciliu.etaj ? `et. ${c.adresaDomiciliu.etaj}` : null,
        c.adresaDomiciliu.apartament ? `ap. ${c.adresaDomiciliu.apartament}` : null,
        c.adresaDomiciliu.localitate,
        `jud. ${c.adresaDomiciliu.judet}`,
      ]
        .filter(Boolean)
        .join(", ")
    : "-";

  return {
    id: c.id,
    tip: c.tip as "PF" | "PJ",
    nume: c.nume,
    prenume: c.prenume,
    cnpMasked,
    cui: c.cui,
    codRol: c.codRol,
    nrDosarFiscal: c.nrDosarFiscal,
    adresa,
  };
}

// ============================================================================
// Helper: get next document number
// ============================================================================

async function getNextDocumentNumber(
  tenantId: string,
  prefix: string,
  year: number
): Promise<string> {
  const result = await prisma.$queryRaw<[{ next_val: number }]>`
    INSERT INTO "document_sequences" ("tenant_id", "prefix", "year", "current_val")
    VALUES (${tenantId}, ${prefix}, ${year}, 1)
    ON CONFLICT ("tenant_id", "prefix", "year")
    DO UPDATE SET "current_val" = "document_sequences"."current_val" + 1
    RETURNING "current_val" AS next_val
  `;
  return generateDocumentNumber(prefix, year, result[0].next_val);
}

// ============================================================================
// Helper: store document in DB + MinIO
// ============================================================================

async function storeDocument(
  tenantId: string,
  contribuabilId: string | null,
  tip: string,
  documentNumber: string,
  dataJson: Prisma.InputJsonValue,
  pdfBuffer: Buffer,
  relatedIds?: { impozitId?: string; somatieId?: string }
): Promise<string> {
  const path = buildDocumentPath(
    tenantId,
    tip,
    `${documentNumber}.pdf`
  );
  await uploadFile(path, pdfBuffer);

  const doc = await prisma.document.create({
    data: {
      tenantId,
      contribuabilId,
      tip,
      numarDocument: documentNumber,
      dataDocument: new Date(),
      templateId: tip,
      dataJson,
      fileUrl: path,
      fileSizeBytes: pdfBuffer.length,
      status: "generat",
      impozitId: relatedIds?.impozitId,
      somatieId: relatedIds?.somatieId,
    },
  });
  return doc.id;
}

// ============================================================================
// GENERATE: Decizie de Impunere
// ============================================================================

export async function generateDecizieImpunere(
  tenantId: string,
  contribuabilId: string,
  fiscalYear: number
): Promise<string> {
  await setTenantContext(tenantId);

  const tenant = await getTenantInfo(tenantId);
  const contribuabil = await getContribuabilInfo(contribuabilId);

  // Get all taxes for this taxpayer and fiscal year
  const impozite = await prisma.impozit.findMany({
    where: { tenantId, contribuabilId, fiscalYear },
    include: {
      taxType: true,
      hclDecision: true,
    },
  });

  if (impozite.length === 0) {
    throw new Error("Nu există impozite calculate pentru acest contribuabil și an fiscal");
  }

  const hcl = impozite[0].hclDecision;
  const documentNumber = await getNextDocumentNumber(tenantId, "DI", fiscalYear);

  const lines = impozite.map((imp) => {
    const taxName = typeof imp.taxType.name === "object"
      ? (imp.taxType.name as Record<string, string>).ro || imp.taxType.code
      : imp.taxType.code;

    let propertyDesc = "-";
    if (imp.proprietateType === "cladire") propertyDesc = "Clădire";
    else if (imp.proprietateType === "teren") propertyDesc = "Teren";
    else if (imp.proprietateType === "vehicul") propertyDesc = "Vehicul";

    return {
      taxTypeName: taxName,
      propertyDescription: propertyDesc,
      bazaImpozabila: formatNumber(Number(imp.bazaImpozabila)),
      rataAplicata: formatNumber(Number(imp.rataAplicata), 4),
      sumaCalculata: formatNumber(Number(imp.sumaCalculata)),
      sumaScutire: formatNumber(Number(imp.sumaScutire)),
      sumaDatorata: formatNumber(Number(imp.sumaDatorata)),
    };
  });

  const totalDatorat = impozite.reduce(
    (sum, imp) => sum + Number(imp.sumaDatorata),
    0
  );

  const data: DecizieImpunereData = {
    tenant,
    contribuabil,
    fiscalYear,
    documentNumber,
    documentDate: formatDate(new Date()),
    hclNumber: hcl?.hclNumber || "-",
    hclDate: hcl?.hclDate ? formatDate(hcl.hclDate) : "-",
    lines,
    totalDatorat: formatLei(totalDatorat),
    installments: {
      rata1: formatNumber(Number(impozite[0].rata1)),
      rata1Scadenta: formatDate(impozite[0].rata1Scadenta),
      rata2: formatNumber(Number(impozite[0].rata2)),
      rata2Scadenta: formatDate(impozite[0].rata2Scadenta),
      bonificatie: formatNumber(
        impozite.reduce((s, i) => s + Number(i.bonificatie), 0)
      ),
    },
    legalBasis: `Legii nr. 227/2015 privind Codul Fiscal, Titlul IX`,
  };

  const element = React.createElement(DecizieImpunerePDF, { data });
  const pdfBuffer = await renderToBuffer(
    element as unknown as React.ReactElement<DocumentProps>
  );

  return storeDocument(
    tenantId,
    contribuabilId,
    "decizie_impunere",
    documentNumber,
    data as unknown as Prisma.InputJsonValue,
    Buffer.from(pdfBuffer)
  );
}

// ============================================================================
// GENERATE: Somație
// ============================================================================

export async function generateSomatie(
  tenantId: string,
  somatieId: string
): Promise<string> {
  await setTenantContext(tenantId);

  const somatie = await prisma.somatie.findUniqueOrThrow({
    where: { id: somatieId },
    include: {
      somatiiImpozite: {
        include: {
          impozit: { include: { taxType: true } },
        },
      },
    },
  });

  const tenant = await getTenantInfo(tenantId);
  const contribuabil = await getContribuabilInfo(somatie.contribuabilId);
  const documentNumber = await getNextDocumentNumber(tenantId, "SM", new Date().getFullYear());

  const debts = somatie.somatiiImpozite.map((si) => {
    const imp = si.impozit;
    const taxName = typeof imp.taxType.name === "object"
      ? (imp.taxType.name as Record<string, string>).ro || imp.taxType.code
      : imp.taxType.code;

    const debit = Number(imp.sumaDatorata) - Number(imp.sumaPlatita);
    const penalties = Number(imp.sumaPenalitati);

    return {
      description: taxName,
      fiscalYear: imp.fiscalYear,
      sumaDebit: formatNumber(Math.max(0, debit)),
      sumaPenalitati: formatNumber(penalties),
      sumaTotala: formatNumber(Math.max(0, debit) + penalties),
    };
  });

  const data: SomatieData = {
    tenant,
    contribuabil,
    documentNumber,
    documentDate: formatDate(new Date()),
    debts,
    totalDebit: formatNumber(Number(somatie.sumaDebit)),
    totalPenalitati: formatNumber(Number(somatie.sumaPenalitati)),
    totalSuma: formatNumber(Number(somatie.sumaTotala)),
    termenPlata: formatDate(somatie.termenPlata),
    legalBasis: "art. 226 din Legea nr. 207/2015 privind Codul de procedură fiscală",
  };

  const element = React.createElement(SomatiePDF, { data });
  const pdfBuffer = await renderToBuffer(
    element as unknown as React.ReactElement<DocumentProps>
  );

  return storeDocument(
    tenantId,
    somatie.contribuabilId,
    "somatie",
    documentNumber,
    data as unknown as Prisma.InputJsonValue,
    Buffer.from(pdfBuffer),
    { somatieId }
  );
}

// ============================================================================
// GENERATE: Certificat de Atestare Fiscală
// ============================================================================

export async function generateCertificatAtestare(
  tenantId: string,
  contribuabilId: string,
  purpose: string = "tranzacții imobiliare"
): Promise<string> {
  await setTenantContext(tenantId);

  const tenant = await getTenantInfo(tenantId);
  const contribuabil = await getContribuabilInfo(contribuabilId);
  const documentNumber = await getNextDocumentNumber(tenantId, "CA", new Date().getFullYear());

  // Get all taxes with balances
  const impozite = await prisma.impozit.findMany({
    where: {
      tenantId,
      contribuabilId,
    },
    include: { taxType: true },
    orderBy: [{ fiscalYear: "asc" }],
  });

  const taxes = impozite.map((imp) => {
    const taxName = typeof imp.taxType.name === "object"
      ? (imp.taxType.name as Record<string, string>).ro || imp.taxType.code
      : imp.taxType.code;

    const restanta = Number(imp.sumaDatorata) + Number(imp.sumaPenalitati) - Number(imp.sumaPlatita);
    return {
      taxType: taxName,
      fiscalYear: imp.fiscalYear,
      sumaDatorata: formatNumber(Number(imp.sumaDatorata)),
      sumaPlatita: formatNumber(Number(imp.sumaPlatita)),
      sumaRestanta: formatNumber(Math.max(0, restanta)),
    };
  });

  const totalRestanta = impozite.reduce((sum, imp) => {
    const rest = Number(imp.sumaDatorata) + Number(imp.sumaPenalitati) - Number(imp.sumaPlatita);
    return sum + Math.max(0, rest);
  }, 0);

  const validUntilDate = new Date();
  validUntilDate.setDate(validUntilDate.getDate() + 30);

  const data: CertificatAtestareData = {
    tenant,
    contribuabil,
    documentNumber,
    documentDate: formatDate(new Date()),
    purpose,
    taxes,
    totalRestanta: formatLei(totalRestanta),
    hasDebts: totalRestanta > 0,
    validUntil: formatDate(validUntilDate),
  };

  const element = React.createElement(CertificatAtestarePDF, { data });
  const pdfBuffer = await renderToBuffer(
    element as unknown as React.ReactElement<DocumentProps>
  );

  return storeDocument(
    tenantId,
    contribuabilId,
    "certificat_atestare",
    documentNumber,
    data as unknown as Prisma.InputJsonValue,
    Buffer.from(pdfBuffer)
  );
}

// ============================================================================
// GENERATE: Chitanță
// ============================================================================

export async function generateChitanta(
  tenantId: string,
  plataId: string
): Promise<string> {
  await setTenantContext(tenantId);

  const plata = await prisma.plata.findUniqueOrThrow({
    where: { id: plataId },
    include: {
      contribuabil: true,
      inregistratDe: true,
      platiDistributie: {
        include: { impozit: { include: { taxType: true } } },
      },
    },
  });

  const tenant = await getTenantInfo(tenantId);
  const contribuabil = await getContribuabilInfo(plata.contribuabilId);
  const documentNumber = await getNextDocumentNumber(tenantId, "CH", new Date().getFullYear());

  const modalitateLabel: Record<string, string> = {
    numerar: "Numerar",
    virament: "Virament bancar",
    mandat_postal: "Mandat poștal",
    ghiseul_ro: "Ghișeul.ro",
    card: "Card",
  };

  const distributions = plata.platiDistributie.map((d) => {
    const taxName = typeof d.impozit.taxType.name === "object"
      ? (d.impozit.taxType.name as Record<string, string>).ro || d.impozit.taxType.code
      : d.impozit.taxType.code;

    return {
      description: taxName,
      fiscalYear: d.impozit.fiscalYear,
      sumaDebit: formatNumber(Number(d.sumaDebit)),
      sumaPenalitati: formatNumber(Number(d.sumaPenalitati)),
    };
  });

  const suma = Number(plata.suma);
  const data: ChitantaData = {
    tenant,
    contribuabil,
    documentNumber,
    documentDate: formatDate(plata.dataPlata),
    suma: formatLei(suma),
    sumaInLitere: numberToWords(suma),
    modalitate: modalitateLabel[plata.modalitate] || plata.modalitate,
    distributions,
    casierName: plata.inregistratDe
      ? `${plata.inregistratDe.firstName} ${plata.inregistratDe.lastName}`
      : "-",
  };

  const element = React.createElement(ChitantaPDF, { data });
  const pdfBuffer = await renderToBuffer(
    element as unknown as React.ReactElement<DocumentProps>
  );

  return storeDocument(
    tenantId,
    plata.contribuabilId,
    "chitanta",
    documentNumber,
    data as unknown as Prisma.InputJsonValue,
    Buffer.from(pdfBuffer)
  );
}

// ============================================================================
// GENERATE: Borderou de Încasări
// ============================================================================

export async function generateBordeRouIncasari(
  tenantId: string,
  date: Date,
  userId: string
): Promise<string> {
  await setTenantContext(tenantId);

  const tenant = await getTenantInfo(tenantId);
  const documentNumber = await getNextDocumentNumber(tenantId, "BI", date.getFullYear());

  // Start and end of day
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const plati = await prisma.plata.findMany({
    where: {
      tenantId,
      dataPlata: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
    include: {
      contribuabil: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const user = await prisma.tenantUser.findUnique({ where: { id: userId } });
  const casierName = user ? `${user.firstName} ${user.lastName}` : "-";

  const modalitateLabel: Record<string, string> = {
    numerar: "Numerar",
    virament: "Virament",
    mandat_postal: "Mandat poștal",
    ghiseul_ro: "Ghișeul.ro",
    card: "Card",
  };

  let totalNumerar = 0;
  let totalVirament = 0;

  const payments = plati.map((p, i) => {
    const suma = Number(p.suma);
    if (p.modalitate === "numerar") totalNumerar += suma;
    else totalVirament += suma;

    return {
      nrCrt: i + 1,
      nrChitanta: p.nrChitanta || p.nrDocument || "-",
      contribuabilName: `${p.contribuabil.nume}${p.contribuabil.prenume ? ` ${p.contribuabil.prenume}` : ""}`,
      modalitate: modalitateLabel[p.modalitate] || p.modalitate,
      suma: formatNumber(suma),
    };
  });

  const data: BordeRouIncasariData = {
    tenant,
    documentDate: formatDate(date),
    documentNumber,
    casierName,
    payments,
    totalNumerar: formatLei(totalNumerar),
    totalVirament: formatLei(totalVirament),
    totalGeneral: formatLei(totalNumerar + totalVirament),
  };

  const element = React.createElement(BordeRouIncasariPDF, { data });
  const pdfBuffer = await renderToBuffer(
    element as unknown as React.ReactElement<DocumentProps>
  );

  return storeDocument(
    tenantId,
    null,
    "borderou_incasari",
    documentNumber,
    data as unknown as Prisma.InputJsonValue,
    Buffer.from(pdfBuffer)
  );
}
