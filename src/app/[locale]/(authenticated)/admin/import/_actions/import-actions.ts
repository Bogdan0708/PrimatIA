"use server";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-utils";
import { setTenantContext } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { createHash } from "crypto";
import { Prisma } from "@prisma/client";
import { normalizeVehicleEuroNorm, normalizeVehicleFuelType, normalizeVehicleType } from "@/lib/vehicle-normalization";

type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

type ImportEntityType =
  | "contribuabil"
  | "proprietate_cladire"
  | "proprietate_teren"
  | "proprietate_vehicul";

interface ImportFieldDefinition {
  key: string;
  required?: boolean;
  aliases: string[];
}

const IMPORT_SCHEMA: Record<ImportEntityType, ImportFieldDefinition[]> = {
  contribuabil: [
    { key: "tip", required: true, aliases: ["tip", "tip_contribuabil", "type"] },
    { key: "nume", required: true, aliases: ["nume", "denumire", "name"] },
    { key: "prenume", aliases: ["prenume", "first_name"] },
    { key: "cnp", aliases: ["cnp", "cod_numeric_personal"] },
    { key: "cui", aliases: ["cui", "cod_fiscal", "cif"] },
    { key: "telefon", aliases: ["telefon", "phone", "tel"] },
    { key: "email", aliases: ["email", "e-mail"] },
    { key: "cod_rol", aliases: ["cod_rol", "codrol", "rol"] },
    { key: "nr_dosar_fiscal", aliases: ["nr_dosar_fiscal", "dosar_fiscal"] },
    { key: "reprezentant_legal", aliases: ["reprezentant_legal", "reprezentant"] },
    { key: "nr_registru_comert", aliases: ["nr_registru_comert", "reg_comert"] },
    { key: "strada", aliases: ["strada", "str"] },
    { key: "numar", aliases: ["numar", "nr"] },
    { key: "localitate", aliases: ["localitate", "oras", "comuna"] },
    { key: "judet", aliases: ["judet", "county"] },
    { key: "cod_postal", aliases: ["cod_postal", "zip"] },
    { key: "zona_fiscala", aliases: ["zona_fiscala", "zona"] },
  ],
  proprietate_cladire: [
    { key: "contribuabil_id", aliases: ["contribuabil_id", "id_contribuabil"] },
    { key: "cod_rol", aliases: ["cod_rol", "codrol"] },
    { key: "strada", aliases: ["strada", "str"] },
    { key: "numar", aliases: ["numar", "nr"] },
    { key: "localitate", aliases: ["localitate", "oras"] },
    { key: "judet", aliases: ["judet"] },
    { key: "zona", aliases: ["zona", "zona_fiscala"] },
    { key: "destinatie", required: true, aliases: ["destinatie", "dest"] },
    { key: "tip_constructie", required: true, aliases: ["tip_constructie", "tip_constr"] },
    { key: "an_constructie", required: true, aliases: ["an_constructie", "an_constr"] },
    {
      key: "suprafata_construita",
      required: true,
      aliases: ["suprafata_construita", "sup_constr", "mp"],
    },
    { key: "suprafata_utila", aliases: ["suprafata_utila", "sup_utila"] },
    { key: "valoare_impozabila", aliases: ["valoare_impozabila", "val_impoz"] },
    { key: "cota_parte", aliases: ["cota_parte", "cota"] },
    { key: "data_dobandire", aliases: ["data_dobandire", "data_achizitie"] },
    { key: "numar_cadastral", aliases: ["numar_cadastral", "nr_cadastral"] },
  ],
  proprietate_teren: [
    { key: "contribuabil_id", aliases: ["contribuabil_id", "id_contribuabil"] },
    { key: "cod_rol", aliases: ["cod_rol", "codrol"] },
    { key: "strada", aliases: ["strada", "str"] },
    { key: "numar", aliases: ["numar", "nr"] },
    { key: "localitate", aliases: ["localitate", "oras"] },
    { key: "judet", aliases: ["judet"] },
    { key: "zona", aliases: ["zona", "zona_fiscala"] },
    { key: "categorie", required: true, aliases: ["categorie", "cat_teren", "categorie_teren"] },
    { key: "suprafata_mp", required: true, aliases: ["suprafata_mp", "suprafata", "mp"] },
    { key: "suprafata_ha", aliases: ["suprafata_ha", "ha"] },
    { key: "cota_parte", aliases: ["cota_parte", "cota"] },
    { key: "data_dobandire", aliases: ["data_dobandire", "data_achizitie"] },
    { key: "numar_cadastral", aliases: ["numar_cadastral", "nr_cadastral"] },
  ],
  proprietate_vehicul: [
    { key: "contribuabil_id", aliases: ["contribuabil_id", "id_contribuabil"] },
    { key: "cod_rol", aliases: ["cod_rol", "codrol"] },
    {
      key: "numar_inmatriculare",
      aliases: ["numar_inmatriculare", "nr_inmatr", "nr_auto"],
    },
    { key: "serie_sasiu", aliases: ["serie_sasiu", "vin"] },
    { key: "tip_vehicul", required: true, aliases: ["tip_vehicul", "tip", "tip_auto"] },
    { key: "marca", aliases: ["marca", "brand"] },
    { key: "model", aliases: ["model"] },
    { key: "an_fabricatie", required: true, aliases: ["an_fabricatie", "an_fab"] },
    { key: "cilindree_cmc", aliases: ["cilindree_cmc", "cilindree", "cmc"] },
    { key: "putere_kw", aliases: ["putere_kw", "kw"] },
    { key: "masa_totala_kg", aliases: ["masa_totala_kg", "masa_totala", "greutate"] },
    { key: "norma_poluare", aliases: ["norma_poluare", "euro"] },
    { key: "tip_combustibil", aliases: ["tip_combustibil", "combustibil"] },
    { key: "emisii_co2_g_km", aliases: ["emisii_co2_g_km", "co2_g_km", "co2"] },
    { key: "data_dobandire", aliases: ["data_dobandire", "data_achizitie"] },
  ],
};

