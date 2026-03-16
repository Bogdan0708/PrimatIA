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
import { Badge } from "@/components/ui/badge";
import { updateHclDecision } from "../../../_actions/hcl-actions";

interface RateTableEntry {
  id: string;
  taxType: string;
  category: string | null;
  zona: string | null;
  rang: number | null;
  rateType: string;
  rateValue: number;
  unit: string | null;
  minRate: number | null;
  maxRate: number | null;
  descriptionRo: string | null;
  legalArticle: string | null;
}

interface HclEditFormProps {
  hcl: {
    id: string;
    hclNumber: string;
    hclDate: string;
    fiscalYear: number;
    title: string | null;
    inflationIndex: number | null;
    bonificatieProcent: number | null;
    validFrom: string;
    validTo: string | null;
    approvedBy: string | null;
    status: string;
    documentUrl: string | null;
  };
  rateTables: RateTableEntry[];
}

export function HclEditForm({ hcl, rateTables }: HclEditFormProps) {
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
    const result = await updateHclDecision(hcl.id, formData);

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
                <Input id="hclNumber" name="hclNumber" defaultValue={hcl.hclNumber} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hclDate">{t("hclDate")} *</Label>
                <Input id="hclDate" name="hclDate" type="date" defaultValue={hcl.hclDate} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fiscalYear">{t("fiscalYear")} *</Label>
                <Input id="fiscalYear" name="fiscalYear" type="number" defaultValue={hcl.fiscalYear} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">{t("title")}</Label>
                <Input id="title" name="title" defaultValue={hcl.title ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inflationIndex">{t("inflationIndex")}</Label>
                <Input id="inflationIndex" name="inflationIndex" type="number" step="0.0001" defaultValue={hcl.inflationIndex ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bonificatieProcent">{t("bonificatie")}</Label>
                <Input id="bonificatieProcent" name="bonificatieProcent" type="number" step="0.01" min="0" max="10" defaultValue={hcl.bonificatieProcent ?? 10} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="approvedBy">{t("approvedBy")}</Label>
                <Input id="approvedBy" name="approvedBy" defaultValue={hcl.approvedBy ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="validFrom">{t("validFrom")} *</Label>
                <Input id="validFrom" name="validFrom" type="date" defaultValue={hcl.validFrom} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="validTo">{t("validTo")}</Label>
                <Input id="validTo" name="validTo" type="date" defaultValue={hcl.validTo ?? ""} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{tc("status")}</Label>
              <Input value={hcl.status} disabled />
              <p className="text-xs text-muted-foreground">{t("statusHint")}</p>
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

      {/* Rate Tables */}
      <Card>
        <CardHeader>
          <CardTitle>
            {t("rateTables")} ({rateTables.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rateTables.length === 0 ? (
            <p className="text-sm text-muted-foreground">{tc("noResults")}</p>
          ) : (
            <RateTablesDisplay rateTables={rateTables} />
          )}
        </CardContent>
      </Card>
    </>
  );
}

function RateTablesDisplay({ rateTables }: { rateTables: RateTableEntry[] }) {
  const t = useTranslations("hcl");

  // Group by taxType
  const grouped = rateTables.reduce<Record<string, RateTableEntry[]>>(
    (acc, rt) => {
      if (!acc[rt.taxType]) acc[rt.taxType] = [];
      acc[rt.taxType].push(rt);
      return acc;
    },
    {}
  );

  const formatRate = (entry: RateTableEntry) => {
    if (entry.rateType === "percent") return `${entry.rateValue}%`;
    if (entry.unit) return `${entry.rateValue} / ${entry.unit}`;
    return `${entry.rateValue}`;
  };

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([taxType, entries]) => (
        <div key={taxType}>
          <h4 className="font-medium mb-2">{taxType}</h4>
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="h-10 px-3 text-left font-medium">{t("rateValue")}</th>
                  <th className="h-10 px-3 text-left font-medium">{t("rateType")}</th>
                  <th className="h-10 px-3 text-left font-medium">Zonă</th>
                  <th className="h-10 px-3 text-left font-medium">Categorie</th>
                  <th className="h-10 px-3 text-left font-medium">{t("minRate")}</th>
                  <th className="h-10 px-3 text-left font-medium">{t("maxRate")}</th>
                  <th className="h-10 px-3 text-left font-medium">{t("legalArticle")}</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="p-3 font-mono font-medium">{formatRate(entry)}</td>
                    <td className="p-3">
                      <Badge variant="outline">
                        {entry.rateType === "percent" ? t("percent") : entry.rateType === "fixed" ? t("fixed") : t("perUnit")}
                      </Badge>
                    </td>
                    <td className="p-3">{entry.zona || "—"}</td>
                    <td className="p-3">{entry.category || "—"}</td>
                    <td className="p-3 font-mono text-xs">{entry.minRate !== null ? entry.minRate : "—"}</td>
                    <td className="p-3 font-mono text-xs">{entry.maxRate !== null ? entry.maxRate : "—"}</td>
                    <td className="p-3 text-xs">{entry.legalArticle || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
