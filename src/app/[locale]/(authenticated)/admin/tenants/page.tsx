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
