"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, CreditCard, Loader2 } from "lucide-react";

export default function MockGatewayPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const t = useTranslations("portal");
  const locale = useLocale();
  const localePrefix = `/${locale}`;

  const gatewayRef = searchParams.get("ref") || "";
  const amount = searchParams.get("amount") || "0";

  const [processing, setProcessing] = useState(false);
  const [cardNumber, setCardNumber] = useState("");

  const formatLei = (n: string) =>
    new Intl.NumberFormat("ro-RO", { minimumFractionDigits: 2 }).format(Number(n)) + " lei";

  const handleConfirm = async () => {
    setProcessing(true);
    try {
      await fetch("/api/portal/payments/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gatewayRef }),
      });
      router.push(
        `${localePrefix}/portal/plati/confirmare?ref=${gatewayRef}&status=success`
      );
    } catch {
      router.push(
        `${localePrefix}/portal/plati/confirmare?ref=${gatewayRef}&status=failed`
      );
    }
  };

  const handleCancel = () => {
    router.push(`${localePrefix}/portal/plati`);
  };

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            <div className="rounded-full bg-amber-100 p-3">
              <Shield className="h-8 w-8 text-amber-600" />
            </div>
          </div>
          <CardTitle>{t("mockGatewayTitle")}</CardTitle>
          <CardDescription>{t("mockGatewayDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-gray-50 p-4 text-center">
            <p className="text-sm text-muted-foreground">{t("totalToPay")}</p>
            <p className="text-3xl font-bold text-teal-600">{formatLei(amount)}</p>
            <p className="text-xs text-muted-foreground mt-1">Ref: {gatewayRef}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cardNumber">{t("cardNumber")}</Label>
            <Input
              id="cardNumber"
              placeholder="4111 1111 1111 1111"
              value={cardNumber}
              onChange={(e) => setCardNumber(e.target.value)}
              maxLength={19}
            />
            <p className="text-xs text-muted-foreground">{t("mockCardHint")}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("expiryDate")}</Label>
              <Input placeholder="12/28" />
            </div>
            <div className="space-y-2">
              <Label>CVV</Label>
              <Input placeholder="123" maxLength={4} />
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={handleCancel}>
            {t("cancelPayment")}
          </Button>
          <Button
            className="flex-1 bg-teal-600 hover:bg-teal-700"
            onClick={handleConfirm}
            disabled={processing}
          >
            {processing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CreditCard className="mr-2 h-4 w-4" />
            )}
            {t("confirmPayment")}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
