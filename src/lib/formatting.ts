/**
 * Romanian formatting utilities for documents and reports.
 * All amounts: Romanian style (1.234,56 lei)
 * All dates: dd.MM.yyyy
 */

/**
 * Format a number in Romanian style: 1.234,56
 */
export function formatNumber(value: number, decimals: number = 2): string {
  return value.toLocaleString("ro-RO", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format an amount in RON (lei): 1.234,56 lei
 */
export function formatLei(value: number): string {
  return `${formatNumber(value, 2)} lei`;
}

/**
 * Format a date in Romanian style: dd.MM.yyyy
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const day = d.getDate().toString().padStart(2, "0");
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

/**
 * Format a date with month name in Romanian: 12 februarie 2026
 */
export function formatDateLong(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("ro-RO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Number to Romanian words (for chitanta amounts).
 * Re-exported from dedicated module for backward compatibility.
 */
export { numberToWordsRo as numberToWords } from "@/lib/formatting/number-to-words";

/**
 * Generate a sequential document number: e.g. DI-2026-000001
 */
export function generateDocumentNumber(
  prefix: string,
  year: number,
  sequence: number
): string {
  return `${prefix}-${year}-${sequence.toString().padStart(6, "0")}`;
}
