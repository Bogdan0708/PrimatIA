"use server";

import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth-utils";
import { hash } from "bcryptjs";

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
  const phone = formData.get("phone") as string;
  const tier = formData.get("tier") as string;

  if (!name || !slug || !county) {
    return { error: "Name, slug, and county are required" };
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

    const defaultPassword = await hash("changeme123!", 12);
    await prisma.tenantUser.create({
      data: {
        tenantId: tenant.id,
        email: email || `admin@${slug}.primaria.ro`,
        passwordHash: defaultPassword,
        firstName: "Administrator",
        lastName: name,
        role: "primaria_admin",
      },
    });

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
