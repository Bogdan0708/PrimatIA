"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createTenant } from "../_actions/tenant-actions";
import { COMMUNE_TYPES, COMMUNE_RANKS } from "@/lib/constants";

interface TenantFormProps {
  initialData?: {
    id: string;
    name: string;
    slug: string;
    cui: string;
    siruta_code: string;
    county: string;
    commune_type: string;
    commune_rank: number;
    population: number | null;
    email: string;
    phone: string;
    tier: string;
  };
}

export function TenantForm({ initialData }: TenantFormProps) {
  const router = useRouter();
  const t = useTranslations("tenant");
  const tCommon = useTranslations("common");
  const tForm = useTranslations("form");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const result = await createTenant(formData);

    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      router.push("/admin/tenants");
      router.refresh();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">{t("name")} *</Label>
              <Input
                id="name"
                name="name"
                defaultValue={initialData?.name}
                required
                placeholder="Primăria Comunei..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">{t("slug")} *</Label>
              <Input
                id="slug"
                name="slug"
                defaultValue={initialData?.slug}
                required
                placeholder="bogdan-voda"
                pattern="[a-z0-9-]+"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cui">CUI</Label>
              <Input
                id="cui"
                name="cui"
                defaultValue={initialData?.cui}
                placeholder="12345678"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="siruta_code">SIRUTA</Label>
              <Input
                id="siruta_code"
                name="siruta_code"
                defaultValue={initialData?.siruta_code}
                placeholder="123456"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="county">{t("county")} *</Label>
              <Input
                id="county"
                name="county"
                defaultValue={initialData?.county}
                required
                placeholder="Maramureș"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="commune_type">{t("communeType")} *</Label>
              <select
                id="commune_type"
                name="commune_type"
                defaultValue={initialData?.commune_type || "comuna"}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                required
              >
                {COMMUNE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(type === "comuna" ? "commune" : type === "oras" ? "city" : "municipality")}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="commune_rank">{t("rank")} *</Label>
              <select
                id="commune_rank"
                name="commune_rank"
                defaultValue={initialData?.commune_rank ?? 5}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                required
              >
                {COMMUNE_RANKS.map((rank) => (
                  <option key={rank} value={rank}>
                    {rank === 0 ? "Rang 0 (București)" : `Rang ${rank}`}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="population">{t("population")}</Label>
              <Input
                id="population"
                name="population"
                type="number"
                defaultValue={initialData?.population ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={initialData?.email}
                placeholder="secretariat@primaria.ro"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">{tForm("number")}</Label>
              <Input
                id="phone"
                name="phone"
                defaultValue={initialData?.phone}
                placeholder="+40..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tier">{t("tier")}</Label>
              <select
                id="tier"
                name="tier"
                defaultValue={initialData?.tier || "comuna"}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {COMMUNE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(type === "comuna" ? "commune" : type === "oras" ? "city" : "municipality")}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <div className="text-sm text-destructive">{error}</div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
            >
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? tCommon("loading") : tCommon("save")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
