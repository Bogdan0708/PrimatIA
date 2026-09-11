/**
 * ANAF CUI/CNP Validation
 *
 * Validates company CUI (Cod Unic de Identificare) against
 * ANAF's public web service. No authentication required.
 *
 * API docs: https://webservicesp.anaf.ro/PlatitorTvaRest/api/v8/ws/tva
 *
 * Also provides offline CNP (Cod Numeric Personal) validation
 * using Romania's standard check-digit algorithm.
 */

export interface AnafCompanyInfo {
  cui: string;
  name: string;
  address: string;
  county: string;
  city: string;
  isActive: boolean;
  isVatPayer: boolean;
  vatCode?: string;
  registrationDate?: string;
  fiscalStatus?: string;
}

export interface CuiValidationResult {
  valid: boolean;
  company?: AnafCompanyInfo;
  error?: string;
}

export interface CnpValidationResult {
  valid: boolean;
  gender?: "M" | "F";
  birthDate?: string;
  countyCode?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// CUI Validation via ANAF Public API
// ---------------------------------------------------------------------------

/**
 * Validate a CUI against the ANAF public web service.
 * Returns company information if the CUI is valid and active.
 *
 * Rate limit: max 100 CUIs per request, ~1 request/second recommended.
 */
export async function validateCui(cui: string): Promise<CuiValidationResult> {
  // Clean the CUI: strip "RO" prefix and non-digits
  const cleanCui = cui.replace(/^RO/i, "").replace(/\D/g, "");

  if (!cleanCui || cleanCui.length < 2 || cleanCui.length > 10) {
    return { valid: false, error: "CUI invalid: trebuie să conțină 2-10 cifre" };
  }

  // Offline check digit validation first
  if (!validateCuiCheckDigit(cleanCui)) {
    return { valid: false, error: "CUI invalid: cifra de control incorectă" };
  }

  try {
    const today = new Date().toISOString().split("T")[0];
    const response = await fetch(
      "https://webservicesp.anaf.ro/PlatitorTvaRest/api/v8/ws/tva",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([{ cui: parseInt(cleanCui, 10), data: today }]),
        signal: AbortSignal.timeout(15_000),
      },
    );

    if (!response.ok) {
      return { valid: false, error: `ANAF API error: HTTP ${response.status}` };
    }

    const data = (await response.json()) as {
      found?: Array<{
        date_generale?: {
          cui?: number;
          denumire?: string;
          adresa?: string;
          judet?: string;
          localitate?: string;
          stare_inregistrare?: string;
          data_inregistrare?: string;
          cod_postal?: string;
          scpTVA?: boolean;
          statusInactivi?: boolean;
        };
        inregistrare_scop_Tva?: {
          scpTVA?: boolean;
          data_inceput_ScpTVA?: string;
        };
      }>;
      notfound?: Array<{ cui?: number }>;
    };

    if (data.notfound && data.notfound.length > 0) {
      return { valid: false, error: "CUI negăsit în baza de date ANAF" };
    }

    const found = data.found?.[0];
    if (!found?.date_generale) {
      return { valid: false, error: "Răspuns ANAF incomplet" };
    }

    const gen = found.date_generale;
    const isActive = !gen.statusInactivi &&
      gen.stare_inregistrare?.toLowerCase() !== "radiat";

    return {
      valid: true,
      company: {
        cui: cleanCui,
        name: gen.denumire || "",
        address: gen.adresa || "",
        county: gen.judet || "",
        city: gen.localitate || "",
        isActive,
        isVatPayer: Boolean(gen.scpTVA || found.inregistrare_scop_Tva?.scpTVA),
        vatCode: gen.scpTVA ? `RO${cleanCui}` : undefined,
        registrationDate: gen.data_inregistrare || undefined,
        fiscalStatus: gen.stare_inregistrare || undefined,
      },
    };
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : "ANAF request failed",
    };
  }
}

/**
 * Batch validate multiple CUIs against ANAF.
 * ANAF allows up to 100 CUIs per request.
 */
export async function validateCuiBatch(
  cuis: string[],
): Promise<Map<string, CuiValidationResult>> {
  const results = new Map<string, CuiValidationResult>();

  // Process in chunks of 100 (ANAF limit)
  for (let i = 0; i < cuis.length; i += 100) {
    const chunk = cuis.slice(i, i + 100);
    const promises = chunk.map((cui) => validateCui(cui));
    const chunkResults = await Promise.all(promises);
    chunk.forEach((cui, idx) => results.set(cui, chunkResults[idx]));
  }

  return results;
}

