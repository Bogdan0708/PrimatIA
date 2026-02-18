"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface TrendPoint {
  day: string;
  mrr: number;
  failedInvoices: number;
}

interface TenantBillingTrendsProps {
  data: TrendPoint[];
}

export function TenantBillingTrends({ data }: TenantBillingTrendsProps) {
  const t = useTranslations("tenant");
  const locale = useLocale();
  const [range, setRange] = useState<7 | 30 | 90>(30);
  const filtered = useMemo(() => data.slice(-range), [data, range]);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {[7, 30, 90].map((r) => (
          <button
            key={r}
            type="button"
            className={`rounded border px-2 py-1 text-xs ${range === r ? "bg-primary text-primary-foreground" : "bg-background"}`}
            onClick={() => setRange(r as 7 | 30 | 90)}
          >
            {r}d
          </button>
        ))}
      </div>
      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={filtered} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" minTickGap={24} />
            <YAxis yAxisId="mrr" tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
            <YAxis yAxisId="failed" orientation="right" allowDecimals={false} />
            <Tooltip
              formatter={(value: number | string | undefined, name: string | undefined) => {
                const numericValue =
                  typeof value === "number" ? value : Number(value || 0);
                if (name === "mrr") {
                  return [
                    new Intl.NumberFormat(locale, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    }).format(numericValue) + " lei",
                    t("billingAnalytics.estimatedMrr"),
                  ];
                }
                return [numericValue, t("billingAnalytics.failedInvoices")];
              }}
            />
            <Legend />
            <Line
              yAxisId="mrr"
              type="monotone"
              dataKey="mrr"
              name={t("billingAnalytics.estimatedMrr")}
              stroke="#0f766e"
              strokeWidth={2}
              dot={false}
            />
            <Line
              yAxisId="failed"
              type="monotone"
              dataKey="failedInvoices"
              name={t("billingAnalytics.failedInvoices")}
              stroke="#dc2626"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
