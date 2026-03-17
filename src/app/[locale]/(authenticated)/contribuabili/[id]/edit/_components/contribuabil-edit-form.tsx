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
import { updateContribuabil } from "../../../_actions/contribuabil-actions";

interface ContribuabilEditFormProps {
  contribuabil: {
    id: string;
    tip: string;
    nume: string;
    prenume: string | null;
    cui: string | null;
    telefon: string | null;
    email: string | null;
    codRol: string | null;
    nrDosarFiscal: string | null;
    reprezentantLegal: string | null;
    nrRegistruComert: string | null;
    limbaPreferata: string | null;
    status: string;
    note: string | null;
    handicapGrav: boolean;
    handicapCertNr: string | null;
    handicapCertExp: string | null;
    veteranRazboi: boolean;
    vaduvaVeteran: boolean;
    erouRevolutie: boolean;
    organizatieNonpro: boolean;
    pensionar: boolean;
    adresaDomiciliu: {
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

export function ContribuabilEditForm({ contribuabil }: ContribuabilEditFormProps) {
  const router = useRouter();
  const t = useTranslations("taxpayer");
  const te = useTranslations("exemption");
  const tc = useTranslations("common");
  const locale = useLocale();
  const localePrefix = `/${locale}`;
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [tip, setTip] = useState(contribuabil.tip);
  const [handicapGrav, setHandicapGrav] = useState(contribuabil.handicapGrav);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const result = await updateContribuabil(contribuabil.id, formData);

    setLoading(false);

    if (!result.success) {
      setError(result.error);
    } else {
      router.push(`${localePrefix}/contribuabili/${contribuabil.id}`);
      router.refresh();
    }
  };

  return (
    <>
      <div className="flex items-center gap-4">
        <Link href={`${localePrefix}/contribuabili/${contribuabil.id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t("edit")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Type & Identity */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="tip">{t("type")} *</Label>
                <select
                  id="tip"
                  name="tip"
                  value={tip}
                  onChange={(e) => setTip(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  required
                >
                  <option value="PF">{t("individual")}</option>
                  <option value="PJ">{t("company")}</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">{tc("status")} *</Label>
                <select
                  id="status"
                  name="status"
                  defaultValue={contribuabil.status}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  required
                >
                  <option value="activ">{t("statusActive")}</option>
                  <option value="inactiv">{t("statusInactive")}</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="nume">{t("name")} *</Label>
                <Input id="nume" name="nume" defaultValue={contribuabil.nume} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prenume">{t("firstName")}</Label>
                <Input id="prenume" name="prenume" defaultValue={contribuabil.prenume ?? ""} />
              </div>
              {tip === "PF" && (
                <div className="space-y-2">
                  <Label htmlFor="cnp">CNP</Label>
                  <Input id="cnp" name="cnp" placeholder={t("cnpPlaceholder")} />
                  <p className="text-xs text-muted-foreground">{t("cnpEncrypted")}</p>
                </div>
              )}
              {tip === "PJ" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="cui">{t("cui")}</Label>
                    <Input id="cui" name="cui" defaultValue={contribuabil.cui ?? ""} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reprezentantLegal">{t("legalRepresentative")}</Label>
                    <Input id="reprezentantLegal" name="reprezentantLegal" defaultValue={contribuabil.reprezentantLegal ?? ""} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nrRegistruComert">{t("tradeRegister")}</Label>
                    <Input id="nrRegistruComert" name="nrRegistruComert" defaultValue={contribuabil.nrRegistruComert ?? ""} />
                  </div>
                </>
              )}
            </div>

            {/* Contact */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="telefon">{t("phone")}</Label>
                <Input id="telefon" name="telefon" defaultValue={contribuabil.telefon ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">{t("email")}</Label>
                <Input id="email" name="email" type="email" defaultValue={contribuabil.email ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="limbaPreferata">{t("preferredLanguage")}</Label>
                <select
                  id="limbaPreferata"
                  name="limbaPreferata"
                  defaultValue={contribuabil.limbaPreferata ?? "ro"}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="ro">Română</option>
                  <option value="en">English</option>
                  <option value="hu">Magyar</option>
                </select>
              </div>
            </div>

            {/* Fiscal */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="codRol">{t("rolNumber")}</Label>
                <Input id="codRol" name="codRol" defaultValue={contribuabil.codRol ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nrDosarFiscal">{t("fiscalRecord")}</Label>
                <Input id="nrDosarFiscal" name="nrDosarFiscal" defaultValue={contribuabil.nrDosarFiscal ?? ""} />
              </div>
            </div>

            {/* Art. 456 Eligibility Flags */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{te("eligibilitySection")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="handicapGrav"
                      checked={handicapGrav}
                      onChange={(e) => setHandicapGrav(e.target.checked)}
                      className="rounded border-input"
                    />
                    {te("handicapGrav")}
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" name="veteranRazboi" defaultChecked={contribuabil.veteranRazboi} className="rounded border-input" />
                    {te("veteranRazboi")}
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" name="vaduvaVeteran" defaultChecked={contribuabil.vaduvaVeteran} className="rounded border-input" />
                    {te("vaduvaVeteran")}
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" name="erouRevolutie" defaultChecked={contribuabil.erouRevolutie} className="rounded border-input" />
                    {te("erouRevolutie")}
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" name="pensionar" defaultChecked={contribuabil.pensionar} className="rounded border-input" />
                    {te("pensionar")}
                  </label>
                  {tip === "PJ" && (
                    <label className="flex items-center gap-2">
                      <input type="checkbox" name="organizatieNonpro" defaultChecked={contribuabil.organizatieNonpro} className="rounded border-input" />
                      {te("organizatieNonpro")}
                    </label>
                  )}
                </div>
                {handicapGrav && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="handicapCertNr">{te("handicapCertNr")}</Label>
                      <Input id="handicapCertNr" name="handicapCertNr" defaultValue={contribuabil.handicapCertNr ?? ""} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="handicapCertExp">{te("handicapCertExp")}</Label>
                      <Input id="handicapCertExp" name="handicapCertExp" type="date" defaultValue={contribuabil.handicapCertExp ?? ""} />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="note">{tc("notes")}</Label>
              <Textarea id="note" name="note" defaultValue={contribuabil.note ?? ""} rows={3} />
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
