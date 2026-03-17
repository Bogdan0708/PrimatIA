import { getTranslations } from "next-intl/server";
import { requireStaff } from "@/lib/auth-utils";
import { notFound } from "next/navigation";
import { getTerenById } from "../../_actions/teren-actions";
import { TerenEditForm } from "./_components/teren-edit-form";

export default async function TerenEditPage({
  params,
}: {
  params: { id: string };
}) {
  await requireStaff();
  const t = await getTranslations("property");

  const teren = await getTerenById(params.id);
  if (!teren) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {t("editLand")} — {teren.contribuabil.nume} {teren.contribuabil.prenume ?? ""}
        </h1>
      </div>
      <TerenEditForm
        teren={{
          id: teren.id,
          contribuabilId: teren.contribuabilId,
          contribuabilNume: `${teren.contribuabil.nume} ${teren.contribuabil.prenume ?? ""}`.trim(),
          zona: teren.zona,
          numarCadastral: teren.numarCadastral,
          numarCarteFunciara: teren.numarCarteFunciara,
          categorie: teren.categorie,
          suprafataMp: Number(teren.suprafataMp),
          suprafataHa: teren.suprafataHa ? Number(teren.suprafataHa) : null,
          cotaParte: Number(teren.cotaParte),
          tipActProprietate: teren.tipActProprietate,
          nrActProprietate: teren.nrActProprietate,
          dataActProprietate: teren.dataActProprietate ? new Date(teren.dataActProprietate).toISOString().split("T")[0] : null,
          dataDobandire: new Date(teren.dataDobandire).toISOString().split("T")[0],
          dataInstrainare: teren.dataInstrainare ? new Date(teren.dataInstrainare).toISOString().split("T")[0] : null,
          isCultReligios: teren.isCultReligios,
          status: teren.status,
          adresa: teren.adresa ? {
            strada: teren.adresa.strada,
            numar: teren.adresa.numar,
            localitate: teren.adresa.localitate,
            judet: teren.adresa.judet,
            codPostal: teren.adresa.codPostal,
          } : null,
        }}
      />
    </div>
  );
}
