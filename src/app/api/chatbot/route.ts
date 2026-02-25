import { NextRequest, NextResponse } from "next/server";
import { generateRAGResponse, streamLLMResponse, getSuggestedQuestions, type ChatMessage } from "@/lib/ai/knowledge-base";

// Rate limiter — 10 requests/minute per IP
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;
const MAX_MESSAGE_LENGTH = 1000;
const MAX_HISTORY = 5;

const rateLimitMap = new Map<string, number[]>();

if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    rateLimitMap.forEach((timestamps, ip) => {
      const valid = timestamps.filter((t: number) => now - t < RATE_LIMIT_WINDOW_MS);
      if (valid.length === 0) rateLimitMap.delete(ip);
      else rateLimitMap.set(ip, valid);
    });
  }, 300_000);
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = (rateLimitMap.get(ip) ?? []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS
  );
  if (timestamps.length >= RATE_LIMIT_MAX) {
    rateLimitMap.set(ip, timestamps);
    return true;
  }
  timestamps.push(now);
  rateLimitMap.set(ip, timestamps);
  return false;
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
    .slice(-MAX_HISTORY);
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { answer: "Prea multe cereri. Te rog așteaptă un minut." },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const message = typeof body?.message === "string" ? body.message.trim() : "";

    if (!message) {
      return NextResponse.json(
        { answer: "Mesajul nu poate fi gol." },
        { status: 400 }
      );
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        { answer: `Mesajul este prea lung. Limita este de ${MAX_MESSAGE_LENGTH} caractere.` },
        { status: 400 }
      );
    }

    const history = parseHistory(body?.history);
    const stream = body?.stream === true;

    // Streaming response via SSE
    if (stream) {
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of streamLLMResponse(message, history)) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: chunk })}\n\n`));
            }
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          } catch {
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
        },
      });
    }

    // Non-streaming response
    const result = await generateRAGResponse(message, history);

    // Sanitize HTML
    const answer = result.answer.replace(/<[^>]*>/g, "");

    return NextResponse.json({
      answer,
      sources: result.sources,
      citations: result.citations,
      suggestedQuestions: getSuggestedQuestions(),
    });
  } catch {
    return NextResponse.json(
      { answer: "A apărut o eroare. Te rog încearcă din nou." },
      { status: 500 }
    );
  }
}
