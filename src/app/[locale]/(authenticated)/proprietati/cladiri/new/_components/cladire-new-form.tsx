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
import { createCladire } from "../../_actions/cladire-actions";

interface CladireNewFormProps {
  contribuabili: { id: string; label: string }[];
}

export function CladireNewForm({ contribuabili }: CladireNewFormProps) {
  const router = useRouter();
  const t = useTranslations("property");
  const te = useTranslations("exemption");
  const tc = useTranslations("common");
  const locale = useLocale();
  const localePrefix = `/${locale}`;
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const selectClassName =
    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const result = await createCladire(formData);

    setLoading(false);

    if (!result.success) {
      setError(result.error);
    } else {
      router.push(`${localePrefix}/proprietati/cladiri`);
      router.refresh();
    }
  };

  return (
    <>
      <div className="flex items-center gap-4">
        <Link href={`${localePrefix}/proprietati/cladiri`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t("buildingDetails")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Owner selector */}
            <div className="space-y-2">
              <Label htmlFor="contribuabilId">{t("owner")} *</Label>
              <select
                id="contribuabilId"
                name="contribuabilId"
                defaultValue=""
                className={selectClassName}
                required
              >
                <option value="" disabled>
                  {t("selectOwner")}
                </option>
                {contribuabili.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Location */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="zona">{t("zone")} *</Label>
                <select
                  id="zona"
                  name="zona"
                  defaultValue="A"
                  className={selectClassName}
                >
                  {["A", "B", "C", "D"].map((z) => (
                    <option key={z} value={z}>{z}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="numarCadastral">{t("cadastralNumber")}</Label>
                <Input id="numarCadastral" name="numarCadastral" defaultValue="" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="numarCarteFunciara">{t("landBookNumber")}</Label>
                <Input id="numarCarteFunciara" name="numarCarteFunciara" defaultValue="" />
              </div>
            </div>

            {/* Address */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="strada">{t("street")}</Label>
                <Input id="strada" name="strada" defaultValue="" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="numar_adresa">{t("number")}</Label>
                <Input id="numar_adresa" name="numar_adresa" defaultValue="" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bloc">{t("block")}</Label>
                <Input id="bloc" name="bloc" defaultValue="" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="localitate">{t("locality")} *</Label>
                <Input id="localitate" name="localitate" defaultValue="" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="judet">{t("county")} *</Label>
                <Input id="judet" name="judet" defaultValue="" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="codPostal">{t("postalCode")}</Label>
                <Input id="codPostal" name="codPostal" defaultValue="" />
              </div>
            </div>

            {/* Building characteristics */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="destinatie">{t("destination")} *</Label>
                <select
                  id="destinatie"
                  name="destinatie"
                  defaultValue="rezidential"
                  className={selectClassName}
                  required
                >
                  <option value="rezidential">{t("residential")}</option>
                  <option value="nerezidential">{t("nonResidential")}</option>
                  <option value="mixt">{t("mixed")}</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tipConstructie">{t("constructionType")} *</Label>
                <Input id="tipConstructie" name="tipConstructie" defaultValue="" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="anConstructie">{t("constructionYear")} *</Label>
                <Input id="anConstructie" name="anConstructie" type="number" defaultValue="" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="suprafataConstruita">{t("builtArea")} (mp) *</Label>
                <Input id="suprafataConstruita" name="suprafataConstruita" type="number" step="0.01" defaultValue="" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="suprafataUtila">{t("usableArea")} (mp)</Label>
                <Input id="suprafataUtila" name="suprafataUtila" type="number" step="0.01" defaultValue="" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="suprafataDesfasurata">{t("totalArea")} (mp)</Label>
                <Input id="suprafataDesfasurata" name="suprafataDesfasurata" type="number" step="0.01" defaultValue="" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nrEtaje">{t("floors")}</Label>
                <Input id="nrEtaje" name="nrEtaje" type="number" defaultValue="" />
              </div>
            </div>

            {/* Valuation */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="valoareImpozabila">{t("taxableValue")} (lei)</Label>
                <Input id="valoareImpozabila" name="valoareImpozabila" type="number" step="0.01" defaultValue="" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="valoareInventar">{t("inventoryValue")} (lei)</Label>
                <Input id="valoareInventar" name="valoareInventar" type="number" step="0.01" defaultValue="" />
              </div>
            </div>

            {/* Ownership */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="cotaParte">{t("ownershipShare")} (%)</Label>
                <Input id="cotaParte" name="cotaParte" type="number" step="0.01" defaultValue={100} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nrProprietari">{t("numberOfOwners")}</Label>
                <Input id="nrProprietari" name="nrProprietari" type="number" defaultValue={1} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tipActProprietate">{t("ownershipDocType")}</Label>
                <Input id="tipActProprietate" name="tipActProprietate" defaultValue="" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nrActProprietate">{t("ownershipDocNumber")}</Label>
                <Input id="nrActProprietate" name="nrActProprietate" defaultValue="" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dataActProprietate">{t("ownershipDocDate")}</Label>
                <Input id="dataActProprietate" name="dataActProprietate" type="date" defaultValue="" />
              </div>
            </div>

            {/* Art. 456 Property Flags */}
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex items-center gap-2">
                <input type="checkbox" name="isCultReligios" className="rounded border-input" />
                {te("isCultReligios")}
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="isMonumentIstoric" className="rounded border-input" />
                {te("isMonumentIstoric")}
              </label>
            </div>

            {/* Dates & Status */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="dataDobandire">{t("acquisitionDate")} *</Label>
                <Input id="dataDobandire" name="dataDobandire" type="date" defaultValue="" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dataInstrainare">{t("disposalDate")}</Label>
                <Input id="dataInstrainare" name="dataInstrainare" type="date" defaultValue="" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">{tc("status")}</Label>
                <select
                  id="status"
                  name="status"
                  defaultValue="activ"
                  className={selectClassName}
                >
                  <option value="activ">{tc("active")}</option>
                  <option value="inactiv">{tc("inactive")}</option>
                  <option value="instrainat">{t("disposed")}</option>
                </select>
              </div>
            </div>

            {error && <div className="text-sm text-destructive">{error}</div>}

            <div className="flex justify-end gap-2">
              <Link href={`${localePrefix}/proprietati/cladiri`}>
                <Button type="button" variant="outline">
                  {tc("cancel")}
                </Button>
              </Link>
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
