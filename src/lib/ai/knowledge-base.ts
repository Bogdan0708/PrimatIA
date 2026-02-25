/**
 * RAG Knowledge Base for the PrimărIA chatbot.
 *
 * Strategy:
 * 1. Try LLM (Claude/GPT/LM Studio) with context from keyword search
 * 2. Fall back to keyword-based retrieval if no LLM available
 *
 * pgvector integration is optional — when ENABLE_PGVECTOR=true and the
 * extension is installed, embeddings are used for semantic search.
 * Otherwise, the enhanced keyword search from fiscal-knowledge.ts is used.
 */

import { searchRegulations } from "@/lib/search/regulation-search";
import { CHATBOT_ENTRIES, type ChatbotEntry } from "@/lib/chatbot/knowledge";
import { getLLMConfig } from "./config";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RAGContext {
  content: string;
  source: string;
  relevanceScore: number;
}

export interface RAGResponse {
  answer: string;
  sources: string[];
  citations: { article: string; title: string }[];
  usedLLM: boolean;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// ---------------------------------------------------------------------------
// Context retrieval (keyword-based, with optional pgvector upgrade path)
// ---------------------------------------------------------------------------

export function retrieveContext(query: string, topK: number = 5): RAGContext[] {
  const contexts: RAGContext[] = [];

  // 1. Search fiscal regulation entries (Cod Fiscal articles)
  const regulationResults = searchRegulations(query, topK);
  for (const result of regulationResults) {
    const e = result.entry;
    contexts.push({
      content: `${e.article ? `Art. ${e.article}: ` : ""}${e.title}\n${e.content}`,
      source: e.article ? `Cod Fiscal, Art. ${e.article}` : e.title,
      relevanceScore: 0.8,
    });
  }

  // 2. Search chatbot FAQ entries
  const normalizedQuery = query
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .trim();

  const faqResults = CHATBOT_ENTRIES
    .map((entry) => {
      let score = 0;
      for (const keyword of entry.keywords) {
        const normalizedKeyword = keyword
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");
        if (normalizedQuery.includes(normalizedKeyword)) {
          score += 2;
        }
      }
      return { entry, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  for (const { entry } of faqResults) {
    contexts.push({
      content: `Întrebare: ${entry.question}\nRăspuns: ${entry.answer}`,
      source: entry.sources.join(", "),
      relevanceScore: 0.7,
    });
  }

  // Sort by relevance and limit
  return contexts
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, topK);
}

// ---------------------------------------------------------------------------
// LLM call abstraction
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `Ești asistentul virtual PrimărIA pentru taxe și impozite locale din România.

Reguli:
- Răspunde în limba română, politicos și concis
- Citează întotdeauna articolele din Codul Fiscal când este relevant (ex: "conform Art. 457 Cod Fiscal")
- Dacă informația vine dintr-o Hotărâre a Consiliului Local (HCL), menționează acest lucru
- Dacă nu ești sigur de un răspuns, spune clar că utilizatorul trebuie să verifice la primărie
- Nu inventa informații — bazează-te strict pe contextul furnizat
- Formatează răspunsul clar, cu paragrafe scurte
- Nu folosi markdown sau formatare specială — doar text simplu`;

async function callLLM(
  messages: { role: string; content: string }[],
  config: ReturnType<typeof getLLMConfig>,
): Promise<string | null> {
  try {
    if (config.provider === "gateway" || config.provider === "openai" || config.provider === "lm_studio") {
      const isGateway = config.provider === "gateway";
      const isLM = config.provider === "lm_studio";
      
      let url: string;
      const headers: Record<string, string> = { "Content-Type": "application/json" };

      if (isGateway) {
        url = `${config.baseUrl!.replace(/\/+$/, "")}/v1/chat/completions`;
        headers["Authorization"] = `Bearer ${config.apiKey}`;
      } else if (isLM) {
        const baseUrl = config.baseUrl!.replace(/\/+$/, "");
        url = baseUrl.endsWith("/v1") ? `${baseUrl}/chat/completions` : `${baseUrl}/v1/chat/completions`;
      } else {
        url = "https://api.openai.com/v1/chat/completions";
        headers["Authorization"] = `Bearer ${config.apiKey}`;
      }

      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: config.model,
          temperature: 0.2,
          max_tokens: 600,
          messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
          // Pass provider to gateway for internal routing if needed
          ...(isGateway && { provider: config.model === "gemini" ? "gemini" : config.model }),
        }),
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) return null;
      const data = await response.json();
      return data?.choices?.[0]?.message?.content?.trim() || null;
    }

    if (config.provider === "claude") {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": config.apiKey!,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: config.model,
          max_tokens: 600,
          system: SYSTEM_PROMPT,
          messages: messages.map((m) => ({
            role: m.role === "system" ? "user" : m.role,
            content: m.content,
          })),
        }),
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) return null;
      const data = await response.json();
      return data?.content?.[0]?.text?.trim() || null;
    }

    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Streaming LLM call (for SSE responses)
// ---------------------------------------------------------------------------

