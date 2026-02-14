import { PrismaClient } from "@prisma/client";

/**
 * Seed tax rate tables for fiscal year 2025.
 * Based on Romanian Cod Fiscal (Legea 227/2015) base rates.
 */
export async function seedTaxRates2025(prisma: PrismaClient, tenantId: string) {
  // Create HCL Decision for 2025
  let hclDecision = await prisma.hclDecision.findFirst({
    where: { tenantId, fiscalYear: 2025, status: "activ" },
  });

  if (!hclDecision) {
    hclDecision = await prisma.hclDecision.create({
      data: {
        tenantId,
        hclNumber: "38/2024",
        hclDate: new Date("2024-12-10"),
        fiscalYear: 2025,
        title:
          "Hotărârea Consiliului Local nr. 38/2024 privind stabilirea impozitelor și taxelor locale pentru anul fiscal 2025",
        inflationIndex: 1.054,
        validFrom: new Date("2025-01-01"),
        validTo: new Date("2025-12-31"),
        status: "activ",
        approvedBy: "Consiliul Local Bogdan Vodă",
      },
    });
  }

  const hclId = hclDecision.id;

  // Delete existing rate tables for this HCL
  await prisma.taxRateTable.deleteMany({
    where: { tenantId, hclDecisionId: hclId },
  });

  const rates: Array<{
    taxType: string;
    category: string | null;
    zona: string | null;
    rang: number | null;
    rateType: string;
    rateValue: number;
    unit: string | null;
    minRate: number | null;
    maxRate: number | null;
    descriptionRo: string;
    legalArticle: string;
  }> = [
    // =========================================================================
    // VEHICLE RATES — Art. 470 Cod Fiscal
    // =========================================================================

    // Autoturism — lei/200 cmc
    {
      taxType: "impozit_mijloace_transport",
      category: "autoturism_sub_1600",
      zona: null,
      rang: 1,
      rateType: "per_unit",
      rateValue: 8,
      unit: "lei/200cc",
      minRate: 8,
      maxRate: 8,
      descriptionRo: "Autoturism sub 1.600 cmc — 8 lei/200 cmc",
      legalArticle: "Art. 470 alin. (2)",
    },
    {
      taxType: "impozit_mijloace_transport",
      category: "autoturism_1601_2000",
      zona: null,
      rang: 2,
      rateType: "per_unit",
      rateValue: 18,
      unit: "lei/200cc",
      minRate: 18,
      maxRate: 18,
      descriptionRo: "Autoturism 1.601–2.000 cmc — 18 lei/200 cmc",
      legalArticle: "Art. 470 alin. (2)",
    },
    {
      taxType: "impozit_mijloace_transport",
      category: "autoturism_2001_2600",
      zona: null,
      rang: 3,
      rateType: "per_unit",
      rateValue: 72,
      unit: "lei/200cc",
      minRate: 72,
      maxRate: 72,
      descriptionRo: "Autoturism 2.001–2.600 cmc — 72 lei/200 cmc",
      legalArticle: "Art. 470 alin. (2)",
    },
    {
      taxType: "impozit_mijloace_transport",
      category: "autoturism_2601_3000",
      zona: null,
      rang: 4,
      rateType: "per_unit",
      rateValue: 144,
      unit: "lei/200cc",
      minRate: 144,
      maxRate: 144,
      descriptionRo: "Autoturism 2.601–3.000 cmc — 144 lei/200 cmc",
      legalArticle: "Art. 470 alin. (2)",
    },
    {
      taxType: "impozit_mijloace_transport",
      category: "autoturism_peste_3000",
      zona: null,
      rang: 5,
      rateType: "per_unit",
      rateValue: 290,
      unit: "lei/200cc",
      minRate: 290,
      maxRate: 290,
      descriptionRo: "Autoturism peste 3.000 cmc — 290 lei/200 cmc",
      legalArticle: "Art. 470 alin. (2)",
    },

    // Motocicletă
    {
      taxType: "impozit_mijloace_transport",
      category: "motocicleta_sub_200",
      zona: null,
      rang: 6,
      rateType: "fixed",
      rateValue: 8,
      unit: "lei",
      minRate: null,
      maxRate: null,
      descriptionRo: "Motocicletă sub 200 cmc — 8 lei",
      legalArticle: "Art. 470 alin. (2)",
    },
    {
      taxType: "impozit_mijloace_transport",
      category: "motocicleta_201_500",
      zona: null,
      rang: 7,
      rateType: "fixed",
      rateValue: 18,
      unit: "lei",
      minRate: null,
      maxRate: null,
      descriptionRo: "Motocicletă 201–500 cmc — 18 lei",
      legalArticle: "Art. 470 alin. (2)",
    },
    {
      taxType: "impozit_mijloace_transport",
      category: "motocicleta_peste_500",
      zona: null,
      rang: 8,
      rateType: "fixed",
      rateValue: 36,
      unit: "lei",
      minRate: null,
      maxRate: null,
      descriptionRo: "Motocicletă peste 500 cmc — 36 lei",
      legalArticle: "Art. 470 alin. (2)",
    },

    // Autobuz/minibus/microbuz
    {
      taxType: "impozit_mijloace_transport",
      category: "autobuz_sub_22_locuri",
      zona: null,
      rang: 9,
      rateType: "per_unit",
      rateValue: 24,
      unit: "lei/loc",
      minRate: null,
      maxRate: null,
      descriptionRo: "Autobuz/minibus sub 22 locuri — 24 lei/loc",
      legalArticle: "Art. 470 alin. (2)",
    },
    {
      taxType: "impozit_mijloace_transport",
      category: "autobuz_peste_22_locuri",
      zona: null,
      rang: 10,
      rateType: "per_unit",
      rateValue: 30,
      unit: "lei/loc",
      minRate: null,
      maxRate: null,
      descriptionRo: "Autobuz peste 22 locuri — 30 lei/loc",
      legalArticle: "Art. 470 alin. (2)",
    },

    // Camion
    {
      taxType: "impozit_mijloace_transport",
      category: "camion",
      zona: null,
      rang: 11,
      rateType: "per_unit",
      rateValue: 30,
      unit: "lei/tona",
      minRate: null,
      maxRate: null,
      descriptionRo: "Camion — 30 lei/tonă",
      legalArticle: "Art. 470 alin. (2)",
    },

    // =========================================================================
    // BUILDING RATES — Art. 457 Cod Fiscal (Residential)
    // Values: lei/mp suprafață construită desfășurată
    // Construction types × zones
    // =========================================================================

    // Type A — Cadre beton / metal
    ...(["A", "B", "C", "D"] as const).map((z, i) => ({
      taxType: "impozit_cladiri_rezidentiale",
      category: "cadre_beton",
      zona: z,
      rang: null,
      rateType: "per_unit" as const,
      rateValue: [1000, 900, 800, 700][i],
      unit: "lei/mp",
      minRate: null,
      maxRate: null,
      descriptionRo: `Clădiri rezidențiale, cadre beton/metal, zona ${z} — ${[1000, 900, 800, 700][i]} lei/mp`,
      legalArticle: "Art. 457",
    })),

    // Type B — Pereți cărămidă
    ...(["A", "B", "C", "D"] as const).map((z, i) => ({
      taxType: "impozit_cladiri_rezidentiale",
      category: "pereti_caramida",
      zona: z,
      rang: null,
      rateType: "per_unit" as const,
      rateValue: [900, 800, 700, 600][i],
      unit: "lei/mp",
      minRate: null,
      maxRate: null,
      descriptionRo: `Clădiri rezidențiale, pereți cărămidă, zona ${z} — ${[900, 800, 700, 600][i]} lei/mp`,
      legalArticle: "Art. 457",
    })),

    // Type C — Lemn
    ...(["A", "B", "C", "D"] as const).map((z, i) => ({
      taxType: "impozit_cladiri_rezidentiale",
      category: "lemn",
      zona: z,
      rang: null,
      rateType: "per_unit" as const,
      rateValue: [200, 200, 175, 150][i],
      unit: "lei/mp",
      minRate: null,
      maxRate: null,
      descriptionRo: `Clădiri rezidențiale, lemn, zona ${z} — ${[200, 200, 175, 150][i]} lei/mp`,
      legalArticle: "Art. 457",
    })),

    // Type D — Alte materiale
    ...(["A", "B", "C", "D"] as const).map((z, i) => ({
      taxType: "impozit_cladiri_rezidentiale",
      category: "alte_materiale",
      zona: z,
      rang: null,
      rateType: "per_unit" as const,
      rateValue: [100, 100, 75, 50][i],
      unit: "lei/mp",
      minRate: null,
      maxRate: null,
      descriptionRo: `Clădiri rezidențiale, alte materiale, zona ${z} — ${[100, 100, 75, 50][i]} lei/mp`,
      legalArticle: "Art. 457",
    })),

    // Non-residential — percentage of valoare inventar (Art. 458)
    ...(["A", "B", "C", "D"] as const).map((z) => ({
      taxType: "impozit_cladiri_nerezidentiale",
      category: null,
      zona: z,
      rang: null,
      rateType: "percent" as const,
      rateValue: 0.013,
      unit: null,
      minRate: 0.002,
      maxRate: 0.02,
      descriptionRo: `Clădiri nerezidențiale, zona ${z} — 1,3% din valoarea de inventar`,
      legalArticle: "Art. 458",
    })),

    // =========================================================================
    // LAND RATES — Art. 465 Cod Fiscal
    // =========================================================================

    // Intravilan — lei/mp
    // Residential (curți construcții)
    ...(["A", "B", "C", "D"] as const).map((z, i) => ({
      taxType: "impozit_teren_intravilan",
      category: "intravilan_curti",
      zona: z,
      rang: null,
      rateType: "per_unit" as const,
      rateValue: [1.5, 1.1, 0.8, 0.5][i],
      unit: "lei/mp",
      minRate: null,
      maxRate: null,
      descriptionRo: `Teren intravilan curți construcții, zona ${z} — ${[1.5, 1.1, 0.8, 0.5][i]} lei/mp`,
      legalArticle: "Art. 465",
    })),

    // Intravilan — arabil
    ...(["A", "B", "C", "D"] as const).map((z, i) => ({
      taxType: "impozit_teren_intravilan",
      category: "intravilan_arabil",
      zona: z,
      rang: null,
      rateType: "per_unit" as const,
      rateValue: [0.30, 0.25, 0.20, 0.15][i],
      unit: "lei/mp",
      minRate: null,
      maxRate: null,
      descriptionRo: `Teren intravilan arabil, zona ${z} — ${[0.30, 0.25, 0.20, 0.15][i]} lei/mp`,
      legalArticle: "Art. 465",
    })),

    // Intravilan — commercial
    ...(["A", "B", "C", "D"] as const).map((z, i) => ({
      taxType: "impozit_teren_intravilan",
      category: "intravilan_comercial",
      zona: z,
      rang: null,
      rateType: "per_unit" as const,
      rateValue: [2.0, 1.5, 1.0, 0.7][i],
      unit: "lei/mp",
      minRate: null,
      maxRate: null,
      descriptionRo: `Teren intravilan comercial, zona ${z} — ${[2.0, 1.5, 1.0, 0.7][i]} lei/mp`,
      legalArticle: "Art. 465",
    })),

    // Intravilan — industrial
    ...(["A", "B", "C", "D"] as const).map((z, i) => ({
      taxType: "impozit_teren_intravilan",
      category: "intravilan_industrial",
      zona: z,
      rang: null,
      rateType: "per_unit" as const,
      rateValue: [1.8, 1.3, 0.9, 0.6][i],
      unit: "lei/mp",
      minRate: null,
      maxRate: null,
      descriptionRo: `Teren intravilan industrial, zona ${z} — ${[1.8, 1.3, 0.9, 0.6][i]} lei/mp`,
      legalArticle: "Art. 465",
    })),

    // Extravilan — lei/ha
    {
      taxType: "impozit_teren_extravilan",
      category: "extravilan_arabil",
      zona: null,
      rang: 1,
      rateType: "per_unit",
      rateValue: 50,
      unit: "lei/ha",
      minRate: null,
      maxRate: null,
      descriptionRo: "Teren extravilan arabil — 50 lei/ha",
      legalArticle: "Art. 465",
    },
    {
      taxType: "impozit_teren_extravilan",
      category: "extravilan_pasuni",
      zona: null,
      rang: 2,
      rateType: "per_unit",
      rateValue: 28,
      unit: "lei/ha",
      minRate: null,
      maxRate: null,
      descriptionRo: "Teren extravilan pășuni — 28 lei/ha",
      legalArticle: "Art. 465",
    },
    {
      taxType: "impozit_teren_extravilan",
      category: "extravilan_paduri",
      zona: null,
      rang: 3,
      rateType: "per_unit",
      rateValue: 16,
      unit: "lei/ha",
      minRate: null,
      maxRate: null,
      descriptionRo: "Teren extravilan păduri — 16 lei/ha",
      legalArticle: "Art. 465",
    },
    {
      taxType: "impozit_teren_extravilan",
      category: "extravilan_vii",
      zona: null,
      rang: 4,
      rateType: "per_unit",
      rateValue: 55,
      unit: "lei/ha",
      minRate: null,
      maxRate: null,
      descriptionRo: "Teren extravilan vii/livezi — 55 lei/ha",
      legalArticle: "Art. 465",
    },
    {
      taxType: "impozit_teren_extravilan",
      category: "extravilan_ape",
      zona: null,
      rang: 5,
      rateType: "per_unit",
      rateValue: 6,
      unit: "lei/ha",
      minRate: null,
      maxRate: null,
      descriptionRo: "Teren extravilan ape/bălți — 6 lei/ha",
      legalArticle: "Art. 465",
    },
    {
      taxType: "impozit_teren_extravilan",
      category: "extravilan_neproductiv",
      zona: null,
      rang: 6,
      rateType: "per_unit",
      rateValue: 1,
      unit: "lei/ha",
      minRate: null,
      maxRate: null,
      descriptionRo: "Teren extravilan neproductiv — 1 leu/ha",
      legalArticle: "Art. 465",
    },
  ];

  for (const rt of rates) {
    await prisma.taxRateTable.create({
      data: {
        tenantId,
        hclDecisionId: hclId,
        taxType: rt.taxType,
        category: rt.category,
        zona: rt.zona,
        rang: rt.rang,
        rateType: rt.rateType,
        rateValue: rt.rateValue,
        unit: rt.unit,
        minRate: rt.minRate,
        maxRate: rt.maxRate,
        descriptionRo: rt.descriptionRo,
        legalArticle: rt.legalArticle,
      },
    });
  }

  console.log(
    `Seeded HCL Decision ${hclDecision.hclNumber} with ${rates.length} tax rate tables for 2025`
  );
}
