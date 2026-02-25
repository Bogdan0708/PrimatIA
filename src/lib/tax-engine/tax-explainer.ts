import { prisma } from "@/lib/db";
import { getBuildingAgeCoefficient } from "@/lib/tax-engine/utils";
import { getCommuneRankMultiplier } from "@/lib/tax-engine/building-tax";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExplanationStep {
  label: string;
  value: string;
  detail?: string;
  legalBasis?: string;
}

export interface TaxExplanation {
  taxTypeLabel: string;
  fiscalYear: number;
  propertyDescription: string;
  steps: ExplanationStep[];
  totalOwed: number;
  installments: { rata1: number; rata2: number; rata1Due: string; rata2Due: string };
  bonificatie: number;
  hclReference: string | null;
}

// ---------------------------------------------------------------------------
// Legal basis citations
// ---------------------------------------------------------------------------

const LEGAL_CITATIONS: Record<string, string> = {
  impozit_cladiri_rezidentiale: "Art. 457 Cod Fiscal",
  impozit_cladiri_nerezidentiale: "Art. 458 Cod Fiscal",
  impozit_cladiri_mixte: "Art. 459 Cod Fiscal",
  impozit_teren_curti: "Art. 465 Cod Fiscal",
  impozit_teren_intravilan: "Art. 465 Cod Fiscal",
  impozit_teren_extravilan: "Art. 465 Cod Fiscal",
  impozit_mijloace_transport: "Art. 470 Cod Fiscal",
  bonificatie: "Art. 462 Cod Fiscal",
  proration: "Art. 461 Cod Fiscal",
  age_coefficient: "Art. 457 alin. (6) Cod Fiscal",
  zone_multiplier: "Art. 457 alin. (7) Cod Fiscal",
  pj_revaluation: "Art. 460 Cod Fiscal",
  installments: "Art. 462 alin. (2) Cod Fiscal",
  rounding: "Art. 489 Cod Fiscal",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtLei(v: number): string {
  return `${v.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} lei`;
}

function fmtDate(d: Date): string {
  const day = d.getDate().toString().padStart(2, "0");
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  return `${day}.${month}.${d.getFullYear()}`;
}

function fmtPercent(v: number): string {
  return `${v.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}%`;
}

function formatAddress(adresa: {
  strada?: string | null;
  numar?: string | null;
  bloc?: string | null;
  scara?: string | null;
  apartament?: string | null;
  localitate: string;
}): string {
  const parts: string[] = [];
  if (adresa.strada) {
    let str = `Str. ${adresa.strada}`;
    if (adresa.numar) str += ` nr. ${adresa.numar}`;
    if (adresa.bloc) str += `, bl. ${adresa.bloc}`;
    if (adresa.scara) str += `, sc. ${adresa.scara}`;
    if (adresa.apartament) str += `, ap. ${adresa.apartament}`;
    parts.push(str);
  }
  parts.push(adresa.localitate);
  return parts.join(", ");
}

// ---------------------------------------------------------------------------
// Main explanation generator
// ---------------------------------------------------------------------------

export async function generateTaxExplanation(impozitId: string): Promise<TaxExplanation | null> {
  const impozit = await prisma.impozit.findUnique({
    where: { id: impozitId },
    include: {
      taxType: true,
      hclDecision: true,
      rateTable: true,
      contribuabil: { select: { tip: true, nume: true, prenume: true } },
    },
  });

  if (!impozit) return null;

  // Load exemptions for this tax
  const exemptions = await prisma.scutireContribuabil.findMany({
    where: {
      tenantId: impozit.tenantId,
      contribuabilId: impozit.contribuabilId,
      fiscalYear: impozit.fiscalYear,
      status: "approved",
      OR: [
        { proprietateType: null },
        {
          proprietateType: impozit.proprietateType ?? undefined,
          proprietateId: impozit.proprietateId ?? undefined,
        },
      ],
    },
    include: { scutireRegula: true },
  });

  // Load tenant for commune rank
  const tenant = await prisma.tenant.findUnique({
    where: { id: impozit.tenantId },
    select: { communeRank: true, name: true },
  });

  const hclRef = impozit.hclDecision
    ? `HCL ${impozit.hclDecision.hclNumber}/${fmtDate(impozit.hclDecision.hclDate)}`
    : null;

  const taxTypeCode = impozit.taxType.code;
  const taxTypeName = (impozit.taxType.name as Record<string, string>)?.ro || taxTypeCode;

  // Dispatch to specific explainer based on property type
  if (impozit.proprietateType === "cladire" && impozit.proprietateId) {
    return explainBuildingTax(impozit, taxTypeName, taxTypeCode, hclRef, exemptions, tenant);
  }
  if (impozit.proprietateType === "teren" && impozit.proprietateId) {
    return explainLandTax(impozit, taxTypeName, taxTypeCode, hclRef, exemptions);
  }
  if (impozit.proprietateType === "vehicul" && impozit.proprietateId) {
    return explainVehicleTax(impozit, taxTypeName, taxTypeCode, hclRef, exemptions);
  }

  // Generic fallback for taxes without a linked property
  return explainGenericTax(impozit, taxTypeName, hclRef);
}

// ---------------------------------------------------------------------------
// Building tax explanation
// ---------------------------------------------------------------------------

type ImpozitWithRelations = NonNullable<Awaited<ReturnType<typeof prisma.impozit.findUnique>> & {
  taxType: { code: string; name: unknown };
  hclDecision: { hclNumber: string; hclDate: Date } | null;
  rateTable: { unit?: string | null; category?: string | null; zona?: string | null; descriptionRo?: string | null; legalArticle?: string | null } | null;
  contribuabil: { tip: string; nume: string; prenume: string | null };
}>;

type ExemptionWithRule = {
  scutireRegula: { nameRo: string; legalBasis: string; discountPercent: unknown };
};

async function explainBuildingTax(
  impozit: ImpozitWithRelations,
  taxTypeName: string,
  taxTypeCode: string,
  hclRef: string | null,
  exemptions: ExemptionWithRule[],
  tenant: { communeRank: number; name: string } | null,
): Promise<TaxExplanation> {
  const building = await prisma.proprietateCladire.findUnique({
    where: { id: impozit.proprietateId! },
    include: { adresa: true },
  });

  const steps: ExplanationStep[] = [];
  const bazaImpozabila = Number(impozit.bazaImpozabila);
  const rataAplicata = Number(impozit.rataAplicata);
  const isPJ = impozit.contribuabil.tip === "PJ";

  // Property description
  const destinatieLabel: Record<string, string> = {
    rezidentiala: "rezidențială",
    nerezidentiala: "nerezidențială",
    mixta: "mixtă",
  };
  const propertyDesc = building
    ? `Clădire ${destinatieLabel[building.destinatie] || building.destinatie} — ${formatAddress(building.adresa)}, Zona ${building.zona}`
    : `Clădire (${impozit.proprietateId})`;

  // Step 1: Taxable base
  if (isPJ) {
    steps.push({
      label: "Valoare inventar",
      value: fmtLei(bazaImpozabila),
      detail: "Valoare contabilă conform evidenței PJ",
      legalBasis: LEGAL_CITATIONS.pj_revaluation,
    });
  } else {
    steps.push({
      label: "Valoare impozabilă",
      value: fmtLei(bazaImpozabila),
      detail: building
        ? `${Number(building.suprafataConstruita).toLocaleString("ro-RO")} mp × valoare unitară`
        : undefined,
      legalBasis: LEGAL_CITATIONS[taxTypeCode],
    });
  }

  // Step 2: Tax rate
  steps.push({
    label: "Cotă impozit",
    value: fmtPercent(rataAplicata),
    detail: hclRef ? `Stabilită prin ${hclRef}` : undefined,
    legalBasis: LEGAL_CITATIONS[taxTypeCode],
  });

  // Step 3: Base calculation
  const sumaPreCoeff = bazaImpozabila * (rataAplicata / 100);
  steps.push({
    label: "Impozit brut",
    value: fmtLei(sumaPreCoeff),
    detail: `${fmtLei(bazaImpozabila)} × ${fmtPercent(rataAplicata)}`,
  });

  // Step 4: Age coefficient (PF only)
  if (!isPJ && building) {
    const ageCoeff = getBuildingAgeCoefficient(building.anConstructie, impozit.fiscalYear);
    if (ageCoeff !== 1.0) {
      const age = impozit.fiscalYear - building.anConstructie;
      steps.push({
        label: "Coeficient vechime",
        value: `× ${ageCoeff.toFixed(2)}`,
        detail: `Clădire construită în ${building.anConstructie} (${age} ani)`,
        legalBasis: LEGAL_CITATIONS.age_coefficient,
      });
    }
  }

  // Step 5: Zone multiplier
  if (tenant) {
    const zoneMultiplier = getCommuneRankMultiplier(tenant.communeRank as 0 | 1 | 2 | 3 | 4 | 5);
    if (zoneMultiplier !== 1.0) {
      steps.push({
        label: "Coeficient rang localitate",
        value: `× ${zoneMultiplier.toFixed(1)}`,
        detail: `Rang ${tenant.communeRank}`,
        legalBasis: LEGAL_CITATIONS.zone_multiplier,
      });
    }
  }

  // Step 6: Co-ownership
  if (building && Number(building.cotaParte) < 100) {
    steps.push({
      label: "Cotă parte proprietate",
      value: `× ${Number(building.cotaParte).toFixed(2)}%`,
      detail: `Coproprietate cu ${building.nrProprietari} proprietari`,
    });
  }

  // Step 7: Proration
  if (impozit.nrLuni < 12) {
    steps.push({
      label: "Luni deținere",
      value: `${impozit.nrLuni}/12`,
      detail: impozit.dataStartCalcul && impozit.dataStopCalcul
        ? `${fmtDate(impozit.dataStartCalcul)} — ${fmtDate(impozit.dataStopCalcul)}`
        : undefined,
      legalBasis: LEGAL_CITATIONS.proration,
    });
  }

  // Step 8: Calculated amount (before exemptions)
  steps.push({
    label: "Impozit calculat",
    value: fmtLei(Number(impozit.sumaCalculata)),
    legalBasis: LEGAL_CITATIONS.rounding,
  });

  // Step 9: Exemptions
  addExemptionSteps(steps, exemptions, Number(impozit.sumaScutire));

  // Step 10: Final amount
  steps.push({
    label: "Total datorat",
    value: fmtLei(Number(impozit.sumaDatorata)),
  });

  return {
    taxTypeLabel: taxTypeName,
    fiscalYear: impozit.fiscalYear,
    propertyDescription: propertyDesc,
    steps,
    totalOwed: Number(impozit.sumaDatorata),
    installments: {
      rata1: Number(impozit.rata1),
      rata2: Number(impozit.rata2),
      rata1Due: fmtDate(impozit.rata1Scadenta),
      rata2Due: fmtDate(impozit.rata2Scadenta),
    },
    bonificatie: Number(impozit.bonificatie),
    hclReference: hclRef,
  };
}

// ---------------------------------------------------------------------------
// Land tax explanation
// ---------------------------------------------------------------------------

async function explainLandTax(
  impozit: ImpozitWithRelations,
  taxTypeName: string,
  taxTypeCode: string,
  hclRef: string | null,
  exemptions: ExemptionWithRule[],
): Promise<TaxExplanation> {
  const land = await prisma.proprietateTeren.findUnique({
    where: { id: impozit.proprietateId! },
    include: { adresa: true },
  });

  const steps: ExplanationStep[] = [];
  const bazaImpozabila = Number(impozit.bazaImpozabila);
  const rataAplicata = Number(impozit.rataAplicata);

  const categorieLabels: Record<string, string> = {
    intravilan_curti: "Intravilan — curți construcții",
    intravilan_arabil: "Intravilan — arabil",
    intravilan_pasuni: "Intravilan — pășuni",
    intravilan_paduri: "Intravilan — păduri",
    intravilan_ape: "Intravilan — ape",
    intravilan_drumuri: "Intravilan — drumuri",
    intravilan_neproductiv: "Intravilan — neproductiv",
    extravilan_arabil: "Extravilan — arabil",
    extravilan_pasuni: "Extravilan — pășuni",
    extravilan_paduri: "Extravilan — păduri",
    extravilan_ape: "Extravilan — ape",
    extravilan_drumuri: "Extravilan — drumuri",
    extravilan_neproductiv: "Extravilan — neproductiv",
  };

  const propertyDesc = land
    ? `Teren ${categorieLabels[land.categorie] || land.categorie} — ${land.adresa ? formatAddress(land.adresa) : ""}, Zona ${land.zona}`
    : `Teren (${impozit.proprietateId})`;

  // Step 1: Area
  steps.push({
    label: "Suprafață",
    value: `${bazaImpozabila.toLocaleString("ro-RO")} mp`,
    detail: land?.suprafataHa ? `(${Number(land.suprafataHa).toLocaleString("ro-RO")} ha)` : undefined,
    legalBasis: LEGAL_CITATIONS[taxTypeCode],
  });

  // Step 2: Rate
  const unit = impozit.rateTable?.unit || "lei/mp";
  steps.push({
    label: "Cotă impozit",
    value: `${rataAplicata.toLocaleString("ro-RO")} ${unit}`,
    detail: hclRef ? `Stabilită prin ${hclRef}` : undefined,
    legalBasis: LEGAL_CITATIONS[taxTypeCode],
  });

  // Step 3: Base calculation
  if (unit === "lei/ha") {
    steps.push({
      label: "Impozit brut",
      value: fmtLei(Number(impozit.sumaCalculata)),
      detail: `(${bazaImpozabila.toLocaleString("ro-RO")} mp / 10.000) × ${rataAplicata.toLocaleString("ro-RO")} lei/ha`,
    });
  } else {
    steps.push({
      label: "Impozit brut",
      value: fmtLei(bazaImpozabila * rataAplicata),
      detail: `${bazaImpozabila.toLocaleString("ro-RO")} mp × ${rataAplicata.toLocaleString("ro-RO")} lei/mp`,
    });
  }

  // Step 4: Co-ownership
  if (land && Number(land.cotaParte) < 100) {
    steps.push({
      label: "Cotă parte proprietate",
      value: `× ${Number(land.cotaParte).toFixed(2)}%`,
    });
  }

  // Step 5: Proration
  if (impozit.nrLuni < 12) {
    steps.push({
      label: "Luni deținere",
      value: `${impozit.nrLuni}/12`,
      detail: impozit.dataStartCalcul && impozit.dataStopCalcul
        ? `${fmtDate(impozit.dataStartCalcul)} — ${fmtDate(impozit.dataStopCalcul)}`
        : undefined,
      legalBasis: LEGAL_CITATIONS.proration,
    });
  }

  // Step 6: Calculated amount
  steps.push({
    label: "Impozit calculat",
    value: fmtLei(Number(impozit.sumaCalculata)),
    legalBasis: LEGAL_CITATIONS.rounding,
  });

  // Step 7: Exemptions
  addExemptionSteps(steps, exemptions, Number(impozit.sumaScutire));

  // Step 8: Final
  steps.push({
    label: "Total datorat",
    value: fmtLei(Number(impozit.sumaDatorata)),
  });

  return {
    taxTypeLabel: taxTypeName,
    fiscalYear: impozit.fiscalYear,
    propertyDescription: propertyDesc,
    steps,
    totalOwed: Number(impozit.sumaDatorata),
    installments: {
      rata1: Number(impozit.rata1),
      rata2: Number(impozit.rata2),
      rata1Due: fmtDate(impozit.rata1Scadenta),
      rata2Due: fmtDate(impozit.rata2Scadenta),
    },
    bonificatie: Number(impozit.bonificatie),
    hclReference: hclRef,
  };
}

// ---------------------------------------------------------------------------
// Vehicle tax explanation
// ---------------------------------------------------------------------------

async function explainVehicleTax(
  impozit: ImpozitWithRelations,
  taxTypeName: string,
  taxTypeCode: string,
  hclRef: string | null,
  exemptions: ExemptionWithRule[],
): Promise<TaxExplanation> {
  const vehicle = await prisma.proprietateVehicul.findUnique({
    where: { id: impozit.proprietateId! },
  });

  const steps: ExplanationStep[] = [];
  const bazaImpozabila = Number(impozit.bazaImpozabila);
  const rataAplicata = Number(impozit.rataAplicata);

  const tipLabels: Record<string, string> = {
    autoturism: "Autoturism",
    motocicleta: "Motocicletă",
    autobuz: "Autobuz",
    camion: "Camion",
    remorca: "Remorcă",
    tractor: "Tractor",
  };

  const propertyDesc = vehicle
    ? `${tipLabels[vehicle.tipVehicul] || vehicle.tipVehicul}${vehicle.marca ? ` ${vehicle.marca}` : ""}${vehicle.model ? ` ${vehicle.model}` : ""} (${vehicle.anFabricatie})${vehicle.numarInmatriculare ? ` — ${vehicle.numarInmatriculare}` : ""}`
    : `Vehicul (${impozit.proprietateId})`;

  const isWeightTable = impozit.rateTableId?.startsWith("weight_table_") ?? false;

  if (vehicle?.tipVehicul === "autoturism") {
    const cmc = vehicle.cilindreeCmc ?? 0;
    const units = Math.ceil(cmc / 200);
    steps.push({
      label: "Cilindree",
      value: `${cmc} cm³`,
      detail: `${units} fracțiuni de 200 cm³`,
      legalBasis: LEGAL_CITATIONS[taxTypeCode],
    });
    steps.push({
      label: "Cotă per fracțiune",
      value: fmtLei(rataAplicata),
      detail: hclRef ? `Stabilită prin ${hclRef}` : undefined,
    });
    steps.push({
      label: "Impozit brut",
      value: fmtLei(units * rataAplicata),
      detail: `${units} × ${fmtLei(rataAplicata)}`,
    });
  } else if (vehicle?.tipVehicul === "motocicleta") {
    steps.push({
      label: "Cilindree",
      value: `${vehicle.cilindreeCmc ?? 0} cm³`,
      legalBasis: LEGAL_CITATIONS[taxTypeCode],
    });
    steps.push({
      label: "Cotă fixă",
      value: fmtLei(rataAplicata),
      detail: hclRef ? `Stabilită prin ${hclRef}` : undefined,
    });
  } else if (vehicle?.tipVehicul === "autobuz") {
    steps.push({
      label: "Număr locuri",
      value: `${vehicle.nrLocuri ?? 0}`,
      legalBasis: LEGAL_CITATIONS[taxTypeCode],
    });
    steps.push({
      label: "Cotă per loc",
      value: fmtLei(rataAplicata),
      detail: hclRef ? `Stabilită prin ${hclRef}` : undefined,
    });
    steps.push({
      label: "Impozit brut",
      value: fmtLei(bazaImpozabila * rataAplicata),
      detail: `${vehicle.nrLocuri ?? 0} locuri × ${fmtLei(rataAplicata)}`,
    });
  } else if (isWeightTable) {
    // Truck/trailer with weight table
    steps.push({
      label: "Masă totală autorizată",
      value: `${bazaImpozabila.toLocaleString("ro-RO")} tone`,
      detail: vehicle?.masaTotalaKg ? `(${vehicle.masaTotalaKg.toLocaleString("ro-RO")} kg)` : undefined,
      legalBasis: LEGAL_CITATIONS[taxTypeCode],
    });
    steps.push({
      label: "Impozit din tabelul axe/greutate",
      value: fmtLei(rataAplicata),
      detail: `Art. 470 Cod Fiscal — tabel greutăți`,
    });
  } else {
    // Generic: flat rate or per-ton
    steps.push({
      label: "Baza de calcul",
      value: bazaImpozabila === 1 ? "Cotă fixă" : `${bazaImpozabila.toLocaleString("ro-RO")} tone`,
      legalBasis: LEGAL_CITATIONS[taxTypeCode],
    });
    steps.push({
      label: "Cotă impozit",
      value: fmtLei(rataAplicata),
      detail: hclRef ? `Stabilită prin ${hclRef}` : undefined,
    });
  }

  // Euro norm adjustment
  if (!isWeightTable && vehicle?.normaPoluare) {
    const euroLabels: Record<string, string> = {
      non_euro: "Non-Euro (+50%)",
      euro_1: "Euro 1 (+30%)",
      euro_2: "Euro 2 (+20%)",
      euro_3: "Euro 3 (+10%)",
      euro_4: "Euro 4 (standard)",
      euro_5: "Euro 5 (-5%)",
      euro_6: "Euro 6 (-10%)",
    };
    const euroAdjustments: Record<string, number> = {
      non_euro: 1.5, euro_1: 1.3, euro_2: 1.2, euro_3: 1.1,
      euro_4: 1.0, euro_5: 0.95, euro_6: 0.9,
    };
    const adj = euroAdjustments[vehicle.normaPoluare] ?? 1.0;
    if (adj !== 1.0) {
      steps.push({
        label: "Normă poluare",
        value: `× ${adj.toFixed(2)}`,
        detail: euroLabels[vehicle.normaPoluare] || vehicle.normaPoluare,
      });
    }
  }

  // Proration
  if (impozit.nrLuni < 12) {
    steps.push({
      label: "Luni deținere",
      value: `${impozit.nrLuni}/12`,
      detail: impozit.dataStartCalcul && impozit.dataStopCalcul
        ? `${fmtDate(impozit.dataStartCalcul)} — ${fmtDate(impozit.dataStopCalcul)}`
        : undefined,
      legalBasis: LEGAL_CITATIONS.proration,
    });
  }

  // Calculated amount
  steps.push({
    label: "Impozit calculat",
    value: fmtLei(Number(impozit.sumaCalculata)),
    legalBasis: LEGAL_CITATIONS.rounding,
  });

  // Exemptions
  addExemptionSteps(steps, exemptions, Number(impozit.sumaScutire));

  // Final
  steps.push({
    label: "Total datorat",
    value: fmtLei(Number(impozit.sumaDatorata)),
  });

  return {
    taxTypeLabel: taxTypeName,
    fiscalYear: impozit.fiscalYear,
    propertyDescription: propertyDesc,
    steps,
    totalOwed: Number(impozit.sumaDatorata),
    installments: {
      rata1: Number(impozit.rata1),
      rata2: Number(impozit.rata2),
      rata1Due: fmtDate(impozit.rata1Scadenta),
      rata2Due: fmtDate(impozit.rata2Scadenta),
    },
    bonificatie: Number(impozit.bonificatie),
    hclReference: hclRef,
  };
}

// ---------------------------------------------------------------------------
// Generic tax explanation (no linked property)
// ---------------------------------------------------------------------------

function explainGenericTax(
  impozit: ImpozitWithRelations,
  taxTypeName: string,
  hclRef: string | null,
): TaxExplanation {
  const steps: ExplanationStep[] = [];

  steps.push({
    label: "Baza impozabilă",
    value: fmtLei(Number(impozit.bazaImpozabila)),
  });

  steps.push({
    label: "Cotă impozit",
    value: fmtPercent(Number(impozit.rataAplicata)),
    detail: hclRef ? `Stabilită prin ${hclRef}` : undefined,
  });

  steps.push({
    label: "Impozit calculat",
    value: fmtLei(Number(impozit.sumaCalculata)),
  });

  if (Number(impozit.sumaScutire) > 0) {
    steps.push({
      label: "Scutire",
      value: `− ${fmtLei(Number(impozit.sumaScutire))}`,
    });
  }

  steps.push({
    label: "Total datorat",
    value: fmtLei(Number(impozit.sumaDatorata)),
  });

  return {
    taxTypeLabel: taxTypeName,
    fiscalYear: impozit.fiscalYear,
    propertyDescription: "",
    steps,
    totalOwed: Number(impozit.sumaDatorata),
    installments: {
      rata1: Number(impozit.rata1),
      rata2: Number(impozit.rata2),
      rata1Due: fmtDate(impozit.rata1Scadenta),
      rata2Due: fmtDate(impozit.rata2Scadenta),
    },
    bonificatie: Number(impozit.bonificatie),
    hclReference: hclRef,
  };
}

// ---------------------------------------------------------------------------
// Shared: Add exemption steps
// ---------------------------------------------------------------------------

function addExemptionSteps(
  steps: ExplanationStep[],
  exemptions: ExemptionWithRule[],
  totalExemption: number,
): void {
  if (totalExemption <= 0 && exemptions.length === 0) return;

  for (const ex of exemptions) {
    steps.push({
      label: `Scutire: ${ex.scutireRegula.nameRo}`,
      value: `− ${Number(ex.scutireRegula.discountPercent).toFixed(0)}%`,
      legalBasis: ex.scutireRegula.legalBasis,
    });
  }

  if (totalExemption > 0) {
    steps.push({
      label: "Total scutiri",
      value: `− ${fmtLei(totalExemption)}`,
    });
  }
}
