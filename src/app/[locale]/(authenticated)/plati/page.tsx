import { getLocale, getTranslations } from "next-intl/server";
import { requireStaff } from "@/lib/auth-utils";
import Link from "next/link";
import { Plus, ChevronLeft, ChevronRight, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { getPlati } from "./_actions/plata-actions";

export default async function PlatiPage({
  searchParams,
}: {
  searchParams: { page?: string; modalitate?: string; dateFrom?: string; dateTo?: string };
}) {
  await requireStaff();
  const t = await getTranslations("payment");
  const tc = await getTranslations("common");
  const locale = await getLocale();
  const localePrefix = `/${locale}`;

  const currentPage = searchParams.page ? parseInt(searchParams.page) : 1;
  const result = await getPlati({
    page: currentPage,
    modalitate: searchParams.modalitate,
    dateFrom: searchParams.dateFrom,
    dateTo: searchParams.dateTo,
  });

  const buildFilterUrl = (params: Record<string, string | undefined>) => {
    const urlParams = new URLSearchParams();
    if (searchParams.dateFrom) urlParams.set("dateFrom", searchParams.dateFrom);
    if (searchParams.dateTo) urlParams.set("dateTo", searchParams.dateTo);
    Object.entries(params).forEach(([key, value]) => { if (value) urlParams.set(key, value); });
    const qs = urlParams.toString();
    return `${localePrefix}/plati${qs ? `?${qs}` : ""}`;
  };

  const buildPageUrl = (page: number) => {
    const urlParams = new URLSearchParams();
    if (searchParams.modalitate) urlParams.set("modalitate", searchParams.modalitate);
    if (searchParams.dateFrom) urlParams.set("dateFrom", searchParams.dateFrom);
    if (searchParams.dateTo) urlParams.set("dateTo", searchParams.dateTo);
    if (page > 1) urlParams.set("page", page.toString());
    const qs = urlParams.toString();
    return `${localePrefix}/plati${qs ? `?${qs}` : ""}`;
  };

  const from = result.total === 0 ? 0 : (currentPage - 1) * result.perPage + 1;
  const to = Math.min(currentPage * result.perPage, result.total);

  const methodLabel = (m: string) => {
    switch (m) {
      case "numerar": return t("cash");
      case "virament": return t("bankTransfer");
      case "mandat_postal": return t("postalOrder");
      case "ghiseul_ro": return t("ghiseulRo");
      case "card": return t("card");
      default: return m;
    }
  };

  const methods = ["numerar", "virament", "mandat_postal", "ghiseul_ro", "card"];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        actions={
          <Link href={`${localePrefix}/plati/new`}>
            <Button><Plus className="mr-2 h-4 w-4" />{t("addNew")}</Button>
          </Link>
        }
      />

      <div className="flex gap-2 flex-wrap">
        <div className="flex rounded-md border border-input">
          <Link href={buildFilterUrl({})}>
            <Button variant={!searchParams.modalitate ? "default" : "ghost"} size="sm" className="rounded-r-none">{tc("total")}</Button>
          </Link>
          {methods.map((m, i) => (
            <Link key={m} href={buildFilterUrl({ modalitate: m })}>
              <Button variant={searchParams.modalitate === m ? "default" : "ghost"} size="sm"
                className={i < methods.length - 1 ? "rounded-none border-x" : "rounded-l-none"}>
                {methodLabel(m)}
              </Button>
            </Link>
          ))}
        </div>
      </div>

      {result.items.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={CreditCard}
              title={tc("noResults")}
              description={tc("noResultsHint")}
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="h-12 px-4 text-left font-medium">Contribuabil</th>
                  <th className="h-12 px-4 text-left font-medium">{t("amount")}</th>
                  <th className="h-12 px-4 text-left font-medium">{t("paymentDate")}</th>
                  <th className="h-12 px-4 text-left font-medium">{t("paymentMethod")}</th>
                  <th className="h-12 px-4 text-left font-medium">{t("receiptNumber")}</th>
                  <th className="h-12 px-4 text-left font-medium">{tc("status")}</th>
                  <th className="h-12 px-4 text-left font-medium">{tc("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((item) => (
                  <tr key={item.id} className="border-b transition-colors hover:bg-muted/50">
                    <td className="p-4 font-medium">
                      <Link
                        href={`${localePrefix}/contribuabili/${item.contribuabil.id}`}
                        className="hover:underline text-primary"
                      >
                        {item.contribuabil.nume} {item.contribuabil.prenume ?? ""}
                      </Link>
                    </td>
                    <td className="p-4 font-mono font-medium">{item.suma.toLocaleString("ro-RO", { minimumFractionDigits: 2 })} lei</td>
                    <td className="p-4">{new Date(item.dataPlata).toLocaleDateString("ro-RO")}</td>
                    <td className="p-4">{methodLabel(item.modalitate)}</td>
                    <td className="p-4 font-mono text-xs">{item.nrChitanta ?? item.nrDocument ?? "-"}</td>
                    <td className="p-4">
                      <Badge variant={item.distribuit ? "success" : "warning"}>
                        {item.distribuit ? t("distributed") : t("notDistributed")}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <Link href={`${localePrefix}/plati/${item.id}`}>
                        <Button variant="ghost" size="sm">{tc("details")}</Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{from}-{to} / {result.total}</p>
            <div className="flex items-center gap-2">
              <p className="text-sm text-muted-foreground">{currentPage} / {result.totalPages}</p>
              {currentPage > 1 ? (
                <Link href={buildPageUrl(currentPage - 1)}><Button variant="outline" size="icon"><ChevronLeft className="h-4 w-4" /></Button></Link>
              ) : (<Button variant="outline" size="icon" disabled><ChevronLeft className="h-4 w-4" /></Button>)}
              {currentPage < result.totalPages ? (
                <Link href={buildPageUrl(currentPage + 1)}><Button variant="outline" size="icon"><ChevronRight className="h-4 w-4" /></Button></Link>
              ) : (<Button variant="outline" size="icon" disabled><ChevronRight className="h-4 w-4" /></Button>)}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
