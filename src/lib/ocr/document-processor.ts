/**
 * OCR Document Processor
 * Extracts structured data from Romanian official documents using regex patterns
 * and optional LM Studio vision/text extraction.
 */

// ============================================================================
// Types
// ============================================================================

export type DocumentType = 'carte_identitate' | 'certificat_auto' | 'act_proprietate' | 'certificat_urbanism';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface ExtractedField {
  key: string;
  label: string;
  value: string | null;
  confidence: ConfidenceLevel;
}

export interface ExtractionResult {
  documentType: DocumentType;
  fields: ExtractedField[];
  rawText: string;
}

// ============================================================================
// Romanian Document Patterns
// ============================================================================

const PATTERNS = {
  // CNP: 13 digits, starts with 1-8
  cnp: /\b([1-8]\d{12})\b/,
  // Serie CI: 2 uppercase letters
  serieCi: /\b(?:seria?\s*)([A-Z]{2})\b/i,
  // Nr CI: 6 digits after serie
  nrCi: /\b(?:nr\.?\s*)(\d{6})\b/i,
  // Nume (after NUME/NUMELE)
  nume: /(?:NUME(?:LE)?|Nume(?:le)?)\s*[:\s]+([A-ZĂÂÎȘȚ][A-ZĂÂÎȘȚa-zăâîșț-]+)/,
  // Prenume (after PRENUME/PRENUMELE)
  prenume: /(?:PRENUME(?:LE)?|Prenume(?:le)?)\s*[:\s]+([A-ZĂÂÎȘȚ][A-ZĂÂÎȘȚa-zăâîșț\s-]+)/,
  // Adresa
  adresa: /(?:DOMICILIU|ADRES[AĂ]|Dom\.?|Adr\.?)\s*[:\s]+(.+?)(?:\n|$)/i,
  // Nr înmatriculare: XX-NN-XXX or B-NNN-XXX
  nrInmatriculare: /\b([A-Z]{1,2}[-\s]?\d{2,3}[-\s]?[A-Z]{3})\b/,
  // Marca auto
  marca: /(?:MARC[AĂ]|Marca)\s*[:\s]+([A-Za-z0-9\s-]+?)(?:\n|,|$)/i,
  // Model auto
  model: /(?:MODEL|Modelul?)\s*[:\s]+([A-Za-z0-9\s.-]+?)(?:\n|,|$)/i,
  // An fabricatie: 4 digits 19xx or 20xx
  anFabricatie: /(?:AN(?:UL)?\s*(?:DE\s*)?FABRICA[ȚT]IE|an\s*fab\.?)\s*[:\s]*(\d{4})/i,
  // Capacitate cilindrica: number + cm³/cmc
  capacitateCilindrica: /(?:CAPACITATE\s*CILINDRIC[AĂ]|cap\.?\s*cil\.?|c\.?c\.?)\s*[:\s]*(\d{3,5})\s*(?:cm[³3]|cmc)?/i,
  // Serie sasiu / VIN: 17 alphanumeric chars
  serieSasiu: /(?:SERIE\s*[SȘ]ASIU|VIN|Nr\.?\s*identificare)\s*[:\s]*([A-HJ-NPR-Z0-9]{17})/i,
  // Suprafata: number + mp/m²/ha
  suprafata: /(?:SUPRAFA[ȚT][AĂ]|S(?:up)?\.?)\s*[:\s]*(\d+[.,]?\d*)\s*(mp|m²|m2|ha)/i,
  // Tip constructie
  tipConstructie: /(?:TIP\s*(?:CONSTRUC[ȚT]IE)?|Destinatie)\s*[:\s]+([A-Za-zĂÂÎȘȚăâîșț\s]+?)(?:\n|,|$)/i,
  // An constructie
  anConstructie: /(?:AN(?:UL)?\s*(?:DE\s*)?CONSTRUC[ȚT]IE|an\s*constr\.?)\s*[:\s]*(\d{4})/i,
  // Zona
  zona: /(?:ZON[AĂ])\s*[:\s]*([A-D]|\d|[A-Za-zĂÂÎȘȚăâîșț\s]+?)(?:\n|,|$)/i,
  // Destinatie
  destinatie: /(?:DESTINA[ȚT]IE)\s*[:\s]+([A-Za-zĂÂÎȘȚăâîșț\s]+?)(?:\n|,|$)/i,
} as const;

// ============================================================================
// Extraction Functions per Document Type
// ============================================================================

function extractCarteIdentitate(text: string): ExtractedField[] {
  return [
    matchField(text, 'nume', 'Nume', PATTERNS.nume),
    matchField(text, 'prenume', 'Prenume', PATTERNS.prenume),
    matchField(text, 'cnp', 'CNP', PATTERNS.cnp),
    matchField(text, 'seria', 'Seria', PATTERNS.serieCi),
    matchField(text, 'nr', 'Nr.', PATTERNS.nrCi),
    matchField(text, 'adresa', 'Adresă', PATTERNS.adresa),
  ];
}

function extractCertificatAuto(text: string): ExtractedField[] {
  return [
    matchField(text, 'nrInmatriculare', 'Nr. înmatriculare', PATTERNS.nrInmatriculare),
    matchField(text, 'marca', 'Marcă', PATTERNS.marca),
    matchField(text, 'model', 'Model', PATTERNS.model),
    matchField(text, 'anFabricatie', 'An fabricație', PATTERNS.anFabricatie),
    matchField(text, 'capacitateCilindrica', 'Capacitate cilindrică (cm³)', PATTERNS.capacitateCilindrica),
    matchField(text, 'serieSasiu', 'Serie șasiu (VIN)', PATTERNS.serieSasiu),
  ];
}

