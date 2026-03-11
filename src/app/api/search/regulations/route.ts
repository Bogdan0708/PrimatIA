import { NextRequest, NextResponse } from "next/server";
import { searchRegulations, searchRegulationsEnhanced } from "@/lib/search/regulation-search";

const MAX_QUERY_LENGTH = 500;

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q")?.trim() || "";

  if (!query) {
    return NextResponse.json(
      { error: "Parametrul 'q' este obligatoriu." },
      { status: 400 }
    );
  }

  if (query.length > MAX_QUERY_LENGTH) {
    return NextResponse.json(
      { error: `Căutarea nu poate depăși ${MAX_QUERY_LENGTH} caractere.` },
      { status: 400 }
    );
  }

  try {
    // Use enhanced search if the gateway is configured, otherwise keyword-only
    const results = process.env.AI_GATEWAY_URL && process.env.AI_GATEWAY_KEY
      ? await searchRegulationsEnhanced(query, 5)
      : searchRegulations(query, 5);

    return NextResponse.json({
      query,
      results: results.map((r) => ({
        article: r.entry.article,
        title: r.entry.title,
        content: r.entry.content,
        category: r.entry.category,
        matchedKeywords: r.matchedKeywords,
        score: r.score,
      })),
      total: results.length,
    });
  } catch {
    return NextResponse.json(
      { error: "Eroare la căutare. Încercați din nou." },
      { status: 500 }
    );
  }
}
