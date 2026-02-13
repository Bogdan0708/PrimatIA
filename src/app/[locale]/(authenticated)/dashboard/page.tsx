import { getLocale, getTranslations } from "next-intl/server";
import { requireStaff } from "@/lib/auth-utils";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { setTenantContext } from "@/lib/db";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Calculator, CreditCard, AlertTriangle, Building2 } from "lucide-react";
import { DashboardCharts } from "./_components/dashboard-charts";

export default async function DashboardPage() {
  await requireStaff();
  const t = await getTranslations("dashboard");
  const tpay = await getTranslations("payment");
  const tc = await getTranslations("common");
  const locale = await getLocale();
  const localePrefix = `/${locale}`;

  const session = await auth();
  if (!session?.user?.tenantId) return null;
  await setTenantContext(session.user.tenantId);

  const tenantId = session.user.tenantId;

  // Fetch real stats
  const [
    totalContribuabili,
    totalProprietati,
    taxAggregates,
    recentPayments,
    revenueByMonth,
    taxBreakdown,
    overdueAging,
  ] = await Promise.all([
    prisma.contribuabil.count({
      where: { tenantId, deletedAt: null, status: "activ" },
    }),
    Promise.all([
      prisma.proprietateCladire.count({
        where: { tenantId, deletedAt: null, status: "activ" },
      }),
      prisma.proprietateTeren.count({
        where: { tenantId, deletedAt: null, status: "activ" },
      }),
      prisma.proprietateVehicul.count({
        where: { tenantId, deletedAt: null, status: "activ" },
      }),
    ]),
    prisma.impozit.aggregate({
      where: { tenantId },
      _sum: {
        sumaDatorata: true,
        sumaPlatita: true,
        sumaPenalitati: true,
      },
    }),
    prisma.plata.findMany({
      where: { tenantId },
      include: {
        contribuabil: {
          select: { id: true, nume: true, prenume: true },
        },
      },
      orderBy: { dataPlata: "desc" },
      take: 5,
    }),
    // Revenue by month (last 12 months) - group payments by month
    prisma.$queryRaw`
      SELECT
        TO_CHAR(data_plata, 'YYYY-MM') as month,
        SUM(suma) as total
      FROM plati
      WHERE tenant_id = ${tenantId}::uuid
        AND data_plata >= NOW() - INTERVAL '12 months'
      GROUP BY TO_CHAR(data_plata, 'YYYY-MM')
      ORDER BY month
    ` as Promise<{ month: string; total: number }[]>,
    // Tax type breakdown
    prisma.$queryRaw`
      SELECT
        ttr.category,
        SUM(i.suma_datorata) as total
      FROM impozite i
      JOIN tax_type_registry ttr ON i.tax_type_id = ttr.id
      WHERE i.tenant_id = ${tenantId}::uuid
        AND i.fiscal_year = ${new Date().getFullYear()}
      GROUP BY ttr.category
    ` as Promise<{ category: string; total: number }[]>,
    // Overdue aging - calculate days overdue from rata_1_scadenta
    prisma.$queryRaw`
      SELECT
        CASE
          WHEN CURRENT_DATE - rata_1_scadenta <= 30 THEN '0-30'
          WHEN CURRENT_DATE - rata_1_scadenta <= 90 THEN '31-90'
          WHEN CURRENT_DATE - rata_1_scadenta <= 180 THEN '91-180'
          ELSE '180+'
        END as bucket,
        SUM(suma_datorata - suma_platita) as total
      FROM impozite
      WHERE tenant_id = ${tenantId}::uuid
        AND suma_datorata > suma_platita
        AND rata_1_scadenta < CURRENT_DATE
      GROUP BY bucket
      ORDER BY bucket
    ` as Promise<{ bucket: string; total: number }[]>,
  ]);

  // Compute collection rate trend from revenueByMonth and monthly debits
  // We derive a simple trend: cumulative paid / cumulative owed over the months
  const collectionRateTrend = revenueByMonth.map((item) => {
    const totalDatoratVal = Number(taxAggregates._sum.sumaDatorata ?? 0);
    const cumulativePaid = revenueByMonth
      .filter((r) => r.month <= item.month)
      .reduce((sum, r) => sum + Number(r.total), 0);
    const rate = totalDatoratVal > 0
      ? Math.min(100, Math.round((cumulativePaid / totalDatoratVal) * 100 * 10) / 10)
      : 0;
    return { month: item.month, rate };
  });

  const totalProps =
    totalProprietati[0] + totalProprietati[1] + totalProprietati[2];
  const totalDatorat = Number(taxAggregates._sum.sumaDatorata ?? 0);
  const totalPlatit = Number(taxAggregates._sum.sumaPlatita ?? 0);
  const totalPenalitati = Number(taxAggregates._sum.sumaPenalitati ?? 0);
  const totalRestante = totalDatorat + totalPenalitati - totalPlatit;
  const collectionRate =
    totalDatorat > 0 ? Math.round((totalPlatit / totalDatorat) * 100) : 0;

  const formatCurrency = (n: number) =>
    n.toLocaleString("ro-RO", { minimumFractionDigits: 2 }) + " lei";

  const methodLabel = (m: string) => {
    switch (m) {
      case "numerar": return tpay("cash");
      case "virament": return tpay("bankTransfer");
      case "mandat_postal": return tpay("postalOrder");
      case "ghiseul_ro": return tpay("ghiseulRo");
      case "card": return tpay("card");
      default: return m;
    }
  };

  const stats = [
    {
      title: t("totalTaxpayers"),
      value: totalContribuabili.toLocaleString(),
      subtitle: `${totalProps} ${t("totalProperties").toLowerCase()}`,
      icon: Users,
    },
    {
      title: t("totalRevenue"),
      value: formatCurrency(totalPlatit),
      subtitle: "",
      icon: CreditCard,
    },
    {
      title: t("outstandingDebts"),
      value: formatCurrency(totalRestante),
      subtitle: totalPenalitati > 0 ? `(din care ${formatCurrency(totalPenalitati)} penalitati)` : "",
      icon: AlertTriangle,
    },
    {
      title: t("collectionRate"),
      value: `${collectionRate}%`,
      subtitle: "",
      icon: Calculator,
    },
    {
      title: t("totalProperties"),
      value: totalProps.toLocaleString(),
      subtitle: `${totalProprietati[0]} ${t("buildings")} / ${totalProprietati[1]} ${t("landPlots")} / ${totalProprietati[2]} ${t("vehiclesCount")}`,
      icon: Building2,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                {stat.subtitle && (
                  <p className="text-xs text-muted-foreground">
                    {stat.subtitle}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts */}
      <DashboardCharts
        revenueByMonth={revenueByMonth}
        taxBreakdown={taxBreakdown}
        collectionRateTrend={collectionRateTrend}
        overdueAging={overdueAging}
      />

      {/* Recent Payments & Deadlines */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">{t("recentPayments")}</CardTitle>
            <Link href={`${localePrefix}/plati`}>
              <Button variant="ghost" size="sm">
                {tc("viewAll")}
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {recentPayments.length === 0 ? (
              <p className="text-sm text-muted-foreground">{tc("noResults")}</p>
            ) : (
              <div className="space-y-3">
                {recentPayments.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <div>
                      <Link
                        href={`${localePrefix}/contribuabili/${p.contribuabil.id}`}
                        className="font-medium hover:underline text-primary"
                      >
                        {p.contribuabil.nume}{" "}
                        {p.contribuabil.prenume ?? ""}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {new Date(p.dataPlata).toLocaleDateString("ro-RO")} &middot;{" "}
                        {methodLabel(p.modalitate)}
                      </p>
                    </div>
                    <span className="font-mono font-medium">
                      {formatCurrency(Number(p.suma))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("upcomingDeadlines")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span>Rata 1 impozite</span>
                <span className="font-mono text-muted-foreground">
                  31 Martie {new Date().getFullYear()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Bonificatie 10% (plata integrala)</span>
                <span className="font-mono text-muted-foreground">
                  31 Martie {new Date().getFullYear()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Rata 2 impozite</span>
                <span className="font-mono text-muted-foreground">
                  30 Septembrie {new Date().getFullYear()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
