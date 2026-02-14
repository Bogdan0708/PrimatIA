"use client";

import { useTranslations } from "next-intl";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type RateRow = {
  taxType: string;
  category: string | null;
  zona: string | null;
  descriptionRo: string | null;
  previousRate: number;
  currentRate: number;
  changePercent: number | null;
};

interface Props {
  rows: RateRow[];
  previousYear: number;
  currentYear: number;
}

export function RateComparisonTable({ rows, previousYear, currentYear }: Props) {
  const t = useTranslations("rateComparison");

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("taxType")}</TableHead>
            <TableHead>{t("category")}</TableHead>
            <TableHead>{t("zone")}</TableHead>
            <TableHead className="text-right">
              {t("previousRate")} ({previousYear})
            </TableHead>
            <TableHead className="text-right">
              {t("currentRate")} ({currentYear})
            </TableHead>
            <TableHead className="text-right">{t("change")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => {
            const isIncrease = row.changePercent !== null && row.changePercent > 0;
            const isDecrease = row.changePercent !== null && row.changePercent < 0;

            return (
              <TableRow key={i}>
                <TableCell className="font-medium">
                  {row.descriptionRo || row.taxType}
                </TableCell>
                <TableCell>{row.category || "—"}</TableCell>
                <TableCell>{row.zona || "—"}</TableCell>
                <TableCell className="text-right">{row.previousRate}</TableCell>
                <TableCell className="text-right">{row.currentRate}</TableCell>
                <TableCell
                  className={cn(
                    "text-right font-semibold",
                    isIncrease && "text-red-600",
                    isDecrease && "text-green-600"
                  )}
                >
                  {row.changePercent !== null
                    ? `${row.changePercent > 0 ? "+" : ""}${row.changePercent}%`
                    : "—"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
