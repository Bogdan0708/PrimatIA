import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth-utils";
import { notFound } from "next/navigation";
import { getHclDecisionById } from "../../_actions/hcl-actions";
import { HclEditForm } from "./_components/hcl-edit-form";

export default async function HclEditPage({
  params,
}: {
  params: { id: string };
}) {
  await requireAdmin();
  const t = await getTranslations("hcl");

  const hcl = await getHclDecisionById(params.id);
  if (!hcl) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {t("editDecision")} — HCL {hcl.hclNumber}
        </h1>
      </div>
      <HclEditForm
        hcl={{
          id: hcl.id,
          hclNumber: hcl.hclNumber,
          hclDate: new Date(hcl.hclDate).toISOString().split("T")[0],
          fiscalYear: hcl.fiscalYear,
          title: hcl.title,
          inflationIndex: hcl.inflationIndex ? Number(hcl.inflationIndex) : null,
          validFrom: new Date(hcl.validFrom).toISOString().split("T")[0],
          validTo: hcl.validTo ? new Date(hcl.validTo).toISOString().split("T")[0] : null,
          approvedBy: hcl.approvedBy,
          status: hcl.status,
          documentUrl: hcl.documentUrl,
        }}
      />
    </div>
  );
}
