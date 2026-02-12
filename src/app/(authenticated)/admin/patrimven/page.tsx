"use client";

import { useState, useTransition, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  FileDown,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Database,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  triggerPatrimvenExport,
  getExportJobs,
  seedCodeMappings,
  getCodeMappings,
  type PatrimVenFormType,
  type ExportJobListResult,
} from "./_actions/patrimven-actions";

const FORM_TYPES: { value: PatrimVenFormType; label: string; description: string }[] = [
  { value: "F3001", label: "F3001", description: "Declarații proprietăți (clădiri + terenuri)" },
  { value: "F3002", label: "F3002", description: "Declarații vehicule" },
  { value: "F3003", label: "F3003", description: "Alte taxe locale" },
  { value: "F3101", label: "F3101", description: "Certificate de atestare fiscală" },
];

export default function PatrimvenPage() {
  const t = useTranslations("patrimven");
  const tc = useTranslations("common");
  const [isPending, startTransition] = useTransition();
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear().toString());
  const [exportJobs, setExportJobs] = useState<ExportJobListResult | null>(null);
  const [codeMappings, setCodeMappings] = useState<
    Array<{ id: string; entityType: string; internalCode: string; patrimvenCode: string; descriptionRo: string | null }>
  >([]);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    startTransition(async () => {
      const [jobs, mappings] = await Promise.all([
        getExportJobs(),
        getCodeMappings(),
      ]);
      setExportJobs(jobs);
      setCodeMappings(mappings);
    });
  };

  const handleExport = (formType: PatrimVenFormType) => {
    setMessage(null);
    startTransition(async () => {
      const result = await triggerPatrimvenExport(formType, parseInt(fiscalYear));
      if (result.success) {
        setMessage({ type: "success", text: t("exportSuccess") });
        loadData();
      } else {
        setMessage({ type: "error", text: result.error });
      }
    });
  };

  const handleSeedMappings = () => {
    startTransition(async () => {
      const result = await seedCodeMappings();
      if (result.success) {
        setMessage({ type: "success", text: `${t("mappingsSeeded")} (${result.data?.count})` });
        loadData();
      } else {
        setMessage({ type: "error", text: result.error });
      }
    });
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="default">{t("statusCompleted")}</Badge>;
      case "completed_with_warnings":
        return <Badge variant="secondary">{t("statusWarnings")}</Badge>;
      case "processing":
        return <Badge variant="outline">{t("statusProcessing")}</Badge>;
      case "failed":
        return <Badge variant="destructive">{t("statusFailed")}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
      </div>

      {/* Message */}
      {message && (
        <Card className={message.type === "error" ? "border-destructive" : "border-green-500"}>
          <CardContent className="flex items-center gap-2 pt-6">
            {message.type === "success" ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : (
              <AlertCircle className="h-5 w-5 text-destructive" />
            )}
            <p className={message.type === "error" ? "text-destructive" : "text-green-700"}>
              {message.text}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Export Controls */}
      <Card>
        <CardHeader>
          <CardTitle>{t("generateExport")}</CardTitle>
          <CardDescription>{t("generateExportDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 items-end">
            <div className="space-y-1">
              <Label>{t("fiscalYear")}</Label>
              <Input
                type="number"
                value={fiscalYear}
                onChange={(e) => setFiscalYear(e.target.value)}
                className="w-28"
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {FORM_TYPES.map((ft) => (
              <Card key={ft.value}>
                <CardContent className="pt-4 pb-4">
                  <div className="font-semibold text-lg mb-1">{ft.label}</div>
                  <p className="text-xs text-muted-foreground mb-3">{ft.description}</p>
                  <Button
                    size="sm"
                    onClick={() => handleExport(ft.value)}
                    disabled={isPending}
                    className="w-full"
                  >
                    {isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <FileDown className="mr-2 h-4 w-4" />
                    )}
                    {t("exportXml")}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Export History */}
      <Card>
        <CardHeader>
          <CardTitle>{t("exportHistory")}</CardTitle>
        </CardHeader>
        <CardContent>
          {!exportJobs || exportJobs.items.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">{tc("noResults")}</p>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="h-10 px-4 text-left font-medium">{t("formType")}</th>
                    <th className="h-10 px-4 text-left font-medium">{tc("status")}</th>
                    <th className="h-10 px-4 text-left font-medium">{t("requestedBy")}</th>
                    <th className="h-10 px-4 text-left font-medium">{tc("date")}</th>
                    <th className="h-10 px-4 text-right font-medium">{t("fileSize")}</th>
                    <th className="h-10 px-4 text-left font-medium">{tc("actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {exportJobs.items.map((job) => (
                    <tr key={job.id} className="border-b transition-colors hover:bg-muted/50">
                      <td className="p-4 font-mono">{job.tip.replace("patrimven_", "").toUpperCase()}</td>
                      <td className="p-4">{statusBadge(job.status)}</td>
                      <td className="p-4">{job.requestedBy ?? "-"}</td>
                      <td className="p-4">{new Date(job.createdAt).toLocaleDateString("ro-RO")}</td>
                      <td className="p-4 text-right font-mono">
                        {job.fileSizeBytes ? `${(job.fileSizeBytes / 1024).toFixed(1)} KB` : "-"}
                      </td>
                      <td className="p-4">
                        {job.fileUrl && (
                          <Button variant="ghost" size="sm" asChild>
                            <a href={job.fileUrl} download>
                              <FileDown className="mr-2 h-4 w-4" />
                              XML
                            </a>
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Code Mappings */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t("codeMappings")}</CardTitle>
              <CardDescription>{t("codeMappingsDesc")}</CardDescription>
            </div>
            <Button variant="outline" onClick={handleSeedMappings} disabled={isPending}>
              <Database className="mr-2 h-4 w-4" />
              {t("seedDefaults")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {codeMappings.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              {t("noMappings")}
            </p>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="h-10 px-4 text-left font-medium">{t("entityType")}</th>
                    <th className="h-10 px-4 text-left font-medium">{t("internalCode")}</th>
                    <th className="h-10 px-4 text-left font-medium">{t("patrimvenCode")}</th>
                    <th className="h-10 px-4 text-left font-medium">{t("descriptionCol")}</th>
                  </tr>
                </thead>
                <tbody>
                  {codeMappings.map((m) => (
                    <tr key={m.id} className="border-b transition-colors hover:bg-muted/50">
                      <td className="p-4 font-mono text-xs">{m.entityType}</td>
                      <td className="p-4 font-mono text-xs">{m.internalCode}</td>
                      <td className="p-4 font-mono text-xs font-medium">{m.patrimvenCode}</td>
                      <td className="p-4 text-xs">{m.descriptionRo ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
