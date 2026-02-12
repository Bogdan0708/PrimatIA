"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Calculator, CheckCircle, AlertTriangle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { runMassCalculation } from "../_actions/calcul-actions";

export function MassCalculationForm() {
  const t = useTranslations("tax");
  const tc = useTranslations("common");
  const { toast } = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear());
  const [resultData, setResultData] = useState<{
    processed: number;
    taxes: number;
    errors: number;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResultData(null);

    const result = await runMassCalculation(fiscalYear);
    setLoading(false);

    if (result.success && result.data) {
      setResultData(result.data);
      toast({
        title: t("calculationComplete"),
        description: `${result.data.processed} contribuabili, ${result.data.taxes} impozite calculate`,
      });
      router.refresh();
    } else if (!result.success) {
      toast({
        title: tc("error"),
        description: result.error,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="flex items-end gap-4">
        <div className="space-y-2">
          <Label>{t("fiscalYear")}</Label>
          <Input
            type="number"
            min={2020}
            max={2100}
            value={fiscalYear}
            onChange={(e) => setFiscalYear(parseInt(e.target.value))}
            className="w-32"
          />
        </div>
        <Button type="submit" disabled={loading}>
          <Calculator className="mr-2 h-4 w-4" />
          {loading ? tc("loading") : t("calculate")}
        </Button>
      </form>

      {loading && (
        <Card>
          <CardContent className="py-8 text-center">
            <div className="animate-pulse space-y-2">
              <Calculator className="h-8 w-8 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {t("massCalculationStarted")}...
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {resultData && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6 text-center">
              <CheckCircle className="h-8 w-8 mx-auto text-green-600 mb-2" />
              <p className="text-2xl font-bold">{resultData.processed}</p>
              <p className="text-sm text-muted-foreground">
                Contribuabili procesați
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <Calculator className="h-8 w-8 mx-auto text-blue-600 mb-2" />
              <p className="text-2xl font-bold">{resultData.taxes}</p>
              <p className="text-sm text-muted-foreground">
                Impozite calculate
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <AlertTriangle
                className={`h-8 w-8 mx-auto mb-2 ${resultData.errors > 0 ? "text-red-600" : "text-green-600"}`}
              />
              <p className="text-2xl font-bold">{resultData.errors}</p>
              <p className="text-sm text-muted-foreground">Erori</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
