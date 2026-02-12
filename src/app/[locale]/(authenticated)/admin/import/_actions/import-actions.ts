"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { setTenantContext } from "@/lib/db";
import { revalidatePath } from "next/cache";

type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

// ============================================================================
// IMPORT BATCHES — LIST
// ============================================================================

export async function getImportBatches(
  params: { status?: string; entityType?: string } = {}
) {
  const session = await auth();
  if (!session?.user?.tenantId) throw new Error("No tenant context");
  await setTenantContext(session.user.tenantId);

  const where: Record<string, unknown> = { tenantId: session.user.tenantId };
  if (params.status) where.status = params.status;
  if (params.entityType) where.entityType = params.entityType;

  return prisma.importBatch.findMany({
    where: where as any,
    include: {
      importedBy: {
        select: { id: true, firstName: true, lastName: true },
      },
      rollbackBy: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

// ============================================================================
// IMPORT BATCHES — GET BY ID
// ============================================================================

export async function getImportBatchById(id: string) {
  const session = await auth();
  if (!session?.user?.tenantId) throw new Error("No tenant context");
  await setTenantContext(session.user.tenantId);

  return prisma.importBatch.findFirst({
    where: { id, tenantId: session.user.tenantId },
    include: {
      importedBy: {
        select: { id: true, firstName: true, lastName: true },
      },
      rollbackBy: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
  });
}

// ============================================================================
// CSV PARSING UTILITIES
// ============================================================================

function parseCSV(content: string): { headers: string[]; rows: string[][] } {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  // Detect delimiter: semicolon (common in RO) or comma
  const firstLine = lines[0];
  const delimiter = firstLine.includes(";") ? ";" : ",";

  const parseLine = (line: string): string[] => {
    const fields: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
          // Escaped quote
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        fields.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    fields.push(current.trim());
    return fields;
  };

  const headers = parseLine(lines[0]).map((h) => h.toLowerCase().trim());
  const rows = lines.slice(1).map(parseLine);

  return { headers, rows };
}

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/**
 * Validate Romanian CNP (Cod Numeric Personal) checksum.
 * 13-digit number with a check digit at position 13.
 */
function validateCNP(cnp: string): boolean {
  if (!/^\d{13}$/.test(cnp)) return false;

  const weights = [2, 7, 9, 1, 4, 6, 3, 5, 8, 2, 7, 9];
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cnp[i]) * weights[i];
  }
  let checkDigit = sum % 11;
  if (checkDigit === 10) checkDigit = 1;

  return checkDigit === parseInt(cnp[12]);
}

/**
 * Validate Romanian CUI (Cod Unic de Identificare).
 * Strips the "RO" prefix if present and validates the check digit.
 */
function validateCUI(cuiRaw: string): boolean {
  const cui = cuiRaw.replace(/^RO/i, "").trim();
  if (!/^\d{2,10}$/.test(cui)) return false;

  const weights = [7, 5, 3, 2, 1, 7, 5, 3, 2];
  const digits = cui.split("").map(Number);
  const checkDigit = digits.pop()!;
  const padded = digits;

  // Pad to 9 digits from the left
  while (padded.length < 9) {
    padded.unshift(0);
  }

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += padded[i] * weights[i];
  }

  let computed = (sum * 10) % 11;
  if (computed === 10) computed = 0;

  return computed === checkDigit;
}

interface ImportRowError {
  row: number;
  field: string;
  value: string;
  error: string;
}

interface ImportSummary {
  batchId: string;
  filename: string;
  entityType: string;
  totalRows: number;
  importedRows: number;
  errorRows: number;
  errors: ImportRowError[];
}

// ============================================================================
// IMPORT — CREATE BATCH (CSV upload and parse)
// ============================================================================

export async function createImportBatch(
  formData: FormData
): Promise<ActionResult<ImportSummary>> {
  const session = await auth();
  if (!session?.user?.tenantId)
    return { success: false, error: "No tenant context" };
  await setTenantContext(session.user.tenantId);

  try {
    const file = formData.get("file") as File;
    const entityType = formData.get("entityType") as string;

    if (!file || !entityType) {
      return {
        success: false,
        error: "Fisierul si tipul de entitate sunt obligatorii",
      };
    }

    const allowedTypes = ["contribuabil", "proprietate_cladire", "proprietate_teren", "proprietate_vehicul"];
    if (!allowedTypes.includes(entityType)) {
      return {
        success: false,
        error: `Tip entitate invalid. Tipuri acceptate: ${allowedTypes.join(", ")}`,
      };
    }

    // Read file content
    const content = await file.text();
    const { headers, rows } = parseCSV(content);

    if (headers.length === 0 || rows.length === 0) {
      return {
        success: false,
        error: "Fisierul este gol sau nu contine date valide",
      };
    }

    // Create the batch record first
    const batch = await prisma.importBatch.create({
      data: {
        tenantId: session.user.tenantId,
        filename: file.name,
        entityType,
        totalRows: rows.length,
        importedRows: 0,
        errorRows: 0,
        status: "processing",
        importedById: session.user.id,
        errorLog: [],
      },
    });

    // Process rows based on entity type
    let importedCount = 0;
    let errorCount = 0;
    const errors: ImportRowError[] = [];

    if (entityType === "contribuabil") {
      const result = await importContribuabili(
        session.user.tenantId,
        headers,
        rows,
        batch.id
      );
      importedCount = result.imported;
      errorCount = result.errors.length;
      errors.push(...result.errors);
    } else if (entityType === "proprietate_cladire") {
      const result = await importProprietatiCladiri(
        session.user.tenantId,
        headers,
        rows,
        batch.id
      );
      importedCount = result.imported;
      errorCount = result.errors.length;
      errors.push(...result.errors);
    } else if (entityType === "proprietate_teren") {
      const result = await importProprietatiTerenuri(
        session.user.tenantId,
        headers,
        rows,
        batch.id
      );
      importedCount = result.imported;
      errorCount = result.errors.length;
      errors.push(...result.errors);
    } else if (entityType === "proprietate_vehicul") {
      const result = await importProprietatiVehicule(
        session.user.tenantId,
        headers,
        rows,
        batch.id
      );
      importedCount = result.imported;
      errorCount = result.errors.length;
      errors.push(...result.errors);
    }

    // Update batch with results
    await prisma.importBatch.update({
      where: { id: batch.id },
      data: {
        importedRows: importedCount,
        errorRows: errorCount,
        status: errorCount > 0 && importedCount > 0
          ? "completed_with_errors"
          : errorCount > 0 && importedCount === 0
            ? "failed"
            : "completed",
        errorLog: errors as any,
        completedAt: new Date(),
      },
    });

    revalidatePath("/admin/import");
    return {
      success: true,
      data: {
        batchId: batch.id,
        filename: file.name,
        entityType,
        totalRows: rows.length,
        importedRows: importedCount,
        errorRows: errorCount,
        errors,
      },
    };
  } catch (error) {
    console.error("Error creating import batch:", error);
    return { success: false, error: "Eroare la importul datelor" };
  }
}

// ============================================================================
// IMPORT — CONTRIBUABILI
// ============================================================================

async function importContribuabili(
  tenantId: string,
  headers: string[],
  rows: string[][],
  batchId: string
): Promise<{ imported: number; errors: ImportRowError[] }> {
  const errors: ImportRowError[] = [];
  let imported = 0;

  // Map header names to indices (support common Romanian column names)
  const colMap = buildColumnMap(headers, {
    tip: ["tip", "tip_contribuabil", "type"],
    nume: ["nume", "denumire", "name"],
    prenume: ["prenume", "first_name"],
    cnp: ["cnp", "cod_numeric_personal"],
    cui: ["cui", "cod_fiscal", "cif"],
    telefon: ["telefon", "phone", "tel"],
    email: ["email", "e-mail"],
    cod_rol: ["cod_rol", "codrol", "rol"],
    nr_dosar_fiscal: ["nr_dosar_fiscal", "dosar_fiscal"],
    reprezentant_legal: ["reprezentant_legal", "reprezentant"],
    nr_registru_comert: ["nr_registru_comert", "reg_comert"],
    strada: ["strada", "str"],
    numar: ["numar", "nr"],
    localitate: ["localitate", "oras", "comuna"],
    judet: ["judet", "county"],
    cod_postal: ["cod_postal", "zip"],
    zona_fiscala: ["zona_fiscala", "zona"],
  });

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // +2 because row 1 is headers, and we're 1-indexed

    try {
      const tip = getField(row, colMap, "tip");
      const nume = getField(row, colMap, "nume");

      // Required fields validation
      if (!tip || !["PF", "PJ", "pf", "pj"].includes(tip)) {
        errors.push({
          row: rowNum,
          field: "tip",
          value: tip || "",
          error: "Tipul contribuabilului este obligatoriu (PF sau PJ)",
        });
        continue;
      }

      if (!nume) {
        errors.push({
          row: rowNum,
          field: "nume",
          value: "",
          error: "Numele este obligatoriu",
        });
        continue;
      }

      const tipUpper = tip.toUpperCase();
      const cnp = getField(row, colMap, "cnp");
      const cui = getField(row, colMap, "cui");

      // CNP validation for PF
      if (tipUpper === "PF" && cnp && !validateCNP(cnp)) {
        errors.push({
          row: rowNum,
          field: "cnp",
          value: cnp,
          error: "CNP invalid (suma de control nu corespunde)",
        });
        continue;
      }

      // CUI validation for PJ
      if (tipUpper === "PJ" && cui && !validateCUI(cui)) {
        errors.push({
          row: rowNum,
          field: "cui",
          value: cui,
          error: "CUI invalid (suma de control nu corespunde)",
        });
        continue;
      }

      // Create address if location data is present
      let adresaDomiciliuId: string | undefined;
      const localitate = getField(row, colMap, "localitate");
      const judet = getField(row, colMap, "judet");

      if (localitate && judet) {
        const adresa = await prisma.adresa.create({
          data: {
            tenantId,
            strada: getField(row, colMap, "strada") || undefined,
            numar: getField(row, colMap, "numar") || undefined,
            localitate,
            judet,
            codPostal: getField(row, colMap, "cod_postal") || undefined,
            zonaFiscala: getField(row, colMap, "zona_fiscala") || undefined,
          },
        });
        adresaDomiciliuId = adresa.id;
      }

      await prisma.contribuabil.create({
        data: {
          tenantId,
          tip: tipUpper,
          nume,
          prenume: getField(row, colMap, "prenume") || undefined,
          cui: cui || undefined,
          telefon: getField(row, colMap, "telefon") || undefined,
          email: getField(row, colMap, "email") || undefined,
          codRol: getField(row, colMap, "cod_rol") || undefined,
          nrDosarFiscal: getField(row, colMap, "nr_dosar_fiscal") || undefined,
          reprezentantLegal: getField(row, colMap, "reprezentant_legal") || undefined,
          nrRegistruComert: getField(row, colMap, "nr_registru_comert") || undefined,
          adresaDomiciliuId,
          note: `Importat din batch ${batchId}`,
        },
      });

      imported++;
    } catch (error) {
      errors.push({
        row: rowNum,
        field: "general",
        value: "",
        error: `Eroare neasteptata: ${error instanceof Error ? error.message : "necunoscut"}`,
      });
    }
  }

  return { imported, errors };
}

// ============================================================================
// IMPORT — PROPRIETATI CLADIRI
// ============================================================================

async function importProprietatiCladiri(
  tenantId: string,
  headers: string[],
  rows: string[][],
  batchId: string
): Promise<{ imported: number; errors: ImportRowError[] }> {
  const errors: ImportRowError[] = [];
  let imported = 0;

  const colMap = buildColumnMap(headers, {
    contribuabil_id: ["contribuabil_id", "id_contribuabil"],
    cod_rol: ["cod_rol", "codrol"],
    strada: ["strada", "str"],
    numar: ["numar", "nr"],
    localitate: ["localitate", "oras"],
    judet: ["judet"],
    zona: ["zona", "zona_fiscala"],
    destinatie: ["destinatie", "dest"],
    tip_constructie: ["tip_constructie", "tip_constr"],
    an_constructie: ["an_constructie", "an_constr"],
    suprafata_construita: ["suprafata_construita", "sup_constr", "mp"],
    suprafata_utila: ["suprafata_utila", "sup_utila"],
    valoare_impozabila: ["valoare_impozabila", "val_impoz"],
    cota_parte: ["cota_parte", "cota"],
    data_dobandire: ["data_dobandire", "data_achizitie"],
    numar_cadastral: ["numar_cadastral", "nr_cadastral"],
  });

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    try {
      // Resolve contribuabil by ID or cod_rol
      let contribuabilId = getField(row, colMap, "contribuabil_id");
      if (!contribuabilId) {
        const codRol = getField(row, colMap, "cod_rol");
        if (codRol) {
          const c = await prisma.contribuabil.findFirst({
            where: { tenantId, codRol, deletedAt: null },
            select: { id: true },
          });
          if (c) contribuabilId = c.id;
        }
      }

      if (!contribuabilId) {
        errors.push({
          row: rowNum,
          field: "contribuabil_id",
          value: "",
          error: "Contribuabilul nu a putut fi identificat",
        });
        continue;
      }

      const destinatie = getField(row, colMap, "destinatie");
      const tipConstructie = getField(row, colMap, "tip_constructie");
      const anConstructieStr = getField(row, colMap, "an_constructie");
      const suprafataStr = getField(row, colMap, "suprafata_construita");

      if (!destinatie || !tipConstructie || !anConstructieStr || !suprafataStr) {
        errors.push({
          row: rowNum,
          field: "general",
          value: "",
          error: "Campuri obligatorii lipsa: destinatie, tip_constructie, an_constructie, suprafata_construita",
        });
        continue;
      }

      // Create address
      const localitate = getField(row, colMap, "localitate") || "necunoscut";
      const judet = getField(row, colMap, "judet") || "necunoscut";
      const adresa = await prisma.adresa.create({
        data: {
          tenantId,
          strada: getField(row, colMap, "strada") || undefined,
          numar: getField(row, colMap, "numar") || undefined,
          localitate,
          judet,
          zonaFiscala: getField(row, colMap, "zona") || undefined,
        },
      });

      const dataDobandirii = getField(row, colMap, "data_dobandire");

      await prisma.proprietateCladire.create({
        data: {
          tenantId,
          contribuabilId,
          adresaId: adresa.id,
          zona: getField(row, colMap, "zona") || "A",
          destinatie,
          tipConstructie,
          anConstructie: parseInt(anConstructieStr),
          suprafataConstruita: parseFloat(suprafataStr),
          suprafataUtila: getField(row, colMap, "suprafata_utila")
            ? parseFloat(getField(row, colMap, "suprafata_utila")!)
            : undefined,
          valoareImpozabila: getField(row, colMap, "valoare_impozabila")
            ? parseFloat(getField(row, colMap, "valoare_impozabila")!)
            : undefined,
          cotaParte: getField(row, colMap, "cota_parte")
            ? parseFloat(getField(row, colMap, "cota_parte")!)
            : 100.0,
          dataDobandire: dataDobandirii
            ? new Date(dataDobandirii)
            : new Date(),
          numarCadastral: getField(row, colMap, "numar_cadastral") || undefined,
          status: "activ",
        },
      });

      imported++;
    } catch (error) {
      errors.push({
        row: rowNum,
        field: "general",
        value: "",
        error: `Eroare neasteptata: ${error instanceof Error ? error.message : "necunoscut"}`,
      });
    }
  }

  return { imported, errors };
}

