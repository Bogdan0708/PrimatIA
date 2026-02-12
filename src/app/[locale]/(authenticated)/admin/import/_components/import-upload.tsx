"use client";

import { useTranslations } from "next-intl";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileSpreadsheet } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { createImportBatch } from "../_actions/import-actions";

const ENTITY_TYPES = [
  { value: "contribuabil", label: "Contribuabili" },
  { value: "proprietate_cladire", label: "Cl\u0103diri" },
  { value: "proprietate_teren", label: "Terenuri" },
  { value: "proprietate_vehicul", label: "Vehicule" },
];

export function ImportUpload() {
  const t = useTranslations("import");
  const tc = useTranslations("common");
  const { toast } = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [entityType, setEntityType] = useState("contribuabil");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast({ title: "Eroare", description: t("selectFile"), variant: "destructive" });
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.set("file", file);
    formData.set("entityType", entityType);

    const result = await createImportBatch(formData);
    setLoading(false);

    if (result.success && result.data) {
      toast({
        title: tc("success"),
        description: `${result.data.importedRows} / ${result.data.totalRows} ${t("importedRows").toLowerCase()}`,
      });
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } else if (!result.success) {
      toast({ title: tc("error"), description: result.error, variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Upload className="h-5 w-5" />
          {t("uploadFile")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>{t("entityType")}</Label>
            <select
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {ENTITY_TYPES.map((et) => (
                <option key={et.value} value={et.value}>{et.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>{t("selectFile")}</Label>
            <Input type="file" accept=".csv,.txt" ref={fileRef} />
          </div>
          <Button type="submit" disabled={loading}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            {loading ? tc("loading") : t("startImport")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
