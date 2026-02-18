import Stripe from "stripe";
import { prisma } from "@/lib/db";
import { getStripeClient } from "@/lib/stripe";
import { Prisma } from "@prisma/client";
import { sendEmail } from "@/lib/notifications/email";

type TenantStatus = "trial" | "active" | "suspended" | "cancelled";

interface BillingSettings {
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripeSubscriptionStatus?: string;
  lastInvoiceStatus?: string;
  updatedAt?: string;
  [key: string]: string | undefined;
}

function resolvePriceIdForTier(tier: string): string | null {
  if (tier === "comuna") {
    return (
      process.env.STRIPE_PRICE_COMUNA_ID ||
      process.env.STRIPE_MUNICIPAL_PRICE_ID ||
      null
    );
  }
  if (tier === "oras") {
    return (
      process.env.STRIPE_PRICE_ORAS_ID ||
      process.env.STRIPE_MUNICIPAL_PRICE_ID ||
      null
    );
  }
  if (tier === "municipiu") {
    return (
      process.env.STRIPE_PRICE_MUNICIPIU_ID ||
      process.env.STRIPE_MUNICIPAL_PRICE_ID ||
      null
    );
  }
  return process.env.STRIPE_MUNICIPAL_PRICE_ID || null;
}

function toBillingSettings(settings: unknown): BillingSettings {
  if (!settings || typeof settings !== "object") return {};
  const root = settings as Record<string, unknown>;
  const billing = root.billing;
  if (!billing || typeof billing !== "object") return {};
  return billing as BillingSettings;
}

function withBillingSettings(settings: unknown, billing: BillingSettings) {
  const root = settings && typeof settings === "object"
    ? (settings as Record<string, unknown>)
    : {};
  return {
    ...root,
    billing,
  } as Prisma.InputJsonValue;
}

function mapStripeSubscriptionToTenantStatus(status: string): TenantStatus {
  if (status === "trialing") return "trial";
  if (status === "active") return "active";
  if (status === "canceled" || status === "incomplete_expired") return "cancelled";
  return "suspended";
}

export async function bootstrapStripeSubscriptionForTenant(tenantId: string): Promise<void> {
  if (process.env.PAYMENT_MODE !== "stripe") return;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      name: true,
      email: true,
      slug: true,
      status: true,
      tier: true,
      settings: true,
    },
  });

  if (!tenant) return;
  const priceId = resolvePriceIdForTier(tenant.tier);
  if (!priceId) return;

  const existingBilling = toBillingSettings(tenant.settings);
  if (existingBilling.stripeSubscriptionId) return;

  const stripe = getStripeClient();

  const customer = await stripe.customers.create({
    name: tenant.name,
    email: tenant.email ?? undefined,
    metadata: {
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
    },
  });

  const subscription = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price: priceId }],
    trial_period_days: 14,
    metadata: {
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
    },
  });

  await syncTenantFromStripeSubscription(subscription, customer.id);
}

async function findTenantByStripeRef(params: {
  tenantId?: string;
  customerId?: string;
  subscriptionId?: string;
}) {
  if (params.tenantId) {
    return prisma.tenant.findUnique({ where: { id: params.tenantId } });
  }

  if (params.customerId) {
    const byCustomer = await prisma.tenant.findFirst({
      where: {
        settings: {
          path: ["billing", "stripeCustomerId"],
          equals: params.customerId,
        },
      },
    });
    if (byCustomer) return byCustomer;
  }

  if (params.subscriptionId) {
    return prisma.tenant.findFirst({
      where: {
        settings: {
          path: ["billing", "stripeSubscriptionId"],
          equals: params.subscriptionId,
        },
      },
    });
  }

  return null;
}

function getTenantBillingRefs(tenant: {
  id: string;
  settings: unknown;
}) {
  const billing = toBillingSettings(tenant.settings);
  return {
    customerId: billing.stripeCustomerId,
    subscriptionId: billing.stripeSubscriptionId,
  };
}

