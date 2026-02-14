import { requireAdmin } from "@/lib/auth-utils";
import { setTenantContext } from "@/lib/db";
import { generateRevenueForecast } from "@/lib/ai/revenue-forecast";
import { getTranslations } from "next-intl/server";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { ForecastCharts } from "./_components/forecast-charts";

export default async function AdminPreviziuniPage() {
  const session = await requireAdmin();
  const t = await getTranslations("forecast");
  await setTenantContext(session.user.tenantId);

  const forecast = await generateRevenueForecast(session.user.tenantId);

  const formatRON = (n: number) =>
    new Intl.NumberFormat("ro-RO", { style: "currency", currency: "RON" }).format(n);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("description")}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("totalAssessed")}</CardDescription>
            <CardTitle className="text-xl">{formatRON(forecast.projectedTotal)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("totalCollected")}</CardDescription>
            <CardTitle className="text-xl">{formatRON(forecast.collectedTotal)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("collectionRate")}</CardDescription>
            <CardTitle className="text-xl">{forecast.collectionRate.toFixed(1)}%</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("growthVsLastYear")}</CardDescription>
            <CardTitle className={`text-xl ${forecast.yearOverYear.growthPercent >= 0 ? "text-green-600" : "text-red-600"}`}>
              {forecast.yearOverYear.growthPercent >= 0 ? "+" : ""}
              {forecast.yearOverYear.growthPercent.toFixed(1)}%
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Charts */}
      <ForecastCharts forecast={forecast} />

      {/* Next year estimate */}
      <Card>
        <CardHeader>
          <CardTitle>{t("nextYearEstimate")}</CardTitle>
          <CardDescription>{t("nextYearNote")}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{formatRON(forecast.nextYearEstimate)}</p>
        </CardContent>
      </Card>
    </div>
  );
}
