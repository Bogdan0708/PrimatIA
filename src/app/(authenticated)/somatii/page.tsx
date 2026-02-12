import { getTranslations } from "next-intl/server";
import { requireStaff } from "@/lib/auth-utils";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getSomatii } from "./_actions/somatie-actions";

export default async function SomatiiPage({
  searchParams,
}: {
  searchParams: { page?: string; status?: string };
}) {
  await requireStaff();
  const t = await getTranslations("somatie");
  const tc = await getTranslations("common");

  const currentPage = searchParams.page ? parseInt(searchParams.page) : 1;
  const result = await getSomatii({
    page: currentPage,
    status: searchParams.status,
  });

  const buildFilterUrl = (params: Record<string, string | undefined>) => {
    const urlParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) urlParams.set(key, value);
    });
    const qs = urlParams.toString();
    return `/somatii${qs ? `?${qs}` : ""}`;
  };

  const buildPageUrl = (page: number) => {
    const urlParams = new URLSearchParams();
    if (searchParams.status) urlParams.set("status", searchParams.status);
    if (page > 1) urlParams.set("page", page.toString());
    const qs = urlParams.toString();
    return `/somatii${qs ? `?${qs}` : ""}`;
  };

  const from = result.total === 0 ? 0 : (currentPage - 1) * result.perPage + 1;
  const to = Math.min(currentPage * result.perPage, result.total);

  const statusVariant = (status: string) => {
    switch (status) {
      case "emis": return "secondary" as const;
      case "comunicat": return "default" as const;
      case "confirmat": return "default" as const;
      case "expirat": return "destructive" as const;
      default: return "outline" as const;
    }
  };

  const statuses = ["emis", "comunicat", "confirmat", "expirat"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="flex rounded-md border border-input">
          <Link href={buildFilterUrl({})}>
            <Button
              variant={!searchParams.status ? "default" : "ghost"}
              size="sm"
              className="rounded-r-none"
            >
              {tc("total")}
            </Button>
          </Link>
          {statuses.map((s, i) => (
            <Link key={s} href={buildFilterUrl({ status: s })}>
              <Button
                variant={searchParams.status === s ? "default" : "ghost"}
                size="sm"
                className={
                  i < statuses.length - 1
                    ? "rounded-none border-x"
                    : "rounded-l-none"
                }
              >
                {t(`status_${s}`)}
              </Button>
            </Link>
          ))}
        </div>
      </div>

      {result.items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ScrollText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{tc("noResults")}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="h-12 px-4 text-left font-medium">{t("number")}</th>
                  <th className="h-12 px-4 text-left font-medium">{t("taxpayer")}</th>
                  <th className="h-12 px-4 text-left font-medium">{t("issueDate")}</th>
                  <th className="h-12 px-4 text-right font-medium">{t("debit")}</th>
                  <th className="h-12 px-4 text-right font-medium">{t("penalties")}</th>
                  <th className="h-12 px-4 text-right font-medium">{t("totalAmount")}</th>
                  <th className="h-12 px-4 text-left font-medium">{t("deadline")}</th>
                  <th className="h-12 px-4 text-left font-medium">{tc("status")}</th>
                  <th className="h-12 px-4 text-left font-medium">{tc("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((item) => (
                  <tr key={item.id} className="border-b transition-colors hover:bg-muted/50">
                    <td className="p-4 font-mono text-xs">{item.numar}</td>
                    <td className="p-4 font-medium">
                      <Link
                        href={`/contribuabili/${item.contribuabilId}`}
                        className="hover:underline text-primary"
                      >
                        {item.contribuabilName}
                      </Link>
                    </td>
                    <td className="p-4">
                      {new Date(item.dataEmitere).toLocaleDateString("ro-RO")}
                    </td>
                    <td className="p-4 text-right font-mono">
                      {item.sumaDebit.toLocaleString("ro-RO", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-4 text-right font-mono">
                      {item.sumaPenalitati.toLocaleString("ro-RO", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-4 text-right font-mono font-medium">
                      {item.sumaTotala.toLocaleString("ro-RO", { minimumFractionDigits: 2 })} lei
                    </td>
                    <td className="p-4">
                      {new Date(item.termenPlata).toLocaleDateString("ro-RO")}
                    </td>
                    <td className="p-4">
                      <Badge variant={statusVariant(item.status)}>
                        {t(`status_${item.status}`)}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <Link href={`/somatii/${item.id}`}>
                        <Button variant="ghost" size="sm">{tc("details")}</Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
