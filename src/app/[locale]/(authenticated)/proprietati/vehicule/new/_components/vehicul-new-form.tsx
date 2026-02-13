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
import { createVehicul } from "../../_actions/vehicul-actions";

interface VehiculNewFormProps {
  contribuabili: { id: string; label: string }[];
}

export function VehiculNewForm({ contribuabili }: VehiculNewFormProps) {
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
    const result = await createVehicul(formData);

    setLoading(false);

    if (!result.success) {
      setError(result.error);
    } else {
      router.push(`${localePrefix}/proprietati/vehicule`);
      router.refresh();
    }
  };

  return (
    <>
      <div className="flex items-center gap-4">
        <Link href={`${localePrefix}/proprietati/vehicule`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t("vehicleDetails")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="contribuabilId">{t("owner")} *</Label>
              <select
                id="contribuabilId"
                name="contribuabilId"
                defaultValue=""
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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

            {/* Identification */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="numarInmatriculare">{t("registrationNumber")}</Label>
                <Input id="numarInmatriculare" name="numarInmatriculare" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="serieSasiu">{t("chassisNumber")}</Label>
                <Input id="serieSasiu" name="serieSasiu" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nrCarteIdentitate">{t("vehicleIdCard")}</Label>
                <Input id="nrCarteIdentitate" name="nrCarteIdentitate" />
              </div>
            </div>

            {/* Vehicle characteristics */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="tipVehicul">{t("vehicleType")} *</Label>
                <select
                  id="tipVehicul"
                  name="tipVehicul"
                  defaultValue=""
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  required
                >
                  <option value="" disabled>-</option>
                  <option value="autoturism">{t("car")}</option>
                  <option value="autobuz">{t("bus")}</option>
                  <option value="autocamion">{t("truck")}</option>
                  <option value="motocicleta">{t("motorcycle")}</option>
                  <option value="tractor">{t("tractor")}</option>
                  <option value="remorca">{t("trailer")}</option>
                  <option value="autoutilitara">{t("van")}</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="marca">{t("brand")}</Label>
                <Input id="marca" name="marca" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="model">{t("model")}</Label>
                <Input id="model" name="model" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="anFabricatie">{t("manufacturingYear")} *</Label>
                <Input id="anFabricatie" name="anFabricatie" type="number" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cilindreeCmc">{t("engineDisplacement")} (cmc)</Label>
                <Input id="cilindreeCmc" name="cilindreeCmc" type="number" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="putereKw">{t("powerKw")} (kW)</Label>
                <Input id="putereKw" name="putereKw" type="number" step="0.01" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="masaTotalaKg">{t("totalMassKg")} (kg)</Label>
                <Input id="masaTotalaKg" name="masaTotalaKg" type="number" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nrLocuri">{t("seats")}</Label>
                <Input id="nrLocuri" name="nrLocuri" type="number" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="normaPoluare">{t("emissionStandard")}</Label>
                <select
                  id="normaPoluare"
                  name="normaPoluare"
                  defaultValue=""
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">-</option>
                  <option value="euro1">Euro 1</option>
                  <option value="euro2">Euro 2</option>
                  <option value="euro3">Euro 3</option>
                  <option value="euro4">Euro 4</option>
                  <option value="euro5">Euro 5</option>
                  <option value="euro6">Euro 6</option>
                  <option value="non_euro">Non-Euro</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tipCombustibil">{t("fuelType")}</Label>
                <select
                  id="tipCombustibil"
                  name="tipCombustibil"
                  defaultValue=""
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">-</option>
                  <option value="benzina">{t("gasoline")}</option>
                  <option value="motorina">{t("diesel")}</option>
                  <option value="gpl">GPL</option>
                  <option value="electric">{t("electric")}</option>
                  <option value="hibrid">{t("hybrid")}</option>
                </select>
              </div>
            </div>

            {/* Dates & Status */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="dataDobandire">{t("acquisitionDate")} *</Label>
                <Input id="dataDobandire" name="dataDobandire" type="date" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dataInstrainare">{t("disposalDate")}</Label>
                <Input id="dataInstrainare" name="dataInstrainare" type="date" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">{tc("status")}</Label>
                <select
                  id="status"
                  name="status"
                  defaultValue="activ"
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
              <Link href={`${localePrefix}/proprietati/vehicule`}>
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