// ============================================================================
// IMPORT BATCHES — LIST
// ============================================================================

export async function getImportBatches(
  params: { status?: string; entityType?: string } = {}
) {
  const session = await requireAdmin();
  if (!session?.user?.tenantId) throw new Error("No tenant context");
  await setTenantContext(session.user.tenantId);

  const where: Prisma.ImportBatchWhereInput = { tenantId: session.user.tenantId };
  if (params.status) where.status = params.status;
  if (params.entityType) where.entityType = params.entityType;

  return prisma.importBatch.findMany({
    where,
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
  const session = await requireAdmin();
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

interface ImportPreviewResult {
  filename: string;
  entityType: ImportEntityType;
  headers: string[];
  totalRows: number;
  sampleRows: Array<Record<string, string>>;
  targetFields: string[];
  mapping: Record<string, string>;
  missingRequiredFields: string[];
  validationErrors: ImportRowError[];
  validationErrorCount: number;
}

interface ImportTemplateResult {
  filename: string;
  content: string;
}

interface RollbackPreviewResult {
  batchId: string;
  status: string;
  canRollback: boolean;
  importedRecords: number;
  countsByEntity: Record<ImportEntityType, number>;
  sampleRecordIds: string[];
}

function isImportEntityType(value: string): value is ImportEntityType {
  return value in IMPORT_SCHEMA;
}

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function sanitizeStringRecord(value: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(value).filter(
      ([k, v]) => typeof k === "string" && typeof v === "string" && v.trim().length > 0
    )
  ) as Record<string, string>;
}

function parseMapping(formDataValue: FormDataEntryValue | null): Record<string, string> {
  if (!formDataValue || typeof formDataValue !== "string") return {};
  try {
    const parsed = JSON.parse(formDataValue) as Record<string, string>;
    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([k, v]) => typeof k === "string" && typeof v === "string" && v.trim().length > 0
      )
    );
  } catch {
    return {};
  }
}

function normalizeHeaderMap(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  headers.forEach((h, idx) => {
    map[h.toLowerCase().trim()] = idx;
  });
  return map;
}

function suggestMapping(entityType: ImportEntityType, headers: string[]): Record<string, string> {
  const normalized = normalizeHeaderMap(headers);
  const mapping: Record<string, string> = {};
  for (const field of IMPORT_SCHEMA[entityType]) {
    for (const alias of field.aliases) {
      const idx = normalized[alias.toLowerCase()];
      if (idx !== undefined) {
        mapping[field.key] = headers[idx];
        break;
      }
    }
  }
  return mapping;
}

