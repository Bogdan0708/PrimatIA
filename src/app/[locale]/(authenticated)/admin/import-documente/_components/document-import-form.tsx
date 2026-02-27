"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

interface ExtractedField {
  key: string;
  label: string;
  value: string | null;
  confidence: "high" | "medium" | "low";
}

const DOCUMENT_TYPES = [
  { value: "carte_identitate", labelKey: "typeCI" },
  { value: "certificat_auto", labelKey: "typeAuto" },
  { value: "act_proprietate", labelKey: "typeProperty" },
  { value: "certificat_urbanism", labelKey: "typeUrbanism" },
] as const;

export function DocumentImportForm() {
  const t = useTranslations("documentImport");
  const [documentType, setDocumentType] = useState<string>("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [fields, setFields] = useState<ExtractedField[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [useAi, setUseAi] = useState(false);
  const [aiUsed, setAiUsed] = useState<{ used: boolean; provider: string | null } | null>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) setFile(droppedFile);
  }, []);

  const handleProcess = async () => {
    if (!documentType) return;
    setLoading(true);
    setError(null);
    setAiUsed(null);

    try {
      let response: Response;

      if (file && !text.trim()) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("documentType", documentType);
        formData.append("useAi", String(useAi));
        response = await fetch("/api/documents/process", {
          method: "POST",
          body: formData,
        });
      } else {
        response = await fetch("/api/documents/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: text.trim() || "",
            documentType,
            useAi,
          }),
        });
      }

      const data = await response.json();
      if (!response.ok) {
        if (data.error === "unsupported_file_type") {
          setError(t("unsupportedFileType"));
        } else {
          setError(data.error || "Processing failed");
        }
        return;
      }
      setFields(data.data.fields);
      if (data.usedAi !== undefined) {
        setAiUsed({ used: data.usedAi, provider: data.aiProvider || null });
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const handleFieldEdit = (key: string, newValue: string) => {
    setFields((prev) =>
      prev.map((f) => (f.key === key ? { ...f, value: newValue } : f))
    );
  };

  const confidenceBadge = (level: string) => {
    switch (level) {
      case "high":
        return <Badge variant="default" className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />{t("confidenceHigh")}</Badge>;
      case "medium":
        return <Badge variant="secondary" className="bg-yellow-500 text-white">{t("confidenceMedium")}</Badge>;
      default:
        return <Badge variant="outline"><AlertCircle className="h-3 w-3 mr-1" />{t("confidenceLow")}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Document Type Selector */}
      <div className="space-y-2">
        <Label>{t("documentType")}</Label>
        <Select value={documentType} onValueChange={setDocumentType}>
          <SelectTrigger>
            <SelectValue placeholder={t("selectType")} />
          </SelectTrigger>
          <SelectContent>
            {DOCUMENT_TYPES.map((dt) => (
              <SelectItem key={dt.value} value={dt.value}>
                {t(dt.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Upload Area */}
      <div
        className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => document.getElementById("file-input")?.click()}
      >
        <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {file ? file.name : t("dragDrop")}
        </p>
        <input
          id="file-input"
          type="file"
          className="hidden"
          accept=".txt,text/plain"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
      </div>

      {/* Text Paste Area */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          {t("pasteText")}
        </Label>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("pasteTextPlaceholder")}
          rows={6}
        />
      </div>

      {/* AI Toggle */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="use-ai"
          checked={useAi}
          onChange={(e) => setUseAi(e.target.checked)}
          className="rounded"
        />
        <Label htmlFor="use-ai">{t("useAi")}</Label>
      </div>

      {/* AI Privacy Notice */}
      {useAi && (
        <div className="flex items-start gap-2 bg-warning/10 text-warning-foreground border border-warning/30 p-3 rounded-md text-sm">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{t("aiPrivacyNotice")}</span>
        </div>
      )}

      {/* Process Button */}
      <Button
        onClick={handleProcess}
        disabled={loading || !documentType || (!text.trim() && !file)}
      >
        {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        {t("process")}
      </Button>

      {aiUsed?.used && (
        <div className="flex items-center gap-2 bg-info/10 text-info-foreground border border-info/30 p-3 rounded-md text-sm">
          <CheckCircle className="h-4 w-4 flex-shrink-0" />
          <span>{t("aiUsedNotice")}{aiUsed.provider ? ` (${aiUsed.provider})` : ""}</span>
        </div>
      )}

      {error && (
        <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm">
          {error}
        </div>
      )}

      {/* Extracted Fields */}
      {fields.length > 0 && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <h3 className="font-semibold">{t("extractedFields")}</h3>
            {fields.map((field) => (
              <div key={field.key} className="flex items-center gap-3">
                <Label className="w-40 text-sm font-medium">{field.label}</Label>
                <Input
                  value={field.value || ""}
                  onChange={(e) => handleFieldEdit(field.key, e.target.value)}
                  className="flex-1"
                />
                {confidenceBadge(field.confidence)}
              </div>
            ))}
            <Button className="mt-4">{t("import")}</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
