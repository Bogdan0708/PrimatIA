"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CreditCard, Loader2 } from "lucide-react";

interface DebtItem {
  impozitId: string;
  contribuabilId: string;
  taxType: string;
  fiscalYear: number;
  amountOwed: number;
  amountPaid: number;
  outstanding: number;
}

export default function OnlinePaymentPage() {
  const [debts, setDebts] = useState<DebtItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const t = useTranslations("portal");

  useEffect(() => {
    fetch("/api/portal/debts")
      .then((res) => res.json())
      .then((data) => {
        setDebts(data.debts || []);
        setLoading(false);
      })
      .catch(() => {
        setError(t("loadError"));
        setLoading(false);
      });
  }, [t]);

  const toggleDebt = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const selectedDebts = debts.filter((d) => selected.has(d.impozitId));
  const totalAmount = selectedDebts.reduce((sum, d) => sum + d.outstanding, 0);

  const handlePay = async () => {
    if (selectedDebts.length === 0) return;
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/portal/payments/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contribuabilId: debts[0]?.contribuabilId,
          items: selectedDebts.map((d) => ({
            impozitId: d.impozitId,
            description: `${d.taxType} ${d.fiscalYear}`,
            amount: d.outstanding,
          })),
        }),
      });

      const data = await res.json();
      if (data.redirectUrl) {
        router.push(data.redirectUrl);
      } else {
        setError(data.error || t("paymentError"));
      }
    } catch {
      setError(t("paymentError"));
    } finally {
      setSubmitting(false);
    }
  };

  const formatLei = (n: number) =>
    new Intl.NumberFormat("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + " lei";

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("payOnline")}</h1>

      {debts.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">{t("noOutstandingDebts")}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{t("selectDebts")}</CardTitle>
              <CardDescription>{t("selectDebtsDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {debts.map((debt) => (
                  <label
                    key={debt.impozitId}
                    className="flex items-center justify-between rounded-lg border p-4 cursor-pointer hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={selected.has(debt.impozitId)}
                        onCheckedChange={() => toggleDebt(debt.impozitId)}
                      />
                      <div>
                        <p className="font-medium">{debt.taxType}</p>
                        <p className="text-sm text-muted-foreground">
                          {t("fiscalYear")} {debt.fiscalYear}
                        </p>
                      </div>
                    </div>
                    <span className="font-semibold text-destructive">
                      {formatLei(debt.outstanding)}
                    </span>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>

          {selected.size > 0 && (
            <Card className="border-teal-200 bg-teal-50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {t("selectedItems")}: {selected.size}
                    </p>
                    <p className="text-2xl font-bold text-teal-700">
                      {formatLei(totalAmount)}
                    </p>
                  </div>
                  <Button
                    onClick={handlePay}
                    disabled={submitting}
                    className="bg-teal-600 hover:bg-teal-700"
                    size="lg"
                  >
                    {submitting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <CreditCard className="mr-2 h-4 w-4" />
                    )}
                    {t("proceedToPayment")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {error && (
            <div className="text-sm text-destructive text-center">{error}</div>
          )}
        </>
      )}
    </div>
  );
}
