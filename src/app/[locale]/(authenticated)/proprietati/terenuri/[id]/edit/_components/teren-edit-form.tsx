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
import { updateTeren } from "../../../_actions/teren-actions";

interface TerenEditFormProps {
  teren: {
    id: string;
    contribuabilId: string;
    contribuabilNume: string;
    zona: string;
    numarCadastral: string | null;
    numarCarteFunciara: string | null;
    categorie: string;
    suprafataMp: number;
    suprafataHa: number | null;
    cotaParte: number;
    tipActProprietate: string | null;
    nrActProprietate: string | null;
    dataActProprietate: string | null;
    dataDobandire: string;
    dataInstrainare: string | null;
    status: string;
    adresa: {
      strada: string | null;
      numar: string | null;
      localitate: string;
      judet: string;
      codPostal: string | null;
    } | null;
  };
}

export function TerenEditForm({ teren }: TerenEditFormProps) {
  const router = useRouter();
  const t = useTranslations("property");
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
    const result = await updateTeren(teren.id, formData);

    setLoading(false);

    if (!result.success) {
      setError(result.error);
    } else {
      router.push(`${localePrefix}/proprietati/terenuri`);
      router.refresh();
    }
  };

  return (
    <>
      <div className="flex items-center gap-4">
        <Link href={`${localePrefix}/proprietati/terenuri`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t("landDetails")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label>{t("owner")}</Label>
              <Input value={teren.contribuabilNume} disabled />
            </div>

            {/* Location */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="zona">{t("zone")} *</Label>
                <select
                  id="zona"
                  name="zona"
                  defaultValue={teren.zona}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {["A", "B", "C", "D"].map((z) => (
                    <option key={z} value={z}>{z}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="numarCadastral">{t("cadastralNumber")}</Label>
                <Input id="numarCadastral" name="numarCadastral" defaultValue={teren.numarCadastral ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="numarCarteFunciara">{t("landBookNumber")}</Label>
                <Input id="numarCarteFunciara" name="numarCarteFunciara" defaultValue={teren.numarCarteFunciara ?? ""} />
              </div>
            </div>

            {/* Address */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="strada">{t("street")}</Label>
                <Input id="strada" name="strada" defaultValue={teren.adresa?.strada ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="numar_adresa">{t("number")}</Label>
                <Input id="numar_adresa" name="numar_adresa" defaultValue={teren.adresa?.numar ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="localitate">{t("locality")}</Label>
                <Input id="localitate" name="localitate" defaultValue={teren.adresa?.localitate ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="judet">{t("county")}</Label>
                <Input id="judet" name="judet" defaultValue={teren.adresa?.judet ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="codPostal">{t("postalCode")}</Label>
                <Input id="codPostal" name="codPostal" defaultValue={teren.adresa?.codPostal ?? ""} />
              </div>
            </div>

            {/* Land characteristics */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="categorie">{t("category")} *</Label>
                <select
                  id="categorie"
                  name="categorie"
                  defaultValue={teren.categorie}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  required
                >
                  <option value="intravilan">{t("urban")}</option>
                  <option value="extravilan">{t("rural")}</option>
                  <option value="arabil">{t("arable")}</option>
                  <option value="pasune">{t("pasture")}</option>
                  <option value="faneata">{t("meadow")}</option>
                  <option value="vie">{t("vineyard")}</option>
                  <option value="livada">{t("orchard")}</option>
                  <option value="padure">{t("forest")}</option>
                  <option value="ape">{t("water")}</option>
                  <option value="drumuri">{t("roads")}</option>
                  <option value="neproductiv">{t("unproductive")}</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="suprafataMp">{t("areaSqm")} *</Label>
                <Input id="suprafataMp" name="suprafataMp" type="number" step="0.01" defaultValue={teren.suprafataMp} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="suprafataHa">{t("areaHa")}</Label>
                <Input id="suprafataHa" name="suprafataHa" type="number" step="0.0001" defaultValue={teren.suprafataHa ?? ""} />
              </div>
            </div>

            {/* Ownership */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="cotaParte">{t("ownershipShare")} (%)</Label>
                <Input id="cotaParte" name="cotaParte" type="number" step="0.01" defaultValue={teren.cotaParte} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tipActProprietate">{t("ownershipDocType")}</Label>
                <Input id="tipActProprietate" name="tipActProprietate" defaultValue={teren.tipActProprietate ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nrActProprietate">{t("ownershipDocNumber")}</Label>
                <Input id="nrActProprietate" name="nrActProprietate" defaultValue={teren.nrActProprietate ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dataActProprietate">{t("ownershipDocDate")}</Label>
                <Input id="dataActProprietate" name="dataActProprietate" type="date" defaultValue={teren.dataActProprietate ?? ""} />
              </div>
            </div>

            {/* Dates & Status */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="dataDobandire">{t("acquisitionDate")} *</Label>
                <Input id="dataDobandire" name="dataDobandire" type="date" defaultValue={teren.dataDobandire} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dataInstrainare">{t("disposalDate")}</Label>
                <Input id="dataInstrainare" name="dataInstrainare" type="date" defaultValue={teren.dataInstrainare ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">{tc("status")}</Label>
                <select
                  id="status"
                  name="status"
                  defaultValue={teren.status}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="activ">{tc("active")}</option>
                  <option value="inactiv">{tc("inactive")}</option>
                  <option value="instrainat">{t("disposed")}</option>
                </select>
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
