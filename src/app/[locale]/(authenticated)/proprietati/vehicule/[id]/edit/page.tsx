import { getTranslations } from "next-intl/server";
import { requireStaff } from "@/lib/auth-utils";
import { notFound } from "next/navigation";
import { getVehiculById } from "../../_actions/vehicul-actions";
import { VehiculEditForm } from "./_components/vehicul-edit-form";

export default async function VehiculEditPage({
  params,
}: {
  params: { id: string };
}) {
  await requireStaff();
  const t = await getTranslations("property");

  const vehicul = await getVehiculById(params.id);
  if (!vehicul) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {t("editVehicle")} — {[vehicul.marca, vehicul.model].filter(Boolean).join(" ") || vehicul.numarInmatriculare || vehicul.id.slice(0, 8)}
        </h1>
      </div>
      <VehiculEditForm
        vehicul={{
          id: vehicul.id,
          contribuabilId: vehicul.contribuabilId,
          contribuabilNume: `${vehicul.contribuabil.nume} ${vehicul.contribuabil.prenume ?? ""}`.trim(),
          numarInmatriculare: vehicul.numarInmatriculare,
          serieSasiu: vehicul.serieSasiu,
          nrCarteIdentitate: vehicul.nrCarteIdentitate,
          tipVehicul: vehicul.tipVehicul,
          marca: vehicul.marca,
          model: vehicul.model,
          anFabricatie: vehicul.anFabricatie,
          cilindreeCmc: vehicul.cilindreeCmc,
          putereKw: vehicul.putereKw ? Number(vehicul.putereKw) : null,
          masaTotalaKg: vehicul.masaTotalaKg,
          nrLocuri: vehicul.nrLocuri,
          normaPoluare: vehicul.normaPoluare,
          tipCombustibil: vehicul.tipCombustibil,
          emisiiCo2GKm: vehicul.emisiiCo2GKm,
          dataDobandire: new Date(vehicul.dataDobandire).toISOString().split("T")[0],
          dataInstrainare: vehicul.dataInstrainare ? new Date(vehicul.dataInstrainare).toISOString().split("T")[0] : null,
          status: vehicul.status,
        }}
      />
    </div>
  );
}