// ---------------------------------------------------------------------------
// CUI Check Digit (offline validation)
// ---------------------------------------------------------------------------

export function validateCuiCheckDigit(cui: string): boolean {
  const weights = [7, 5, 3, 2, 1, 7, 5, 3, 2];
  const digits = cui.split("").map(Number);

  if (digits.length < 2 || digits.length > 10) return false;

  const checkDigit = digits[digits.length - 1];
  const body = digits.slice(0, -1);

  // Pad with leading zeros to align with weights (right-aligned)
  const padded = new Array(9 - body.length).fill(0).concat(body);

  const sum = padded.reduce((acc, d, i) => acc + d * weights[i], 0);
  const remainder = (sum * 10) % 11;
  const expected = remainder === 10 ? 0 : remainder;

  return checkDigit === expected;
}

// ---------------------------------------------------------------------------
// CNP Validation (offline)
// ---------------------------------------------------------------------------

const CNP_WEIGHTS = [2, 7, 9, 1, 4, 6, 3, 5, 8, 2, 7, 9];

const COUNTY_CODES: Record<string, string> = {
  "01": "Alba", "02": "Arad", "03": "Argeș", "04": "Bacău",
  "05": "Bihor", "06": "Bistrița-Năsăud", "07": "Botoșani", "08": "Brașov",
  "09": "Brăila", "10": "Buzău", "11": "Caraș-Severin", "12": "Cluj",
  "13": "Constanța", "14": "Covasna", "15": "Dâmbovița", "16": "Dolj",
  "17": "Galați", "18": "Gorj", "19": "Harghita", "20": "Hunedoara",
  "21": "Ialomița", "22": "Iași", "23": "Ilfov", "24": "Maramureș",
  "25": "Mehedinți", "26": "Mureș", "27": "Neamț", "28": "Olt",
  "29": "Prahova", "30": "Satu Mare", "31": "Sălaj", "32": "Sibiu",
  "33": "Suceava", "34": "Teleorman", "35": "Timiș", "36": "Tulcea",
  "37": "Vaslui", "38": "Vâlcea", "39": "Vrancea", "40": "București",
  "41": "București S1", "42": "București S2", "43": "București S3",
  "44": "București S4", "45": "București S5", "46": "București S6",
  "51": "Călărași", "52": "Giurgiu",
};

/**
 * Validate a Romanian CNP (Cod Numeric Personal) offline.
 * Checks format, check digit, and extracts demographic info.
 */
export function validateCnp(cnp: string): CnpValidationResult {
  const cleaned = cnp.replace(/\D/g, "");

  if (cleaned.length !== 13) {
    return { valid: false, error: "CNP trebuie să conțină exact 13 cifre" };
  }

  const digits = cleaned.split("").map(Number);
  const [s, y1, y2, m1, m2, d1, d2, c1, c2] = digits;

  // Check digit validation
  const checkSum = CNP_WEIGHTS.reduce((sum, w, i) => sum + w * digits[i], 0) % 11;
  const expectedCheck = checkSum === 10 ? 1 : checkSum;
  if (expectedCheck !== digits[12]) {
    return { valid: false, error: "CNP invalid: cifra de control incorectă" };
  }

  // Gender and century from first digit (S)
  let gender: "M" | "F";
  let century: number;
  switch (s) {
    case 1: case 3: case 5: case 7: gender = "M"; break;
    case 2: case 4: case 6: case 8: gender = "F"; break;
    default: return { valid: false, error: "CNP invalid: prima cifră incorectă" };
  }
  switch (s) {
    case 1: case 2: century = 1900; break;
    case 3: case 4: century = 1800; break;
    case 5: case 6: century = 2000; break;
    case 7: case 8: century = 1900; break; // Resident foreigners
    default: century = 1900;
  }

  const year = century + y1 * 10 + y2;
  const month = m1 * 10 + m2;
  const day = d1 * 10 + d2;

  // Basic date validation
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return { valid: false, error: "CNP invalid: dată de naștere incorectă" };
  }

  const countyCode = `${c1}${c2}`;
  const birthDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  return {
    valid: true,
    gender,
    birthDate,
    countyCode: COUNTY_CODES[countyCode] || countyCode,
  };
}