// ============================================================================
// IMPORT — PROPRIETATI TERENURI
// ============================================================================

async function importProprietatiTerenuri(
  tenantId: string,
  headers: string[],
  rows: string[][],
  batchId: string
): Promise<{ imported: number; errors: ImportRowError[] }> {
  const errors: ImportRowError[] = [];
  let imported = 0;

  const colMap = buildColumnMap(headers, {
    contribuabil_id: ["contribuabil_id", "id_contribuabil"],
    cod_rol: ["cod_rol", "codrol"],
    strada: ["strada", "str"],
    numar: ["numar", "nr"],
    localitate: ["localitate", "oras"],
    judet: ["judet"],
    zona: ["zona", "zona_fiscala"],
    categorie: ["categorie", "cat_teren", "categorie_teren"],
    suprafata_mp: ["suprafata_mp", "suprafata", "mp"],
    suprafata_ha: ["suprafata_ha", "ha"],
    cota_parte: ["cota_parte", "cota"],
    data_dobandire: ["data_dobandire", "data_achizitie"],
    numar_cadastral: ["numar_cadastral", "nr_cadastral"],
  });

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    try {
      let contribuabilId = getField(row, colMap, "contribuabil_id");
      if (!contribuabilId) {
        const codRol = getField(row, colMap, "cod_rol");
        if (codRol) {
          const c = await prisma.contribuabil.findFirst({
            where: { tenantId, codRol, deletedAt: null },
            select: { id: true },
          });
          if (c) contribuabilId = c.id;
        }
      }

      if (!contribuabilId) {
        errors.push({
          row: rowNum,
          field: "contribuabil_id",
          value: "",
          error: "Contribuabilul nu a putut fi identificat",
        });
        continue;
      }

      const categorie = getField(row, colMap, "categorie");
      const suprafataMpStr = getField(row, colMap, "suprafata_mp");

      if (!categorie || !suprafataMpStr) {
        errors.push({
          row: rowNum,
          field: "general",
          value: "",
          error: "Campuri obligatorii lipsa: categorie, suprafata_mp",
        });
        continue;
      }

      // Optional address
      let adresaId: string | undefined;
      const localitate = getField(row, colMap, "localitate");
      const judet = getField(row, colMap, "judet");
      if (localitate && judet) {
        const adresa = await prisma.adresa.create({
          data: {
            tenantId,
            strada: getField(row, colMap, "strada") || undefined,
            numar: getField(row, colMap, "numar") || undefined,
            localitate,
            judet,
            zonaFiscala: getField(row, colMap, "zona") || undefined,
          },
        });
        adresaId = adresa.id;
      }

      const dataDobandirii = getField(row, colMap, "data_dobandire");
      const suprafataMp = parseFloat(suprafataMpStr);

      await prisma.proprietateTeren.create({
        data: {
          tenantId,
          contribuabilId,
          adresaId,
          zona: getField(row, colMap, "zona") || "A",
          categorie,
          suprafataMp,
          suprafataHa: getField(row, colMap, "suprafata_ha")
            ? parseFloat(getField(row, colMap, "suprafata_ha")!)
            : suprafataMp / 10000,
          cotaParte: getField(row, colMap, "cota_parte")
            ? parseFloat(getField(row, colMap, "cota_parte")!)
            : 100.0,
          dataDobandire: dataDobandirii
            ? new Date(dataDobandirii)
            : new Date(),
          numarCadastral: getField(row, colMap, "numar_cadastral") || undefined,
          status: "activ",
        },
      });

      imported++;
    } catch (error) {
      errors.push({
        row: rowNum,
        field: "general",
        value: "",
        error: `Eroare neasteptata: ${error instanceof Error ? error.message : "necunoscut"}`,
      });
    }
  }

  return { imported, errors };
}