function extractActProprietate(text: string): ExtractedField[] {
  const suprafataMatch = text.match(PATTERNS.suprafata);
  const suprafataField: ExtractedField = suprafataMatch
    ? { key: 'suprafata', label: 'Suprafață', value: `${suprafataMatch[1]} ${suprafataMatch[2]}`, confidence: 'high' }
    : { key: 'suprafata', label: 'Suprafață', value: null, confidence: 'low' };

  return [
    suprafataField,
    matchField(text, 'adresa', 'Adresă', PATTERNS.adresa),
    matchField(text, 'tipConstructie', 'Tip construcție', PATTERNS.tipConstructie),
    matchField(text, 'anConstructie', 'An construcție', PATTERNS.anConstructie),
  ];
}

function extractCertificatUrbanism(text: string): ExtractedField[] {
  const suprafataMatch = text.match(PATTERNS.suprafata);
  const suprafataField: ExtractedField = suprafataMatch
    ? { key: 'suprafataTeren', label: 'Suprafață teren', value: `${suprafataMatch[1]} ${suprafataMatch[2]}`, confidence: 'high' }
    : { key: 'suprafataTeren', label: 'Suprafață teren', value: null, confidence: 'low' };

  return [
    suprafataField,
    matchField(text, 'zona', 'Zonă', PATTERNS.zona),
    matchField(text, 'destinatie', 'Destinație', PATTERNS.destinatie),
  ];
}

// ============================================================================
// Helpers
// ============================================================================

function matchField(
  text: string,
  key: string,
  label: string,
  pattern: RegExp
): ExtractedField {
  const match = text.match(pattern);
  if (match && match[1]) {
    return { key, label, value: match[1].trim(), confidence: 'high' };
  }
  return { key, label, value: null, confidence: 'low' };
}

// ============================================================================
// Optional: LM Studio AI extraction fallback
// ============================================================================

const LM_STUDIO_URL = process.env.LM_STUDIO_URL || 'http://172.25.208.1:1234/v1';

async function aiExtractText(
  text: string,
  documentType: DocumentType
): Promise<ExtractedField[]> {
  const typeLabels: Record<DocumentType, string> = {
    carte_identitate: 'carte de identitate',
    certificat_auto: 'certificat de înmatriculare auto',
    act_proprietate: 'act de proprietate / contract de vânzare-cumpărare',
    certificat_urbanism: 'certificat de urbanism',
  };

  const fieldsByType: Record<DocumentType, string[]> = {
    carte_identitate: ['nume', 'prenume', 'cnp', 'seria', 'nr', 'adresa'],
    certificat_auto: ['nrInmatriculare', 'marca', 'model', 'anFabricatie', 'capacitateCilindrica', 'serieSasiu'],
    act_proprietate: ['suprafata', 'adresa', 'tipConstructie', 'anConstructie'],
    certificat_urbanism: ['suprafataTeren', 'zona', 'destinatie'],
  };

  try {
    const response = await fetch(`${LM_STUDIO_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-oss-20b',
        messages: [
          {
            role: 'system',
            content: `Extract fields from a Romanian ${typeLabels[documentType]}. Return ONLY valid JSON with these keys: ${fieldsByType[documentType].join(', ')}. Use null for missing fields.`,
          },
          { role: 'user', content: text },
        ],
        temperature: 0.1,
        max_tokens: 500,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) return [];

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Try to parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]);
    return Object.entries(parsed)
      .filter(([, v]) => v !== null && v !== '')
      .map(([key, value]) => ({
        key,
        label: key,
        value: String(value),
        confidence: 'medium' as ConfidenceLevel,
      }));
  } catch {
    return [];
  }
}

// ============================================================================
// Main Processing Function
// ============================================================================

export async function processDocument(
  text: string,
  documentType: DocumentType,
  useAi: boolean = false
): Promise<ExtractionResult> {
  // Step 1: Regex extraction
  let fields: ExtractedField[];
  switch (documentType) {
    case 'carte_identitate':
      fields = extractCarteIdentitate(text);
      break;
    case 'certificat_auto':
      fields = extractCertificatAuto(text);
      break;
    case 'act_proprietate':
      fields = extractActProprietate(text);
      break;
    case 'certificat_urbanism':
      fields = extractCertificatUrbanism(text);
      break;
  }

  // Step 2: If AI enabled, fill in missing fields
  if (useAi) {
    const missingKeys = fields.filter(f => !f.value).map(f => f.key);
    if (missingKeys.length > 0) {
      const aiFields = await aiExtractText(text, documentType);
      for (const aiField of aiFields) {
        const idx = fields.findIndex(f => f.key === aiField.key && !f.value);
        if (idx >= 0) {
          fields[idx].value = aiField.value;
          fields[idx].confidence = 'medium';
        }
      }
    }
  }

  return { documentType, fields, rawText: text };
}

// ============================================================================
// Document Type Labels (for UI)
// ============================================================================

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, { ro: string; en: string; hu: string }> = {
  carte_identitate: {
    ro: 'Carte de identitate (CI/BI)',
    en: 'Identity Card',
    hu: 'Személyi igazolvány',
  },
  certificat_auto: {
    ro: 'Certificat de înmatriculare auto',
    en: 'Vehicle Registration Certificate',
    hu: 'Gépjármű forgalmi engedély',
  },
  act_proprietate: {
    ro: 'Act de proprietate / Contract vânzare-cumpărare',
    en: 'Property Deed / Sales Contract',
    hu: 'Tulajdoni lap / Adásvételi szerződés',
  },
  certificat_urbanism: {
    ro: 'Certificat de urbanism',
    en: 'Urban Planning Certificate',
    hu: 'Városrendezési bizonyítvány',
  },
};