function mergeMapping(
  entityType: ImportEntityType,
  headers: string[],
  explicitMapping: Record<string, string>
): Record<string, string> {
  const suggested = suggestMapping(entityType, headers);
  const headerSet = new Set(headers.map((h) => h.toLowerCase().trim()));
  for (const field of IMPORT_SCHEMA[entityType]) {
    const selectedHeader = explicitMapping[field.key];
    if (!selectedHeader) continue;
    if (headerSet.has(selectedHeader.toLowerCase().trim())) {
      suggested[field.key] = selectedHeader;
    }
  }
  return suggested;
}

function buildColumnMapFromSchema(
  entityType: ImportEntityType,
  headers: string[],
  fieldToHeaderMap: Record<string, string>
): ColumnMap {
  const normalized = normalizeHeaderMap(headers);
  const colMap: ColumnMap = {};
  for (const field of IMPORT_SCHEMA[entityType]) {
    const header = fieldToHeaderMap[field.key];
    if (!header) continue;
    const idx = normalized[header.toLowerCase().trim()];
    if (idx !== undefined) colMap[field.key] = idx;
  }
  return colMap;
}

function computeRowHash(
  entityType: ImportEntityType,
  headers: string[],
  row: string[]
): string {
  const rowPayload: Record<string, string> = {};
  headers.forEach((header, idx) => {
    rowPayload[header.toLowerCase().trim()] = (row[idx] || "").trim().toLowerCase();
  });
  const canonical = JSON.stringify({
    entityType,
    row: Object.fromEntries(Object.entries(rowPayload).sort(([a], [b]) => a.localeCompare(b))),
  });
  return createHash("sha256").update(canonical).digest("hex");
}

function missingRequiredMapping(
  entityType: ImportEntityType,
  mapping: Record<string, string>
): string[] {
  return IMPORT_SCHEMA[entityType]
    .filter((f) => f.required && !mapping[f.key])
    .map((f) => f.key);
}

function validateRowsForPreview(
  entityType: ImportEntityType,
  colMap: ColumnMap,
  rows: string[][]
): ImportRowError[] {
  const errors: ImportRowError[] = [];
  const push = (row: number, field: string, value: string, error: string) => {
    errors.push({ row, field, value, error });
  };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    if (entityType === "contribuabil") {
      const tip = getField(row, colMap, "tip");
      const nume = getField(row, colMap, "nume");
      if (!tip || !["PF", "PJ", "pf", "pj"].includes(tip)) {
        push(rowNum, "tip", tip || "", "Tipul contribuabilului este obligatoriu (PF sau PJ)");
      }
      if (!nume) {
        push(rowNum, "nume", "", "Numele este obligatoriu");
      }
      const cnp = getField(row, colMap, "cnp");
      const cui = getField(row, colMap, "cui");
      if ((tip || "").toUpperCase() === "PF" && cnp && !validateCNP(cnp)) {
        push(rowNum, "cnp", cnp, "CNP invalid (suma de control nu corespunde)");
      }
      if ((tip || "").toUpperCase() === "PJ" && cui && !validateCUI(cui)) {
        push(rowNum, "cui", cui, "CUI invalid (suma de control nu corespunde)");
      }
      continue;
    }

    if (entityType === "proprietate_cladire") {
      const contribuabilId = getField(row, colMap, "contribuabil_id");
      const codRol = getField(row, colMap, "cod_rol");
      if (!contribuabilId && !codRol) {
        push(rowNum, "contribuabil_id", "", "Lipseste contribuabil_id sau cod_rol");
      }
      const destinatie = getField(row, colMap, "destinatie");
      const tipConstructie = getField(row, colMap, "tip_constructie");
      const anConstructie = getField(row, colMap, "an_constructie");
      const suprafata = getField(row, colMap, "suprafata_construita");
      if (!destinatie) push(rowNum, "destinatie", "", "Camp obligatoriu");
      if (!tipConstructie) push(rowNum, "tip_constructie", "", "Camp obligatoriu");
      if (!anConstructie) push(rowNum, "an_constructie", "", "Camp obligatoriu");
      if (!suprafata) push(rowNum, "suprafata_construita", "", "Camp obligatoriu");
      if (anConstructie && Number.isNaN(Number(anConstructie))) {
        push(rowNum, "an_constructie", anConstructie, "Valoare numerica invalida");
      }
      if (suprafata && Number.isNaN(Number(suprafata))) {
        push(rowNum, "suprafata_construita", suprafata, "Valoare numerica invalida");
      }
      continue;
    }

    if (entityType === "proprietate_teren") {
      const contribuabilId = getField(row, colMap, "contribuabil_id");
      const codRol = getField(row, colMap, "cod_rol");
      if (!contribuabilId && !codRol) {
        push(rowNum, "contribuabil_id", "", "Lipseste contribuabil_id sau cod_rol");
      }
      const categorie = getField(row, colMap, "categorie");
      const suprafataMp = getField(row, colMap, "suprafata_mp");
      if (!categorie) push(rowNum, "categorie", "", "Camp obligatoriu");
      if (!suprafataMp) push(rowNum, "suprafata_mp", "", "Camp obligatoriu");
      if (suprafataMp && Number.isNaN(Number(suprafataMp))) {
        push(rowNum, "suprafata_mp", suprafataMp, "Valoare numerica invalida");
      }
      continue;
    }

    if (entityType === "proprietate_vehicul") {
      const contribuabilId = getField(row, colMap, "contribuabil_id");
      const codRol = getField(row, colMap, "cod_rol");
      if (!contribuabilId && !codRol) {
        push(rowNum, "contribuabil_id", "", "Lipseste contribuabil_id sau cod_rol");
      }
      const tipVehicul = getField(row, colMap, "tip_vehicul");
      const anFabricatie = getField(row, colMap, "an_fabricatie");
      if (!tipVehicul) push(rowNum, "tip_vehicul", "", "Camp obligatoriu");
      if (!anFabricatie) push(rowNum, "an_fabricatie", "", "Camp obligatoriu");
      if (anFabricatie && Number.isNaN(Number(anFabricatie))) {
        push(rowNum, "an_fabricatie", anFabricatie, "Valoare numerica invalida");
      }
    }
  }

  return errors;
}

