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
import { updateCladire } from "../../../_actions/cladire-actions";

interface CladireEditFormProps {
  cladire: {
    id: string;
    contribuabilId: string;
    contribuabilNume: string;
    zona: string;
    numarCadastral: string | null;
    numarCarteFunciara: string | null;
    destinatie: string;
    tipConstructie: string;
    anConstructie: number;
    suprafataConstruita: number;
    suprafataUtila: number | null;
    suprafataDesfasurata: number | null;
    nrEtaje: number;
    valoareImpozabila: number | null;
    valoareInventar: number | null;
    suprafataRezidentiala: number | null;
    suprafataNerezidentiala: number | null;
    cotaParte: number;
    nrProprietari: number;
    tipActProprietate: string | null;
    nrActProprietate: string | null;
    dataActProprietate: string | null;
    dataDobandire: string;
    dataInstrainare: string | null;
    isCultReligios: boolean;
    isMonumentIstoric: boolean;
    ocupareNerezidentiala: string | null;
    chiriasNume: string | null;
    chiriasCui: string | null;
    contractNr: string | null;
    contractData: string | null;
    contractExpirare: string | null;
    status: string;
    adresa: {
      strada: string | null;
      numar: string | null;
      bloc: string | null;
      scara: string | null;
      etaj: string | null;
      apartament: string | null;
      localitate: string;
      judet: string;
      codPostal: string | null;
    } | null;
  };
}

