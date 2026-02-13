import { getLocale, getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth-utils";
import Link from "next/link";
import { Plus, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getScutiriReguli } from "./_actions/scutire-actions";
import { ToggleScutire } from "./_components/toggle-scutire";

export default async function ScutiriPage({
  searchParams,
}: {
  searchParams: { isActive?: string };
}) {
  await requireAdmin();
  const t = await getTranslations("exemption");
  const tc = await getTranslations("common");
  const locale = await getLocale();
  const localePrefix = `/${locale}`;

  const isActive = searchParams.isActive === "true" ? true : searchParams.isActive === "false" ? false : undefined;
  const items = await getScutiriReguli({ isActive });

  const buildFilterUrl = (params: Record<string, string | undefined>) => {
    const urlParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => { if (value) urlParams.set(key, value); });
    const qs = urlParams.toString();
    return `${localePrefix}/admin/scutiri${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <Link href={`${localePrefix}/admin/scutiri/new`}>
          <Button><Plus className="mr-2 h-4 w-4" />{t("addRule")}</Button>
        </Link>
      </div>

      <div className="flex gap-2">
        <div className="flex rounded-md border border-input">
          <Link href={buildFilterUrl({})}>
            <Button variant={isActive === undefined ? "default" : "ghost"} size="sm" className="rounded-r-none">{tc("total")}</Button>
          </Link>
          <Link href={buildFilterUrl({ isActive: "true" })}>
            <Button variant={isActive === true ? "default" : "ghost"} size="sm" className="rounded-none border-x">{t("approved")}</Button>
          </Link>
          <Link href={buildFilterUrl({ isActive: "false" })}>
            <Button variant={isActive === false ? "default" : "ghost"} size="sm" className="rounded-l-none">{t("rejected")}</Button>
          </Link>
        </div>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Shield className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{tc("noResults")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="h-12 px-4 text-left font-medium">{t("ruleName")}</th>
                <th className="h-12 px-4 text-left font-medium">{t("legalBasis")}</th>
                <th className="h-12 px-4 text-left font-medium">{t("discountPercent")}</th>
                <th className="h-12 px-4 text-left font-medium">{t("applicableTaxTypes")}</th>
                <th className="h-12 px-4 text-left font-medium">{t("autoRenewable")}</th>
                <th className="h-12 px-4 text-left font-medium">{tc("status")}</th>
                <th className="h-12 px-4 text-left font-medium">{tc("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b transition-colors hover:bg-muted/50">
                  <td className="p-4 font-medium">
                    <Link
                      href={`${localePrefix}/admin/scutiri/${item.id}`}
                      className="hover:underline text-primary"
                    >
                      {item.nameRo}
                    </Link>
                  </td>
                  <td className="p-4 text-xs font-mono">{item.legalBasis}</td>
                  <td className="p-4">{Number(item.discountPercent)}%</td>
                  <td className="p-4">
                    <div className="flex gap-1 flex-wrap">
                      {item.taxTypes.map((tt) => (
                        <Badge key={tt} variant="outline" className="text-xs">{tt}</Badge>
                      ))}
                    </div>
                  </td>
                  <td className="p-4">{item.autoRenewable ? tc("yes") : tc("no")}</td>
                  <td className="p-4">
                    <ToggleScutire id={item.id} isActive={item.isActive} />
                  </td>
                  <td className="p-4">
                    <div className="flex gap-1">
                      <Link href={`${localePrefix}/admin/scutiri/${item.id}`}>
                        <Button variant="ghost" size="sm">{tc("details")}</Button>
                      </Link>
                      <Link href={`${localePrefix}/admin/scutiri/${item.id}/edit`}>
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
