/**
 * Convert a number to Romanian words with lei/bani.
 *
 * Handles 0–999,999,999.
 * Romanian grammar: "una sută", "două sute", "o mie", "două mii",
 * "de" connector for millions ("un milion de lei").
 *
 * @example numberToWordsRo(1234.56) → "o mie două sute treizeci și patru lei și cincizeci și șase bani"
 */

const UNITS = [
  "",
  "unu",
  "doi",
  "trei",
  "patru",
  "cinci",
  "șase",
  "șapte",
  "opt",
  "nouă",
];

const UNITS_FEM = [
  "",
  "una",
  "două",
  "trei",
  "patru",
  "cinci",
  "șase",
  "șapte",
  "opt",
  "nouă",
];

const TEENS = [
  "zece",
  "unsprezece",
  "doisprezece",
  "treisprezece",
  "paisprezece",
  "cincisprezece",
  "șaisprezece",
  "șaptesprezece",
  "optsprezece",
  "nouăsprezece",
];

const TENS = [
  "",
  "",
  "douăzeci",
  "treizeci",
  "patruzeci",
  "cincizeci",
  "șaizeci",
  "șaptezeci",
  "optzeci",
  "nouăzeci",
];

/**
 * Convert a number 0-999 to Romanian words.
 * @param feminine - use feminine forms for 1/2 (una/două vs unu/doi)
 */
function chunk(num: number, feminine: boolean = false): string {
  if (num === 0) return "";
  if (num < 10) return feminine ? UNITS_FEM[num] : UNITS[num];
  if (num < 20) return TEENS[num - 10];
  if (num < 100) {
    const t = Math.floor(num / 10);
    const u = num % 10;
    if (u === 0) return TENS[t];
    return TENS[t] + " și " + (feminine ? UNITS_FEM[u] : UNITS[u]);
  }
  // 100-999
  const h = Math.floor(num / 100);
  const rest = num % 100;
  let hWord: string;
  if (h === 1) hWord = "o sută";
  else if (h === 2) hWord = "două sute";
  else hWord = UNITS[h] + " sute";

  if (rest === 0) return hWord;
  return hWord + " " + chunk(rest, feminine);
}

export function numberToWordsRo(amount: number): string {
  const abs = Math.abs(amount);
  const wholeNum = Math.floor(abs);
  const bani = Math.round((abs - wholeNum) * 100);

  if (wholeNum === 0 && bani === 0) return "zero lei";
  if (wholeNum === 0 && bani > 0) {
    const prefix = amount < 0 ? "minus " : "";
    const baniText = bani === 1 ? "un ban" : chunk(bani, true) + " bani";
    return prefix + baniText;
  }

  const parts: string[] = [];

  // Millions (feminine: "două milioane")
  if (wholeNum >= 1000000) {
    const mil = Math.floor(wholeNum / 1000000);
    if (mil === 1) {
      parts.push("un milion");
    } else if (mil === 2) {
      parts.push("două milioane");
    } else {
      // 3-999 milioane — chunk is masculine for millions
      parts.push(chunk(mil, false) + " milioane");
    }
  }

  // Thousands (feminine: "o mie", "două mii")
  const afterMil = wholeNum % 1000000;
  if (afterMil >= 1000) {
    const thou = Math.floor(afterMil / 1000);
    if (thou === 1) {
      parts.push("o mie");
    } else if (thou === 2) {
      parts.push("două mii");
    } else {
      // 3-999 mii — chunk is feminine for thousands
      parts.push(chunk(thou, true) + " mii");
    }
  }

  // Hundreds/tens/units
  const hundreds = afterMil % 1000;
  if (hundreds > 0) {
    // The last chunk is feminine when followed by "lei" (but standard is masculine for numbers alone)
    parts.push(chunk(hundreds, false));
  }

  let result = parts.join(" ") || "zero";

  // "un leu" not "unu leu" — replace standalone "unu" at end when wholeNum is exactly 1
  if (wholeNum === 1) result = "un";

  if (amount < 0) result = "minus " + result;

  // "de" connector: used after millions when followed directly by "lei" (no thousands/hundreds)
  const needsDe = wholeNum >= 1000000 && wholeNum % 1000000 === 0;

  // Singular/plural: 1 leu, 2+ lei; 1 ban, 2+ bani
  const leiWord = wholeNum === 1 ? "leu" : "lei";
  const baniWord = bani === 1 ? "ban" : "bani";

  if (bani > 0) {
    const baniText = bani === 1 ? "un ban" : chunk(bani, true) + ` ${baniWord}`;
    result += (needsDe ? " de" : "") + ` ${leiWord} și ` + baniText;
  } else {
    result += (needsDe ? " de" : "") + ` ${leiWord}`;
  }

  return result;
}
