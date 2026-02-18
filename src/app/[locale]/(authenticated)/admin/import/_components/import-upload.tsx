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
import {
  createImportBatch,
  getImportMappingPreset,
  getImportTemplate,
  previewImportBatch,
  saveImportMappingPreset,
} from "../_actions/import-actions";

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
  const [previewLoading, setPreviewLoading] = useState(false);
  const [presetLoading, setPresetLoading] = useState(false);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [entityType, setEntityType] = useState("contribuabil");
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [targetFields, setTargetFields] = useState<string[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [missingRequiredFields, setMissingRequiredFields] = useState<string[]>([]);
  const [validationErrors, setValidationErrors] = useState<
    Array<{ row: number; field: string; value: string; error: string }>
  >([]);
  const [validationErrorCount, setValidationErrorCount] = useState(0);
  const [confirmImport, setConfirmImport] = useState(false);
  const [sampleRows, setSampleRows] = useState<Array<Record<string, string>>>([]);
  const [totalRows, setTotalRows] = useState<number>(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const downloadValidationReport = () => {
    if (validationErrors.length === 0) return;
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const csv = ["row,field,value,error"]
      .concat(
        validationErrors.map((e) =>
          [String(e.row), e.field, e.value || "", e.error].map(escape).join(",")
        )
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `import-validation-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePreview = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast({ title: tc("error"), description: t("selectFile"), variant: "destructive" });
      return;
    }
    setPreviewLoading(true);
    const formData = new FormData();
    formData.set("file", file);
    formData.set("entityType", entityType);
    formData.set("mapping", JSON.stringify(mapping));
    const result = await previewImportBatch(formData);
    setPreviewLoading(false);
    if (!result.success) {
      toast({ title: tc("error"), description: result.error, variant: "destructive" });
      return;
    }
    if (!result.data) {
      toast({ title: tc("error"), description: t("preview"), variant: "destructive" });
      return;
    }
    setHeaders(result.data.headers);
    setTargetFields(result.data.targetFields);
    setMapping(result.data.mapping);
    setMissingRequiredFields(result.data.missingRequiredFields);
    setValidationErrors(result.data.validationErrors);
    setValidationErrorCount(result.data.validationErrorCount);
    setConfirmImport(false);
    setSampleRows(result.data.sampleRows);
    setTotalRows(result.data.totalRows);
  };

  const handleDownloadTemplate = async () => {
    setTemplateLoading(true);
    const result = await getImportTemplate(entityType);
    setTemplateLoading(false);
    if (!result.success || !result.data) {
      toast({
        title: tc("error"),
        description: !result.success ? result.error : t("selectFile"),
        variant: "destructive",
      });
      return;
    }

    const blob = new Blob([result.data.content], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = result.data.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLoadPreset = async () => {
    setPresetLoading(true);
    const result = await getImportMappingPreset(entityType);
    setPresetLoading(false);
    if (!result.success || !result.data) {
      toast({
        title: tc("error"),
        description: !result.success ? result.error : t("requiredFieldMissing"),
        variant: "destructive",
      });
      return;
    }
    const loaded = result.data;

    if (Object.keys(loaded.mapping).length === 0) {
      toast({ title: tc("error"), description: t("noPreset"), variant: "destructive" });
      return;
    }

    const loadedMapping = loaded.mapping;
    setMapping((prev) => ({ ...prev, ...loadedMapping }));
    setConfirmImport(false);
    toast({ title: tc("success"), description: t("presetLoaded") });
  };

  const handleSavePreset = async () => {
    if (Object.keys(mapping).length === 0) {
      toast({ title: tc("error"), description: t("requiredFieldMissing"), variant: "destructive" });
      return;
    }
    setPresetLoading(true);
    const result = await saveImportMappingPreset(entityType, mapping);
    setPresetLoading(false);
    if (!result.success) {
      toast({ title: tc("error"), description: result.error, variant: "destructive" });
      return;
    }
    toast({ title: tc("success"), description: t("presetSaved") });
  };

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
    formData.set("mapping", JSON.stringify(mapping));
    formData.set("confirmImport", String(confirmImport));

    const result = await createImportBatch(formData);
    setLoading(false);

    if (result.success && result.data) {
      toast({
        title: tc("success"),
        description: `${result.data.importedRows} / ${result.data.totalRows} ${t("importedRows").toLowerCase()}`,
      });
      if (fileRef.current) fileRef.current.value = "";
      setHeaders([]);
      setTargetFields([]);
      setMapping({});
      setSampleRows([]);
      setMissingRequiredFields([]);
      setValidationErrors([]);
      setValidationErrorCount(0);
      setConfirmImport(false);
      setTotalRows(0);
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
              onChange={(e) => {
                setEntityType(e.target.value);
                setHeaders([]);
                setTargetFields([]);
                setMapping({});
                setSampleRows([]);
                setMissingRequiredFields([]);
                setValidationErrors([]);
                setValidationErrorCount(0);
                setConfirmImport(false);
                setTotalRows(0);
              }}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {ENTITY_TYPES.map((et) => (
                <option key={et.value} value={et.value}>{et.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>{t("selectFile")}</Label>
            <Input
              type="file"
              accept=".csv,.txt"
              ref={fileRef}
              onChange={() => {
                setHeaders([]);
                setTargetFields([]);
                setMapping({});
                setSampleRows([]);
                setMissingRequiredFields([]);
                setValidationErrors([]);
                setValidationErrorCount(0);
                setConfirmImport(false);
                setTotalRows(0);
              }}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleDownloadTemplate}
              disabled={templateLoading || loading || previewLoading || presetLoading}
            >
              {templateLoading ? tc("loading") : t("downloadTemplate")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleLoadPreset}
              disabled={presetLoading || loading || previewLoading || templateLoading}
            >
              {presetLoading ? tc("loading") : t("loadPreset")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleSavePreset}
              disabled={presetLoading || loading || previewLoading || templateLoading}
            >
              {presetLoading ? tc("loading") : t("savePreset")}
            </Button>
            <Button type="button" variant="outline" onClick={handlePreview} disabled={previewLoading || loading}>
              {previewLoading ? tc("loading") : t("preview")}
            </Button>
            <Button
              type="submit"
              disabled={loading || missingRequiredFields.length > 0 || !confirmImport}
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              {loading ? tc("loading") : t("startImport")}
            </Button>
            {validationErrors.length > 0 ? (
              <Button type="button" variant="outline" onClick={downloadValidationReport}>
                {t("errorReport")}
              </Button>
            ) : null}
          </div>
          {headers.length > 0 ? (
            <div className="space-y-3 rounded-md border p-3">
              <div className="text-sm font-medium">
                {t("totalRows")}: {totalRows}
              </div>
              {missingRequiredFields.length > 0 ? (
                <div className="text-xs text-destructive">
                  {t("requiredFieldMissing")}: {missingRequiredFields.join(", ")}
                </div>
              ) : null}
              {validationErrorCount > 0 ? (
                <div className="text-xs text-amber-700">
                  {validationErrorCount} {t("errorRows").toLowerCase()}
                </div>
              ) : null}
              <div className="grid gap-2 md:grid-cols-2">
                {targetFields.map((field) => (
                  <div key={field} className="space-y-1">
                    <Label className="text-xs">{field}</Label>
                    <select
                      value={mapping[field] || ""}
                      onChange={(e) =>
                        {
                          setMapping((prev) => ({ ...prev, [field]: e.target.value }));
                          setConfirmImport(false);
                        }
                      }
                      className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                    >
                      <option value="">{t("sourceColumn")}</option>
                      {headers.map((header) => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              {sampleRows.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b">
                        {headers.map((header) => (
                          <th key={header} className="px-2 py-1 text-left font-medium">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sampleRows.map((row, idx) => (
                        <tr key={idx} className="border-b">
                          {headers.map((header) => (
                            <td key={`${idx}-${header}`} className="px-2 py-1">
                              {row[header] || ""}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={confirmImport}
                  onChange={(e) => setConfirmImport(e.target.checked)}
                />
                <span>{t("confirmImport")}</span>
              </label>
            </div>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
