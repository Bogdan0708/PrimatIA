import { getTranslations } from "next-intl/server";
import { requireStaff } from "@/lib/auth-utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Users, Calculator, CreditCard, AlertTriangle } from "lucide-react";

export default async function DashboardPage() {
  await requireStaff();
  const t = await getTranslations("dashboard");

  const stats = [
    {
      title: t("totalTaxpayers"),
      value: "—",
      icon: Users,
      change: "",
    },
    {
      title: t("totalRevenue"),
      value: "—",
      icon: CreditCard,
      change: "",
    },
    {
      title: t("outstandingDebts"),
      value: "—",
      icon: AlertTriangle,
      change: "",
    },
    {
      title: t("collectionRate"),
      value: "—",
      icon: Calculator,
      change: "",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
                {stat.change && (
                  <p className="text-xs text-muted-foreground">
                    {stat.change}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Placeholder sections */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("recentPayments")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {/* Placeholder for Phase 2 */}
              —
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("upcomingDeadlines")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {/* Placeholder for Phase 2 */}
              —
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
