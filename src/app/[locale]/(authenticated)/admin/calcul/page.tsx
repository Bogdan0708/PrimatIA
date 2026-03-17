import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth-utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calculator, Shield } from "lucide-react";
import { MassCalculationForm } from "./_components/mass-calculation-form";
import { EligibilityDetectionForm } from "./_components/eligibility-detection-form";

export default async function CalculPage() {
  await requireAdmin();
  const t = await getTranslations("tax");
  const te = await getTranslations("exemption");

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">{t("massCalculation")}</h1>

      {/* Step 1: Eligibility Detection */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Shield className="h-5 w-5" />
          <div>
            <CardTitle className="text-lg">{te("stepDetection")}</CardTitle>
            <CardDescription>{te("detectEligibilityDesc")}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <EligibilityDetectionForm />
        </CardContent>
      </Card>

      {/* Step 2: Mass Calculation */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Calculator className="h-5 w-5" />
          <CardTitle className="text-lg">{te("stepCalculation")}</CardTitle>
        </CardHeader>
        <CardContent>
          <MassCalculationForm />
        </CardContent>
      </Card>
    </div>
  );
}
