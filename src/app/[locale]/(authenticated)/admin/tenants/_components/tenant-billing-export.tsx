"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { sanitizeCsvCell } from "@/lib/sanitize";

interface TrendPoint {
  day: string;
  mrr: number;
  failedInvoices: number;
}

interface IncidentPoint {
  tenantId: string;
  action: string;
  createdAt: string;
  invoiceStatus: string;
}

interface TenantBillingExportProps {
  trends: TrendPoint[];
  incidents: IncidentPoint[];
}

function escapeCsv(value: string): string {
  const safe = sanitizeCsvCell(value);
  return `"${safe.replace(/"/g, '""')}"`;
}

function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const csv = [headers.map(escapeCsv).join(",")]
    .concat(rows.map((row) => row.map(escapeCsv).join(",")))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function TenantBillingExport({ trends, incidents }: TenantBillingExportProps) {
  const t = useTranslations("tenant");

  const exportTrends = () => {
    const rows = trends.map((t) => [
      t.day,
      String(t.mrr),
      String(t.failedInvoices),
    ]);
    downloadCsv(
      `billing-trends-${new Date().toISOString().slice(0, 10)}.csv`,
      ["day", "estimated_mrr_lei", "failed_invoices"],
      rows
    );
  };

  const exportIncidents = () => {
    const rows = incidents.map((i) => [
      i.tenantId,
      i.action,
      i.createdAt,
      i.invoiceStatus,
    ]);
    downloadCsv(
      `billing-incidents-${new Date().toISOString().slice(0, 10)}.csv`,
      ["tenant_id", "action", "created_at", "invoice_status"],
      rows
    );
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" variant="outline" onClick={exportTrends}>
        {t("billingAnalytics.exportTrendsCsv")}
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={exportIncidents}>
        {t("billingAnalytics.exportIncidentsCsv")}
      </Button>
    </div>
  );
}
