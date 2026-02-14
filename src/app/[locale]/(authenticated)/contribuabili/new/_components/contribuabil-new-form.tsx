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
import { createContribuabil } from "../../_actions/contribuabil-actions";

export function ContribuabilNewForm() {
  const router = useRouter();
  const t = useTranslations("taxpayer");
  const tc = useTranslations("common");
  const tf = useTranslations("form");
  const locale = useLocale();
  const localePrefix = `/${locale}`;
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [tip, setTip] = useState("PF");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const result = await createContribuabil(formData);

    setLoading(false);

    if (!result.success) {
      setError(result.error);
    } else {
      router.push(`${localePrefix}/contribuabili`);
      router.refresh();
    }
  };

  return (
    <>
      <div className="flex items-center gap-4">
        <Link href={`${localePrefix}/contribuabili`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t("addNew")}</CardTitle>
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
                  defaultValue="activ"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  required
                >
                  <option value="activ">{t("statusActive")}</option>
                  <option value="inactiv">{t("statusInactive")}</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="nume">{t("name")} *</Label>
                <Input id="nume" name="nume" required />
              </div>
              {tip === "PF" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="prenume">{t("firstName")}</Label>
                    <Input id="prenume" name="prenume" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cnp">CNP</Label>
                    <Input id="cnp" name="cnp" placeholder={t("cnpPlaceholder")} />
                    <p className="text-xs text-muted-foreground">{t("cnpEncrypted")}</p>
                  </div>
                </>
              )}
              {tip === "PJ" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="cui">{t("cui")}</Label>
                    <Input id="cui" name="cui" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reprezentantLegal">{t("legalRepresentative")}</Label>
                    <Input id="reprezentantLegal" name="reprezentantLegal" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nrRegistruComert">{t("tradeRegister")}</Label>
                    <Input id="nrRegistruComert" name="nrRegistruComert" />
                  </div>
                </>
              )}
            </div>

            {/* Contact */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="telefon">{t("phone")}</Label>
                <Input id="telefon" name="telefon" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">{t("email")}</Label>
                <Input id="email" name="email" type="email" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="limbaPreferata">{t("preferredLanguage")}</Label>
                <select
                  id="limbaPreferata"
                  name="limbaPreferata"
                  defaultValue="ro"
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
                <Input id="codRol" name="codRol" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nrDosarFiscal">{t("fiscalRecord")}</Label>
                <Input id="nrDosarFiscal" name="nrDosarFiscal" />
              </div>
            </div>

            {/* Address */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">{t("address")}</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="strada">{tf("streetName")}</Label>
                  <Input id="strada" name="strada" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="numar">{tf("number")}</Label>
                  <Input id="numar" name="numar" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bloc">{tf("block")}</Label>
                  <Input id="bloc" name="bloc" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="scara">{tf("staircase")}</Label>
                  <Input id="scara" name="scara" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="etaj">{tf("floor")}</Label>
                  <Input id="etaj" name="etaj" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="apartament">{tf("apartment")}</Label>
                  <Input id="apartament" name="apartament" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sat">{tf("village")}</Label>
                  <Input id="sat" name="sat" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="localitate">{tf("locality")}</Label>
                  <Input id="localitate" name="localitate" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="judet">{tf("county")}</Label>
                  <Input id="judet" name="judet" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="codPostal">{tf("postalCode")}</Label>
                  <Input id="codPostal" name="codPostal" />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="note">{tc("notes")}</Label>
              <Textarea id="note" name="note" rows={3} />
            </div>

            {error && <div className="text-sm text-destructive">{error}</div>}

            <div className="flex justify-end gap-2">
              <Link href={`${localePrefix}/contribuabili`}>
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
