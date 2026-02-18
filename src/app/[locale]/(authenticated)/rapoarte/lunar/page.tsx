"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Minus,
  DollarSign,
  AlertTriangle,
  Users,
  FileText,
  Download,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

// ============================================================================
// Types (matches MonthlyReportResult from the API)
// ============================================================================

interface TaxCategoryBreakdown {
  code: string;
  name: string;
  collected: number;
  outstanding: number;
  overdue: number;
}

interface OverdueTaxpayer {
  id: string;
  nume: string;
  prenume: string | null;
  tip: string;
  totalOverdue: number;
  oldestDueDate: string;
}

interface MonthlyReport {
  period: { year: number; month: number; label: string };
  totalCollected: number;
  totalOutstanding: number;
  totalOverdue: number;
  collectionRate: number;
  prevMonth: {
    totalCollected: number;
    totalOutstanding: number;
    collectionRate: number;
  };
  changes: {
    collectedPct: number;
    outstandingPct: number;
    collectionRateDelta: number;
  };
  byCategory: TaxCategoryBreakdown[];
  topOverdue: OverdueTaxpayer[];
  totalTaxpayers: number;
  activeTaxpayers: number;
  totalPaymentsCount: number;
  generatedAt: string;
}

// ============================================================================
// Helpers
// ============================================================================

function formatLei(n: number): string {
  return n.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " lei";
}

function TrendBadge({ value, suffix = "%" }: { value: number; suffix?: string }) {
  if (value === 0)
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" /> 0{suffix}
      </span>
    );
  if (value > 0)
    return (
      <span className="inline-flex items-center gap-1 text-xs text-green-600">
        <TrendingUp className="h-3 w-3" /> +{value}{suffix}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-xs text-red-600">
      <TrendingDown className="h-3 w-3" /> {value}{suffix}
    </span>
  );
}