export async function previewImportBatch(
  formData: FormData
): Promise<ActionResult<ImportPreviewResult>> {
  const session = await requireAdmin();
  if (!session?.user?.tenantId) return { success: false, error: "No tenant context" };

  const file = formData.get("file") as File;
  const entityTypeRaw = formData.get("entityType");
  if (!file || !entityTypeRaw || typeof entityTypeRaw !== "string") {
    return { success: false, error: "Fisierul si tipul de entitate sunt obligatorii" };
  }
  if (!isImportEntityType(entityTypeRaw)) {
    return { success: false, error: "Tip entitate invalid" };
  }

  const content = await file.text();
  const { headers, rows } = parseCSV(content);
  if (headers.length === 0 || rows.length === 0) {
    return { success: false, error: "Fisierul este gol sau nu contine date valide" };
  }

  const explicitMapping = parseMapping(formData.get("mapping"));
  const mapping = mergeMapping(entityTypeRaw, headers, explicitMapping);
  const missingRequiredFields = missingRequiredMapping(entityTypeRaw, mapping);
  const colMap = buildColumnMapFromSchema(entityTypeRaw, headers, mapping);
  const allValidationErrors = validateRowsForPreview(entityTypeRaw, colMap, rows);
  const sampleRows = rows.slice(0, 5).map((row) =>
    Object.fromEntries(headers.map((h, idx) => [h, row[idx] || ""]))
  );

  return {
    success: true,
    data: {
      filename: file.name,
      entityType: entityTypeRaw,
      headers,
      totalRows: rows.length,
      sampleRows,
      targetFields: IMPORT_SCHEMA[entityTypeRaw].map((f) => f.key),
      mapping,
      missingRequiredFields,
      validationErrors: allValidationErrors.slice(0, 200),
      validationErrorCount: allValidationErrors.length,
    },
  };
}

export async function getImportTemplate(
  entityTypeRaw: string
): Promise<ActionResult<ImportTemplateResult>> {
  const session = await requireAdmin();
  if (!session?.user?.tenantId) return { success: false, error: "No tenant context" };
  if (!isImportEntityType(entityTypeRaw)) return { success: false, error: "Tip entitate invalid" };

  const headers = IMPORT_SCHEMA[entityTypeRaw].map((f) => f.key);
  const exampleByType: Record<ImportEntityType, Record<string, string>> = {
    contribuabil: {
      tip: "PF",
      nume: "Popescu",
      prenume: "Ion",
      cnp: "1960523420018",
      email: "ion.popescu@example.ro",
      telefon: "0712345678",
      localitate: "Bogdan Voda",
      judet: "Maramures",
    },
    proprietate_cladire: {
      cod_rol: "ROL-0001",
      destinatie: "rezidential",
      tip_constructie: "zidarie",
      an_constructie: "2008",
      suprafata_construita: "120",
      localitate: "Bogdan Voda",
      judet: "Maramures",
      zona: "A",
    },
    proprietate_teren: {
      cod_rol: "ROL-0001",
      categorie: "intravilan",
      suprafata_mp: "850",
      localitate: "Bogdan Voda",
      judet: "Maramures",
      zona: "A",
    },
    proprietate_vehicul: {
      cod_rol: "ROL-0001",
      tip_vehicul: "autoturism",
      an_fabricatie: "2019",
      numar_inmatriculare: "MM-01-ABC",
      marca: "Dacia",
      model: "Duster",
      cilindree_cmc: "1461",
    },
  };

  const sample = headers.map((h) => exampleByType[entityTypeRaw][h] || "");
  const content = [headers.join(","), sample.join(",")].join("\n");
  return {
    success: true,
    data: {
      filename: `template-${entityTypeRaw}.csv`,
      content,
    },
  };
}

