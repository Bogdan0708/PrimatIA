"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { updateScutireRegula } from "../../../_actions/scutire-actions";

interface ScutireEditFormProps {
  regula: {
    id: string;
    nameRo: string;
    nameEn: string | null;
    legalBasis: string;
    taxTypes: string[];
    discountPercent: number;
    conditions: string;
    requiredDocuments: string[];
    autoRenewable: boolean;
    isActive: boolean;
    validFrom: string | null;
    validTo: string | null;
  };
}

export function ScutireEditForm({ regula }: ScutireEditFormProps) {
  const router = useRouter();
  const t = useTranslations("exemption");
  const tc = useTranslations("common");
  const locale = useLocale();
  const localePrefix = `/${locale}`;
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const result = await updateScutireRegula(regula.id, formData);

    setLoading(false);

    if (!result.success) {
      setError(result.error);
    } else {
      router.push(`${localePrefix}/admin/scutiri`);
      router.refresh();
    }
  };

  return (
    <>
      <div className="flex items-center gap-4">
        <Link href={`${localePrefix}/admin/scutiri`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t("ruleDetails")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nameRo">{t("nameRo")} *</Label>
                <Input id="nameRo" name="nameRo" defaultValue={regula.nameRo} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nameEn">{t("nameEn")}</Label>
                <Input id="nameEn" name="nameEn" defaultValue={regula.nameEn ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="legalBasis">{t("legalBasis")} *</Label>
                <Input id="legalBasis" name="legalBasis" defaultValue={regula.legalBasis} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="discountPercent">{t("discountPercent")} (%) *</Label>
                <Input id="discountPercent" name="discountPercent" type="number" step="0.01" min="0" max="100" defaultValue={regula.discountPercent} required />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="taxTypes">{t("taxTypes")}</Label>
              <Input
                id="taxTypes"
                name="taxTypes"
                defaultValue={regula.taxTypes.join(", ")}
                placeholder="impozit_cladiri, impozit_teren, impozit_vehicul"
              />
              <p className="text-xs text-muted-foreground">{t("taxTypesHint")}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="requiredDocuments">{t("requiredDocuments")}</Label>
              <Input
                id="requiredDocuments"
                name="requiredDocuments"
                defaultValue={regula.requiredDocuments.join(", ")}
                placeholder="certificat_handicap, decizie_pensie"
              />
              <p className="text-xs text-muted-foreground">{t("requiredDocumentsHint")}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="conditions">{t("conditions")} (JSON)</Label>
              <Textarea
                id="conditions"
                name="conditions"
                defaultValue={regula.conditions}
                rows={4}
                className="font-mono text-sm"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="validFrom">{t("validFrom")}</Label>
                <Input id="validFrom" name="validFrom" type="date" defaultValue={regula.validFrom ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="validTo">{t("validTo")}</Label>
                <Input id="validTo" name="validTo" type="date" defaultValue={regula.validTo ?? ""} />
              </div>
              <div className="flex items-end gap-4 pb-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="autoRenewable"
                    value="true"
                    defaultChecked={regula.autoRenewable}
                    className="h-4 w-4 rounded border-input"
                  />
                  {t("autoRenewable")}
                </label>
              </div>
            </div>

            {error && <div className="text-sm text-destructive">{error}</div>}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => router.back()}>
                {tc("cancel")}
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? tc("loading") : tc("save")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
