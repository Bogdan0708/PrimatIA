const REDACTION_RULES: Array<[RegExp, string]> = [
  [/\b[1-8]\d{12}\b/g, "[REDACTED_CNP]"],
  [/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[REDACTED_EMAIL]"],
  [/\b(?:\+4|0)?7\d{8}\b/g, "[REDACTED_PHONE]"],
  [/\bRO\d{2}[A-Z0-9]{4,30}\b/gi, "[REDACTED_IBAN]"],
  [/\b[A-HJ-NPR-Z0-9]{17}\b/g, "[REDACTED_VIN]"],
  [/(NUME(?:LE)?\s*[:\s]+)[A-ZĂÂÎȘȚ][A-ZĂÂÎȘȚa-zăâîșț-]+/gi, "$1[REDACTED_NAME]"],
  [/(PRENUME(?:LE)?\s*[:\s]+)[A-ZĂÂÎȘȚ][A-ZĂÂÎȘȚa-zăâîșț\s-]+/gi, "$1[REDACTED_NAME]"],
];

export function redactSensitiveText(input: string): string {
  return REDACTION_RULES.reduce(
    (value, [pattern, replacement]) => value.replace(pattern, replacement),
    input
  );
}
