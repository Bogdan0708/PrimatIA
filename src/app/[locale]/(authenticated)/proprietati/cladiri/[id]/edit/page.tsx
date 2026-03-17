import { getTranslations } from "next-intl/server";
import { requireStaff } from "@/lib/auth-utils";
import { notFound } from "next/navigation";
import { getCladireById } from "../../_actions/cladire-actions";
import { CladireEditForm } from "./_components/cladire-edit-form";

export default async function CladireEditPage({
  params,
}: {
  params: { id: string };
}) {
  await requireStaff();
  const t = await getTranslations("property");

  const cladire = await getCladireById(params.id);
  if (!cladire) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {t("editBuilding")} — {cladire.contribuabil.nume} {cladire.contribuabil.prenume ?? ""}
        </h1>
      </div>
      <CladireEditForm
        cladire={{
          id: cladire.id,
          contribuabilId: cladire.contribuabilId,
          contribuabilNume: `${cladire.contribuabil.nume} ${cladire.contribuabil.prenume ?? ""}`.trim(),
          zona: cladire.zona,
          numarCadastral: cladire.numarCadastral,
          numarCarteFunciara: cladire.numarCarteFunciara,
          destinatie: cladire.destinatie,
          tipConstructie: cladire.tipConstructie,
          anConstructie: cladire.anConstructie,
          suprafataConstruita: Number(cladire.suprafataConstruita),
          suprafataUtila: cladire.suprafataUtila ? Number(cladire.suprafataUtila) : null,
          suprafataDesfasurata: cladire.suprafataDesfasurata ? Number(cladire.suprafataDesfasurata) : null,
          nrEtaje: cladire.nrEtaje,
          valoareImpozabila: cladire.valoareImpozabila ? Number(cladire.valoareImpozabila) : null,
          valoareInventar: cladire.valoareInventar ? Number(cladire.valoareInventar) : null,
          suprafataRezidentiala: cladire.suprafataRezidentiala ? Number(cladire.suprafataRezidentiala) : null,
          suprafataNerezidentiala: cladire.suprafataNerezidentiala ? Number(cladire.suprafataNerezidentiala) : null,
          cotaParte: Number(cladire.cotaParte),
          nrProprietari: cladire.nrProprietari,
          tipActProprietate: cladire.tipActProprietate,
          nrActProprietate: cladire.nrActProprietate,
          dataActProprietate: cladire.dataActProprietate ? new Date(cladire.dataActProprietate).toISOString().split("T")[0] : null,
          dataDobandire: new Date(cladire.dataDobandire).toISOString().split("T")[0],
          dataInstrainare: cladire.dataInstrainare ? new Date(cladire.dataInstrainare).toISOString().split("T")[0] : null,
          isCultReligios: cladire.isCultReligios,
          isMonumentIstoric: cladire.isMonumentIstoric,
          status: cladire.status,
          adresa: cladire.adresa ? {
            strada: cladire.adresa.strada,
            numar: cladire.adresa.numar,
            bloc: cladire.adresa.bloc,
            scara: cladire.adresa.scara,
            etaj: cladire.adresa.etaj,
            apartament: cladire.adresa.apartament,
            localitate: cladire.adresa.localitate,
            judet: cladire.adresa.judet,
            codPostal: cladire.adresa.codPostal,
          } : null,
        }}
      />
    </div>
  );
}
