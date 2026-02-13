import { getLocale, getTranslations } from "next-intl/server";
import { requireStaff } from "@/lib/auth-utils";
import { notFound } from "next/navigation";
import { getContribuabilById } from "../../_actions/contribuabil-actions";
import { ContribuabilEditForm } from "./_components/contribuabil-edit-form";

export default async function ContribuabilEditPage({
  params,
}: {
  params: { id: string };
}) {
  await requireStaff();
  const t = await getTranslations("taxpayer");
  const locale = await getLocale();

  const contribuabil = await getContribuabilById(params.id);
  if (!contribuabil) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {t("edit")} — {contribuabil.nume} {contribuabil.prenume ?? ""}
        </h1>
      </div>
      <ContribuabilEditForm
        contribuabil={{
          id: contribuabil.id,
          tip: contribuabil.tip,
          nume: contribuabil.nume,
          prenume: contribuabil.prenume,
          cui: contribuabil.cui,
          telefon: contribuabil.telefon,
          email: contribuabil.email,
          codRol: contribuabil.codRol,
          nrDosarFiscal: contribuabil.nrDosarFiscal,
          reprezentantLegal: contribuabil.reprezentantLegal,
          nrRegistruComert: contribuabil.nrRegistruComert,
          limbaPreferata: contribuabil.limbaPreferata,
          status: contribuabil.status,
          note: contribuabil.note,
          adresaDomiciliu: contribuabil.adresaDomiciliu,
        }}
      />
    </div>
  );
}
