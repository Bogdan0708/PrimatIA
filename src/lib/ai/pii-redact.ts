/**
 * PII redaction for AI Gateway queries.
 * Strips CNP, email, and phone numbers before sending to external LLMs.
 */

// Romanian CNP: 13 digits starting with 1-8
const CNP_REGEX = /\b[1-8]\d{12}\b/g;

// Email addresses
const EMAIL_REGEX = /\b[\w.+-]+@[\w.-]+\.\w{2,}\b/g;

// Romanian phone formats: +40/0 followed by 9 digits (various separators)
const PHONE_REGEX = /(?<!\d)\+?(?:4\s*0|0)\s*[- ]?\d{2,3}[- ]?\d{3}[- ]?\d{3,4}\b/g;

/**
 * Redacts personally identifiable information from text before sending to LLM.
 * Preserves the original text structure so the LLM can still understand context.
 */
export function redactPII(text: string): string {
  return text
    .replace(CNP_REGEX, "[CNP_REDACTED]")
    .replace(EMAIL_REGEX, "[EMAIL_REDACTED]")
    .replace(PHONE_REGEX, "[PHONE_REDACTED]");
}
