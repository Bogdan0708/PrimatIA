/**
 * EPC QR Code Generator for Romanian bank transfers.
 *
 * Generates EPC 069-12 standard QR codes that can be scanned by
 * banking apps (BT Pay, ING HomeBank, BRD, etc.) to initiate
 * a bank transfer with pre-filled data.
 *
 * Standard: European Payments Council Quick Response Code
 * https://www.europeanpaymentscouncil.eu/document-library/guidance-documents/quick-response-code-guidelines-enable-data-capture-initiation
 */

export interface EpcQrData {
  /** Beneficiary name (max 70 chars) */
  beneficiaryName: string;
  /** IBAN of the beneficiary */
  iban: string;
  /** Amount in EUR or RON */
  amount: number;
  /** Currency code (RON for Romanian) */
  currency?: string;
  /** Payment reference / code (max 35 chars) */
  reference?: string;
  /** Unstructured remittance info (max 140 chars) */
  description?: string;
  /** BIC/SWIFT code (optional, 8 or 11 chars) */
  bic?: string;
}

/**
 * Generate EPC QR code payload string.
 *
 * This returns the raw text content that should be encoded into a QR code.
 * The client can use any QR library (qrcode, qrcode-svg, etc.) to render it.
 */
export function generateEpcQrPayload(data: EpcQrData): string {
  const currency = data.currency || "RON";
  const bic = data.bic || "";

  // EPC QR Code format (line-by-line):
  // Line 1: Service Tag (BCD)
  // Line 2: Version (002)
  // Line 3: Character Set (1 = UTF-8)
  // Line 4: Identification (SCT = SEPA Credit Transfer)
  // Line 5: BIC of beneficiary bank (optional)
  // Line 6: Name of beneficiary
  // Line 7: IBAN of beneficiary
  // Line 8: Amount (EUR format: EUR12.50)
  // Line 9: Purpose of Credit Transfer (empty)
  // Line 10: Structured Remittance Reference (empty or RF reference)
  // Line 11: Unstructured Remittance Information
  // Line 12: Beneficiary to Originator Information (empty)

  const lines = [
    "BCD",                                             // Service tag
    "002",                                             // Version
    "1",                                               // UTF-8
    "SCT",                                             // SEPA Credit Transfer
    bic,                                               // BIC
    data.beneficiaryName.slice(0, 70),                // Beneficiary name
    data.iban.replace(/\s/g, ""),                      // IBAN (no spaces)
    `${currency}${data.amount.toFixed(2)}`,           // Amount
    "",                                                // Purpose
    data.reference ? data.reference.slice(0, 35) : "", // Reference
    data.description ? data.description.slice(0, 140) : "", // Description
    "",                                                // Beneficiary info
  ];

  return lines.join("\n");
}

/**
 * Generate a simple Romanian bank transfer QR payload.
 * This is a simplified version for Romanian domestic transfers.
 */
export function generateRomanianTransferQr(params: {
  beneficiary: string;
  iban: string;
  amount: number;
  reference: string;
  description?: string;
}): string {
  return generateEpcQrPayload({
    beneficiaryName: params.beneficiary,
    iban: params.iban,
    amount: params.amount,
    currency: "RON",
    reference: params.reference,
    description: params.description || `Plata impozite - Ref ${params.reference}`,
  });
}

/**
 * Generate a data URI for a QR code SVG.
 * This is a minimal QR generator for server-side rendering.
 * For client-side, use a library like `qrcode` npm package.
 *
 * Returns: the raw text payload to encode (client handles QR rendering)
 */
export function getQrPayloadForTax(params: {
  tenantName: string;
  tenantIban: string;
  amount: number;
  contribuabilName: string;
  fiscalYear: number;
  reference: string;
}): string {
  return generateRomanianTransferQr({
    beneficiary: params.tenantName,
    iban: params.tenantIban,
    amount: params.amount,
    reference: params.reference,
    description: `Impozite ${params.fiscalYear} - ${params.contribuabilName} - Ref ${params.reference}`,
  });
}
