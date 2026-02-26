import { prisma } from "@/lib/db";
import { Decimal } from "@prisma/client/runtime/library";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Anomaly {
  type: 'zero_tax' | 'outlier_amount' | 'overpayment' | 'duplicate' | 'missing_data' | 'zero_value' | 'implausible' | 'value_change';
  severity: 'low' | 'medium' | 'high' | 'critical';
  entityType: 'contribuabil' | 'cladire' | 'teren' | 'vehicul' | 'plata';
  entityId: string;
  description: string;
  suggestedAction: string;
}

// ─── Cache ───────────────────────────────────────────────────────────────────

const cache = new Map<string, { data: Anomaly[]; timestamp: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

// ─── Main ────────────────────────────────────────────────────────────────────

export async function detectAnomalies(tenantId: string): Promise<Anomaly[]> {
  const cacheKey = `anomalies:${tenantId}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const anomalies: Anomaly[] = [];

  await Promise.all([
    detectMissingData(tenantId, anomalies),
    detectZeroTax(tenantId, anomalies),
    detectOverpayment(tenantId, anomalies),
    detectZeroValue(tenantId, anomalies),
    detectImplausibleVehicles(tenantId, anomalies),
    detectDuplicateProperties(tenantId, anomalies),
    detectOutlierAmounts(tenantId, anomalies),
  ]);

  // Sort by severity
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  anomalies.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  cache.set(cacheKey, { data: anomalies, timestamp: Date.now() });
  return anomalies;
}

export function clearAnomalyCache(tenantId: string): void {
  cache.delete(`anomalies:${tenantId}`);
}

// ─── Detectors ───────────────────────────────────────────────────────────────

async function detectMissingData(tenantId: string, anomalies: Anomaly[]) {
  // PF without CNP (Active only)
  const pfNoCnp = await prisma.contribuabil.findMany({
    where: { 
      tenantId, 
      tip: 'PF', 
      cnpHash: null, 
      status: 'activ',
      deletedAt: null 
    },
    select: { id: true, nume: true, prenume: true },
  });
  for (const c of pfNoCnp) {
    anomalies.push({
      type: 'missing_data',
      severity: 'high',
      entityType: 'contribuabil',
      entityId: c.id,
      description: `Contribuabilul PF „${c.nume} ${c.prenume ?? ''}" nu are CNP completat.`,
      suggestedAction: 'Completați CNP-ul contribuabilului din fișa acestuia.',
    });
  }

  // PJ without CUI (Active only)
  const pjNoCui = await prisma.contribuabil.findMany({
    where: { 
      tenantId, 
      tip: 'PJ', 
      cui: null, 
      status: 'activ',
      deletedAt: null 
    },
    select: { id: true, nume: true },
  });
  for (const c of pjNoCui) {
    anomalies.push({
      type: 'missing_data',
      severity: 'high',
      entityType: 'contribuabil',
      entityId: c.id,
      description: `Contribuabilul PJ „${c.nume}" nu are CUI completat.`,
      suggestedAction: 'Completați CUI-ul contribuabilului din fișa acestuia.',
    });
  }
}

async function detectZeroTax(tenantId: string, anomalies: Anomaly[]) {
  const currentYear = new Date().getFullYear();

  // Taxpayers with active properties but no taxes this year
  const taxpayersWithProps = await prisma.contribuabil.findMany({
    where: {
      tenantId,
      deletedAt: null,
      OR: [
        { proprietatiCladiri: { some: { status: 'activ' } } },
        { proprietatiTerenuri: { some: { status: 'activ' } } },
        { proprietatiVehicule: { some: { status: 'activ' } } },
      ],
    },
    select: {
      id: true,
      nume: true,
      prenume: true,
      impozite: {
        where: { fiscalYear: currentYear },
        select: { sumaDatorata: true },
      },
    },
  });

  for (const c of taxpayersWithProps) {
    const totalTax = c.impozite.reduce((sum, i) => sum + Number(i.sumaDatorata), 0);
    if (totalTax === 0 && c.impozite.length === 0) {
      anomalies.push({
        type: 'zero_tax',
        severity: 'high',
        entityType: 'contribuabil',
        entityId: c.id,
        description: `Contribuabilul „${c.nume} ${c.prenume ?? ''}" deține proprietăți active dar nu are impozite calculate pentru ${currentYear}.`,
        suggestedAction: 'Calculați impozitele pentru acest contribuabil sau verificați starea proprietăților.',
      });
    }
  }
}

