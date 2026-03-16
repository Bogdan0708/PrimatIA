"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createHclDecision } from "../../_actions/hcl-actions";

export function HclNewForm() {
  const router = useRouter();
  const t = useTranslations("hcl");
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
    const result = await createHclDecision(formData);

    setLoading(false);

    if (!result.success) {
      setError(result.error);
    } else {
      router.push(`${localePrefix}/admin/hcl`);
      router.refresh();
    }
  };

  return (
    <>
      <div className="flex items-center gap-4">
        <Link href={`${localePrefix}/admin/hcl`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t("decisionDetails")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="hclNumber">{t("hclNumber")} *</Label>
                <Input id="hclNumber" name="hclNumber" defaultValue="" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hclDate">{t("hclDate")} *</Label>
                <Input id="hclDate" name="hclDate" type="date" defaultValue="" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fiscalYear">{t("fiscalYear")} *</Label>
                <Input id="fiscalYear" name="fiscalYear" type="number" defaultValue="" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">{t("title")}</Label>
                <Input id="title" name="title" defaultValue="" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inflationIndex">{t("inflationIndex")}</Label>
                <Input id="inflationIndex" name="inflationIndex" type="number" step="0.0001" defaultValue="" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bonificatieProcent">{t("bonificatie")}</Label>
                <Input id="bonificatieProcent" name="bonificatieProcent" type="number" step="0.01" min="0" max="10" defaultValue="10" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="approvedBy">{t("approvedBy")}</Label>
                <Input id="approvedBy" name="approvedBy" defaultValue="" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="validFrom">{t("validFrom")} *</Label>
                <Input id="validFrom" name="validFrom" type="date" defaultValue="" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="validTo">{t("validTo")}</Label>
                <Input id="validTo" name="validTo" type="date" defaultValue="" />
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
