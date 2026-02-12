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
 * Handles up to millions.
 */
export function numberToWords(n: number): string {
  if (n === 0) return "zero";

  const units = [
    "", "unu", "doi", "trei", "patru", "cinci",
    "șase", "șapte", "opt", "nouă",
  ];
  const teens = [
    "zece", "unsprezece", "doisprezece", "treisprezece", "paisprezece",
    "cincisprezece", "șaisprezece", "șaptesprezece", "optsprezece", "nouăsprezece",
  ];
  const tens = [
    "", "", "douăzeci", "treizeci", "patruzeci", "cincizeci",
    "șaizeci", "șaptezeci", "optzeci", "nouăzeci",
  ];

  function chunk(num: number): string {
    if (num === 0) return "";
    if (num < 10) return units[num];
    if (num < 20) return teens[num - 10];
    if (num < 100) {
      const t = Math.floor(num / 10);
      const u = num % 10;
      return tens[t] + (u > 0 ? " și " + units[u] : "");
    }
    if (num < 1000) {
      const h = Math.floor(num / 100);
      const rest = num % 100;
      const hWord = h === 1 ? "o sută" : h === 2 ? "două sute" : units[h] + " sute";
      return hWord + (rest > 0 ? " " + chunk(rest) : "");
    }
    return "";
  }

  const parts: string[] = [];
  const wholeNum = Math.floor(Math.abs(n));
  const bani = Math.round((Math.abs(n) - wholeNum) * 100);

  if (wholeNum >= 1000000) {
    const mil = Math.floor(wholeNum / 1000000);
    parts.push(mil === 1 ? "un milion" : mil === 2 ? "două milioane" : chunk(mil) + " milioane");
  }
  const afterMil = wholeNum % 1000000;
  if (afterMil >= 1000) {
    const thou = Math.floor(afterMil / 1000);
    parts.push(thou === 1 ? "o mie" : thou === 2 ? "două mii" : chunk(thou) + " mii");
  }
  const hundreds = afterMil % 1000;
  if (hundreds > 0) {
    parts.push(chunk(hundreds));
  }

  let result = parts.join(" ") || "zero";
  if (n < 0) result = "minus " + result;

  if (bani > 0) {
    result += ` lei și ${chunk(bani)} bani`;
  } else {
    result += " lei";
  }

  return result;
}

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