async function detectOverpayment(tenantId: string, anomalies: Anomaly[]) {
  const currentYear = new Date().getFullYear();

  const taxpayers = await prisma.contribuabil.findMany({
    where: { tenantId, deletedAt: null },
    select: {
      id: true,
      nume: true,
      prenume: true,
      impozite: {
        where: { fiscalYear: currentYear },
        select: { sumaDatorata: true, sumaPlatita: true },
      },
    },
  });

  for (const c of taxpayers) {
    const totalOwed = c.impozite.reduce((s, i) => s + Number(i.sumaDatorata), 0);
    const totalPaid = c.impozite.reduce((s, i) => s + Number(i.sumaPlatita), 0);
    if (totalOwed > 0 && totalPaid > totalOwed * 1.01) { // 1% tolerance
      anomalies.push({
        type: 'overpayment',
        severity: 'medium',
        entityType: 'contribuabil',
        entityId: c.id,
        description: `Contribuabilul „${c.nume} ${c.prenume ?? ''}" a plătit ${totalPaid.toFixed(2)} RON, depășind datoria de ${totalOwed.toFixed(2)} RON.`,
        suggestedAction: 'Verificați plățile și emiteți o restituire dacă este cazul.',
      });
    }
  }
}

async function detectZeroValue(tenantId: string, anomalies: Anomaly[]) {
  const zeroBuildings = await prisma.proprietateCladire.findMany({
    where: {
      tenantId,
      status: 'activ',
      OR: [
        { suprafataConstruita: new Decimal(0) },
        { valoareImpozabila: new Decimal(0) },
        { valoareImpozabila: null },
      ],
    },
    select: { id: true, contribuabil: { select: { nume: true, prenume: true } } },
  });

  for (const b of zeroBuildings) {
    anomalies.push({
      type: 'zero_value',
      severity: 'medium',
      entityType: 'cladire',
      entityId: b.id,
      description: `Clădire a contribuabilului „${b.contribuabil.nume} ${b.contribuabil.prenume ?? ''}" cu suprafață sau valoare zero.`,
      suggestedAction: 'Actualizați datele clădirii cu suprafața și valoarea corectă.',
    });
  }

  const zeroLand = await prisma.proprietateTeren.findMany({
    where: { tenantId, status: 'activ', suprafataMp: new Decimal(0) },
    select: { id: true, contribuabil: { select: { nume: true, prenume: true } } },
  });

  for (const l of zeroLand) {
    anomalies.push({
      type: 'zero_value',
      severity: 'medium',
      entityType: 'teren',
      entityId: l.id,
      description: `Teren al contribuabilului „${l.contribuabil.nume} ${l.contribuabil.prenume ?? ''}" cu suprafață zero.`,
      suggestedAction: 'Actualizați suprafața terenului conform actelor de proprietate.',
    });
  }
}

async function detectImplausibleVehicles(tenantId: string, anomalies: Anomaly[]) {
  const now = new Date();

  const vehicles = await prisma.proprietateVehicul.findMany({
    where: { tenantId, status: 'activ' },
    select: {
      id: true,
      cilindreeCmc: true,
      anFabricatie: true,
      dataDobandire: true,
      contribuabil: { select: { nume: true, prenume: true } },
    },
  });

  for (const v of vehicles) {
    const ownerName = `${v.contribuabil.nume} ${v.contribuabil.prenume ?? ''}`;

    if (v.cilindreeCmc !== null && v.cilindreeCmc <= 0) {
      anomalies.push({
        type: 'implausible',
        severity: 'medium',
        entityType: 'vehicul',
        entityId: v.id,
        description: `Vehicul al contribuabilului „${ownerName}" cu cilindree ${v.cilindreeCmc} cmc.`,
        suggestedAction: 'Corectați cilindreea vehiculului conform cărții de identitate.',
      });
    }

    if (v.dataDobandire > now) {
      anomalies.push({
        type: 'implausible',
        severity: 'low',
        entityType: 'vehicul',
        entityId: v.id,
        description: `Vehicul al contribuabilului „${ownerName}" cu dată de dobândire în viitor.`,
        suggestedAction: 'Verificați data de dobândire a vehiculului.',
      });
    }

    if (v.anFabricatie > now.getFullYear() + 1 || v.anFabricatie < 1900) {
      anomalies.push({
        type: 'implausible',
        severity: 'medium',
        entityType: 'vehicul',
        entityId: v.id,
        description: `Vehicul al contribuabilului „${ownerName}" cu an fabricație implauzibil: ${v.anFabricatie}.`,
        suggestedAction: 'Corectați anul de fabricație al vehiculului.',
      });
    }
  }
}

