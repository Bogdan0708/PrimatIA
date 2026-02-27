import { requireCitizenAuth } from "@/lib/portal-auth";
import { prisma, setTenantContext } from "@/lib/db";
import { getLocale, getTranslations } from "next-intl/server";
import { formatLei, formatDate } from "@/lib/formatting";
import Link from "next/link";
import { getOutstanding } from "@/lib/tax-engine/liability-utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, CreditCard, FileText, AlertTriangle } from "lucide-react";

export default async function PortalDashboardPage() {
  const citizen = await requireCitizenAuth();
  const t = await getTranslations("portal");
  const locale = await getLocale();
  const localePrefix = `/${locale}`;
  await setTenantContext(citizen.tenantId);

  // Get linked contribuabili
  const links = await prisma.citizenContribuabilLink.findMany({
    where: { citizenUserId: citizen.sub, isActive: true },
    select: { contribuabilId: true },
  });
  const contribuabilIds = links.map((l) => l.contribuabilId);

  if (contribuabilIds.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">{t("noLinkedAccounts")}</p>
      </div>
    );
  }

  // Fetch summary data
  const currentYear = new Date().getFullYear();

  const [
    buildings,
    land,
    vehicles,
    taxes,
    recentPayments,
    buildingsList,
    landList,
    vehiclesList,
  ] = await Promise.all([
    prisma.proprietateCladire.count({
      where: { contribuabilId: { in: contribuabilIds }, status: "activ" },
    }),
    prisma.proprietateTeren.count({
      where: { contribuabilId: { in: contribuabilIds }, status: "activ" },
    }),
    prisma.proprietateVehicul.count({
      where: { contribuabilId: { in: contribuabilIds }, status: "activ" },
    }),
    prisma.impozit.findMany({
      where: {
        contribuabilId: { in: contribuabilIds },
        fiscalYear: currentYear,
      },
      include: {
        taxType: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.plata.findMany({
      where: { contribuabilId: { in: contribuabilIds } },
      orderBy: { dataPlata: "desc" },
      take: 5,
    }),
    prisma.proprietateCladire.findMany({
      where: { contribuabilId: { in: contribuabilIds }, status: "activ" },
      include: { adresa: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.proprietateTeren.findMany({
      where: { contribuabilId: { in: contribuabilIds }, status: "activ" },
      include: { adresa: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.proprietateVehicul.findMany({
      where: { contribuabilId: { in: contribuabilIds }, status: "activ" },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const totalOwed = taxes.reduce(
    (sum, tax) => sum + getOutstanding(tax),
    0
  );
  const totalPaid = taxes.reduce(
    (sum, tax) => sum + Number(tax.sumaPlatita),
    0
  );

  const formatAddress = (adresa?: {
    strada?: string | null;
    numar?: string | null;
    localitate?: string | null;
    judet?: string | null;
  }) => {
    if (!adresa) return "-";
    const street = [adresa.strada, adresa.numar].filter(Boolean).join(" ");
    const locality = [adresa.localitate, adresa.judet].filter(Boolean).join(", ");
    return [street, locality].filter(Boolean).join(", ") || "-";
  };

  const localeKey = locale || "ro";
  const propertyItems = [
    ...buildingsList.map((item) => ({
      id: item.id,
      createdAt: item.createdAt,
      label: t("buildings"),
      detail: formatAddress(item.adresa ?? undefined),
    })),
    ...landList.map((item) => ({
      id: item.id,
      createdAt: item.createdAt,
      label: t("land"),
      detail: formatAddress(item.adresa ?? undefined),
    })),
    ...vehiclesList.map((item) => ({
      id: item.id,
      createdAt: item.createdAt,
      label: t("vehicles"),
      detail: [item.marca, item.model, item.numarInmatriculare]
        .filter(Boolean)
        .join(" ")
        .trim() || "-",
    })),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 5);

  const taxObligations = taxes
    .map((tax) => {
      const taxName =
        (tax.taxType.name as Record<string, string>)?.[localeKey] ||
        (tax.taxType.name as Record<string, string>)?.ro ||
        tax.taxType.code;
      const outstanding =
        getOutstanding(tax);
      return {
        id: tax.id,
        name: taxName,
        outstanding,
        dueDate: tax.rata1Scadenta,
      };
    })
    .filter((tax) => tax.outstanding > 0)
    .sort((a, b) => b.outstanding - a.outstanding)
    .slice(0, 5);

  // Upcoming deadlines
  const now = new Date();
  const upcomingDeadlines = taxes
    .flatMap((tax) => [
      { date: tax.rata1Scadenta, amount: Number(tax.rata1), label: `${t("installment")} 1` },
      { date: tax.rata2Scadenta, amount: Number(tax.rata2), label: `${t("installment")} 2` },
    ])
    .filter((d) => d.date > now)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 3);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("welcome")}, {citizen.firstName}!</h1>
        <p className="text-muted-foreground">{t("dashboardSubtitle")}</p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("myProperties")}</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{buildings + land + vehicles}</div>
            <p className="text-xs text-muted-foreground">
              {buildings} {t("buildings")}, {land} {t("land")}, {vehicles} {t("vehicles")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("totalOwed")}</CardTitle>
            <AlertTriangle className={`h-4 w-4 ${totalOwed > 0 ? "text-destructive" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalOwed > 0 ? "text-destructive" : "text-portal-primary"}`}>
              {formatLei(totalOwed)}
            </div>
            <p className="text-xs text-muted-foreground">{t("forYear")} {currentYear}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("totalPaidYear")}</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-portal-primary">{formatLei(totalPaid)}</div>
            <p className="text-xs text-muted-foreground">{t("forYear")} {currentYear}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("documents")}</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Link
              href={`${localePrefix}/portal/documente`}
              className="text-portal-primary hover:underline text-sm"
            >
              {t("viewDocuments")}
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* My properties */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle className="text-lg">{t("myProperties")}</CardTitle>
            <Link href={`${localePrefix}/portal/proprietati`} className="text-sm text-portal-primary hover:underline">
              {t("properties")}
            </Link>
          </CardHeader>
          <CardContent>
            {propertyItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noProperties")}</p>
            ) : (
              <div className="space-y-3">
                {propertyItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tax obligations */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle className="text-lg">{t("myTaxes")}</CardTitle>
            <Link href={`${localePrefix}/portal/impozite`} className="text-sm text-portal-primary hover:underline">
              {t("taxes")}
            </Link>
          </CardHeader>
          <CardContent>
            {taxObligations.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noOutstandingDebts")}</p>
            ) : (
              <div className="space-y-3">
                {taxObligations.map((tax) => (
                  <div key={tax.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{tax.name}</p>
                      <p className="text-xs text-muted-foreground">{t("installment")} 1: {formatDate(tax.dueDate)}</p>
                    </div>
                    <span className="font-semibold text-destructive">{formatLei(tax.outstanding)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment history */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle className="text-lg">{t("paymentHistory")}</CardTitle>
            <Link href={`${localePrefix}/portal/plati`} className="text-sm text-portal-primary hover:underline">
              {t("payments")}
            </Link>
          </CardHeader>
          <CardContent>
            {recentPayments.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noPayments")}</p>
            ) : (
              <div className="space-y-3">
                {recentPayments.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{formatLei(Number(payment.suma))}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(payment.dataPlata)}</p>
                    </div>
                    <Badge variant="outline">{payment.modalitate}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Upcoming deadlines */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("upcomingDeadlines")}</CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingDeadlines.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noUpcomingDeadlines")}</p>
            ) : (
              <div className="space-y-3">
                {upcomingDeadlines.map((deadline, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{deadline.label}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(deadline.date)}</p>
                    </div>
                    <span className="font-semibold">{formatLei(deadline.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("quickActions")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            <Link
              href={`${localePrefix}/portal/plati/online`}
              className="flex items-center gap-2 rounded-lg border p-4 hover:bg-portal-primary-subtle transition-colors"
            >
              <CreditCard className="h-5 w-5 text-portal-primary" />
              <span className="font-medium">{t("payOnline")}</span>
            </Link>
            <Link
              href={`${localePrefix}/portal/certificate`}
              className="flex items-center gap-2 rounded-lg border p-4 hover:bg-portal-primary-subtle transition-colors"
            >
              <FileText className="h-5 w-5 text-portal-primary" />
              <span className="font-medium">{t("requestCertificate")}</span>
            </Link>
            <Link
              href={`${localePrefix}/portal/impozite`}
              className="flex items-center gap-2 rounded-lg border p-4 hover:bg-portal-primary-subtle transition-colors"
            >
              <AlertTriangle className="h-5 w-5 text-portal-primary" />
              <span className="font-medium">{t("viewTaxes")}</span>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
