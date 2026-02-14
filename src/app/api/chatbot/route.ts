import { NextRequest, NextResponse } from "next/server";
import { CHATBOT_ENTRIES, type ChatbotEntry } from "@/lib/chatbot/knowledge";

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const scoreEntry = (entry: ChatbotEntry, message: string) => {
  const normalizedMessage = normalizeText(message);
  const matchedKeywords = new Set<string>();

  for (const keyword of entry.keywords) {
    const normalizedKeyword = normalizeText(keyword);
    if (normalizedKeyword && normalizedMessage.includes(normalizedKeyword)) {
      matchedKeywords.add(normalizedKeyword);
    }
  }

  return matchedKeywords.size;
};

const getRelevantEntries = (message: string) => {
  return CHATBOT_ENTRIES
    .map((entry) => ({
      entry,
      score: scoreEntry(entry, message),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((item) => item.entry);
};

const buildFallbackAnswer = (entries: ChatbotEntry[]) => {
  if (entries.length === 0) {
    return {
      answer:
        "Imi pare rau, nu am gasit un raspuns clar. Te rog reformuleaza intrebarea sau foloseste pagina Contact pentru asistenta.",
      sources: ["Portal PrimarIA"],
    };
  }

  const primary = entries[0];
  const sources = Array.from(
    new Set(entries.flatMap((entry) => entry.sources))
  );

  return {
    answer: primary.answer,
    sources,
  };
};

const buildLmStudioPayload = (message: string, entries: ChatbotEntry[]) => {
  const context = entries
    .map((entry) => `- ${entry.question}: ${entry.answer}`)
    .join("\n");

  const systemPrompt =
    "Esti asistentul virtual PrimarIA pentru taxe locale. Raspunde in limba romana, politicos si concis. Foloseste informatiile din context. Daca nu stii sigur, spune ca utilizatorul poate verifica in portal sau la primarie.";

  const userPrompt =
    context.length > 0
      ? `Context util:\n${context}\n\nIntrebare: ${message}`
      : `Intrebare: ${message}`;

  return {
    model: "local-model",
    temperature: 0.2,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  };
};

const getLmStudioEndpoint = (baseUrl: string) => {
  const trimmed = baseUrl.replace(/\/+$/, "");
  return trimmed.endsWith("/v1")
    ? `${trimmed}/chat/completions`
    : `${trimmed}/v1/chat/completions`;
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message = typeof body?.message === "string" ? body.message.trim() : "";

    if (!message) {
      return NextResponse.json(
        { answer: "Mesajul nu poate fi gol." },
        { status: 400 }
      );
    }

    const relevantEntries = getRelevantEntries(message);
    const fallback = buildFallbackAnswer(relevantEntries);
    const lmStudioUrl = process.env.LM_STUDIO_URL;

    if (!lmStudioUrl) {
      return NextResponse.json(fallback);
    }

    try {
      const response = await fetch(getLmStudioEndpoint(lmStudioUrl), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildLmStudioPayload(message, relevantEntries)),
      });

      if (!response.ok) {
        return NextResponse.json(fallback);
      }

      const data = await response.json();
      const answer = data?.choices?.[0]?.message?.content?.trim();

      if (!answer) {
        return NextResponse.json(fallback);
      }

      return NextResponse.json({
        answer,
        sources: fallback.sources,
      });
    } catch {
      return NextResponse.json(fallback);
    }
  } catch {
    return NextResponse.json(
      { answer: "A aparut o eroare. Te rog incearca din nou." },
      { status: 500 }
    );
  }
}