// ============================================================================
// IMPORT — PROPRIETATI VEHICULE
// ============================================================================

async function importProprietatiVehicule(
  tenantId: string,
  headers: string[],
  rows: string[][],
  batchId: string
): Promise<{ imported: number; errors: ImportRowError[] }> {
  const errors: ImportRowError[] = [];
  let imported = 0;

  const colMap = buildColumnMap(headers, {
    contribuabil_id: ["contribuabil_id", "id_contribuabil"],
    cod_rol: ["cod_rol", "codrol"],
    numar_inmatriculare: ["numar_inmatriculare", "nr_inmatr", "nr_auto"],
    serie_sasiu: ["serie_sasiu", "vin"],
    tip_vehicul: ["tip_vehicul", "tip", "tip_auto"],
    marca: ["marca", "brand"],
    model: ["model"],
    an_fabricatie: ["an_fabricatie", "an_fab"],
    cilindree_cmc: ["cilindree_cmc", "cilindree", "cmc"],
    putere_kw: ["putere_kw", "kw"],
    masa_totala_kg: ["masa_totala_kg", "masa_totala", "greutate"],
    norma_poluare: ["norma_poluare", "euro"],
    tip_combustibil: ["tip_combustibil", "combustibil"],
    data_dobandire: ["data_dobandire", "data_achizitie"],
  });

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    try {
      let contribuabilId = getField(row, colMap, "contribuabil_id");
      if (!contribuabilId) {
        const codRol = getField(row, colMap, "cod_rol");
        if (codRol) {
          const c = await prisma.contribuabil.findFirst({
            where: { tenantId, codRol, deletedAt: null },
            select: { id: true },
          });
          if (c) contribuabilId = c.id;
        }
      }

      if (!contribuabilId) {
        errors.push({
          row: rowNum,
          field: "contribuabil_id",
          value: "",
          error: "Contribuabilul nu a putut fi identificat",
        });
        continue;
      }

      const tipVehicul = getField(row, colMap, "tip_vehicul");
      const anFabricatieStr = getField(row, colMap, "an_fabricatie");

      if (!tipVehicul || !anFabricatieStr) {
        errors.push({
          row: rowNum,
          field: "general",
          value: "",
          error: "Campuri obligatorii lipsa: tip_vehicul, an_fabricatie",
        });
        continue;
      }

      const dataDobandirii = getField(row, colMap, "data_dobandire");

      await prisma.proprietateVehicul.create({
        data: {
          tenantId,
          contribuabilId,
          numarInmatriculare: getField(row, colMap, "numar_inmatriculare") || undefined,
          serieSasiu: getField(row, colMap, "serie_sasiu") || undefined,
          tipVehicul,
          marca: getField(row, colMap, "marca") || undefined,
          model: getField(row, colMap, "model") || undefined,
          anFabricatie: parseInt(anFabricatieStr),
          cilindreeCmc: getField(row, colMap, "cilindree_cmc")
            ? parseInt(getField(row, colMap, "cilindree_cmc")!)
            : undefined,
          putereKw: getField(row, colMap, "putere_kw")
            ? parseFloat(getField(row, colMap, "putere_kw")!)
            : undefined,
          masaTotalaKg: getField(row, colMap, "masa_totala_kg")
            ? parseInt(getField(row, colMap, "masa_totala_kg")!)
            : undefined,
          normaPoluare: getField(row, colMap, "norma_poluare") || undefined,
          tipCombustibil: getField(row, colMap, "tip_combustibil") || undefined,
          dataDobandire: dataDobandirii
            ? new Date(dataDobandirii)
            : new Date(),
          status: "activ",
        },
      });

      imported++;
    } catch (error) {
      errors.push({
        row: rowNum,
        field: "general",
        value: "",
        error: `Eroare neasteptata: ${error instanceof Error ? error.message : "necunoscut"}`,
      });
    }
  }

  return { imported, errors };
}

