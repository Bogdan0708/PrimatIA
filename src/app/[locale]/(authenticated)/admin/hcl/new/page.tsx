import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth-utils";
import { HclNewForm } from "./_components/hcl-new-form";

export default async function HclNewPage() {
  await requireAdmin();
  const t = await getTranslations("hcl");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {t("addDecision")}
        </h1>
      </div>
      <HclNewForm />
    </div>
  );
}
