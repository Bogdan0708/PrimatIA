"use client";

import { useTranslations } from "next-intl";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface DashboardChartsProps {
  revenueByMonth: { month: string; total: number }[];
  taxBreakdown: { category: string; total: number }[];
  collectionRateTrend: { month: string; rate: number }[];
  overdueAging: { bucket: string; total: number }[];
}

const PIE_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

const AGING_COLORS: Record<string, string> = {
  "0-30": "hsl(var(--chart-1))",
  "31-90": "hsl(var(--chart-3))",
  "91-180": "hsl(var(--warning))",
  "180+": "hsl(var(--destructive))",
};

function formatCurrency(n: number) {
  return n.toLocaleString("ro-RO", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " lei";
}

export function DashboardCharts({
  revenueByMonth,
  taxBreakdown,
  collectionRateTrend,
  overdueAging,
}: DashboardChartsProps) {
  const t = useTranslations("dashboard");

  const categoryLabels: Record<string, string> = {
    cladiri: t("buildings"),
    teren: t("landPlots"),
    vehicule: t("vehiclesCount"),
  };

  const pieData = taxBreakdown.map((item, index) => ({
    name: categoryLabels[item.category] ?? item.category,
    value: Number(item.total),
    fill: PIE_COLORS[index % PIE_COLORS.length],
  }));

  const agingData = overdueAging.map((item) => ({
    bucket: item.bucket + " " + t("days"),
    total: Number(item.total),
    fill: AGING_COLORS[item.bucket] ?? "#6b7280",
  }));

  const revenueData = revenueByMonth.map((item) => ({
    month: item.month,
    total: Number(item.total),
  }));

  const trendData = collectionRateTrend.map((item) => ({
    month: item.month,
    rate: Number(item.rate),
  }));

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Revenue by Month - BarChart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("revenueByMonth")}</CardTitle>
          <CardDescription>{t("last12Months")}</CardDescription>
        </CardHeader>
        <CardContent>
          {revenueData.length === 0 ? (
            <div className="flex h-[300px] flex-col justify-end gap-2 px-4">
              <Skeleton className="h-24 w-full rounded-sm" />
              <Skeleton className="h-16 w-full rounded-sm" />
              <Skeleton className="h-32 w-full rounded-sm" />
            </div>
          ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12 }}
                interval={0}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                tickFormatter={(v: number) => (v / 1000).toFixed(0) + "k"}
              />
              <Tooltip
                formatter={(value: number | undefined) =>
                  value != null ? [formatCurrency(value), t("totalRevenue")] : ["-", t("totalRevenue")]
                }
              />
              <Bar dataKey="total" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Tax Type Breakdown - PieChart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("taxTypeBreakdown")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={true}
                label={({ name, percent }: { name?: string; percent?: number }) =>
                  `${name ?? ""} (${((percent ?? 0) * 100).toFixed(0)}%)`
                }
                outerRadius={100}
                dataKey="value"
              />
              <Tooltip
                formatter={(value: number | undefined) =>
                  value != null ? formatCurrency(value) : "-"
                }
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Collection Rate Trend - LineChart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("collectionRateTrend")}</CardTitle>
          <CardDescription>{t("last12Months")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12 }}
                interval={0}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                domain={[0, 100]}
                tickFormatter={(v: number) => `${v}%`}
              />
              <Tooltip
                formatter={(value: number | undefined) =>
                  value != null ? [`${value.toFixed(1)}%`, t("collectionRate")] : ["-", t("collectionRate")]
                }
              />
              <Line
                type="monotone"
                dataKey="rate"
                stroke="hsl(var(--chart-2))"
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Overdue Aging - BarChart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("overdueAging")}</CardTitle>
        </CardHeader>
        <CardContent>
          {agingData.length === 0 ? (
            <div className="flex h-[300px] flex-col justify-end gap-2 px-4">
              <Skeleton className="h-32 w-full rounded-sm" />
              <Skeleton className="h-20 w-full rounded-sm" />
              <Skeleton className="h-48 w-full rounded-sm" />
            </div>
          ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={agingData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="bucket"
                tick={{ fontSize: 12 }}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                tickFormatter={(v: number) => (v / 1000).toFixed(0) + "k"}
              />
              <Tooltip
                formatter={(value: number | undefined) =>
                  value != null ? [formatCurrency(value), t("overdueAging")] : ["-", t("overdueAging")]
                }
              />
              <Bar dataKey="total" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