export async function* streamLLMResponse(
  query: string,
  history: ChatMessage[],
): AsyncGenerator<string> {
  const config = getLLMConfig();
  const contexts = retrieveContext(query);

  const contextText = contexts
    .map((c) => `[${c.source}]\n${c.content}`)
    .join("\n\n");

  const userPrompt = contextText
    ? `Context din legislație și FAQ:\n${contextText}\n\nÎntrebarea cetățeanului: ${query}`
    : `Întrebarea cetățeanului: ${query}`;

  // For streaming, we need the OpenAI-compatible API (Gateway, LM Studio or OpenAI)
  if (config.provider === "gateway" || config.provider === "openai" || config.provider === "lm_studio") {
    let baseUrl: string;
    const headers: Record<string, string> = { "Content-Type": "application/json" };

    if (config.provider === "gateway") {
      baseUrl = `${config.baseUrl!.replace(/\/+$/, "")}/v1/chat/completions`;
      headers["Authorization"] = `Bearer ${config.apiKey}`;
    } else if (config.provider === "lm_studio") {
      const trimmed = config.baseUrl!.replace(/\/+$/, "");
      baseUrl = trimmed.endsWith("/v1") ? `${trimmed}/chat/completions` : `${trimmed}/v1/chat/completions`;
    } else {
      baseUrl = "https://api.openai.com/v1/chat/completions";
      headers.Authorization = `Bearer ${config.apiKey}`;
    }

    try {
      const response = await fetch(baseUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: config.model,
          temperature: 0.2,
          max_tokens: 600,
          stream: true,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...history.map((m) => ({ role: m.role, content: m.content })),
            { role: "user", content: userPrompt },
          ],
          ...(config.provider === "gateway" && { provider: config.model === "gemini" ? "gemini" : config.model }),
        }),
        signal: AbortSignal.timeout(30_000),
      });

      if (!response.ok || !response.body) {
        // Fall back to non-streaming
        const fallback = await generateRAGResponse(query, history);
        yield fallback.answer;
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            if (data === "[DONE]") return;
            try {
              const parsed = JSON.parse(data);
              const delta = parsed?.choices?.[0]?.delta?.content;
              if (delta) yield delta;
            } catch {
              // Skip malformed SSE chunks
            }
          }
        }
      }
    } catch {
      const fallback = await generateRAGResponse(query, history);
      yield fallback.answer;
    }
    return;
  }

  // For Claude or no LLM, use non-streaming
  const result = await generateRAGResponse(query, history);
  yield result.answer;
}

// ---------------------------------------------------------------------------
// Main RAG pipeline (non-streaming)
// ---------------------------------------------------------------------------

export async function generateRAGResponse(
  query: string,
  history: ChatMessage[] = [],
): Promise<RAGResponse> {
  const contexts = retrieveContext(query);
  const config = getLLMConfig();

  // Extract citations from retrieved contexts
  const citations: { article: string; title: string }[] = [];
  for (const ctx of contexts) {
    const articleMatch = ctx.source.match(/Art\.\s*(\d+)/);
    if (articleMatch) {
      citations.push({ article: articleMatch[1], title: ctx.source });
    }
  }

  const sources = Array.from(new Set(contexts.map((c) => c.source)));

  // If no LLM available, use keyword-based fallback
  if (config.provider === "none") {
    return buildKeywordFallback(query, contexts, sources, citations);
  }

  // Build LLM prompt with retrieved context
  const contextText = contexts
    .map((c) => `[${c.source}]\n${c.content}`)
    .join("\n\n");

  const userPrompt = contextText
    ? `Context din legislație și FAQ:\n${contextText}\n\nÎntrebarea cetățeanului: ${query}`
    : `Întrebarea cetățeanului: ${query}`;

  const messages = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: userPrompt },
  ];

  const llmAnswer = await callLLM(messages, config);

  if (llmAnswer) {
    // Sanitize HTML
    const sanitized = llmAnswer.replace(/<[^>]*>/g, "");
    return { answer: sanitized, sources, citations, usedLLM: true };
  }

  // LLM failed — fall back to keyword
  return buildKeywordFallback(query, contexts, sources, citations);
}

// ---------------------------------------------------------------------------
// Keyword fallback (existing behavior)
// ---------------------------------------------------------------------------

function buildKeywordFallback(
  query: string,
  _contexts: RAGContext[],
  fallbackSources: string[],
  citations: { article: string; title: string }[],
): RAGResponse {
  // Find best FAQ match
  const normalizedQuery = query
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .trim();

  let bestMatch: ChatbotEntry | null = null;
  let bestScore = 0;

  for (const entry of CHATBOT_ENTRIES) {
    let score = 0;
    for (const keyword of entry.keywords) {
      const normalized = keyword
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      if (normalizedQuery.includes(normalized)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = entry;
    }
  }

  if (bestMatch) {
    return {
      answer: bestMatch.answer,
      sources: [...bestMatch.sources, ...fallbackSources].filter((v, i, a) => a.indexOf(v) === i),
      citations,
      usedLLM: false,
    };
  }

  // No match at all
  return {
    answer:
      "Îmi pare rău, nu am găsit un răspuns clar. Te rog reformulează întrebarea sau folosește pagina Contact pentru asistență.",
    sources: fallbackSources.length > 0 ? fallbackSources : ["Portal PrimărIA"],
    citations: [],
    usedLLM: false,
  };
}

// ---------------------------------------------------------------------------
// Suggested questions (for chatbot UI)
// ---------------------------------------------------------------------------

export function getSuggestedQuestions(): string[] {
  return [
    "deadlines",
    "payOnline",
    "bonificatie",
    "certificate",
    "penalties",
  ];
}
