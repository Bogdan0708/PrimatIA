"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Search, BookOpen, ChevronDown, ChevronUp, Scale } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface SearchResultItem {
  article: string;
  title: string;
  content: string;
  category: string;
  matchedKeywords: string[];
  score: number;
}

const CATEGORY_LABELS: Record<string, { ro: string; en: string; hu: string }> = {
  cladiri: { ro: "Clădiri", en: "Buildings", hu: "Épületek" },
  teren: { ro: "Teren", en: "Land", hu: "Telek" },
  vehicule: { ro: "Vehicule", en: "Vehicles", hu: "Járművek" },
  taxe_locale: { ro: "Taxe locale", en: "Local taxes", hu: "Helyi adók" },
  procedura: { ro: "Procedură", en: "Procedure", hu: "Eljárás" },
  plati: { ro: "Plăți", en: "Payments", hu: "Fizetések" },
  executare: { ro: "Executare", en: "Enforcement", hu: "Végrehajtás" },
  contestatii: { ro: "Contestații", en: "Appeals", hu: "Fellebbezések" },
};

const CATEGORY_COLORS: Record<string, string> = {
  cladiri: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  teren: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  vehicule: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  taxe_locale: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
  procedura: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300",
  plati: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300",
  executare: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  contestatii: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
};

function highlightKeywords(text: string, keywords: string[]): React.ReactNode {
  if (keywords.length === 0) return text;

  // Build regex from keywords, escape special chars
  const escaped = keywords.map((k) =>
    k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  );
  const regex = new RegExp(`(${escaped.join("|")})`, "gi");
  const parts = text.split(regex);

  return parts.map((part, i) => {
    const isMatch = keywords.some(
      (k) => k.toLowerCase() === part.toLowerCase()
    );
    return isMatch ? (
      <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5">
        {part}
      </mark>
    ) : (
      <span key={i}>{part}</span>
    );
  });
}

export default function ReglementariPage() {
  const t = useTranslations("regulations");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const handleSearch = useCallback(async () => {
    const q = query.trim();
    if (!q) return;

    setLoading(true);
    setSearched(true);

    try {
      const res = await fetch(
        `/api/search/regulations?q=${encodeURIComponent(q)}`
      );
      const data = await res.json();
      setResults(data.results || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const toggleExpand = (article: string) => {
    setExpanded((prev) => ({ ...prev, [article]: !prev[article] }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Scale className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("description")}</p>
        </div>
      </div>

      {/* Search bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t("searchPlaceholder")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                className="pl-10"
              />
            </div>
            <Button onClick={handleSearch} disabled={loading || !query.trim()}>
              {loading ? t("searching") : t("search")}
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {t("searchHint")}
          </p>
        </CardContent>
      </Card>

      {/* Results */}
      {searched && !loading && results.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-muted-foreground">{t("noResults")}</p>
          </CardContent>
        </Card>
      )}

      {results.map((result) => {
        const isExpanded = expanded[result.article] || false;
        const contentPreview = result.content.slice(0, 150);
        const hasMore = result.content.length > 150;

        return (
          <Card key={result.article} className="transition-shadow hover:shadow-md">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-xs">
                      {result.article}
                    </Badge>
                    <Badge
                      className={
                        CATEGORY_COLORS[result.category] || CATEGORY_COLORS.procedura
                      }
                    >
                      {CATEGORY_LABELS[result.category]?.ro || result.category}
                    </Badge>
                  </div>
                  <CardTitle className="text-lg">{result.title}</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <CardDescription className="text-sm leading-relaxed text-foreground/80">
                {isExpanded
                  ? highlightKeywords(result.content, result.matchedKeywords)
                  : highlightKeywords(
                      contentPreview + (hasMore ? "..." : ""),
                      result.matchedKeywords
                    )}
              </CardDescription>

              {hasMore && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleExpand(result.article)}
                  className="gap-1 text-xs"
                >
                  {isExpanded ? (
                    <>
                      <ChevronUp className="h-3 w-3" />
                      {t("showLess")}
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3 w-3" />
                      {t("showMore")}
                    </>
                  )}
                </Button>
              )}

              {result.matchedKeywords.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {result.matchedKeywords.map((kw) => (
                    <Badge key={kw} variant="secondary" className="text-xs">
                      {kw}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Info footer */}
      {!searched && (
        <Card>
          <CardContent className="py-8 text-center">
            <BookOpen className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 font-medium">{t("welcomeTitle")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("welcomeDescription")}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