export async function getImportMappingPreset(
  entityTypeRaw: string
): Promise<ActionResult<{ mapping: Record<string, string> }>> {
  const session = await requireAdmin();
  if (!session?.user?.tenantId) return { success: false, error: "No tenant context" };
  if (!isImportEntityType(entityTypeRaw)) return { success: false, error: "Tip entitate invalid" };
  await setTenantContext(session.user.tenantId);

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
    select: { settings: true },
  });
  const settings = asObject(tenant?.settings);
  const importSettings = asObject(settings.importSettings);
  const presets = asObject(importSettings.mappingPresets);
  const preset = asObject(presets[entityTypeRaw]);
  const mapping = sanitizeStringRecord(preset);

  return { success: true, data: { mapping } };
}

export async function saveImportMappingPreset(
  entityTypeRaw: string,
  mapping: Record<string, string>
): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!session?.user?.tenantId) return { success: false, error: "No tenant context" };
  if (!isImportEntityType(entityTypeRaw)) return { success: false, error: "Tip entitate invalid" };
  await setTenantContext(session.user.tenantId);

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
    select: { settings: true },
  });
  const settings = asObject(tenant?.settings);
  const importSettings = asObject(settings.importSettings);
  const presets = asObject(importSettings.mappingPresets);
  const sanitizedMapping = sanitizeStringRecord(mapping as Record<string, unknown>);

  presets[entityTypeRaw] = sanitizedMapping;
  importSettings.mappingPresets = presets;
  settings.importSettings = importSettings;

  await prisma.tenant.update({
    where: { id: session.user.tenantId },
    data: { settings: settings as Prisma.InputJsonValue },
  });

  return { success: true };
}

// ============================================================================
// IMPORT — CREATE BATCH (CSV upload and parse)
// ============================================================================

