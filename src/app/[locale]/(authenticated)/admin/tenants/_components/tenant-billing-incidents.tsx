"use client";

import { Fragment, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

interface IncidentRow {
  id: string;
  tenantId: string;
  action: string;
  createdAt: string;
  invoiceStatus: string;
  oldValues: string;
  newValues: string;
}

interface TenantBillingIncidentsProps {
  incidents: IncidentRow[];
}

const PAGE_SIZE = 10;
type SortKey = "createdAt" | "tenantId" | "invoiceStatus" | "action";
type SortDir = "asc" | "desc";

export function TenantBillingIncidents({ incidents }: TenantBillingIncidentsProps) {
  const t = useTranslations("tenant");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const [tenantQuery, setTenantQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateRange, setDateRange] = useState<"all" | "7" | "30" | "90">("30");
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string>("");

  const filtered = useMemo(() => {
    const now = Date.now();

    const rows = incidents.filter((row) => {
      if (
        tenantQuery.trim().length > 0 &&
        !row.tenantId.toLowerCase().includes(tenantQuery.trim().toLowerCase())
      ) {
        return false;
      }

      if (statusFilter !== "all" && row.invoiceStatus !== statusFilter) {
        return false;
      }

      if (dateRange !== "all") {
        const days = Number(dateRange);
        const cutoff = now - days * 24 * 60 * 60 * 1000;
        if (new Date(row.createdAt).getTime() < cutoff) {
          return false;
        }
      }

      return true;
    });

    const sorted = rows.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "createdAt") {
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else {
        cmp = a[sortKey].localeCompare(b[sortKey], "ro");
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return sorted;
  }, [incidents, tenantQuery, statusFilter, dateRange, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const onSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir("asc");
  };

  const sortIndicator = (key: SortKey) =>
    sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : "";

  return (
    <div className="space-y-3">
      <div className="grid gap-2 md:grid-cols-4">
        <input
          value={tenantQuery}
          onChange={(e) => {
            setTenantQuery(e.target.value);
            setPage(1);
          }}
          placeholder={t("billingAnalytics.filterTenantId")}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="all">{t("billingAnalytics.allStatuses")}</option>
          <option value="paid">paid</option>
          <option value="failed">failed</option>
          <option value="open">open</option>
        </select>
        <select
          value={dateRange}
          onChange={(e) => {
            setDateRange(e.target.value as "all" | "7" | "30" | "90");
            setPage(1);
          }}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="7">{t("billingAnalytics.last7Days")}</option>
          <option value="30">{t("billingAnalytics.last30Days")}</option>
          <option value="90">{t("billingAnalytics.last90Days")}</option>
          <option value="all">{t("billingAnalytics.allTime")}</option>
        </select>
        <div className="text-xs text-muted-foreground flex items-center justify-end">
          {t("billingAnalytics.incidentCount", { count: filtered.length })}
        </div>
      </div>

      <div className="rounded border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="h-10 px-3 text-left font-medium">
                <button type="button" onClick={() => onSort("tenantId")}>
                  {t("billingAnalytics.tenant")}{sortIndicator("tenantId")}
                </button>
              </th>
              <th className="h-10 px-3 text-left font-medium">
                <button type="button" onClick={() => onSort("invoiceStatus")}>
                  {tCommon("status")}{sortIndicator("invoiceStatus")}
                </button>
              </th>
              <th className="h-10 px-3 text-left font-medium">
                <button type="button" onClick={() => onSort("action")}>
                  {tCommon("actions")}{sortIndicator("action")}
                </button>
              </th>
              <th className="h-10 px-3 text-left font-medium">
                <button type="button" onClick={() => onSort("createdAt")}>
                  {t("billingAnalytics.created")}{sortIndicator("createdAt")}
                </button>
              </th>
              <th className="h-10 px-3 text-left font-medium">{tCommon("details")}</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-4 text-center text-muted-foreground">
                  {t("billingAnalytics.noIncidents")}
                </td>
              </tr>
            ) : (
              pageRows.map((row) => {
                const isExpanded = expandedId === row.id;
                return (
                  <Fragment key={row.id}>
                    <tr className="border-b">
                      <td className="p-3 font-mono text-xs">{row.tenantId}</td>
                      <td className="p-3">{row.invoiceStatus || "-"}</td>
                      <td className="p-3">{row.action}</td>
                      <td className="p-3 text-xs">
                        {new Date(row.createdAt).toLocaleString(locale)}
                      </td>
                      <td className="p-3">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setExpandedId((prev) => (prev === row.id ? null : row.id))
                          }
                        >
                          {isExpanded
                            ? t("billingAnalytics.hide")
                            : tCommon("details")}
                        </Button>
                      </td>
                    </tr>
                    {isExpanded ? (
                      <tr className="border-b bg-muted/20">
                        <td colSpan={5} className="p-3">
                          <div className="grid gap-3 md:grid-cols-2">
                            <div>
                              <div className="mb-1 flex items-center justify-between">
                                <p className="text-xs font-medium text-muted-foreground">
                                  {t("billingAnalytics.oldValues")}
                                </p>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={async () => {
                                    await navigator.clipboard.writeText(formatJson(row.oldValues));
                                    setCopiedKey(`${row.id}:old`);
                                    setTimeout(() => setCopiedKey(""), 1200);
                                  }}
                                >
                                  {copiedKey === `${row.id}:old`
                                    ? t("billingAnalytics.copied")
                                    : t("billingAnalytics.copy")}
                                </Button>
                              </div>
                              <pre className="max-h-48 overflow-auto rounded border bg-background p-2 text-[11px]">
                                {formatJson(row.oldValues)}
                              </pre>
                            </div>
                            <div>
                              <div className="mb-1 flex items-center justify-between">
                                <p className="text-xs font-medium text-muted-foreground">
                                  {t("billingAnalytics.newValues")}
                                </p>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={async () => {
                                    await navigator.clipboard.writeText(formatJson(row.newValues));
                                    setCopiedKey(`${row.id}:new`);
                                    setTimeout(() => setCopiedKey(""), 1200);
                                  }}
                                >
                                  {copiedKey === `${row.id}:new`
                                    ? t("billingAnalytics.copied")
                                    : t("billingAnalytics.copy")}
                                </Button>
                              </div>
                              <pre className="max-h-48 overflow-auto rounded border bg-background p-2 text-[11px]">
                                {formatJson(row.newValues)}
                              </pre>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {t("billingAnalytics.page", { current: safePage, totalPages })}
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            {tCommon("previous")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={safePage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            {tCommon("next")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function formatJson(value: string): string {
  try {
    return JSON.stringify(JSON.parse(value || "{}"), null, 2);
  } catch {
    return value || "{}";
  }
}
