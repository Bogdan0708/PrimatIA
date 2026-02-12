"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { CheckCircle, XCircle } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function PaymentConfirmationPage() {
  const searchParams = useSearchParams();
  const t = useTranslations("portal");

  const status = searchParams.get("status");
  const ref = searchParams.get("ref");
  const success = status === "success";

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">
            {success ? (
              <CheckCircle className="h-16 w-16 text-teal-600" />
            ) : (
              <XCircle className="h-16 w-16 text-destructive" />
            )}
          </div>
          <CardTitle>
            {success ? t("paymentSuccessTitle") : t("paymentFailedTitle")}
          </CardTitle>
          <CardDescription>
            {success ? t("paymentSuccessDescription") : t("paymentFailedDescription")}
          </CardDescription>
          {ref && (
            <p className="text-xs text-muted-foreground mt-2">Ref: {ref}</p>
          )}
        </CardHeader>
        <CardFooter className="justify-center gap-2">
          <Button asChild variant="outline">
            <Link href="/portal/plati">{t("viewPayments")}</Link>
          </Button>
          {success && (
            <Button asChild className="bg-teal-600 hover:bg-teal-700">
              <Link href="/portal/dashboard">{t("backToDashboard")}</Link>
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