async function detectDuplicateProperties(tenantId: string, anomalies: Anomaly[]) {
  // Find buildings with same address and same owner
  const buildings = await prisma.proprietateCladire.findMany({
    where: { tenantId, status: 'activ' },
    select: { id: true, contribuabilId: true, adresaId: true },
  });

  const seen = new Map<string, string>();
  for (const b of buildings) {
    const key = `${b.contribuabilId}:${b.adresaId}`;
    if (seen.has(key)) {
      anomalies.push({
        type: 'duplicate',
        severity: 'medium',
        entityType: 'cladire',
        entityId: b.id,
        description: `Clădire posibil duplicată — aceeași adresă și proprietar ca și înregistrarea ${seen.get(key)!.slice(0, 8)}...`,
        suggestedAction: 'Verificați dacă înregistrarea este un duplicat și ștergeți-o dacă este cazul.',
      });
    } else {
      seen.set(key, b.id);
    }
  }
}

async function detectOutlierAmounts(tenantId: string, anomalies: Anomaly[]) {
  const currentYear = new Date().getFullYear();

  const taxes = await prisma.impozit.findMany({
    where: { tenantId, fiscalYear: currentYear },
    select: {
      id: true,
      contribuabilId: true,
      sumaDatorata: true,
      proprietateType: true,
      contribuabil: { select: { tip: true, nume: true, prenume: true } },
    },
  });

  // Group by property type AND taxpayer type (PF/PJ)
  const groups = new Map<string, { id: string; taxId: string; amount: number; name: string }[]>();
  for (const t of taxes) {
    const propType = t.proprietateType ?? 'other';
    const contribType = t.contribuabil.tip;
    const key = `${propType}:${contribType}`;

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push({
      id: t.contribuabilId,
      taxId: t.id,
      amount: Number(t.sumaDatorata),
      name: `${t.contribuabil.nume} ${t.contribuabil.prenume ?? ''}`,
    });
  }

  const groupKeys = Array.from(groups.keys());
  for (const key of groupKeys) {
    const items = groups.get(key)!;
    if (items.length < 5) continue; // Need enough data points for statistical relevance

    const amounts = items.map((i: { amount: number }) => i.amount);
    const mean = amounts.reduce((a: number, b: number) => a + b, 0) / amounts.length;
    
    // Avoid calculations if mean is zero
    if (mean === 0) continue;

    const stdDev = Math.sqrt(amounts.reduce((s: number, x: number) => s + (x - mean) ** 2, 0) / amounts.length);

    if (stdDev === 0) continue;

    for (const item of items) {
      const zScore = Math.abs(item.amount - mean) / stdDev;
      // High severity for > 3 sigma, Medium for > 2 sigma
      if (zScore > 2) {
        anomalies.push({
          type: 'outlier_amount',
          severity: zScore > 3 ? 'high' : 'medium',
          entityType: 'contribuabil',
          entityId: item.id,
          description: `Impozit ${item.taxId.slice(0, 8)}… de ${item.amount.toFixed(2)} RON pentru „${item.name}" este semnificativ diferit de media categoriei ${key.split(':')[1]} (${mean.toFixed(2)} RON, ${zScore.toFixed(1)}σ).`,
          suggestedAction: 'Verificați corectitudinea calculului impozitului.',
        });
      }
    }
  }
}
