"use client";

import { type RevenueForecast } from "@/lib/ai/revenue-forecast";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import { useTranslations } from "next-intl";

const MONTH_NAMES = [
  "Ian", "Feb", "Mar", "Apr", "Mai", "Iun",
  "Iul", "Aug", "Sep", "Oct", "Noi", "Dec",
];

interface Props {
  forecast: RevenueForecast;
}

export function ForecastCharts({ forecast }: Props) {
  const t = useTranslations("forecast");

  const monthlyData = forecast.byMonth.map((m) => ({
    name: MONTH_NAMES[m.month - 1],
    proiectat: m.projected,
    încasat: m.collected,
  }));

  const taxTypeData = forecast.byTaxType.map((tt) => ({
    name: tt.taxType,
    proiectat: tt.projected,
    încasat: tt.collected,
  }));

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* By Tax Type - Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle>{t("byTaxType")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={taxTypeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Legend />
              <Bar dataKey="proiectat" fill="#94a3b8" name={t("projected")} />
              <Bar dataKey="încasat" fill="#3b82f6" name={t("collected")} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Monthly Trend - Area Chart */}
      <Card>
        <CardHeader>
          <CardTitle>{t("monthlyTrend")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Legend />
              <Area
                type="monotone"
                dataKey="proiectat"
                stroke="#94a3b8"
                fill="#94a3b8"
                fillOpacity={0.3}
                name={t("projected")}
              />
              <Area
                type="monotone"
                dataKey="încasat"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.3}
                name={t("collected")}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
