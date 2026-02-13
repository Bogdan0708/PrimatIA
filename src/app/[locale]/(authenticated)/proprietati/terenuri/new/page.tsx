import { getTranslations } from "next-intl/server";
import { requireStaff } from "@/lib/auth-utils";
import { getContribuabili } from "../../../contribuabili/_actions/contribuabil-actions";
import { TerenNewForm } from "./_components/teren-new-form";

export default async function TerenNewPage() {
  await requireStaff();
  const t = await getTranslations("property");

  const { items: contribuabili } = await getContribuabili({ perPage: 1000 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {t("addLand")}
        </h1>
      </div>
      <TerenNewForm
        contribuabili={contribuabili.map((c) => ({
          id: c.id,
          label: `${c.nume} ${c.prenume ?? ""}`.trim() + (c.cui ? ` (${c.cui})` : ""),
        }))}
      />
    </div>
  );
}
