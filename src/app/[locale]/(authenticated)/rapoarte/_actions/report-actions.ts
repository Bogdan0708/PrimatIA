"use server";

import { auth } from "@/lib/auth";
import {
  reportVenituriIncasate,
  reportRestante,
  reportRegistruRol,
  reportBordeRouZilnic,
  reportDebiteIncasari,
  reportToCsv,
  type ReportResult,
} from "@/lib/reports";

type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

export type ReportType =
  | "venituri_incasate"
  | "restante"
  | "registru_rol"
  | "borderou_zilnic"
  | "debite_incasari";

export interface ReportActionParams {
  reportType: ReportType;
  dateFrom?: string;
  dateTo?: string;
  fiscalYear?: number;
  taxType?: string;
}

export async function generateReport(
  params: ReportActionParams
): Promise<ActionResult<ReportResult>> {
  const session = await auth();
  if (!session?.user?.tenantId)
    return { success: false, error: "No tenant context" };

  try {
    const reportParams = {
      tenantId: session.user.tenantId,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      fiscalYear: params.fiscalYear,
      taxType: params.taxType,
    };

    let result: ReportResult;

    switch (params.reportType) {
      case "venituri_incasate":
        result = await reportVenituriIncasate(reportParams);
        break;
      case "restante":
        result = await reportRestante(reportParams);
        break;
      case "registru_rol":
        result = await reportRegistruRol(reportParams);
        break;
      case "borderou_zilnic":
        result = await reportBordeRouZilnic(reportParams);
        break;
      case "debite_incasari":
        result = await reportDebiteIncasari(reportParams);
        break;
      default:
        return { success: false, error: `Tip raport necunoscut: ${params.reportType}` };
    }

    return { success: true, data: result };
  } catch (error) {
    console.error("Error generating report:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Eroare la generarea raportului",
    };
  }
}

export async function exportReportCsv(
  params: ReportActionParams
): Promise<ActionResult<{ csv: string; filename: string }>> {
  const result = await generateReport(params);
  if (!result.success) return result;
  if (!result.data) return { success: false, error: "Nu s-au generat date" };

  const csv = reportToCsv(result.data);
  const filename = `${params.reportType}_${new Date().toISOString().slice(0, 10)}.csv`;

  return { success: true, data: { csv, filename } };
}