export async function syncTenantFromStripeSubscription(
  subscription: Stripe.Subscription,
  customerId?: string
): Promise<void> {
  const metadataTenantId = subscription.metadata?.tenantId || undefined;
  const tenant = await findTenantByStripeRef({
    tenantId: metadataTenantId,
    customerId: customerId || (typeof subscription.customer === "string" ? subscription.customer : undefined),
    subscriptionId: subscription.id,
  });

  if (!tenant) {
    console.warn("No tenant found for Stripe subscription", subscription.id);
    return;
  }

  const billing = toBillingSettings(tenant.settings);
  const targetStatus = mapStripeSubscriptionToTenantStatus(subscription.status);
  const mergedBilling: BillingSettings = {
    ...billing,
    stripeCustomerId:
      customerId ||
      billing.stripeCustomerId ||
      (typeof subscription.customer === "string" ? subscription.customer : undefined),
    stripeSubscriptionId: subscription.id,
    stripeSubscriptionStatus: subscription.status,
    updatedAt: new Date().toISOString(),
  };

  const periodStart = (subscription as unknown as { current_period_start?: number }).current_period_start;
  const periodEnd = (subscription as unknown as { current_period_end?: number }).current_period_end;

  await prisma.tenant.update({
    where: { id: tenant.id },
    data: {
      status: targetStatus,
      subscriptionStart: periodStart
        ? new Date(periodStart * 1000)
        : undefined,
      subscriptionEnd: periodEnd
        ? new Date(periodEnd * 1000)
        : undefined,
      settings: withBillingSettings(tenant.settings, mergedBilling),
    },
  });

  await prisma.auditLog.create({
    data: {
      tenantId: tenant.id,
      action: "tenant_billing_subscription_sync",
      entityType: "tenant",
      entityId: tenant.id,
      oldValues: { status: tenant.status },
      newValues: {
        status: targetStatus,
        stripeSubscriptionStatus: subscription.status,
      },
    },
  });
}

export async function markTenantInvoiceOutcome(params: {
  customerId?: string;
  subscriptionId?: string;
  invoiceStatus: string;
  paid: boolean;
}) {
  const tenant = await findTenantByStripeRef({
    customerId: params.customerId,
    subscriptionId: params.subscriptionId,
  });
  if (!tenant) return;

  const billing = toBillingSettings(tenant.settings);
  const mergedBilling: BillingSettings = {
    ...billing,
    lastInvoiceStatus: params.invoiceStatus,
    updatedAt: new Date().toISOString(),
  };

  await prisma.tenant.update({
    where: { id: tenant.id },
    data: {
      status: params.paid
        ? (tenant.status === "cancelled" ? "cancelled" : "active")
        : (tenant.status === "cancelled" ? "cancelled" : "suspended"),
      settings: withBillingSettings(tenant.settings, mergedBilling),
    },
  });

  await prisma.auditLog.create({
    data: {
      tenantId: tenant.id,
      action: "tenant_billing_invoice_sync",
      entityType: "tenant",
      entityId: tenant.id,
      oldValues: { status: tenant.status },
      newValues: {
        status: params.paid
          ? (tenant.status === "cancelled" ? "cancelled" : "active")
          : (tenant.status === "cancelled" ? "cancelled" : "suspended"),
        invoiceStatus: params.invoiceStatus,
      },
    },
  });

  if (!params.paid) {
    await notifyTenantSuspended(tenant.id);
  }
}

export async function fetchSubscriptionFromInvoice(
  invoice: Stripe.Invoice
): Promise<Stripe.Subscription | null> {
  const invoiceLike = invoice as unknown as {
    subscription?: string | Stripe.Subscription | null;
  };
  const subscriptionId =
    typeof invoiceLike.subscription === "string" ? invoiceLike.subscription : null;
  if (!subscriptionId) return null;

  try {
    return await getStripeClient().subscriptions.retrieve(subscriptionId);
  } catch (error) {
    console.error("Failed to retrieve Stripe subscription", error);
    return null;
  }
}

export async function syncTenantBillingByTenantId(tenantId: string): Promise<boolean> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, settings: true },
  });
  if (!tenant) return false;

  const refs = getTenantBillingRefs(tenant);
  if (!refs.subscriptionId) return false;

  const subscription = await getStripeClient().subscriptions.retrieve(
    refs.subscriptionId
  );
  await syncTenantFromStripeSubscription(subscription, refs.customerId);
  return true;
}

export async function cancelTenantSubscriptionByTenantId(
  tenantId: string
): Promise<boolean> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, settings: true },
  });
  if (!tenant) return false;

  const refs = getTenantBillingRefs(tenant);
  if (!refs.subscriptionId) return false;

  const subscription = await getStripeClient().subscriptions.update(
    refs.subscriptionId,
    { cancel_at_period_end: true }
  );
  await syncTenantFromStripeSubscription(subscription, refs.customerId);
  return true;
}

