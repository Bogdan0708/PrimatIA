import { getLocale, getTranslations } from "next-intl/server";
import { requireSuperAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Building2 } from "lucide-react";
import { TenantBillingTrends } from "./_components/tenant-billing-trends";
import { TenantBillingExport } from "./_components/tenant-billing-export";
import { TenantBillingIncidents } from "./_components/tenant-billing-incidents";

export default async function TenantsPage() {
  await requireSuperAdmin();
  const t = await getTranslations("tenant");
  const tCommon = await getTranslations("common");
  const locale = await getLocale();
  const localePrefix = `/${locale}`;

  const tenants = await prisma.tenant.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { tenantUsers: true },
      },
    },
  });

  const billingLogs = await prisma.auditLog.findMany({
    where: {
      entityType: "tenant",
      action: {
        in: [
          "tenant_status_updated",
          "tenant_billing_invoice_sync",
          "tenant_billing_subscription_sync",
          "tenant_billing_manual_plan_change",
        ],
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      action: true,
      oldValues: true,
      newValues: true,
      createdAt: true,
      tenantId: true,
    },
  });

  const tierMonthlyEstimate: Record<string, number> = {
    comuna: Number(process.env.BILLING_ESTIMATE_COMUNA || 750),
    oras: Number(process.env.BILLING_ESTIMATE_ORAS || 3000),
    municipiu: Number(process.env.BILLING_ESTIMATE_MUNICIPIU || 7000),
  };

  const activeAndTrial = tenants.filter((t) =>
    ["active", "trial"].includes(t.status)
  );
  const estimatedMrr = activeAndTrial.reduce(
    (sum, t) => sum + (tierMonthlyEstimate[t.tier] || tierMonthlyEstimate.comuna),
    0
  );
  const suspendedCount = tenants.filter((t) => t.status === "suspended").length;
  const cancelledCount = tenants.filter((t) => t.status === "cancelled").length;

  const invoiceSyncEvents = billingLogs.filter((e) => e.action === "tenant_billing_invoice_sync");
  const failedInvoiceEvents = invoiceSyncEvents.filter((e) => {
    const nv = (e.newValues || {}) as Record<string, unknown>;
    return nv.invoiceStatus === "failed";
  });
  const incidentRows = invoiceSyncEvents.map((event) => {
    const nv = (event.newValues || {}) as Record<string, unknown>;
    const ov = (event.oldValues || {}) as Record<string, unknown>;
    return {
      id: event.id,
      tenantId: event.tenantId,
      action: event.action,
      createdAt: new Date(event.createdAt).toISOString(),
      invoiceStatus: String(nv.invoiceStatus || ""),
      oldValues: JSON.stringify(ov),
      newValues: JSON.stringify(nv),
    };
  });

  const formatDay = (date: Date) =>
    `${String(date.getDate()).padStart(2, "0")}/${String(
      date.getMonth() + 1
    ).padStart(2, "0")}`;

  const dayKey = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
      date.getDate()
    ).padStart(2, "0")}`;

  const failedInvoicesByDay = new Map<string, number>();
  for (const event of failedInvoiceEvents) {
    const key = dayKey(new Date(event.createdAt));
    failedInvoicesByDay.set(key, (failedInvoicesByDay.get(key) || 0) + 1);
  }

  const stateByTenant = new Map(
    tenants.map((tenant) => [
      tenant.id,
      {
        status: tenant.status,
        tier: tenant.tier,
      },
    ])
  );

  const logsDesc = [...billingLogs].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const today = new Date();
  today.setHours(23, 59, 59, 999);

  let logCursor = 0;
  const trendPoints: Array<{ day: string; mrr: number; failedInvoices: number }> = [];

  for (let offset = 0; offset < 90; offset++) {
    const dayEnd = new Date(today);
    dayEnd.setDate(today.getDate() - offset);
    const endMs = dayEnd.getTime();

    while (
      logCursor < logsDesc.length &&
      new Date(logsDesc[logCursor].createdAt).getTime() > endMs
    ) {
      const event = logsDesc[logCursor];
      const tenantState = stateByTenant.get(event.tenantId);
      const oldValues = (event.oldValues || {}) as Record<string, unknown>;

      if (tenantState) {
        if (typeof oldValues.status === "string") {
          tenantState.status = oldValues.status;
        }
        if (typeof oldValues.tier === "string") {
          tenantState.tier = oldValues.tier;
        }
      }

      logCursor++;
    }

    let mrrSnapshot = 0;
    for (const tenantState of Array.from(stateByTenant.values())) {
      if (tenantState.status === "active" || tenantState.status === "trial") {
        mrrSnapshot +=
          tierMonthlyEstimate[tenantState.tier] || tierMonthlyEstimate.comuna;
      }
    }

    const k = dayKey(dayEnd);
    trendPoints.unshift({
      day: formatDay(dayEnd),
      mrr: mrrSnapshot,
      failedInvoices: failedInvoicesByDay.get(k) || 0,
    });
  }

  const formatLei = (value: number) =>
    new Intl.NumberFormat("ro-RO", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);

  const statusVariant = (status: string) => {
    switch (status) {
      case "active":
        return "default" as const;
      case "trial":
        return "secondary" as const;
      case "suspended":
        return "destructive" as const;
      default:
        return "outline" as const;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        </div>
        <Link href={`${localePrefix}/admin/tenants/new`}>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            {t("addNew")}
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t("billingAnalytics.estimatedMrr")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatLei(estimatedMrr)} lei</div>
            <p className="text-xs text-muted-foreground">
              {t("billingAnalytics.estimatedMrrHint")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t("billingAnalytics.activePlusTrial")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeAndTrial.length}</div>
            <p className="text-xs text-muted-foreground">{t("billingAnalytics.billableTenants")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t("billingAnalytics.suspended")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{suspendedCount}</div>
            <p className="text-xs text-muted-foreground">{t("billingAnalytics.needsFollowUp")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t("billingAnalytics.cancelled")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cancelledCount}</div>
            <p className="text-xs text-muted-foreground">{t("billingAnalytics.accumulatedChurn")}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-base">{t("billingAnalytics.billingTrends")}</CardTitle>
            <TenantBillingExport trends={trendPoints} incidents={incidentRows} />
          </div>
        </CardHeader>
        <CardContent>
          <TenantBillingTrends data={trendPoints} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("billingAnalytics.billingIncidents")}</CardTitle>
        </CardHeader>
        <CardContent>
          <TenantBillingIncidents incidents={incidentRows} />
        </CardContent>
      </Card>

      {tenants.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{tCommon("noResults")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tenants.map((tenant) => (
            <Link key={tenant.id} href={`${localePrefix}/admin/tenants/${tenant.id}`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-base font-medium">
                    {tenant.name}
                  </CardTitle>
                  <Badge variant={statusVariant(tenant.status)}>
                    {tenant.status}
                  </Badge>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>
                      {t("county")}: {tenant.county}
                    </p>
                    <p>
                      {t("rank")}: {tenant.communeRank}
                    </p>
                    <p>
                      {t("tier")}: {tenant.tier}
                    </p>
                    <p>
                      {tenant._count.tenantUsers} {tCommon("total")}{" "}
                      {t("users")}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
