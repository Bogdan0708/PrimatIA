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
import { updateVehicul } from "../../../_actions/vehicul-actions";

interface VehiculEditFormProps {
  vehicul: {
    id: string;
    contribuabilId: string;
    contribuabilNume: string;
    numarInmatriculare: string | null;
    serieSasiu: string | null;
    nrCarteIdentitate: string | null;
    tipVehicul: string;
    marca: string | null;
    model: string | null;
    anFabricatie: number;
    cilindreeCmc: number | null;
    putereKw: number | null;
    masaTotalaKg: number | null;
    nrLocuri: number | null;
    normaPoluare: string | null;
    tipCombustibil: string | null;
    emisiiCo2GKm: number | null;
    dataDobandire: string;
    dataInstrainare: string | null;
    status: string;
  };
}

export function VehiculEditForm({ vehicul }: VehiculEditFormProps) {
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
    const result = await updateVehicul(vehicul.id, formData);

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
              <Label>{t("owner")}</Label>
              <Input value={vehicul.contribuabilNume} disabled />
            </div>

            {/* Identification */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="numarInmatriculare">{t("registrationNumber")}</Label>
                <Input id="numarInmatriculare" name="numarInmatriculare" defaultValue={vehicul.numarInmatriculare ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="serieSasiu">{t("chassisNumber")}</Label>
                <Input id="serieSasiu" name="serieSasiu" defaultValue={vehicul.serieSasiu ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nrCarteIdentitate">{t("vehicleIdCard")}</Label>
                <Input id="nrCarteIdentitate" name="nrCarteIdentitate" defaultValue={vehicul.nrCarteIdentitate ?? ""} />
              </div>
            </div>

            {/* Vehicle characteristics */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="tipVehicul">{t("vehicleType")} *</Label>
                <select
                  id="tipVehicul"
                  name="tipVehicul"
                  defaultValue={vehicul.tipVehicul}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  required
                >
                  <option value="autoturism">{t("car")}</option>
                  <option value="autobuz">{t("bus")}</option>
                  <option value="camion">{t("truck")}</option>
                  <option value="motocicleta">{t("motorcycle")}</option>
                  <option value="tractor">{t("tractor")}</option>
                  <option value="remorca">{t("trailer")}</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="marca">{t("brand")}</Label>
                <Input id="marca" name="marca" defaultValue={vehicul.marca ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="model">{t("model")}</Label>
                <Input id="model" name="model" defaultValue={vehicul.model ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="anFabricatie">{t("manufacturingYear")} *</Label>
                <Input id="anFabricatie" name="anFabricatie" type="number" defaultValue={vehicul.anFabricatie} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cilindreeCmc">{t("engineDisplacement")} (cmc)</Label>
                <Input id="cilindreeCmc" name="cilindreeCmc" type="number" defaultValue={vehicul.cilindreeCmc ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="putereKw">{t("powerKw")} (kW)</Label>
                <Input id="putereKw" name="putereKw" type="number" step="0.01" defaultValue={vehicul.putereKw ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="masaTotalaKg">{t("totalMassKg")} (kg)</Label>
                <Input id="masaTotalaKg" name="masaTotalaKg" type="number" defaultValue={vehicul.masaTotalaKg ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nrLocuri">{t("seats")}</Label>
                <Input id="nrLocuri" name="nrLocuri" type="number" defaultValue={vehicul.nrLocuri ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="normaPoluare">{t("emissionStandard")}</Label>
                <select
                  id="normaPoluare"
                  name="normaPoluare"
                  defaultValue={vehicul.normaPoluare ?? ""}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">-</option>
                  <option value="euro_1">Euro 1</option>
                  <option value="euro_2">Euro 2</option>
                  <option value="euro_3">Euro 3</option>
                  <option value="euro_4">Euro 4</option>
                  <option value="euro_5">Euro 5</option>
                  <option value="euro_6">Euro 6</option>
                  <option value="non_euro">Non-Euro</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tipCombustibil">{t("fuelType")}</Label>
                <select
                  id="tipCombustibil"
                  name="tipCombustibil"
                  defaultValue={vehicul.tipCombustibil ?? ""}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">-</option>
                  <option value="benzina">{t("gasoline")}</option>
                  <option value="motorina">{t("diesel")}</option>
                  <option value="gpl">GPL</option>
                  <option value="electric">{t("electric")}</option>
                  <option value="hybrid">{t("hybrid")}</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="emisiiCo2GKm">CO2 (g/km)</Label>
                <Input id="emisiiCo2GKm" name="emisiiCo2GKm" type="number" min="0" defaultValue={vehicul.emisiiCo2GKm ?? ""} />
              </div>
            </div>

            {/* Dates & Status */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="dataDobandire">{t("acquisitionDate")} *</Label>
                <Input id="dataDobandire" name="dataDobandire" type="date" defaultValue={vehicul.dataDobandire} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dataInstrainare">{t("disposalDate")}</Label>
                <Input id="dataInstrainare" name="dataInstrainare" type="date" defaultValue={vehicul.dataInstrainare ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">{tc("status")}</Label>
                <select
                  id="status"
                  name="status"
                  defaultValue={vehicul.status}
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