export async function createImportBatch(
  formData: FormData
): Promise<ActionResult<ImportSummary>> {
  const session = await requireAdmin();
  if (!session?.user?.tenantId)
    return { success: false, error: "No tenant context" };
  await setTenantContext(session.user.tenantId);

  try {
    const file = formData.get("file") as File;
    const entityTypeRaw = formData.get("entityType");
    const confirmImport = formData.get("confirmImport") === "true";

    if (!file || !entityTypeRaw || typeof entityTypeRaw !== "string") {
      return {
        success: false,
        error: "Fisierul si tipul de entitate sunt obligatorii",
      };
    }
    if (!confirmImport) {
      return {
        success: false,
        error: "Confirmarea explicita este obligatorie inainte de import",
      };
    }

    if (!isImportEntityType(entityTypeRaw)) {
      return {
        success: false,
        error: "Tip entitate invalid",
      };
    }
    const entityType = entityTypeRaw as ImportEntityType;

    // Read file content
    const content = await file.text();
    const { headers, rows } = parseCSV(content);
    const explicitMapping = parseMapping(formData.get("mapping"));
    const mapping = mergeMapping(entityType, headers, explicitMapping);
    const missingRequiredFields = missingRequiredMapping(entityType, mapping);

    if (headers.length === 0 || rows.length === 0) {
      return {
        success: false,
        error: "Fisierul este gol sau nu contine date valide",
      };
    }
    if (missingRequiredFields.length > 0) {
      return {
        success: false,
        error: `Lipsesc mapari obligatorii: ${missingRequiredFields.join(", ")}`,
      };
    }

    const colMap = buildColumnMapFromSchema(entityType, headers, mapping);
    const rowHashes = rows.map((row) => computeRowHash(entityType, headers, row));

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
        colMap,
        rows,
        batch.id,
        rowHashes
      );
      importedCount = result.imported;
      errorCount = result.errors.length;
      errors.push(...result.errors);
    } else if (entityType === "proprietate_cladire") {
      const result = await importProprietatiCladiri(
        session.user.tenantId,
        colMap,
        rows,
        batch.id,
        rowHashes
      );
      importedCount = result.imported;
      errorCount = result.errors.length;
      errors.push(...result.errors);
    } else if (entityType === "proprietate_teren") {
      const result = await importProprietatiTerenuri(
        session.user.tenantId,
        colMap,
        rows,
        batch.id,
        rowHashes
      );
      importedCount = result.imported;
      errorCount = result.errors.length;
      errors.push(...result.errors);
    } else if (entityType === "proprietate_vehicul") {
      const result = await importProprietatiVehicule(
        session.user.tenantId,
        colMap,
        rows,
        batch.id,
        rowHashes
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
        errorLog: errors as unknown as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
    });

    revalidatePath("/admin/import");
    return {
      success: true,
      data: {
        batchId: batch.id,
        filename: file.name,
        entityType: entityTypeRaw,
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

async function ledgerHasImportedRow(
  tenantId: string,
  entityType: ImportEntityType,
  rowHash: string
): Promise<boolean> {
  const existing = await prisma.importRowLedger.findUnique({
    where: {
      tenantId_entityType_rowHash: {
        tenantId,
        entityType,
        rowHash,
      },
    },
    select: { status: true },
  });
  return existing?.status === "imported";
}

async function ledgerUpsertRow(params: {
  tenantId: string;
  batchId: string;
  entityType: ImportEntityType;
  rowHash: string;
  entityRecordId?: string;
  status: "imported" | "skipped" | "failed";
}) {
  const { tenantId, batchId, entityType, rowHash, entityRecordId, status } = params;
  await prisma.importRowLedger.upsert({
    where: {
      tenantId_entityType_rowHash: {
        tenantId,
        entityType,
        rowHash,
      },
    },
    update: {
      batchId,
      status,
      entityRecordId: entityRecordId || null,
      rolledBackAt: null,
    },
    create: {
      tenantId,
      batchId,
      entityType,
      rowHash,
      status,
      entityRecordId: entityRecordId || null,
    },
  });
}

async function importContribuabili(
  tenantId: string,
  colMap: ColumnMap,
  rows: string[][],
  batchId: string,
  rowHashes: string[]
): Promise<{ imported: number; errors: ImportRowError[] }> {
  const errors: ImportRowError[] = [];
  let imported = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // +2 because row 1 is headers, and we're 1-indexed
    const rowHash = rowHashes[i];

    try {
      if (await ledgerHasImportedRow(tenantId, "contribuabil", rowHash)) {
        continue;
      }

      const tip = getField(row, colMap, "tip");
      const nume = getField(row, colMap, "nume");

      // Required fields validation
      if (!tip || !["PF", "PJ", "pf", "pj"].includes(tip)) {
        await ledgerUpsertRow({
          tenantId,
          batchId,
          entityType: "contribuabil",
          rowHash,
          status: "failed",
        });
        errors.push({
          row: rowNum,
          field: "tip",
          value: tip || "",
          error: "Tipul contribuabilului este obligatoriu (PF sau PJ)",
        });
        continue;
      }

      if (!nume) {
        await ledgerUpsertRow({
          tenantId,
          batchId,
          entityType: "contribuabil",
          rowHash,
          status: "failed",
        });
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
        await ledgerUpsertRow({
          tenantId,
          batchId,
          entityType: "contribuabil",
          rowHash,
          status: "failed",
        });
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
        await ledgerUpsertRow({
          tenantId,
          batchId,
          entityType: "contribuabil",
          rowHash,
          status: "failed",
        });
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

      const created = await prisma.contribuabil.create({
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

      await ledgerUpsertRow({
        tenantId,
        batchId,
        entityType: "contribuabil",
        rowHash,
        entityRecordId: created.id,
        status: "imported",
      });
      imported++;
    } catch (error) {
      await ledgerUpsertRow({
        tenantId,
        batchId,
        entityType: "contribuabil",
        rowHash,
        status: "failed",
      });
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
  colMap: ColumnMap,
  rows: string[][],
  batchId: string,
  rowHashes: string[]
): Promise<{ imported: number; errors: ImportRowError[] }> {
  const errors: ImportRowError[] = [];
  let imported = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;
    const rowHash = rowHashes[i];

    try {
      if (await ledgerHasImportedRow(tenantId, "proprietate_cladire", rowHash)) {
        continue;
      }

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
        await ledgerUpsertRow({
          tenantId,
          batchId,
          entityType: "proprietate_cladire",
          rowHash,
          status: "failed",
        });
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
        await ledgerUpsertRow({
          tenantId,
          batchId,
          entityType: "proprietate_cladire",
          rowHash,
          status: "failed",
        });
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

      const created = await prisma.proprietateCladire.create({
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

      await ledgerUpsertRow({
        tenantId,
        batchId,
        entityType: "proprietate_cladire",
        rowHash,
        entityRecordId: created.id,
        status: "imported",
      });
      imported++;
    } catch (error) {
      await ledgerUpsertRow({
        tenantId,
        batchId,
        entityType: "proprietate_cladire",
        rowHash,
        status: "failed",
      });
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
  colMap: ColumnMap,
  rows: string[][],
  batchId: string,
  rowHashes: string[]
): Promise<{ imported: number; errors: ImportRowError[] }> {
  const errors: ImportRowError[] = [];
  let imported = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;
    const rowHash = rowHashes[i];

    try {
      if (await ledgerHasImportedRow(tenantId, "proprietate_teren", rowHash)) {
        continue;
      }

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
        await ledgerUpsertRow({
          tenantId,
          batchId,
          entityType: "proprietate_teren",
          rowHash,
          status: "failed",
        });
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
        await ledgerUpsertRow({
          tenantId,
          batchId,
          entityType: "proprietate_teren",
          rowHash,
          status: "failed",
        });
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

      const created = await prisma.proprietateTeren.create({
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

      await ledgerUpsertRow({
        tenantId,
        batchId,
        entityType: "proprietate_teren",
        rowHash,
        entityRecordId: created.id,
        status: "imported",
      });
      imported++;
    } catch (error) {
      await ledgerUpsertRow({
        tenantId,
        batchId,
        entityType: "proprietate_teren",
        rowHash,
        status: "failed",
      });
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
  colMap: ColumnMap,
  rows: string[][],
  batchId: string,
  rowHashes: string[]
): Promise<{ imported: number; errors: ImportRowError[] }> {
  const errors: ImportRowError[] = [];
  let imported = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;
    const rowHash = rowHashes[i];

    try {
      if (await ledgerHasImportedRow(tenantId, "proprietate_vehicul", rowHash)) {
        continue;
      }

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
        await ledgerUpsertRow({
          tenantId,
          batchId,
          entityType: "proprietate_vehicul",
          rowHash,
          status: "failed",
        });
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
        await ledgerUpsertRow({
          tenantId,
          batchId,
          entityType: "proprietate_vehicul",
          rowHash,
          status: "failed",
        });
        errors.push({
          row: rowNum,
          field: "general",
          value: "",
          error: "Campuri obligatorii lipsa: tip_vehicul, an_fabricatie",
        });
        continue;
      }

      const dataDobandirii = getField(row, colMap, "data_dobandire");

      const created = await prisma.proprietateVehicul.create({
        data: {
          tenantId,
          contribuabilId,
          numarInmatriculare: getField(row, colMap, "numar_inmatriculare") || undefined,
          serieSasiu: getField(row, colMap, "serie_sasiu") || undefined,
          tipVehicul: normalizeVehicleType(tipVehicul) || tipVehicul,
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
          normaPoluare: normalizeVehicleEuroNorm(getField(row, colMap, "norma_poluare")) || undefined,
          tipCombustibil: normalizeVehicleFuelType(getField(row, colMap, "tip_combustibil")) || undefined,
          emisiiCo2GKm: getField(row, colMap, "emisii_co2_g_km")
            ? parseInt(getField(row, colMap, "emisii_co2_g_km")!)
            : undefined,
          dataDobandire: dataDobandirii
            ? new Date(dataDobandirii)
            : new Date(),
          status: "activ",
        },
      });

      await ledgerUpsertRow({
        tenantId,
        batchId,
        entityType: "proprietate_vehicul",
        rowHash,
        entityRecordId: created.id,
        status: "imported",
      });
      imported++;
    } catch (error) {
      await ledgerUpsertRow({
        tenantId,
        batchId,
        entityType: "proprietate_vehicul",
        rowHash,
        status: "failed",
      });
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
  const session = await requireAdmin();
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

    const ledgerRows = await prisma.importRowLedger.findMany({
      where: {
        tenantId: session.user.tenantId,
        batchId: id,
        status: "imported",
      },
      select: {
        id: true,
        entityType: true,
        entityRecordId: true,
      },
    });

    const contribuabilIds = ledgerRows
      .filter((r) => r.entityType === "contribuabil" && r.entityRecordId)
      .map((r) => r.entityRecordId as string);
    const cladireIds = ledgerRows
      .filter((r) => r.entityType === "proprietate_cladire" && r.entityRecordId)
      .map((r) => r.entityRecordId as string);
    const terenIds = ledgerRows
      .filter((r) => r.entityType === "proprietate_teren" && r.entityRecordId)
      .map((r) => r.entityRecordId as string);
    const vehiculIds = ledgerRows
      .filter((r) => r.entityType === "proprietate_vehicul" && r.entityRecordId)
      .map((r) => r.entityRecordId as string);

    if (contribuabilIds.length > 0) {
      await prisma.contribuabil.updateMany({
        where: {
          tenantId: session.user.tenantId,
          id: { in: contribuabilIds },
          deletedAt: null,
        },
        data: { deletedAt: new Date() },
      });
    }

    if (cladireIds.length > 0) {
      await prisma.proprietateCladire.updateMany({
        where: {
          tenantId: session.user.tenantId,
          id: { in: cladireIds },
          deletedAt: null,
        },
        data: { deletedAt: new Date() },
      });
    }

    if (terenIds.length > 0) {
      await prisma.proprietateTeren.updateMany({
        where: {
          tenantId: session.user.tenantId,
          id: { in: terenIds },
          deletedAt: null,
        },
        data: { deletedAt: new Date() },
      });
    }

    if (vehiculIds.length > 0) {
      await prisma.proprietateVehicul.updateMany({
        where: {
          tenantId: session.user.tenantId,
          id: { in: vehiculIds },
          deletedAt: null,
        },
        data: { deletedAt: new Date() },
      });
    }

    await prisma.importRowLedger.updateMany({
      where: { tenantId: session.user.tenantId, batchId: id },
      data: { status: "rolled_back", rolledBackAt: new Date() },
    });

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
    revalidatePath(`/admin/import/${id}`);
    revalidatePath("/contribuabili");
    return { success: true };
  } catch (error) {
    console.error("Error rolling back import batch:", error);
    return { success: false, error: "Eroare la anularea importului" };
  }
}

async function buildRollbackPreviewInternal(
  tenantId: string,
  batchId: string
): Promise<ActionResult<RollbackPreviewResult>> {
  const batch = await prisma.importBatch.findFirst({
    where: { id: batchId, tenantId },
    select: { id: true, status: true },
  });

  if (!batch) return { success: false, error: "Batch-ul nu a fost gasit" };

  const ledgerRows = await prisma.importRowLedger.findMany({
    where: {
      tenantId,
      batchId,
      status: "imported",
      entityRecordId: { not: null },
    },
    select: {
      entityType: true,
      entityRecordId: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const countsByEntity: Record<ImportEntityType, number> = {
    contribuabil: 0,
    proprietate_cladire: 0,
    proprietate_teren: 0,
    proprietate_vehicul: 0,
  };

  for (const row of ledgerRows) {
    if (row.entityType in countsByEntity) {
      countsByEntity[row.entityType as ImportEntityType] += 1;
    }
  }

  return {
    success: true,
    data: {
      batchId,
      status: batch.status,
      canRollback: batch.status !== "rolled_back",
      importedRecords: ledgerRows.length,
      countsByEntity,
      sampleRecordIds: ledgerRows
        .slice(0, 10)
        .map((r) => r.entityRecordId)
        .filter((v): v is string => typeof v === "string"),
    },
  };
}

export async function getRollbackPreview(
  id: string
): Promise<ActionResult<RollbackPreviewResult>> {
  const session = await requireAdmin();
  if (!session?.user?.tenantId) return { success: false, error: "No tenant context" };
  await setTenantContext(session.user.tenantId);
  return buildRollbackPreviewInternal(session.user.tenantId, id);
}

export async function rollbackImportBatchConfirmed(
  id: string,
  confirmed: boolean
): Promise<ActionResult> {
  if (!confirmed) {
    return { success: false, error: "Confirmarea rollback-ului este obligatorie" };
  }
  return rollbackImportBatch(id);
}

type ColumnMap = Record<string, number>;

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
