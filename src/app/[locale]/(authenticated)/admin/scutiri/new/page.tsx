import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth-utils";
import { ScutireNewForm } from "./_components/scutire-new-form";

export default async function ScutireNewPage() {
  await requireAdmin();
  const t = await getTranslations("exemption");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {t("addRule")}
        </h1>
      </div>
      <ScutireNewForm />
    </div>
  );
}
