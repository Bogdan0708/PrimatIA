"use server";

import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth-utils";
import { hash } from "bcryptjs";
import {
  bootstrapStripeSubscriptionForTenant,
  changeTenantPlanByTenantId,
  cancelTenantSubscriptionByTenantId,
  reactivateTenantSubscriptionByTenantId,
  syncTenantBillingByTenantId,
} from "@/lib/billing/tenant-subscription";
import { revalidatePath } from "next/cache";

type ActionFeedback =
  | { success: true; message: string }
  | { success: false; error: string };

export async function createTenant(formData: FormData) {
  await requireSuperAdmin();

  const name = formData.get("name") as string;
  const slug = formData.get("slug") as string;
  const cui = formData.get("cui") as string;
  const siruta_code = formData.get("siruta_code") as string;
  const county = formData.get("county") as string;
  const commune_type = formData.get("commune_type") as string;
  const commune_rank = parseInt(formData.get("commune_rank") as string, 10);
  const population = formData.get("population")
    ? parseInt(formData.get("population") as string, 10)
    : null;
  const email = formData.get("email") as string;
  const adminPassword = formData.get("admin_password") as string;
  const phone = formData.get("phone") as string;
  const tier = formData.get("tier") as string;

  if (!name || !slug || !county) {
    return { error: "Name, slug, and county are required" };
  }

  if (!adminPassword || adminPassword.length < 12) {
    return { error: "Admin password is required and must be at least 12 characters" };
  }

  const existing = await prisma.tenant.findUnique({
    where: { slug },
  });

  if (existing) {
    return { error: "A tenant with this slug already exists" };
  }

  try {
    const tenant = await prisma.tenant.create({
      data: {
        name,
        slug,
        cui: cui || null,
        sirutaCode: siruta_code || null,
        county,
        communeType: commune_type,
        communeRank: commune_rank,
        population,
        email: email || null,
        phone: phone || null,
        tier,
        status: "trial",
      },
    });

    await prisma.tenantUser.create({
      data: {
        tenantId: tenant.id,
        email: email || `admin@${slug}.primaria.ro`,
        passwordHash: await hash(adminPassword, 12),
        firstName: "Administrator",
        lastName: name,
        role: "primaria_admin",
      },
    });

    try {
      await bootstrapStripeSubscriptionForTenant(tenant.id);
    } catch (error) {
      console.error("Failed to bootstrap Stripe subscription:", error);
    }

    return { success: true, tenantId: tenant.id };
  } catch (err) {
    console.error("Failed to create tenant:", err);
    return { error: "Failed to create tenant" };
  }
}

export async function getTenants() {
  await requireSuperAdmin();

  return prisma.tenant.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { tenantUsers: true },
      },
    },
  });
}

export async function getTenantById(id: string) {
  await requireSuperAdmin();

  return prisma.tenant.findUnique({
    where: { id },
    include: {
      tenantUsers: {
        where: { deletedAt: null },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
        },
      },
    },
  });
}

export async function updateTenantStatus(id: string, status: "trial" | "active" | "suspended" | "cancelled") {
  const session = await requireSuperAdmin();

  const before = await prisma.tenant.findUnique({
    where: { id },
    select: { id: true, status: true, settings: true },
  });
  if (!before) return { success: false, error: "Tenant not found" } satisfies ActionFeedback;

  await prisma.tenant.update({
    where: { id },
    data: { status },
  });

  await prisma.auditLog.create({
    data: {
      tenantId: id,
      userId: session.user.id,
      action: "tenant_status_updated",
      entityType: "tenant",
      entityId: id,
      oldValues: { status: before.status },
      newValues: { status },
    },
  });

  revalidatePath("/admin/tenants");
  revalidatePath(`/admin/tenants/${id}`);
  return { success: true, message: `Tenant status set to ${status}` } satisfies ActionFeedback;
}

export async function syncTenantBilling(id: string) {
  const session = await requireSuperAdmin();
  const ok = await syncTenantBillingByTenantId(id);
  if (!ok) return { success: false, error: "No Stripe subscription found for tenant" } satisfies ActionFeedback;

  await prisma.auditLog.create({
    data: {
      tenantId: id,
      userId: session.user.id,
      action: "tenant_billing_manual_sync",
      entityType: "tenant",
      entityId: id,
      newValues: { source: "manual" },
    },
  });

  revalidatePath(`/admin/tenants/${id}`);
  return { success: true, message: "Billing synchronized" } satisfies ActionFeedback;
}

export async function cancelTenantBilling(id: string) {
  const session = await requireSuperAdmin();
  const ok = await cancelTenantSubscriptionByTenantId(id);
  if (!ok) return { success: false, error: "No active Stripe subscription to cancel" } satisfies ActionFeedback;

  await prisma.auditLog.create({
    data: {
      tenantId: id,
      userId: session.user.id,
      action: "tenant_billing_manual_cancel",
      entityType: "tenant",
      entityId: id,
      newValues: { cancelAtPeriodEnd: true },
    },
  });

  revalidatePath(`/admin/tenants/${id}`);
  return { success: true, message: "Subscription set to cancel at period end" } satisfies ActionFeedback;
}

export async function reactivateTenantBilling(id: string) {
  const session = await requireSuperAdmin();
  const ok = await reactivateTenantSubscriptionByTenantId(id);
  if (!ok) return { success: false, error: "Unable to reactivate subscription" } satisfies ActionFeedback;

  await prisma.auditLog.create({
    data: {
      tenantId: id,
      userId: session.user.id,
      action: "tenant_billing_manual_reactivate",
      entityType: "tenant",
      entityId: id,
      newValues: { reactivated: true },
    },
  });

  revalidatePath(`/admin/tenants/${id}`);
  return { success: true, message: "Subscription reactivated" } satisfies ActionFeedback;
}

export async function getTenantBillingTimeline(id: string) {
  await requireSuperAdmin();

  return prisma.auditLog.findMany({
    where: {
      tenantId: id,
      entityType: "tenant",
      OR: [
        { action: { startsWith: "tenant_billing_" } },
        { action: "tenant_status_updated" },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      id: true,
      action: true,
      oldValues: true,
      newValues: true,
      createdAt: true,
      userId: true,
    },
  });
}

export async function changeTenantPlan(id: string, formData: FormData) {
  const session = await requireSuperAdmin();
  const nextTier = formData.get("tier");
  if (
    nextTier !== "comuna" &&
    nextTier !== "oras" &&
    nextTier !== "municipiu"
  ) {
    return { success: false, error: "Invalid tenant tier" } satisfies ActionFeedback;
  }

  const before = await prisma.tenant.findUnique({
    where: { id },
    select: { tier: true },
  });
  if (!before) return { success: false, error: "Tenant not found" } satisfies ActionFeedback;

  const ok = await changeTenantPlanByTenantId(id, nextTier);
  if (!ok) return { success: false, error: "Failed to change tenant plan" } satisfies ActionFeedback;

  await prisma.auditLog.create({
    data: {
      tenantId: id,
      userId: session.user.id,
      action: "tenant_billing_manual_plan_change",
      entityType: "tenant",
      entityId: id,
      oldValues: { tier: before.tier },
      newValues: { tier: nextTier },
    },
  });

  revalidatePath(`/admin/tenants/${id}`);
  return { success: true, message: `Plan changed to ${nextTier}` } satisfies ActionFeedback;
}
