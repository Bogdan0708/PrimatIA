import { getTranslations } from "next-intl/server";
import { requireSuperAdmin } from "@/lib/auth-utils";
import { notFound } from "next/navigation";
import {
  getTenantBillingTimeline,
  getTenantById,
} from "../_actions/tenant-actions";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BillingControls } from "./_components/billing-controls";

export default async function TenantDetailPage({
  params,
}: {
  params: { id: string };
}) {
  await requireSuperAdmin();
  const t = await getTranslations("tenant");
  const tCommon = await getTranslations("common");
  const tRoles = await getTranslations("roles");

  const tenant = await getTenantById(params.id);
  if (!tenant) notFound();
  const timeline = await getTenantBillingTimeline(tenant.id);

  const billing = (
    (tenant.settings as { billing?: { stripeCustomerId?: string; stripeSubscriptionId?: string; stripeSubscriptionStatus?: string; lastInvoiceStatus?: string } })?.billing ??
    {}
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{tenant.name}</h1>
          <p className="text-muted-foreground">
            {tenant.county} &middot; {t(tenant.communeType === "comuna" ? "commune" : tenant.communeType === "oras" ? "city" : "municipality")}
          </p>
        </div>
        <Badge>{tenant.status}</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{tCommon("details")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("slug")}</span>
              <span>{tenant.slug}</span>
            </div>
            {tenant.cui && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">CUI</span>
                <span>{tenant.cui}</span>
              </div>
            )}
            {tenant.sirutaCode && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">SIRUTA</span>
                <span>{tenant.sirutaCode}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("rank")}</span>
              <span>{tenant.communeRank}</span>
            </div>
            {tenant.population && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("population")}</span>
                <span>{tenant.population.toLocaleString("ro-RO")}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("tier")}</span>
              <span>{tenant.tier}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {tCommon("total")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {tenant.tenantUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between text-sm"
                >
                  <div>
                    <p className="font-medium">
                      {user.firstName} {user.lastName}
                    </p>
                    <p className="text-muted-foreground">{user.email}</p>
                  </div>
                  <Badge variant="secondary">{tRoles(user.role)}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("billing.title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("billing.stripeCustomer")}</span>
              <span className="font-mono text-xs">{billing.stripeCustomerId || "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("billing.stripeSubscription")}</span>
              <span className="font-mono text-xs">{billing.stripeSubscriptionId || "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("billing.subscriptionStatus")}</span>
              <span>{billing.stripeSubscriptionStatus || "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("billing.lastInvoice")}</span>
              <span>{billing.lastInvoiceStatus || "-"}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("billing.lifecycleControls")}</CardTitle>
          </CardHeader>
          <CardContent>
            <BillingControls
              tenantId={tenant.id}
              tier={tenant.tier as "comuna" | "oras" | "municipiu"}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("billing.timelineTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            {timeline.length === 0 ? (
              <p className="text-muted-foreground">{t("billing.noEvents")}</p>
            ) : (
              timeline.map((event) => (
                <div key={event.id} className="rounded border p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{event.action}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(event.createdAt).toLocaleString("ro-RO")}
                    </span>
                  </div>
                  <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
                    <div>{t("billing.user")}: {event.userId || t("billing.system")}</div>
                    <div>{t("billing.old")}: {event.oldValues ? JSON.stringify(event.oldValues) : "-"}</div>
                    <div>{t("billing.new")}: {event.newValues ? JSON.stringify(event.newValues) : "-"}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
