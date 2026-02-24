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
import {
  CreditCard,
  Landmark,
  Loader2,
  Copy,
  Check,
} from "lucide-react";

interface DebtItem {
  impozitId: string;
  contribuabilId: string;
  taxType: string;
  fiscalYear: number;
  amountOwed: number;
  amountPaid: number;
  outstanding: number;
}

interface BankDetails {
  iban: string;
  bankName: string;
  beneficiary: string;
  referenceCode: string;
}

type PaymentStep = "select" | "method" | "bank-details";

export default function OnlinePaymentPage() {
  const [debts, setDebts] = useState<DebtItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<PaymentStep>("select");
  const [bankDetails, setBankDetails] = useState<BankDetails | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
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

  const getPaymentItems = () =>
    selectedDebts.map((d) => ({
      impozitId: d.impozitId,
      description: `${d.taxType} ${d.fiscalYear}`,
      amount: d.outstanding,
    }));

  const handleCardPayment = async () => {
    if (selectedDebts.length === 0) return;
    setSubmitting(true);
    setError("");

    try {
      // Use the appropriate endpoint based on payment mode
      const res = await fetch("/api/payments/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contribuabilId: debts[0]?.contribuabilId,
          items: getPaymentItems(),
        }),
      });

      const data = await res.json();
      if (data.redirectUrl) {
        // For Stripe: external URL; for mock: internal redirect
        if (data.redirectUrl.startsWith("http")) {
          window.location.href = data.redirectUrl;
        } else {
          router.push(data.redirectUrl);
        }
      } else {
        setError(data.error || t("paymentError"));
      }
    } catch {
      setError(t("paymentError"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleBankTransfer = async () => {
    if (selectedDebts.length === 0) return;
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/payments/bank-transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contribuabilId: debts[0]?.contribuabilId,
          items: getPaymentItems(),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setBankDetails(data.bankDetails);
        setStep("bank-details");
      } else {
        setError(data.error || t("paymentError"));
      }
    } catch {
      setError(t("paymentError"));
    } finally {
      setSubmitting(false);
    }
  };

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const formatLei = (n: number) =>
    new Intl.NumberFormat("ro-RO", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n) + " lei";

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-portal-primary" />
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
          {/* Step 1: Select debts */}
          {(step === "select" || step === "method") && (
            <Card>
              <CardHeader>
                <CardTitle>{t("selectDebts")}</CardTitle>
                <CardDescription>
                  {t("selectDebtsDescription")}
                </CardDescription>
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
                          disabled={step === "method"}
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
          )}

          {/* Summary + proceed button (step: select) */}
          {step === "select" && selected.size > 0 && (
            <Card className="border-portal-primary/30 bg-portal-primary-subtle">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {t("selectedItems")}: {selected.size}
                    </p>
                    <p className="text-2xl font-bold text-portal-primary">
                      {formatLei(totalAmount)}
                    </p>
                  </div>
                  <Button
                    onClick={() => setStep("method")}
                    className="bg-portal-primary hover:bg-portal-primary-hover"
                    size="lg"
                  >
                    <CreditCard className="mr-2 h-4 w-4" />
                    {t("proceedToPayment")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Choose payment method */}
          {step === "method" && (
            <Card>
              <CardHeader>
                <CardTitle>{t("choosePaymentMethod")}</CardTitle>
                <CardDescription>
                  {t("choosePaymentMethodDescription")}
                </CardDescription>
                <div className="mt-2 rounded-lg bg-portal-primary-subtle p-3">
                  <p className="text-sm text-muted-foreground">
                    {t("selectedItems")}: {selected.size}
                  </p>
                  <p className="text-xl font-bold text-portal-primary">
                    {formatLei(totalAmount)}
                  </p>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Card Payment */}
                  <button
                    onClick={handleCardPayment}
                    disabled={submitting}
                    className="flex flex-col items-center gap-3 rounded-xl border-2 border-portal-primary/30 p-6 text-center transition-all hover:border-portal-primary hover:bg-portal-primary-subtle disabled:opacity-50"
                  >
                    <div className="rounded-full bg-portal-primary-subtle p-4">
                      <CreditCard className="h-8 w-8 text-portal-primary" />
                    </div>
                    <div>
                      <p className="text-lg font-semibold">
                        {t("cardPayment")}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {t("cardPaymentDescription")}
                      </p>
                    </div>
                    {submitting && (
                      <div className="flex items-center gap-2 text-sm text-portal-primary">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t("processingPayment")}
                      </div>
                    )}
                  </button>

                  {/* Bank Transfer */}
                  <button
                    onClick={handleBankTransfer}
                    disabled={submitting}
                    className="flex flex-col items-center gap-3 rounded-xl border-2 border-blue-200 p-6 text-center transition-all hover:border-blue-500 hover:bg-blue-50 disabled:opacity-50"
                  >
                    <div className="rounded-full bg-blue-100 p-4">
                      <Landmark className="h-8 w-8 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-lg font-semibold">
                        {t("bankTransfer")}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {t("bankTransferDescription")}
                      </p>
                    </div>
                  </button>
                </div>

                <div className="mt-4 flex justify-start">
                  <Button
                    variant="ghost"
                    onClick={() => setStep("select")}
                    disabled={submitting}
                  >
                    &larr; {t("cancelPayment")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Bank transfer details */}
          {step === "bank-details" && bankDetails && (
            <Card className="border-blue-200">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-blue-100 p-3">
                    <Landmark className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle>{t("bankTransferTitle")}</CardTitle>
                    <CardDescription>
                      {t("bankTransferInstructions")}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 rounded-lg bg-gray-50 p-4">
                  <BankDetailRow
                    label={t("beneficiary")}
                    value={bankDetails.beneficiary}
                    onCopy={() =>
                      copyToClipboard(bankDetails.beneficiary, "beneficiary")
                    }
                    copied={copiedField === "beneficiary"}
                    t={t}
                  />
                  <BankDetailRow
                    label={t("iban")}
                    value={bankDetails.iban}
                    onCopy={() => copyToClipboard(bankDetails.iban, "iban")}
                    copied={copiedField === "iban"}
                    t={t}
                    mono
                  />
                  <BankDetailRow
                    label={t("bankName")}
                    value={bankDetails.bankName}
                    onCopy={() =>
                      copyToClipboard(bankDetails.bankName, "bankName")
                    }
                    copied={copiedField === "bankName"}
                    t={t}
                  />
                  <BankDetailRow
                    label={t("referenceCode")}
                    value={bankDetails.referenceCode}
                    onCopy={() =>
                      copyToClipboard(
                        bankDetails.referenceCode,
                        "referenceCode"
                      )
                    }
                    copied={copiedField === "referenceCode"}
                    t={t}
                    mono
                    highlight
                  />
                  <BankDetailRow
                    label={t("amountToPay")}
                    value={formatLei(totalAmount)}
                    onCopy={() =>
                      copyToClipboard(totalAmount.toFixed(2), "amount")
                    }
                    copied={copiedField === "amount"}
                    t={t}
                    highlight
                  />
                </div>

                <div className="mt-6 flex justify-center">
                  <Button
                    variant="outline"
                    onClick={() => router.push("../plati")}
                  >
                    {t("viewPayments")}
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

function BankDetailRow({
  label,
  value,
  onCopy,
  copied,
  t,
  mono,
  highlight,
}: {
  label: string;
  value: string;
  onCopy: () => void;
  copied: boolean;
  t: ReturnType<typeof useTranslations>;
  mono?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p
          className={`font-medium ${mono ? "font-mono text-sm" : ""} ${
            highlight ? "text-portal-primary" : ""
          }`}
        >
          {value}
        </p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onCopy}
        className="shrink-0"
      >
        {copied ? (
          <>
            <Check className="mr-1 h-3 w-3" />
            {t("copied")}
          </>
        ) : (
          <>
            <Copy className="mr-1 h-3 w-3" />
            {t("copyToClipboard")}
          </>
        )}
      </Button>
    </div>
  );
}