export async function reactivateTenantSubscriptionByTenantId(
  tenantId: string
): Promise<boolean> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      name: true,
      slug: true,
      email: true,
      tier: true,
      settings: true,
    },
  });
  if (!tenant) return false;

  const refs = getTenantBillingRefs(tenant);
  const stripe = getStripeClient();
  const priceId = resolvePriceIdForTier(tenant.tier);
  if (!priceId) return false;

  if (refs.subscriptionId) {
    const existing = await stripe.subscriptions.retrieve(refs.subscriptionId);
    if (existing.status === "active" || existing.status === "trialing") {
      const updated = await stripe.subscriptions.update(existing.id, {
        cancel_at_period_end: false,
      });
      await syncTenantFromStripeSubscription(updated, refs.customerId);
      return true;
    }
  }

  let customerId = refs.customerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      name: tenant.name,
      email: tenant.email ?? undefined,
      metadata: { tenantId: tenant.id, tenantSlug: tenant.slug },
    });
    customerId = customer.id;
  }

  const created = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    metadata: { tenantId: tenant.id, tenantSlug: tenant.slug },
  });
  await syncTenantFromStripeSubscription(created, customerId);
  return true;
}

export async function changeTenantPlanByTenantId(
  tenantId: string,
  nextTier: "comuna" | "oras" | "municipiu"
): Promise<boolean> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      name: true,
      slug: true,
      email: true,
      tier: true,
      settings: true,
    },
  });
  if (!tenant) return false;

  const nextPriceId = resolvePriceIdForTier(nextTier);
  if (!nextPriceId) return false;

  const refs = getTenantBillingRefs(tenant);
  const stripe = getStripeClient();

  let customerId = refs.customerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      name: tenant.name,
      email: tenant.email ?? undefined,
      metadata: { tenantId: tenant.id, tenantSlug: tenant.slug },
    });
    customerId = customer.id;
  }

  let subscription: Stripe.Subscription;
  if (refs.subscriptionId) {
    const existing = await stripe.subscriptions.retrieve(refs.subscriptionId);
    const firstItem = existing.items.data[0];
    if (firstItem) {
      subscription = await stripe.subscriptions.update(existing.id, {
        cancel_at_period_end: false,
        proration_behavior: "create_prorations",
        items: [{ id: firstItem.id, price: nextPriceId }],
      });
    } else {
      subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: nextPriceId }],
        metadata: { tenantId: tenant.id, tenantSlug: tenant.slug },
      });
    }
  } else {
    subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: nextPriceId }],
      metadata: { tenantId: tenant.id, tenantSlug: tenant.slug },
    });
  }

  await prisma.tenant.update({
    where: { id: tenant.id },
    data: { tier: nextTier },
  });

  await syncTenantFromStripeSubscription(subscription, customerId);
  return true;
}

async function notifyTenantSuspended(tenantId: string): Promise<void> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      name: true,
      slug: true,
      tenantUsers: {
        where: {
          role: { in: ["primaria_admin", "super_admin"] },
          isActive: true,
          deletedAt: null,
        },
        select: { email: true, firstName: true },
      },
    },
  });

  if (!tenant) return;

  const dashboardUrl =
    (process.env.NEXTAUTH_URL || "http://localhost:3000") + "/ro/login";

  for (const user of tenant.tenantUsers) {
    if (!user.email) continue;
    try {
      await sendEmail({
        to: user.email,
        subject: `[PrimarIA] Tenant suspended: ${tenant.name}`,
        text: `Tenantul ${tenant.name} (${tenant.slug}) a fost suspendat automat din cauza unei plăți eșuate. Verificați billing-ul și reactivați tenantul după rezolvare. ${dashboardUrl}`,
        html: `<p>Tenantul <strong>${tenant.name}</strong> (${tenant.slug}) a fost suspendat automat din cauza unei plăți eșuate.</p><p>Verificați billing-ul și reactivați tenantul după rezolvare.</p><p><a href=\"${dashboardUrl}\">Accesează platforma</a></p>`,
      });
    } catch (error) {
      console.error("Failed to send tenant suspension alert email:", error);
    }
  }
}
