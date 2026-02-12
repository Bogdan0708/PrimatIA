import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calculator } from "lucide-react";
import { MassCalculationForm } from "./_components/mass-calculation-form";

export default async function CalculPage() {
  await requireAdmin();
  const t = await getTranslations("tax");

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">{t("massCalculation")}</h1>
      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Calculator className="h-5 w-5" />
          <CardTitle className="text-lg">{t("massCalculation")}</CardTitle>
        </CardHeader>
        <CardContent>
          <MassCalculationForm />
        </CardContent>
      </Card>
    </div>
  );
}
