import { getTranslations } from "next-intl/server";
import { requireStaff } from "@/lib/auth-utils";
import Link from "next/link";
import { Plus, ChevronLeft, ChevronRight, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getContribuabili } from "./_actions/contribuabil-actions";
import { ContribuabilSearch } from "./_components/contribuabil-search";

export default async function ContribuabiliPage({
  searchParams,
}: {
  searchParams: { query?: string; page?: string; tip?: string; status?: string };
}) {
  await requireStaff();
  const t = await getTranslations("taxpayer");
  const tc = await getTranslations("common");

  const currentPage = searchParams.page ? parseInt(searchParams.page) : 1;
  const result = await getContribuabili({
    query: searchParams.query,
    page: currentPage,
    tip: searchParams.tip as "PF" | "PJ" | undefined,
    status: searchParams.status,
  });

  const statusVariant = (status: string) => {
    switch (status) {
      case "activ":
        return "default" as const;
      case "inactiv":
        return "secondary" as const;
      default:
        return "outline" as const;
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "activ":
        return t("statusActive");
      case "inactiv":
        return t("statusInactive");
      default:
        return status;
    }
  };

  // Build filter URLs
  const buildFilterUrl = (params: Record<string, string | undefined>) => {
    const urlParams = new URLSearchParams();
    if (searchParams.query) urlParams.set("query", searchParams.query);
    Object.entries(params).forEach(([key, value]) => {
      if (value) urlParams.set(key, value);
    });
    const qs = urlParams.toString();
    return `/contribuabili${qs ? `?${qs}` : ""}`;
  };

  // Build pagination URLs
  const buildPageUrl = (page: number) => {
    const urlParams = new URLSearchParams();
    if (searchParams.query) urlParams.set("query", searchParams.query);
    if (searchParams.tip) urlParams.set("tip", searchParams.tip);
    if (searchParams.status) urlParams.set("status", searchParams.status);
    if (page > 1) urlParams.set("page", page.toString());
    const qs = urlParams.toString();
    return `/contribuabili${qs ? `?${qs}` : ""}`;
  };

  const from = result.total === 0 ? 0 : (currentPage - 1) * result.perPage + 1;
  const to = Math.min(currentPage * result.perPage, result.total);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        </div>
        <Link href="/contribuabili/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            {t("addNew")}
          </Button>
        </Link>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <ContribuabilSearch />
        <div className="flex gap-2">
          {/* Type filter */}
          <div className="flex rounded-md border border-input">
            <Link href={buildFilterUrl({ status: searchParams.status })}>
              <Button
                variant={!searchParams.tip ? "default" : "ghost"}
                size="sm"
                className="rounded-r-none"
              >
                {t("allTypes")}
              </Button>
            </Link>
            <Link
              href={buildFilterUrl({
                tip: "PF",
                status: searchParams.status,
              })}
            >
              <Button
                variant={searchParams.tip === "PF" ? "default" : "ghost"}
                size="sm"
                className="rounded-none border-x"
              >
                PF
              </Button>
            </Link>
            <Link
              href={buildFilterUrl({
                tip: "PJ",
                status: searchParams.status,
              })}
            >
              <Button
                variant={searchParams.tip === "PJ" ? "default" : "ghost"}
                size="sm"
                className="rounded-l-none"
              >
                PJ
              </Button>
            </Link>
          </div>

          {/* Status filter */}
          <div className="flex rounded-md border border-input">
            <Link href={buildFilterUrl({ tip: searchParams.tip })}>
              <Button
                variant={!searchParams.status ? "default" : "ghost"}
                size="sm"
                className="rounded-r-none"
              >
                {t("allStatuses")}
              </Button>
            </Link>
            <Link
              href={buildFilterUrl({
                tip: searchParams.tip,
                status: "activ",
              })}
            >
              <Button
                variant={searchParams.status === "activ" ? "default" : "ghost"}
                size="sm"
                className="rounded-none border-x"
              >
                {t("statusActive")}
              </Button>
            </Link>
            <Link
              href={buildFilterUrl({
                tip: searchParams.tip,
                status: "inactiv",
              })}
            >
              <Button
                variant={searchParams.status === "inactiv" ? "default" : "ghost"}
                size="sm"
                className="rounded-l-none"
              >
                {t("statusInactive")}
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Table */}
      {result.items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{tc("noResults")}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="h-12 px-4 text-left font-medium">
                    {t("name")}
                  </th>
                  <th className="h-12 px-4 text-left font-medium">
                    {t("firstName")}
                  </th>
                  <th className="h-12 px-4 text-left font-medium">
                    {t("type")}
                  </th>
                  <th className="h-12 px-4 text-left font-medium">
                    {t("cnp")}/{t("cui")}
                  </th>
                  <th className="h-12 px-4 text-left font-medium">
                    {t("rolNumber")}
                  </th>
                  <th className="h-12 px-4 text-left font-medium">
                    {t("phone")}
                  </th>
                  <th className="h-12 px-4 text-left font-medium">
                    {tc("status")}
                  </th>
                  <th className="h-12 px-4 text-left font-medium">
                    {tc("actions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b transition-colors hover:bg-muted/50"
                  >
                    <td className="p-4 font-medium">
                      <Link
                        href={`/contribuabili/${item.id}`}
                        className="hover:underline text-primary"
                      >
                        {item.nume}
                      </Link>
                    </td>
                    <td className="p-4">{item.prenume ?? "-"}</td>
                    <td className="p-4">
                      <Badge variant={item.tip === "PF" ? "secondary" : "outline"}>
                        {item.tip === "PF" ? t("individual") : t("company")}
                      </Badge>
                    </td>
                    <td className="p-4 font-mono text-xs">
                      {item.tip === "PF" ? "***" : item.cui ?? "-"}
                    </td>
                    <td className="p-4">{item.codRol ?? "-"}</td>
                    <td className="p-4">{item.telefon ?? "-"}</td>
                    <td className="p-4">
                      <Badge variant={statusVariant(item.status)}>
                        {statusLabel(item.status)}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-1">
                        <Link href={`/contribuabili/${item.id}`}>
                          <Button variant="ghost" size="sm">
                            {tc("details")}
                          </Button>
                        </Link>
                        <Link href={`/contribuabili/${item.id}/edit`}>
                          <Button variant="ghost" size="sm">
                            {tc("edit")}
                          </Button>
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
              {t("showingResults", {
                from,
                to,
                total: result.total,
              })}
            </p>
            <div className="flex items-center gap-2">
              <p className="text-sm text-muted-foreground">
                {t("page", {
                  current: currentPage,
                  totalPages: result.totalPages,
                })}
              </p>
              {currentPage > 1 ? (
                <Link href={buildPageUrl(currentPage - 1)}>
                  <Button variant="outline" size="icon">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                </Link>
              ) : (
                <Button variant="outline" size="icon" disabled>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              )}
              {currentPage < result.totalPages ? (
                <Link href={buildPageUrl(currentPage + 1)}>
                  <Button variant="outline" size="icon">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              ) : (
                <Button variant="outline" size="icon" disabled>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
