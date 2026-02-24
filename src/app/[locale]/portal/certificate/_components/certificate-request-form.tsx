"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
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
import { Loader2 } from "lucide-react";

interface Props {
  contribuabili: Array<{ id: string; name: string }>;
}

export function CertificateRequestForm({ contribuabili }: Props) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const t = useTranslations("portal");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);

    try {
      const res = await fetch("/api/portal/certificates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contribuabilId: formData.get("contribuabilId"),
          tipCertificat: formData.get("tipCertificat"),
          scop: formData.get("scop"),
          nrExemplare: Number(formData.get("nrExemplare")) || 1,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || t("requestError"));
      } else {
        setSuccess(true);
        router.refresh();
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch {
      setError(t("requestError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="contribuabilId">{t("selectContribuabil")}</Label>
        <Select name="contribuabilId" required>
          <SelectTrigger>
            <SelectValue placeholder={t("selectContribuabil")} />
          </SelectTrigger>
          <SelectContent>
            {contribuabili.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="tipCertificat">{t("certificateType")}</Label>
        <Select name="tipCertificat" required>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="certificat_atestare">{t("certificatAtestare")}</SelectItem>
            <SelectItem value="adeverinta_fiscala">{t("adeverintaFiscala")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="scop">{t("certificatePurpose")}</Label>
        <Input id="scop" name="scop" placeholder={t("certificatePurposePlaceholder")} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="nrExemplare">{t("numberOfCopies")}</Label>
        <Input id="nrExemplare" name="nrExemplare" type="number" min={1} max={5} defaultValue={1} />
      </div>

      {error && <div className="text-sm text-destructive">{error}</div>}
      {success && <div className="text-sm text-portal-primary">{t("requestSubmitted")}</div>}

      <Button
        type="submit"
        className="w-full bg-portal-primary hover:bg-portal-primary-hover"
        disabled={loading}
      >
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {t("submitRequest")}
      </Button>
    </form>
  );
}