export function CladireEditForm({ cladire }: CladireEditFormProps) {
  const router = useRouter();
  const t = useTranslations("property");
  const te = useTranslations("exemption");
  const tc = useTranslations("common");
  const locale = useLocale();
  const localePrefix = `/${locale}`;
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [destinatie, setDestinatie] = useState(cladire.destinatie);
  const [ocupare, setOcupare] = useState(cladire.ocupareNerezidentiala ?? "");
  const showNonResFields = destinatie === "mixta" || destinatie === "mixt" || destinatie === "nerezidentiala" || destinatie === "nerezidential";
  const showTenantFields = showNonResFields && (ocupare === "inchiriat" || ocupare === "comodat");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const result = await updateCladire(cladire.id, formData);

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
            {/* Owner info (read-only) */}
            <div className="space-y-2">
              <Label>{t("owner")}</Label>
              <Input value={cladire.contribuabilNume} disabled />
            </div>

            {/* Location */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="zona">{t("zone")} *</Label>
                <select
                  id="zona"
                  name="zona"
                  defaultValue={cladire.zona}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {["A", "B", "C", "D"].map((z) => (
                    <option key={z} value={z}>{z}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="numarCadastral">{t("cadastralNumber")}</Label>
                <Input id="numarCadastral" name="numarCadastral" defaultValue={cladire.numarCadastral ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="numarCarteFunciara">{t("landBookNumber")}</Label>
                <Input id="numarCarteFunciara" name="numarCarteFunciara" defaultValue={cladire.numarCarteFunciara ?? ""} />
              </div>
            </div>

            {/* Address */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="strada">{t("street")}</Label>
                <Input id="strada" name="strada" defaultValue={cladire.adresa?.strada ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="numar_adresa">{t("number")}</Label>
                <Input id="numar_adresa" name="numar_adresa" defaultValue={cladire.adresa?.numar ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bloc">{t("block")}</Label>
                <Input id="bloc" name="bloc" defaultValue={cladire.adresa?.bloc ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="localitate">{t("locality")} *</Label>
                <Input id="localitate" name="localitate" defaultValue={cladire.adresa?.localitate ?? ""} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="judet">{t("county")} *</Label>
                <Input id="judet" name="judet" defaultValue={cladire.adresa?.judet ?? ""} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="codPostal">{t("postalCode")}</Label>
                <Input id="codPostal" name="codPostal" defaultValue={cladire.adresa?.codPostal ?? ""} />
              </div>
            </div>

            {/* Building characteristics */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="destinatie">{t("destination")} *</Label>
                <select
                  id="destinatie"
                  name="destinatie"
                  value={destinatie}
                  onChange={(e) => setDestinatie(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  required
                >
                  <option value="rezidential">{t("residential")}</option>
                  <option value="nerezidential">{t("nonResidential")}</option>
                  <option value="mixt">{t("mixed")}</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tipConstructie">{t("constructionType")} *</Label>
                <Input id="tipConstructie" name="tipConstructie" defaultValue={cladire.tipConstructie} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="anConstructie">{t("constructionYear")} *</Label>
                <Input id="anConstructie" name="anConstructie" type="number" defaultValue={cladire.anConstructie} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="suprafataConstruita">{t("builtArea")} (mp) *</Label>
                <Input id="suprafataConstruita" name="suprafataConstruita" type="number" step="0.01" defaultValue={cladire.suprafataConstruita} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="suprafataUtila">{t("usableArea")} (mp)</Label>
                <Input id="suprafataUtila" name="suprafataUtila" type="number" step="0.01" defaultValue={cladire.suprafataUtila ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="suprafataDesfasurata">{t("totalArea")} (mp)</Label>
                <Input id="suprafataDesfasurata" name="suprafataDesfasurata" type="number" step="0.01" defaultValue={cladire.suprafataDesfasurata ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nrEtaje">{t("floors")}</Label>
                <Input id="nrEtaje" name="nrEtaje" type="number" defaultValue={cladire.nrEtaje} />
              </div>
            </div>

            {/* Valuation */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="valoareImpozabila">{t("taxableValue")} (lei)</Label>
                <Input id="valoareImpozabila" name="valoareImpozabila" type="number" step="0.01" defaultValue={cladire.valoareImpozabila ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="valoareInventar">{t("inventoryValue")} (lei)</Label>
                <Input id="valoareInventar" name="valoareInventar" type="number" step="0.01" defaultValue={cladire.valoareInventar ?? ""} />
              </div>
            </div>

            {/* Ownership */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="cotaParte">{t("ownershipShare")} (%)</Label>
                <Input id="cotaParte" name="cotaParte" type="number" step="0.01" defaultValue={cladire.cotaParte} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nrProprietari">{t("numberOfOwners")}</Label>
                <Input id="nrProprietari" name="nrProprietari" type="number" defaultValue={cladire.nrProprietari} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tipActProprietate">{t("ownershipDocType")}</Label>
                <Input id="tipActProprietate" name="tipActProprietate" defaultValue={cladire.tipActProprietate ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nrActProprietate">{t("ownershipDocNumber")}</Label>
                <Input id="nrActProprietate" name="nrActProprietate" defaultValue={cladire.nrActProprietate ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dataActProprietate">{t("ownershipDocDate")}</Label>
                <Input id="dataActProprietate" name="dataActProprietate" type="date" defaultValue={cladire.dataActProprietate ?? ""} />
              </div>
            </div>

            {/* Art. 456 Property Flags */}
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex items-center gap-2">
                <input type="checkbox" name="isCultReligios" defaultChecked={cladire.isCultReligios} className="rounded border-input" />
                {te("isCultReligios")}
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="isMonumentIstoric" defaultChecked={cladire.isMonumentIstoric} className="rounded border-input" />
                {te("isMonumentIstoric")}
              </label>
            </div>

            {/* Non-residential occupancy (Art. 459) */}
            {showNonResFields && (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="ocupareNerezidentiala">{t("nonResOccupancy")}</Label>
                    <select
                      id="ocupareNerezidentiala"
                      name="ocupareNerezidentiala"
                      value={ocupare}
                      onChange={(e) => setOcupare(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <option value="">&mdash;</option>
                      <option value="proprietar">{t("occupancyOwner")}</option>
                      <option value="inchiriat">{t("occupancyRented")}</option>
                      <option value="comodat">{t("occupancyFreeUse")}</option>
                    </select>
                  </div>
                </div>
                {showTenantFields && (
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="chiriasNume">{t("tenantName")}</Label>
                      <Input id="chiriasNume" name="chiriasNume" defaultValue={cladire.chiriasNume ?? ""} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="chiriasCui">{t("tenantCui")}</Label>
                      <Input id="chiriasCui" name="chiriasCui" defaultValue={cladire.chiriasCui ?? ""} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contractNr">{t("contractNumber")}</Label>
                      <Input id="contractNr" name="contractNr" defaultValue={cladire.contractNr ?? ""} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contractData">{t("contractDate")}</Label>
                      <Input id="contractData" name="contractData" type="date" defaultValue={cladire.contractData ?? ""} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contractExpirare">{t("contractExpiry")}</Label>
                      <Input id="contractExpirare" name="contractExpirare" type="date" defaultValue={cladire.contractExpirare ?? ""} />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Dates & Status */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="dataDobandire">{t("acquisitionDate")} *</Label>
                <Input id="dataDobandire" name="dataDobandire" type="date" defaultValue={cladire.dataDobandire} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dataInstrainare">{t("disposalDate")}</Label>
                <Input id="dataInstrainare" name="dataInstrainare" type="date" defaultValue={cladire.dataInstrainare ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">{tc("status")}</Label>
                <select
                  id="status"
                  name="status"
                  defaultValue={cladire.status}
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
