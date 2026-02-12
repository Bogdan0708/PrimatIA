import { getTranslations } from "next-intl/server";
import { requireSuperAdmin } from "@/lib/auth-utils";
import { TenantForm } from "../_components/tenant-form";

export default async function NewTenantPage() {
  await requireSuperAdmin();
  const t = await getTranslations("tenant");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("addNew")}</h1>
      </div>
      <TenantForm />
    </div>
  );
}
