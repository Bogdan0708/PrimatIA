"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, FileText, Download, CheckCircle, XCircle } from "lucide-react";

const SINGLE_DOC_TYPES = [
  { value: "decizie", labelKey: "typeDecizie" },
  { value: "chitanta", labelKey: "typeChitanta" },
  { value: "certificat", labelKey: "typeCertificat" },
  { value: "somatie", labelKey: "typeSomatie" },
  { value: "titlu_executoriu", labelKey: "typeTitlu" },
] as const;

const BATCH_DOC_TYPES = [
  { value: "decizie", labelKey: "typeDecizie" },
  { value: "somatie", labelKey: "typeSomatie" },
] as const;

interface BatchResult {
  total: number;
  success: number;
  failed: number;
}

export function DocumentGeneratorDashboard() {
  const t = useTranslations("documentGenerate");

  // Single generation state
  const [singleType, setSingleType] = useState("");
  const [entityId, setEntityId] = useState("");
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear().toString());
  const [singleLoading, setSingleLoading] = useState(false);
  const [singleResult, setSingleResult] = useState<string | null>(null);
  const [singleError, setSingleError] = useState<string | null>(null);

  // Batch generation state
  const [batchType, setBatchType] = useState("");
  const [batchYear, setBatchYear] = useState(new Date().getFullYear().toString());
  const [overdueDays, setOverdueDays] = useState("30");
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchResult, setBatchResult] = useState<BatchResult | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);

  const handleSingleGenerate = async () => {
    if (!singleType || !entityId) return;
    setSingleLoading(true);
    setSingleError(null);
    setSingleResult(null);

    try {
      const response = await fetch("/api/documents/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: singleType,
          entityId,
          options: { fiscalYear: parseInt(fiscalYear) },
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setSingleError(data.error);
      } else {
        setSingleResult(data.documentId);
      }
    } catch {
      setSingleError("Network error");
    } finally {
      setSingleLoading(false);
    }
  };

  const handleBatchGenerate = async () => {
    if (!batchType) return;
    setBatchLoading(true);
    setBatchError(null);
    setBatchResult(null);

    try {
      const response = await fetch("/api/documents/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: batchType,
          filters: {
            year: parseInt(batchYear),
            overdueDays: parseInt(overdueDays),
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setBatchError(data.error);
      } else {
        setBatchResult({ total: data.total, success: data.success, failed: data.failed });
      }
    } catch {
      setBatchError("Network error");
    } finally {
      setBatchLoading(false);
    }
  };

  return (
    <Tabs defaultValue="single" className="space-y-4">
      <TabsList>
        <TabsTrigger value="single">{t("singleGeneration")}</TabsTrigger>
        <TabsTrigger value="batch">{t("batchGeneration")}</TabsTrigger>
      </TabsList>

      {/* Single Generation */}
      <TabsContent value="single" className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t("documentType")}</Label>
            <Select value={singleType} onValueChange={setSingleType}>
              <SelectTrigger>
                <SelectValue placeholder={t("selectType")} />
              </SelectTrigger>
              <SelectContent>
                {SINGLE_DOC_TYPES.map((dt) => (
                  <SelectItem key={dt.value} value={dt.value}>
                    {t(dt.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t("entityId")}</Label>
            <Input
              value={entityId}
              onChange={(e) => setEntityId(e.target.value)}
              placeholder={t("entityIdPlaceholder")}
            />
          </div>

          {(singleType === "decizie") && (
            <div className="space-y-2">
              <Label>{t("fiscalYear")}</Label>
              <Input
                type="number"
                value={fiscalYear}
                onChange={(e) => setFiscalYear(e.target.value)}
              />
            </div>
          )}
        </div>

        <Button
          onClick={handleSingleGenerate}
          disabled={singleLoading || !singleType || !entityId}
        >
          {singleLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          <FileText className="h-4 w-4 mr-2" />
          {t("generate")}
        </Button>

        {singleError && (
          <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm flex items-center gap-2">
            <XCircle className="h-4 w-4" /> {singleError}
          </div>
        )}

        {singleResult && (
          <div className="bg-green-50 text-green-700 p-3 rounded-md text-sm flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            {t("generatedSuccess")} — ID: {singleResult}
            <Button size="sm" variant="outline" className="ml-auto">
              <Download className="h-4 w-4 mr-1" /> {t("download")}
            </Button>
          </div>
        )}
      </TabsContent>

      {/* Batch Generation */}
      <TabsContent value="batch" className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>{t("documentType")}</Label>
            <Select value={batchType} onValueChange={setBatchType}>
              <SelectTrigger>
                <SelectValue placeholder={t("selectType")} />
              </SelectTrigger>
              <SelectContent>
                {BATCH_DOC_TYPES.map((dt) => (
                  <SelectItem key={dt.value} value={dt.value}>
                    {t(dt.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t("fiscalYear")}</Label>
            <Input
              type="number"
              value={batchYear}
              onChange={(e) => setBatchYear(e.target.value)}
            />
          </div>

          {batchType === "somatie" && (
            <div className="space-y-2">
              <Label>{t("overdueDays")}</Label>
              <Input
                type="number"
                value={overdueDays}
                onChange={(e) => setOverdueDays(e.target.value)}
              />
            </div>
          )}
        </div>

        <Button
          onClick={handleBatchGenerate}
          disabled={batchLoading || !batchType}
        >
          {batchLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {t("generateBatch")}
        </Button>

        {batchError && (
          <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm flex items-center gap-2">
            <XCircle className="h-4 w-4" /> {batchError}
          </div>
        )}

        {batchResult && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("batchResults")}</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-4">
              <Badge variant="outline">{t("total")}: {batchResult.total}</Badge>
              <Badge className="bg-green-600">{t("success")}: {batchResult.success}</Badge>
              {batchResult.failed > 0 && (
                <Badge variant="destructive">{t("failed")}: {batchResult.failed}</Badge>
              )}
            </CardContent>
          </Card>
        )}
      </TabsContent>
    </Tabs>
  );
}
