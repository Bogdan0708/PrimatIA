import { getLocale, getTranslations } from "next-intl/server";
import { requireStaff } from "@/lib/auth-utils";
import Link from "next/link";
import { Plus, ChevronLeft, ChevronRight, Car } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { deleteVehicul, getVehicule } from "./_actions/vehicul-actions";
import { PropertySearch } from "./_components/property-search";
import { ConfirmDeleteButton } from "@/components/ui/confirm-delete-button";

export default async function VehiculePage({
  searchParams,
}: {
  searchParams: { query?: string; page?: string; tipVehicul?: string };
}) {
  await requireStaff();
  const t = await getTranslations("property");
  const tc = await getTranslations("common");
  const locale = await getLocale();
  const localePrefix = `/${locale}`;

  const currentPage = searchParams.page ? parseInt(searchParams.page) : 1;
  const result = await getVehicule({
    query: searchParams.query,
    page: currentPage,
    tipVehicul: searchParams.tipVehicul,
  });

  const buildFilterUrl = (params: Record<string, string | undefined>) => {
    const urlParams = new URLSearchParams();
    if (searchParams.query) urlParams.set("query", searchParams.query);
    Object.entries(params).forEach(([key, value]) => { if (value) urlParams.set(key, value); });
    const qs = urlParams.toString();
    return `${localePrefix}/proprietati/vehicule${qs ? `?${qs}` : ""}`;
  };

  const buildPageUrl = (page: number) => {
    const urlParams = new URLSearchParams();
    if (searchParams.query) urlParams.set("query", searchParams.query);
    if (searchParams.tipVehicul) urlParams.set("tipVehicul", searchParams.tipVehicul);
    if (page > 1) urlParams.set("page", page.toString());
    const qs = urlParams.toString();
    return `${localePrefix}/proprietati/vehicule${qs ? `?${qs}` : ""}`;
  };

  const from = result.total === 0 ? 0 : (currentPage - 1) * result.perPage + 1;
  const to = Math.min(currentPage * result.perPage, result.total);

  const vehicleTypeLabel = (vt: string) => {
    switch (vt) {
      case "autoturism": return t("car");
      case "autobuz": return t("bus");
      case "camion": return t("truck");
      case "motocicleta": return t("motorcycle");
      case "tractor": return t("tractor");
      case "remorca": return t("trailer");
      default: return vt;
    }
  };

  const vehicleTypes = ["autoturism", "autobuz", "camion", "motocicleta", "tractor", "remorca"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">{t("vehicles")}</h1>
        <Link href={`${localePrefix}/proprietati/vehicule/new`}>
          <Button><Plus className="mr-2 h-4 w-4" />{t("addVehicle")}</Button>
        </Link>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <PropertySearch />
        <div className="flex gap-2 flex-wrap">
          <div className="flex rounded-md border border-input">
            <Link href={buildFilterUrl({})}>
              <Button variant={!searchParams.tipVehicul ? "default" : "ghost"} size="sm" className="rounded-r-none">{tc("total")}</Button>
            </Link>
            {vehicleTypes.map((vt, i) => (
              <Link key={vt} href={buildFilterUrl({ tipVehicul: vt })}>
                <Button
                  variant={searchParams.tipVehicul === vt ? "default" : "ghost"}
                  size="sm"
                  className={i < vehicleTypes.length - 1 ? "rounded-none border-x" : "rounded-l-none"}
                >
                  {vehicleTypeLabel(vt)}
                </Button>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {result.items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Car className="h-12 w-12 text-muted-foreground mb-4" />
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
                  <th className="h-12 px-4 text-left font-medium">{t("vehicleType")}</th>
                  <th className="h-12 px-4 text-left font-medium">{t("brand")} / {t("model")}</th>
                  <th className="h-12 px-4 text-left font-medium">{t("registrationNumber")}</th>
                  <th className="h-12 px-4 text-left font-medium">{t("engineDisplacement")}</th>
                  <th className="h-12 px-4 text-left font-medium">{t("manufacturingYear")}</th>
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
                    <td className="p-4">{vehicleTypeLabel(item.tipVehicul)}</td>
                    <td className="p-4">{[item.marca, item.model].filter(Boolean).join(" ") || "-"}</td>
                    <td className="p-4 font-mono text-xs">{item.numarInmatriculare ?? "-"}</td>
                    <td className="p-4">{item.cilindreeCmc ? `${item.cilindreeCmc} cmc` : "-"}</td>
                    <td className="p-4">{item.anFabricatie}</td>
                    <td className="p-4">
                      <Badge variant={item.status === "activ" ? "default" : "secondary"}>
                        {item.status === "activ" ? t("active") : item.status}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-1">
                        <Link href={`${localePrefix}/proprietati/vehicule/${item.id}`}>
                          <Button variant="ghost" size="sm">{tc("details")}</Button>
                        </Link>
                        <Link href={`${localePrefix}/proprietati/vehicule/${item.id}/edit`}>
                          <Button variant="ghost" size="sm">{tc("edit")}</Button>
                        </Link>
                        <ConfirmDeleteButton
                          id={item.id}
                          onDelete={deleteVehicul}
                        />
                      </div>
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
