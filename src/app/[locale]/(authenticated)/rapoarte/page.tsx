"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { FileDown, BarChart3, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  generateReport,
  exportReportCsv,
  type ReportType,
  type ReportActionParams,
} from "./_actions/report-actions";
import type { ReportResult } from "@/lib/reports";

const REPORT_TYPES: { value: ReportType; labelKey: string; icon: string }[] = [
  { value: "venituri_incasate", labelKey: "venituriIncasate", icon: "revenue" },
  { value: "restante", labelKey: "restante", icon: "debts" },
  { value: "registru_rol", labelKey: "registruRol", icon: "register" },
  { value: "borderou_zilnic", labelKey: "borderouZilnic", icon: "daily" },
  { value: "debite_incasari", labelKey: "debiteIncasari", icon: "collection" },
];

export default function RapoartePage() {
  const t = useTranslations("report");
  const tc = useTranslations("common");
  const [isPending, startTransition] = useTransition();
  const [selectedReport, setSelectedReport] = useState<ReportType | null>(null);
  const [report, setReport] = useState<ReportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear().toString());
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const handleGenerate = (reportType: ReportType) => {
    setSelectedReport(reportType);
    setError(null);
    setReport(null);

    const params: ReportActionParams = {
      reportType,
      fiscalYear: fiscalYear ? parseInt(fiscalYear) : undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    };

    startTransition(async () => {
      const result = await generateReport(params);
      if (result.success && result.data) {
        setReport(result.data);
      } else if (!result.success) {
        setError(result.error);
      }
    });
  };

  const handleExportCsv = (reportType: ReportType) => {
    const params: ReportActionParams = {
      reportType,
      fiscalYear: fiscalYear ? parseInt(fiscalYear) : undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    };

    startTransition(async () => {
      const result = await exportReportCsv(params);
      if (result.success && result.data) {
        const blob = new Blob([result.data.csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = result.data.filename;
        a.click();
        URL.revokeObjectURL(url);
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 flex-wrap items-end">
            <div className="space-y-1">
              <Label>{t("fiscalYear")}</Label>
              <Input
                type="number"
                value={fiscalYear}
                onChange={(e) => setFiscalYear(e.target.value)}
                className="w-28"
              />
            </div>
            <div className="space-y-1">
              <Label>{t("dateFrom")}</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="space-y-1">
              <Label>{t("dateTo")}</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-40"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {REPORT_TYPES.map((rt) => (
          <Card key={rt.value} className={selectedReport === rt.value ? "ring-2 ring-primary" : ""}>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">{t(rt.labelKey)}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                {t(`${rt.labelKey}Desc`)}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => handleGenerate(rt.value)}
                  disabled={isPending}
                >
                  {isPending && selectedReport === rt.value ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <BarChart3 className="mr-2 h-4 w-4" />
                  )}
                  {t("generate")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleExportCsv(rt.value)}
                  disabled={isPending}
                >
                  <FileDown className="mr-2 h-4 w-4" />
                  CSV
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Error */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Report Results */}
      {report && (
        <Card>
          <CardHeader>
            <CardTitle>{report.title}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {t("generatedAt")}: {report.generatedAt}
              {Object.entries(report.parameters).map(([k, v]) => (
                <span key={k} className="ml-4">
                  {k}: <strong>{v}</strong>
                </span>
              ))}
            </p>
          </CardHeader>
          <CardContent>
            {report.rows.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center">{tc("noResults")}</p>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      {report.columns.map((col) => (
                        <th
                          key={col.key}
                          className={`h-10 px-4 font-medium ${col.align === "right" ? "text-right" : "text-left"}`}
                        >
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.rows.map((row, i) => (
                      <tr key={i} className="border-b transition-colors hover:bg-muted/50">
                        {report.columns.map((col) => (
                          <td
                            key={col.key}
                            className={`p-4 ${col.align === "right" ? "text-right font-mono" : ""}`}
                          >
                            {row[col.key] ?? "-"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                  {report.totals && (
                    <tfoot>
                      <tr className="bg-muted/50 font-medium">
                        {report.columns.map((col, i) => (
                          <td
                            key={col.key}
                            className={`p-4 ${col.align === "right" ? "text-right font-mono" : ""}`}
                          >
                            {i === 0
                              ? tc("total")
                              : report.totals?.[col.key] ?? ""}
                          </td>
                        ))}
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