function BarChart<T extends object>({
  data,
  labelKey,
  valueKey,
}: {
  data: ReadonlyArray<T>;
  labelKey: keyof T;
  valueKey: keyof T;
}) {
  if (data.length === 0) return null;
  const max = Math.max(...data.map((d) => Number(d[valueKey]) || 0), 1);
  const barWidth = Math.max(30, Math.floor(400 / data.length) - 8);

  const colors = [
    "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
    "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#6366f1",
  ];

  return (
    <div className="w-full overflow-x-auto">
      <svg
        width={Math.max(data.length * (barWidth + 8), 300)}
        height={200}
        className="mx-auto"
      >
        {data.map((d, i) => {
          const val = Number(d[valueKey]) || 0;
          const h = (val / max) * 140;
          const x = i * (barWidth + 8) + 8;
          const fill = colors[i % colors.length];
          return (
            <g key={i}>
              <rect
                x={x}
                y={160 - h}
                width={barWidth}
                height={h}
                fill={fill}
                rx={3}
              />
              <text
                x={x + barWidth / 2}
                y={175}
                textAnchor="middle"
                className="fill-muted-foreground"
                fontSize={9}
              >
                {String(d[labelKey]).slice(0, 8)}
              </text>
              <text
                x={x + barWidth / 2}
                y={155 - h}
                textAnchor="middle"
                className="fill-foreground"
                fontSize={9}
                fontWeight={600}
              >
                {val > 0 ? formatLei(val).replace(" lei", "") : ""}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ============================================================================
// Main page
// ============================================================================

export default function MonthlyReportPage() {
  const t = useTranslations("monthlyReport");
  const tc = useTranslations("common");
  const locale = useLocale();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/reports/monthly?year=${year}&month=${month}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          setReport(json.data);
        } else {
          setError(json.error ?? "Unknown error");
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [year, month]);

  const goToPrevMonth = () => {
    if (month === 1) {
      setYear(year - 1);
      setMonth(12);
    } else {
      setMonth(month - 1);
    }
  };

  const goToNextMonth = () => {
    if (month === 12) {
      setYear(year + 1);
      setMonth(1);
    } else {
      setMonth(month + 1);
    }
  };

  const isCurrentMonth =
    year === now.getFullYear() && month === now.getMonth() + 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/${locale}/rapoarte`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground text-sm">{t("description")}</p>
        </div>
        <Button variant="outline" disabled>
          <Download className="mr-2 h-4 w-4" />
          {tc("export")}
        </Button>
      </div>

      {/* Month selector */}
      <div className="flex items-center justify-center gap-4">
        <Button variant="outline" size="icon" onClick={goToPrevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-lg font-semibold min-w-[200px] text-center">
          {report?.period.label ?? `${month}/${year}`}
        </span>
        <Button
          variant="outline"
          size="icon"
          onClick={goToNextMonth}
          disabled={isCurrentMonth}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <p className="text-muted-foreground animate-pulse">{tc("loading")}</p>
        </div>
      )}

      {error && (
        <Card>
          <CardContent className="py-8 text-center text-red-600">
            {error}
          </CardContent>
        </Card>
      )}

      {report && !loading && (
        <>
          {/* Metric cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t("totalCollected")}
                </CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatLei(report.totalCollected)}
                </div>
                <TrendBadge value={report.changes.collectedPct} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t("totalOutstanding")}
                </CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {formatLei(report.totalOutstanding)}
                </div>
                <TrendBadge value={report.changes.outstandingPct} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t("collectionRate")}
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {report.collectionRate}%
                </div>
                <TrendBadge value={report.changes.collectionRateDelta} suffix=" pp" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t("paymentsCount")}
                </CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {report.totalPaymentsCount}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("activeTaxpayers")}: {report.activeTaxpayers}/{report.totalTaxpayers}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Category breakdown + chart */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t("byCategory")}</CardTitle>
                <CardDescription>{t("byCategoryDesc")}</CardDescription>
              </CardHeader>
              <CardContent>
                {report.byCategory.length === 0 ? (
                  <p className="text-muted-foreground text-sm py-4 text-center">
                    {tc("noResults")}
                  </p>
                ) : (
                  <div className="rounded-md border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="h-10 px-3 text-left font-medium">
                            {t("taxCategory")}
                          </th>
                          <th className="h-10 px-3 text-right font-medium">
                            {t("collected")}
                          </th>
                          <th className="h-10 px-3 text-right font-medium">
                            {t("outstanding")}
                          </th>
                          <th className="h-10 px-3 text-right font-medium">
                            {t("overdue")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.byCategory.map((cat) => (
                          <tr
                            key={cat.code}
                            className="border-b transition-colors hover:bg-muted/50"
                          >
                            <td className="p-3 font-medium">{cat.name}</td>
                            <td className="p-3 text-right text-green-600">
                              {formatLei(cat.collected)}
                            </td>
                            <td className="p-3 text-right text-orange-600">
                              {formatLei(cat.outstanding)}
                            </td>
                            <td className="p-3 text-right text-red-600">
                              {formatLei(cat.overdue)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t("collectedChart")}</CardTitle>
              </CardHeader>
              <CardContent>
                {report.byCategory.length === 0 ? (
                  <p className="text-muted-foreground text-sm py-4 text-center">
                    {tc("noResults")}
                  </p>
                ) : (
                  <BarChart
                    data={report.byCategory}
                    labelKey="name"
                    valueKey="collected"
                  />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Top overdue taxpayers */}
          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <Users className="h-5 w-5" />
              <div>
                <CardTitle className="text-lg">{t("topOverdue")}</CardTitle>
                <CardDescription>{t("topOverdueDesc")}</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {report.topOverdue.length === 0 ? (
                <p className="text-muted-foreground text-sm py-4 text-center">
                  {t("noOverdue")}
                </p>
              ) : (
                <div className="rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="h-10 px-3 text-left font-medium">Nr.</th>
                        <th className="h-10 px-3 text-left font-medium">
                          {t("taxpayer")}
                        </th>
                        <th className="h-10 px-3 text-left font-medium">
                          {t("type")}
                        </th>
                        <th className="h-10 px-3 text-right font-medium">
                          {t("overdueAmount")}
                        </th>
                        <th className="h-10 px-3 text-left font-medium">
                          {t("oldestDue")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.topOverdue.map((tp, i) => (
                        <tr
                          key={tp.id}
                          className="border-b transition-colors hover:bg-muted/50"
                        >
                          <td className="p-3 text-muted-foreground">{i + 1}</td>
                          <td className="p-3 font-medium">
                            <Link
                              href={`/${locale}/contribuabili/${tp.id}`}
                              className="hover:underline text-primary"
                            >
                              {tp.nume} {tp.prenume ?? ""}
                            </Link>
                          </td>
                          <td className="p-3">
                            <Badge
                              variant={tp.tip === "PF" ? "secondary" : "outline"}
                            >
                              {tp.tip}
                            </Badge>
                          </td>
                          <td className="p-3 text-right font-mono text-red-600 font-medium">
                            {formatLei(tp.totalOverdue)}
                          </td>
                          <td className="p-3 text-sm">
                            {new Date(tp.oldestDueDate).toLocaleDateString("ro-RO")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Generated at */}
          <p className="text-xs text-muted-foreground text-right">
            {t("generatedAt")}: {new Date(report.generatedAt).toLocaleString("ro-RO")}
          </p>
        </>
      )}
    </div>
  );
}
