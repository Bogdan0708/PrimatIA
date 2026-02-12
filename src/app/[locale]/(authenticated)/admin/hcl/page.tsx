import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth-utils";
import Link from "next/link";
import { Plus, Gavel } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getHclDecisions } from "./_actions/hcl-actions";

export default async function HclPage({
  searchParams,
}: {
  searchParams: { fiscalYear?: string; status?: string };
}) {
  await requireAdmin();
  const t = await getTranslations("hcl");
  const tc = await getTranslations("common");

  const items = await getHclDecisions({
    fiscalYear: searchParams.fiscalYear ? parseInt(searchParams.fiscalYear) : undefined,
    status: searchParams.status,
  });

  const statusVariant = (s: string) => {
    switch (s) {
      case "active": return "default" as const;
      case "draft": return "secondary" as const;
      case "superseded": return "outline" as const;
      default: return "outline" as const;
    }
  };

  const statusLabel = (s: string) => {
    switch (s) {
      case "active": return t("active");
      case "draft": return t("draft");
      case "superseded": return t("superseded");
      default: return s;
    }
  };

  const buildFilterUrl = (params: Record<string, string | undefined>) => {
    const urlParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => { if (value) urlParams.set(key, value); });
    const qs = urlParams.toString();
    return `/admin/hcl${qs ? `?${qs}` : ""}`;
  };

  // Get unique fiscal years for filter
  const fiscalYears = Array.from(new Set(items.map(i => i.fiscalYear))).sort((a, b) => b - a);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <Link href="/admin/hcl/new">
          <Button><Plus className="mr-2 h-4 w-4" />{t("addNew")}</Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {/* Status filter */}
        <div className="flex rounded-md border border-input">
          <Link href={buildFilterUrl({ fiscalYear: searchParams.fiscalYear })}>
            <Button variant={!searchParams.status ? "default" : "ghost"} size="sm" className="rounded-r-none">{tc("total")}</Button>
          </Link>
          {["draft", "active", "superseded"].map((s, i) => (
            <Link key={s} href={buildFilterUrl({ status: s, fiscalYear: searchParams.fiscalYear })}>
              <Button variant={searchParams.status === s ? "default" : "ghost"} size="sm" className={i < 2 ? "rounded-none border-x" : "rounded-l-none"}>
                {statusLabel(s)}
              </Button>
            </Link>
          ))}
        </div>
        {/* Year filter */}
        {fiscalYears.length > 0 && (
          <div className="flex rounded-md border border-input">
            <Link href={buildFilterUrl({ status: searchParams.status })}>
              <Button variant={!searchParams.fiscalYear ? "default" : "ghost"} size="sm" className="rounded-r-none">{tc("total")}</Button>
            </Link>
            {fiscalYears.slice(0, 5).map((y, i) => (
              <Link key={y} href={buildFilterUrl({ fiscalYear: y.toString(), status: searchParams.status })}>
                <Button variant={searchParams.fiscalYear === y.toString() ? "default" : "ghost"} size="sm"
                  className={i < Math.min(fiscalYears.length, 5) - 1 ? "rounded-none border-x" : "rounded-l-none"}>
                  {y}
                </Button>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Table */}
      {items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Gavel className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{tc("noResults")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="h-12 px-4 text-left font-medium">{t("hclNumber")}</th>
                <th className="h-12 px-4 text-left font-medium">{t("fiscalYear")}</th>
                <th className="h-12 px-4 text-left font-medium">{t("hclDate")}</th>
                <th className="h-12 px-4 text-left font-medium">{t("inflationIndex")}</th>
                <th className="h-12 px-4 text-left font-medium">{t("rateTables")}</th>
                <th className="h-12 px-4 text-left font-medium">{tc("status")}</th>
                <th className="h-12 px-4 text-left font-medium">{tc("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b transition-colors hover:bg-muted/50">
                  <td className="p-4 font-medium">
                    <Link href={`/admin/hcl/${item.id}`} className="hover:underline text-primary">
                      {item.hclNumber}
                    </Link>
                  </td>
                  <td className="p-4 font-mono">{item.fiscalYear}</td>
                  <td className="p-4">{new Date(item.hclDate).toLocaleDateString("ro-RO")}</td>
                  <td className="p-4">{item.inflationIndex ? Number(item.inflationIndex).toFixed(2) : "-"}</td>
                  <td className="p-4">
                    <Badge variant="outline">{item._count.taxRateTables} {t("rateTables").toLowerCase()}</Badge>
                  </td>
                  <td className="p-4">
                    <Badge variant={statusVariant(item.status)}>{statusLabel(item.status)}</Badge>
                  </td>
                  <td className="p-4">
                    <div className="flex gap-1">
                      <Link href={`/admin/hcl/${item.id}`}>
                        <Button variant="ghost" size="sm">{tc("details")}</Button>
                      </Link>
                      <Link href={`/admin/hcl/${item.id}/edit`}>
                        <Button variant="ghost" size="sm">{tc("edit")}</Button>
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
