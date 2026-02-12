import { getTranslations } from "next-intl/server";
import { requireStaff } from "@/lib/auth-utils";
import Link from "next/link";
import { Plus, ChevronLeft, ChevronRight, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getCladiri } from "./_actions/cladire-actions";
import { PropertySearch } from "./_components/property-search";

export default async function CladiriPage({
  searchParams,
}: {
  searchParams: { query?: string; page?: string; zona?: string; destinatie?: string };
}) {
  await requireStaff();
  const t = await getTranslations("property");
  const tc = await getTranslations("common");

  const currentPage = searchParams.page ? parseInt(searchParams.page) : 1;
  const result = await getCladiri({
    query: searchParams.query,
    page: currentPage,
    zona: searchParams.zona,
    destinatie: searchParams.destinatie,
  });

  // Build filter URLs (same pattern as contribuabili)
  const buildFilterUrl = (params: Record<string, string | undefined>) => {
    const urlParams = new URLSearchParams();
    if (searchParams.query) urlParams.set("query", searchParams.query);
    Object.entries(params).forEach(([key, value]) => {
      if (value) urlParams.set(key, value);
    });
    const qs = urlParams.toString();
    return `/proprietati/cladiri${qs ? `?${qs}` : ""}`;
  };

  const buildPageUrl = (page: number) => {
    const urlParams = new URLSearchParams();
    if (searchParams.query) urlParams.set("query", searchParams.query);
    if (searchParams.zona) urlParams.set("zona", searchParams.zona);
    if (searchParams.destinatie) urlParams.set("destinatie", searchParams.destinatie);
    if (page > 1) urlParams.set("page", page.toString());
    const qs = urlParams.toString();
    return `/proprietati/cladiri${qs ? `?${qs}` : ""}`;
  };

  const from = result.total === 0 ? 0 : (currentPage - 1) * result.perPage + 1;
  const to = Math.min(currentPage * result.perPage, result.total);

  // Destination labels
  const destinationLabel = (d: string) => {
    switch (d) {
      case "rezidentiala": return t("residential");
      case "nerezidentiala": return t("nonResidential");
      case "mixta": return t("mixed");
      default: return d;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("buildings")}</h1>
        </div>
        <Link href="/proprietati/cladiri/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            {t("addBuilding")}
          </Button>
        </Link>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <PropertySearch />
        <div className="flex gap-2">
          {/* Zone filter */}
          <div className="flex rounded-md border border-input">
            <Link href={buildFilterUrl({ destinatie: searchParams.destinatie })}>
              <Button variant={!searchParams.zona ? "default" : "ghost"} size="sm" className="rounded-r-none">
                {tc("total")}
              </Button>
            </Link>
            {["A", "B", "C", "D"].map((z, i) => (
              <Link key={z} href={buildFilterUrl({ zona: z, destinatie: searchParams.destinatie })}>
                <Button
                  variant={searchParams.zona === z ? "default" : "ghost"}
                  size="sm"
                  className={i < 3 ? "rounded-none border-x" : "rounded-l-none"}
                >
                  {t("zone")} {z}
                </Button>
              </Link>
            ))}
          </div>
          {/* Destination filter */}
          <div className="flex rounded-md border border-input">
            <Link href={buildFilterUrl({ zona: searchParams.zona })}>
              <Button variant={!searchParams.destinatie ? "default" : "ghost"} size="sm" className="rounded-r-none">
                {tc("total")}
              </Button>
            </Link>
            {["rezidentiala", "nerezidentiala", "mixta"].map((d, i) => (
              <Link key={d} href={buildFilterUrl({ destinatie: d, zona: searchParams.zona })}>
                <Button
                  variant={searchParams.destinatie === d ? "default" : "ghost"}
                  size="sm"
                  className={i < 2 ? "rounded-none border-x" : "rounded-l-none"}
                >
                  {destinationLabel(d)}
                </Button>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      {result.items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{tc("noResults")}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="h-12 px-4 text-left font-medium">{t("owners")}</th>
                  <th className="h-12 px-4 text-left font-medium">{tc("status") + " / " + t("zone")}</th>
                  <th className="h-12 px-4 text-left font-medium">{t("destination")}</th>
                  <th className="h-12 px-4 text-left font-medium">{t("constructionType")}</th>
                  <th className="h-12 px-4 text-left font-medium">{t("builtArea")}</th>
                  <th className="h-12 px-4 text-left font-medium">{t("constructionYear")}</th>
                  <th className="h-12 px-4 text-left font-medium">{tc("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((item) => (
                  <tr key={item.id} className="border-b transition-colors hover:bg-muted/50">
                    <td className="p-4 font-medium">
                      <Link href={`/contribuabili/${item.contribuabil.id}`} className="hover:underline text-primary">
                        {item.contribuabil.nume} {item.contribuabil.prenume ?? ""}
                      </Link>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-1">
                        <Badge variant={item.status === "activ" ? "default" : "secondary"}>
                          {item.status === "activ" ? t("active") : item.status}
                        </Badge>
                        <Badge variant="outline">{item.zona}</Badge>
                      </div>
                    </td>
                    <td className="p-4">{destinationLabel(item.destinatie)}</td>
                    <td className="p-4">{item.tipConstructie}</td>
                    <td className="p-4">{Number(item.suprafataConstruita).toLocaleString()} mp</td>
                    <td className="p-4">{item.anConstructie}</td>
                    <td className="p-4">
                      <div className="flex gap-1">
                        <Link href={`/proprietati/cladiri/${item.id}`}>
                          <Button variant="ghost" size="sm">{tc("details")}</Button>
                        </Link>
                        <Link href={`/proprietati/cladiri/${item.id}/edit`}>
                          <Button variant="ghost" size="sm">{tc("edit")}</Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {from}-{to} / {result.total}
            </p>
            <div className="flex items-center gap-2">
              <p className="text-sm text-muted-foreground">
                {currentPage} / {result.totalPages}
              </p>
              {currentPage > 1 ? (
                <Link href={buildPageUrl(currentPage - 1)}>
                  <Button variant="outline" size="icon"><ChevronLeft className="h-4 w-4" /></Button>
                </Link>
              ) : (
                <Button variant="outline" size="icon" disabled><ChevronLeft className="h-4 w-4" /></Button>
              )}
              {currentPage < result.totalPages ? (
                <Link href={buildPageUrl(currentPage + 1)}>
                  <Button variant="outline" size="icon"><ChevronRight className="h-4 w-4" /></Button>
                </Link>
              ) : (
                <Button variant="outline" size="icon" disabled><ChevronRight className="h-4 w-4" /></Button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
