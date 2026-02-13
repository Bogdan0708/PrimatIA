import { getLocale, getTranslations } from "next-intl/server";
import { requireStaff } from "@/lib/auth-utils";
import { notFound } from "next/navigation";
import { getScutireRegulaById } from "../../_actions/scutire-actions";
import { ScutireEditForm } from "./_components/scutire-edit-form";

export default async function ScutireEditPage({
  params,
}: {
  params: { id: string };
}) {
  await requireStaff();
  const t = await getTranslations("exemption");
  const locale = await getLocale();

  const regula = await getScutireRegulaById(params.id);
  if (!regula) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {t("editRule")} — {regula.nameRo}
        </h1>
      </div>
      <ScutireEditForm
        regula={{
          id: regula.id,
          nameRo: regula.nameRo,
          nameEn: regula.nameEn,
          legalBasis: regula.legalBasis,
          taxTypes: regula.taxTypes,
          discountPercent: Number(regula.discountPercent),
          conditions: JSON.stringify(regula.conditions, null, 2),
          requiredDocuments: regula.requiredDocuments,
          autoRenewable: regula.autoRenewable,
          isActive: regula.isActive,
          validFrom: regula.validFrom ? new Date(regula.validFrom).toISOString().split("T")[0] : null,
          validTo: regula.validTo ? new Date(regula.validTo).toISOString().split("T")[0] : null,
        }}
      />
    </div>
  );
}
