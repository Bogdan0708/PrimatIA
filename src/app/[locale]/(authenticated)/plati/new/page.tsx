"use client";

import { useState, useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";

export default function NewPaymentPage() {
  const t = useTranslations("payment");
  const tc = useTranslations("common");
  const router = useRouter();
  const locale = useLocale();
  const localePrefix = `/${locale}`;

  const [isOnline, setIsOnline] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [queued, setQueued] = useState(false);

  const [formData, setFormData] = useState({
    contribuabilId: "",
    suma: "",
    modalitate: "",
    dataPlata: new Date().toISOString().split("T")[0],
    nrChitanta: "",
    nrDocument: "",
    nota: "",
    targetImpozitIds: "",
  });

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    setIsOnline(navigator.onLine);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setQueued(false);
    setIsSubmitting(true);

    try {
      // Validate required fields
      if (
        !formData.contribuabilId ||
        !formData.suma ||
        !formData.modalitate ||
        !formData.dataPlata
      ) {
        setError(t("requiredFieldsError") || "Please fill in all required fields");
        setIsSubmitting(false);
        return;
      }

      const response = await fetch("/api/plati/record", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contribuabilId: formData.contribuabilId,
          suma: parseFloat(formData.suma),
          modalitate: formData.modalitate,
          dataPlata: formData.dataPlata,
          nrChitanta: formData.nrChitanta || undefined,
          nrDocument: formData.nrDocument || undefined,
          nota: formData.nota || undefined,
          targetImpozitIds: formData.targetImpozitIds
            ? formData.targetImpozitIds.split(",").map((value) => value.trim()).filter(Boolean)
            : undefined,
        }),
      });

      const data = await response.json();

      if (response.status === 202 && data.queued) {
        // Payment was queued for offline sync
        setQueued(true);
        setSuccess(t("queuedForSync") || "Payment queued for sync");
        setTimeout(() => {
          router.push(`${localePrefix}/plati`);
        }, 2000);
      } else if (response.ok && data.success) {
        // Payment was successfully recorded
        setSuccess(t("paymentRecorded") || "Payment recorded successfully");
        setTimeout(() => {
          router.push(`${localePrefix}/plati`);
        }, 1500);
      } else {
        setError(data.error || tc("error"));
      }
    } catch (err) {
      console.error("Error submitting payment:", err);
      setError(tc("error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Link href={`${localePrefix}/plati`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">{t("addNew")}</h1>
      </div>

      {/* Offline indicator */}
      {!isOnline && (
        <Alert className="border-amber-500 bg-amber-50 text-amber-900">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription>
            {t("offlineWarning") || "You are offline. Payment will be synced when reconnected."}
          </AlertDescription>
        </Alert>
      )}

      {/* Success message */}
      {success && (
        <Alert className="border-green-500 bg-green-50 text-green-900">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription>
            {success}
            {queued && (
              <div className="text-xs mt-1 text-green-700">
                {t("syncWhenOnline") || "Will be synced when connection is restored."}
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Error message */}
      {error && (
        <Alert className="border-red-500 bg-red-50 text-red-900">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("addNew")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Contribuabil ID */}
            <div className="space-y-2">
              <Label htmlFor="contribuabilId">
                Contribuabil ID <span className="text-red-500">*</span>
              </Label>
              <Input
                id="contribuabilId"
                value={formData.contribuabilId}
                onChange={(e) =>
                  setFormData({ ...formData, contribuabilId: e.target.value })
                }
                placeholder="UUID al contribuabilului"
                required
              />
              <p className="text-xs text-muted-foreground">
                Enter the taxpayer&apos;s unique ID
              </p>
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <Label htmlFor="suma">
                {t("amount")} (lei) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="suma"
                type="number"
                step="0.01"
                min="0.01"
                value={formData.suma}
                onChange={(e) =>
                  setFormData({ ...formData, suma: e.target.value })
                }
                placeholder="0.00"
                required
              />
            </div>

            {/* Payment Method */}
            <div className="space-y-2">
              <Label htmlFor="modalitate">
                {t("paymentMethod")} <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.modalitate}
                onValueChange={(value) =>
                  setFormData({ ...formData, modalitate: value })
                }
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder={tc("selectOption")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="numerar">{t("cash")}</SelectItem>
                  <SelectItem value="virament">{t("bankTransfer")}</SelectItem>
                  <SelectItem value="mandat_postal">
                    {t("postalOrder")}
                  </SelectItem>
                  <SelectItem value="ghiseul_ro">{t("ghiseulRo")}</SelectItem>
                  <SelectItem value="card">{t("card")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Payment Date */}
            <div className="space-y-2">
              <Label htmlFor="dataPlata">
                {t("paymentDate")} <span className="text-red-500">*</span>
              </Label>
              <Input
                id="dataPlata"
                type="date"
                value={formData.dataPlata}
                onChange={(e) =>
                  setFormData({ ...formData, dataPlata: e.target.value })
                }
                required
              />
            </div>

            {/* Receipt Number (optional) */}
            <div className="space-y-2">
              <Label htmlFor="nrChitanta">{t("receiptNumber")}</Label>
              <Input
                id="nrChitanta"
                value={formData.nrChitanta}
                onChange={(e) =>
                  setFormData({ ...formData, nrChitanta: e.target.value })
                }
                placeholder="Optional"
              />
            </div>

            {/* Document Number (optional) */}
            <div className="space-y-2">
              <Label htmlFor="nrDocument">{t("documentNumber")}</Label>
              <Input
                id="nrDocument"
                value={formData.nrDocument}
                onChange={(e) =>
                  setFormData({ ...formData, nrDocument: e.target.value })
                }
                placeholder="Optional"
              />
            </div>

            {/* Notes (optional) */}
            <div className="space-y-2">
              <Label htmlFor="nota">Notă</Label>
              <Textarea
                id="nota"
                value={formData.nota}
                onChange={(e) =>
                  setFormData({ ...formData, nota: e.target.value })
                }
                placeholder="Optional notes..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="targetImpozitIds">ID-uri impozite țintă</Label>
              <Input
                id="targetImpozitIds"
                value={formData.targetImpozitIds}
                onChange={(e) =>
                  setFormData({ ...formData, targetImpozitIds: e.target.value })
                }
                placeholder="uuid-1, uuid-2"
              />
              <p className="text-xs text-muted-foreground">
                Lasă gol pentru FIFO automat sau trimite ID-urile obligațiilor desemnate de contribuabil.
              </p>
            </div>

            {/* Auto-distribution info */}
            <Alert>
              <AlertDescription className="text-sm">
                {t("distributionInfo")}
              </AlertDescription>
            </Alert>

            {/* Submit Button */}
            <div className="flex gap-3">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {tc("loading")}
                  </>
                ) : (
                  tc("save")
                )}
              </Button>
              <Link href={`${localePrefix}/plati`}>
                <Button type="button" variant="outline">
                  {tc("cancel")}
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
