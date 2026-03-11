import { FISCAL_ENTRIES, type FiscalEntry } from "./fiscal-knowledge";
import { getGatewayHeaders, getLLMConfig } from "@/lib/ai/config";

// Normalize Romanian diacritics and text for search
const normalizeText = (value: string): string =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export interface SearchResult {
  entry: FiscalEntry;
  score: number;
  matchedKeywords: string[];
}

/**
 * Search the fiscal knowledge base using keyword overlap scoring.
 * Returns top `limit` results sorted by relevance.
 */
export function searchRegulations(
  query: string,
  limit = 5
): SearchResult[] {
  if (!query.trim()) return [];

  const normalizedQuery = normalizeText(query);
  const queryTokens = normalizedQuery.split(" ").filter((t) => t.length > 1);

  const results: SearchResult[] = [];

  for (const entry of FISCAL_ENTRIES) {
    const matchedKeywords: string[] = [];
    let score = 0;

    // Check keyword matches
    for (const keyword of entry.keywords) {
      const normalizedKeyword = normalizeText(keyword);
      if (!normalizedKeyword) continue;

      // Full keyword match in query
      if (normalizedQuery.includes(normalizedKeyword)) {
        matchedKeywords.push(keyword);
        score += 3;
        continue;
      }

      // Partial: check if any query token appears in keyword or vice versa
      const keywordTokens = normalizedKeyword.split(" ");
      for (const kt of keywordTokens) {
        if (kt.length < 3) continue;
        for (const qt of queryTokens) {
          if (qt.length < 3) continue;
          if (qt.includes(kt) || kt.includes(qt)) {
            matchedKeywords.push(keyword);
            score += 1;
            break;
          }
        }
        if (matchedKeywords.includes(keyword)) break;
      }
    }

    // Check title match
    const normalizedTitle = normalizeText(entry.title);
    for (const qt of queryTokens) {
      if (qt.length >= 3 && normalizedTitle.includes(qt)) {
        score += 2;
      }
    }

    // Check article number match
    const normalizedArticle = normalizeText(entry.article);
    if (normalizedQuery.includes(normalizedArticle) || normalizedArticle.includes(normalizedQuery)) {
      score += 5;
    }

    // Check content for additional relevance
    const normalizedContent = normalizeText(entry.content);
    for (const qt of queryTokens) {
      if (qt.length >= 4 && normalizedContent.includes(qt)) {
        score += 0.5;
      }
    }

    if (score > 0) {
      results.push({
        entry,
        score,
        matchedKeywords: Array.from(new Set(matchedKeywords)),
      });
    }
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Optional: enhance search with the AI gateway for better relevance.
 * Falls back to keyword search if the gateway is unavailable.
 */
export async function searchRegulationsEnhanced(
  query: string,
  limit = 5
): Promise<SearchResult[]> {
  const keywordResults = searchRegulations(query, limit * 2);
  const config = getLLMConfig();

  if (config.provider !== "gateway" || keywordResults.length === 0) {
    return keywordResults.slice(0, limit);
  }

  try {
    const context = keywordResults
      .slice(0, 10)
      .map((r, i) => `[${i}] ${r.entry.article} - ${r.entry.title}: ${r.entry.content.slice(0, 150)}`)
      .join("\n");

    const response = await fetch(`${config.baseUrl!.replace(/\/+$/, "")}/v1/chat/completions`, {
      method: "POST",
      headers: getGatewayHeaders(config),
      body: JSON.stringify({
        model: config.model,
        temperature: 0,
        ...(config.gatewayProvider && { provider: config.gatewayProvider }),
        messages: [
          {
            role: "system",
            content:
              "Ești un asistent juridic. Primești o întrebare și o listă de articole de lege. Returnează DOAR indicii articolelor cele mai relevante, separate prin virgulă (ex: 0,3,5). Maximum 5 indici.",
          },
          {
            role: "user",
            content: `Întrebare: ${query}\n\nArticole:\n${context}`,
          },
        ],
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) return keywordResults.slice(0, limit);

    const data = await response.json();
    const answer = data?.choices?.[0]?.message?.content?.trim() || "";
    const indices = answer
      .match(/\d+/g)
      ?.map(Number)
      .filter((i: number) => i >= 0 && i < keywordResults.length) || [];

    if (indices.length === 0) return keywordResults.slice(0, limit);

    // Reorder based on LLM ranking
    const reranked = indices.map((i: number) => keywordResults[i]);
    // Add any remaining results not in the LLM selection
    for (const r of keywordResults) {
      if (!reranked.includes(r) && reranked.length < limit) {
        reranked.push(r);
      }
    }

    return reranked.slice(0, limit);
  } catch {
    return keywordResults.slice(0, limit);
  }
}
