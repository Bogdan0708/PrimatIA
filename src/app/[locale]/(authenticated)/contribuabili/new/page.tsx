import { getTranslations } from "next-intl/server";
import { requireStaff } from "@/lib/auth-utils";
import { ContribuabilNewForm } from "./_components/contribuabil-new-form";

export default async function ContribuabilNewPage() {
  await requireStaff();
  const t = await getTranslations("taxpayer");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {t("addNew")}
        </h1>
      </div>
      <ContribuabilNewForm />
    </div>
  );
}
