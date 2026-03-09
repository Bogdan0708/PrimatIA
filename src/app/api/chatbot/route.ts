import { NextRequest, NextResponse } from "next/server";
import { generateRAGResponse, streamLLMResponse, getSuggestedQuestions, type ChatMessage } from "@/lib/ai/knowledge-base";
import { checkSharedRateLimit, createRateLimitExceededResponse, withRateLimitHeaders } from "@/lib/rate-limit";
import { logError, logWarn, getRequestLogContext } from "@/lib/logger";

const MAX_MESSAGE_LENGTH = 1000;
const MAX_HISTORY = 5;
const MAX_HISTORY_MESSAGE_LENGTH = 500;
const MAX_OUTPUT_LENGTH = 1200;
const OUTPUT_DISCLAIMER =
  "Nota: raspuns informativ, nu reprezinta consultanta fiscala sau juridica oficiala.";
const DELIMITER_START = "<UNTRUSTED_INPUT>";
const DELIMITER_END = "</UNTRUSTED_INPUT>";

const INVISIBLE_OR_BIDI_PATTERN = /[\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]/g;
const CONTROL_CHAR_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

const PROMPT_INJECTION_PATTERNS = [
  /ignore.{0,40}(previous|prior|all).{0,40}(instructions|rules|system|prompt)/i,
  /ignora.{0,40}(instructiunile|regulile|promptul|sistemul)/i,
  /(bypass|override|disable|disregard).{0,40}(safety|guard|policy|instructions|rules)/i,
  /(ocoleste|dezactiveaza|anuleaza).{0,40}(regulile|protectiile|filtrele)/i,
  /(reveal|show|print|display).{0,40}(system prompt|developer message|hidden instructions)/i,
  /(arata|dezvaluie|afiseaza).{0,40}(promptul de sistem|mesajul dezvoltatorului)/i,
  /(you are now|act as|roleplay as|pretend to be).{0,40}(admin|system|developer)/i,
  /(run|execute|call).{0,40}(sql|query|command|tool|function)/i,
];

const BLOCKED_OUTPUT_PATTERNS = [
  /(system prompt|prompt de sistem|developer message|mesajul dezvoltatorului|hidden instructions|internal policy)/i,
  /(api key|cheie api|access token|secret key|password|parola|credential)/i,
  /\btenant[\s_-]?(id|uuid)\b/i,
  /(am executat|am efectuat|executed|run command|deleted records|updated records)/i,
];

function sanitizeUntrustedText(value: string): string {
  return value
    .normalize("NFKC")
    .replace(INVISIBLE_OR_BIDI_PATTERN, "")
    .replace(CONTROL_CHAR_PATTERN, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isPromptInjectionAttempt(content: string): boolean {
  const normalized = sanitizeUntrustedText(content);
  return PROMPT_INJECTION_PATTERNS.some((pattern) => pattern.test(normalized));
}

function isSensitiveOrUnsafeOutput(content: string): boolean {
  if (content.includes(DELIMITER_START) || content.includes(DELIMITER_END)) {
    return true;
  }
  return BLOCKED_OUTPUT_PATTERNS.some((pattern) => pattern.test(content));
}

function parseHistory(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (h): h is ChatMessage =>
        typeof h === "object" &&
        h !== null &&
        (h.role === "user" || h.role === "assistant") &&
        typeof h.content === "string"
    )
    .map((h) => ({
      ...h,
      content: sanitizeUntrustedText(h.content).slice(0, MAX_HISTORY_MESSAGE_LENGTH),
    }))
    .slice(-MAX_HISTORY);
}

export async function POST(req: NextRequest) {
  const logContext = getRequestLogContext(req);
  const rateLimit = await checkSharedRateLimit({
    request: req,
    bucket: "chatbot",
    limit: 15,
    windowMs: 60_000,
  });
  if (!rateLimit.allowed) {
    return createRateLimitExceededResponse(rateLimit);
  }

  try {
    const body = await req.json();
    const rawMessage = typeof body?.message === "string" ? body.message : "";
    const message = sanitizeUntrustedText(rawMessage);

    if (!message) {
      return withRateLimitHeaders(NextResponse.json(
        { answer: "Mesajul nu poate fi gol." },
        { status: 400 }
      ), rateLimit);
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      return withRateLimitHeaders(NextResponse.json(
        { answer: `Mesajul este prea lung. Limita este de ${MAX_MESSAGE_LENGTH} caractere.` },
        { status: 400 }
      ), rateLimit);
    }

    const history = parseHistory(body?.history);
    const stream = body?.stream === true;

    // Block prompt injection attempts
    if (
      isPromptInjectionAttempt(message) ||
      history.some((entry) => isPromptInjectionAttempt(entry.content))
    ) {
      logWarn({ message: "Blocked prompt injection attempt in chatbot route", ...logContext });
      return withRateLimitHeaders(NextResponse.json({
        answer:
          "Nu pot procesa cereri care incearca sa schimbe regulile asistentului, sa obtina date sensibile sau sa execute actiuni." +
          "\n\n" +
          OUTPUT_DISCLAIMER,
        sources: ["Portal PrimarIA"],
      }), rateLimit);
    }

    // Streaming response via SSE
    if (stream) {
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of streamLLMResponse(message, history)) {
              const sanitized = chunk.replace(/<[^>]*>/g, "");
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: sanitized })}\n\n`));
            }
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          } catch (error) {
            logError({ message: "Streaming error in chatbot", ...logContext }, error);
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ content: "A apărut o eroare." })}\n\n`)
            );
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          } finally {
            controller.close();
          }
        },
      });

      return new Response(readable, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "X-RateLimit-Limit": String(rateLimit.limit),
          "X-RateLimit-Remaining": String(rateLimit.remaining),
          "Retry-After": String(rateLimit.retryAfterSeconds),
        },
      });
    }

    // Non-streaming response
    const result = await generateRAGResponse(message, history);

    // Sanitize HTML and check for sensitive output
    let answer = result.answer.replace(/<[^>]*>/g, "");
    answer = sanitizeUntrustedText(answer).slice(0, MAX_OUTPUT_LENGTH);

    if (!answer || isSensitiveOrUnsafeOutput(answer)) {
      answer =
        "Imi pare rau, nu am gasit un raspuns clar. Te rog reformuleaza intrebarea sau foloseste pagina Contact pentru asistenta." +
        "\n\n" +
        OUTPUT_DISCLAIMER;
    }

    return withRateLimitHeaders(NextResponse.json({
      answer,
      sources: result.sources,
      citations: result.citations,
      suggestedQuestions: getSuggestedQuestions(),
    }), rateLimit);
  } catch (error) {
    logError({ message: "Chatbot error", ...logContext }, error);
    return withRateLimitHeaders(NextResponse.json(
      { answer: "A apărut o eroare. Te rog încearcă din nou." },
      { status: 500 }
    ), rateLimit);
  }
}
