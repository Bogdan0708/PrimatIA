"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  cancelTenantBilling,
  changeTenantPlan,
  reactivateTenantBilling,
  syncTenantBilling,
  updateTenantStatus,
} from "../../_actions/tenant-actions";

type TenantTier = "comuna" | "oras" | "municipiu";

interface BillingControlsProps {
  tenantId: string;
  tier: TenantTier;
}

export function BillingControls({ tenantId, tier }: BillingControlsProps) {
  const t = useTranslations("tenant");
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [nextTier, setNextTier] = useState<TenantTier>(tier);

  const run = (fn: () => Promise<{ success: boolean; message?: string; error?: string } | void>) => {
    setMessage("");
    setError("");
    startTransition(async () => {
      try {
        const result = await fn();
        if (!result) {
          setMessage(t("billing.actionCompleted"));
          return;
        }
        if (result.success) {
          setMessage(mapActionMessage(t, result.message) || t("billing.actionCompleted"));
        } else {
          setError(mapActionError(t, result.error) || t("billing.actionFailed"));
        }
      } catch {
        setError(t("billing.actionFailed"));
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={isPending}
          onClick={() => run(() => updateTenantStatus(tenantId, "active"))}
        >
          {t("billing.setActive")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={isPending}
          onClick={() => run(() => updateTenantStatus(tenantId, "suspended"))}
        >
          {t("billing.setSuspended")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={isPending}
          onClick={() => run(() => updateTenantStatus(tenantId, "cancelled"))}
        >
          {t("billing.setCancelled")}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 border-t pt-3">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() => run(() => syncTenantBilling(tenantId))}
        >
          {t("billing.syncBilling")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() => run(() => cancelTenantBilling(tenantId))}
        >
          {t("billing.cancelAtPeriodEnd")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() => run(() => reactivateTenantBilling(tenantId))}
        >
          {t("billing.reactivateSubscription")}
        </Button>
      </div>

      <div className="mt-3 border-t pt-3">
        <div className="text-xs text-muted-foreground mb-2">{t("billing.changePlan")}</div>
        <div className="flex items-center gap-2">
          <select
            name="tier"
            value={nextTier}
            onChange={(e) => setNextTier(e.target.value as TenantTier)}
            className="flex h-8 rounded-md border border-input bg-background px-2 text-xs"
          >
            <option value="comuna">comuna</option>
            <option value="oras">oras</option>
            <option value="municipiu">municipiu</option>
          </select>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => {
              const fd = new FormData();
              fd.set("tier", nextTier);
              run(() => changeTenantPlan(tenantId, fd));
            }}
          >
            {t("billing.updatePlan")}
          </Button>
        </div>
      </div>

      {message ? <p className="text-xs text-emerald-700">{message}</p> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function mapActionMessage(
  t: ReturnType<typeof useTranslations<"tenant">>,
  message?: string
): string | null {
  if (!message) return null;

  if (message.startsWith("Tenant status set to ")) {
    const status = message.slice("Tenant status set to ".length);
    if (status === "active") return t("billing.statusUpdatedActive");
    if (status === "suspended") return t("billing.statusUpdatedSuspended");
    if (status === "cancelled") return t("billing.statusUpdatedCancelled");
  }

  switch (message) {
    case "Billing synchronized":
      return t("billing.billingSynchronized");
    case "Subscription set to cancel at period end":
      return t("billing.subscriptionCancelScheduled");
    case "Subscription reactivated":
      return t("billing.subscriptionReactivated");
    case "Tenant plan changed":
      return t("billing.tenantPlanChanged");
    case "Action completed":
      return t("billing.actionCompleted");
    default:
      return message;
  }
}

function mapActionError(
  t: ReturnType<typeof useTranslations<"tenant">>,
  error?: string
): string | null {
  if (!error) return null;
  switch (error) {
    case "No Stripe subscription found for tenant":
      return t("billing.noStripeSubscriptionFound");
    case "No active Stripe subscription to cancel":
      return t("billing.noActiveSubscriptionToCancel");
    case "Unable to reactivate subscription":
      return t("billing.unableToReactivateSubscription");
    case "Invalid tenant tier":
      return t("billing.invalidTenantTier");
    case "Action failed":
      return t("billing.actionFailed");
    default:
      return error;
  }
}