// ============================================================================
// IMPORT — ROLLBACK BATCH
// ============================================================================

export async function rollbackImportBatch(id: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.tenantId)
    return { success: false, error: "No tenant context" };
  await setTenantContext(session.user.tenantId);

  try {
    const batch = await prisma.importBatch.findFirst({
      where: { id, tenantId: session.user.tenantId },
    });

    if (!batch) return { success: false, error: "Batch-ul nu a fost gasit" };

    if (batch.status === "rolled_back") {
      return { success: false, error: "Batch-ul a fost deja anulat" };
    }

    // Soft-delete all records created by this batch based on the note marker
    const batchNote = `Importat din batch ${id}`;

    if (batch.entityType === "contribuabil") {
      await prisma.contribuabil.updateMany({
        where: {
          tenantId: session.user.tenantId,
          note: { contains: batchNote },
          deletedAt: null,
        },
        data: { deletedAt: new Date() },
      });
    }

    // For property types, we soft-delete by matching creation time window
    // Records created between batch creation and completion
    if (batch.entityType === "proprietate_cladire") {
      await prisma.proprietateCladire.updateMany({
        where: {
          tenantId: session.user.tenantId,
          createdAt: {
            gte: batch.createdAt,
            lte: batch.completedAt || new Date(),
          },
          deletedAt: null,
        },
        data: { deletedAt: new Date() },
      });
    }

    if (batch.entityType === "proprietate_teren") {
      await prisma.proprietateTeren.updateMany({
        where: {
          tenantId: session.user.tenantId,
          createdAt: {
            gte: batch.createdAt,
            lte: batch.completedAt || new Date(),
          },
          deletedAt: null,
        },
        data: { deletedAt: new Date() },
      });
    }

    if (batch.entityType === "proprietate_vehicul") {
      await prisma.proprietateVehicul.updateMany({
        where: {
          tenantId: session.user.tenantId,
          createdAt: {
            gte: batch.createdAt,
            lte: batch.completedAt || new Date(),
          },
          deletedAt: null,
        },
        data: { deletedAt: new Date() },
      });
    }

    // Mark batch as rolled back
    await prisma.importBatch.update({
      where: { id },
      data: {
        status: "rolled_back",
        rollbackAt: new Date(),
        rollbackById: session.user.id,
      },
    });

    revalidatePath("/admin/import");
    revalidatePath("/contribuabili");
    return { success: true };
  } catch (error) {
    console.error("Error rolling back import batch:", error);
    return { success: false, error: "Eroare la anularea importului" };
  }
}

// ============================================================================
// HELPER: Column mapping for flexible CSV headers
// ============================================================================

type ColumnMap = Record<string, number>;

function buildColumnMap(
  headers: string[],
  mapping: Record<string, string[]>
): ColumnMap {
  const colMap: ColumnMap = {};

  for (const [field, aliases] of Object.entries(mapping)) {
    for (const alias of aliases) {
      const idx = headers.indexOf(alias.toLowerCase());
      if (idx !== -1) {
        colMap[field] = idx;
        break;
      }
    }
  }

  return colMap;
}

function getField(
  row: string[],
  colMap: ColumnMap,
  field: string
): string | undefined {
  const idx = colMap[field];
  if (idx === undefined || idx >= row.length) return undefined;
  const val = row[idx]?.trim();
  return val || undefined;
}
