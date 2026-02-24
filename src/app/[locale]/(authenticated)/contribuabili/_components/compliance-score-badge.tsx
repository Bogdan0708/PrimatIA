"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ComplianceGrade, ComplianceColor } from "@/lib/scoring/compliance-score";

interface ScoreData {
  score: number;
  grade: ComplianceGrade;
  color: ComplianceColor;
  factors: {
    paymentTimeliness: { score: number; avgDaysLate: number; totalPayments: number };
    declarationCompleteness: { score: number; filed: number; expected: number };
    paymentConsistency: { score: number; variance: number };
    disputeHistory: { score: number; totalDisputes: number; activeDisputes: number };
  };
}

const colorClasses: Record<ComplianceColor, string> = {
  green: "bg-green-100 text-green-800 border-green-300",
  yellow: "bg-yellow-100 text-yellow-800 border-yellow-300",
  orange: "bg-orange-100 text-orange-800 border-orange-300",
  red: "bg-red-100 text-red-800 border-red-300",
};

export function ComplianceScoreBadge({
  contribuabilId,
  compact = false,
}: {
  contribuabilId: string;
  compact?: boolean;
}) {
  const t = useTranslations("compliance");
  const [data, setData] = useState<ScoreData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/contribuabili/${contribuabilId}/score`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setData(json.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [contribuabilId]);

  if (loading) {
    return <Skeleton className="h-5 w-12 rounded-full" />;
  }

  if (!data) return null;

  const badge = (
    <Badge
      variant="outline"
      className={`${colorClasses[data.color]} font-bold cursor-default ${compact ? "text-xs px-1.5 py-0" : ""}`}
    >
      {data.grade} ({data.score})
    </Badge>
  );

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{badge}</TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <p className="font-semibold mb-1">
              {t("title")}: {data.score}/100
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-sm p-3">
          <div className="space-y-2">
            <p className="font-semibold text-sm">
              {t("title")}: {data.score}/100
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <span className="text-muted-foreground">{t("timeliness")} (40%)</span>
              <span className="font-medium text-right">{data.factors.paymentTimeliness.score}/100</span>

              <span className="text-muted-foreground">{t("completeness")} (25%)</span>
              <span className="font-medium text-right">{data.factors.declarationCompleteness.score}/100</span>

              <span className="text-muted-foreground">{t("consistency")} (20%)</span>
              <span className="font-medium text-right">{data.factors.paymentConsistency.score}/100</span>

              <span className="text-muted-foreground">{t("disputes")} (15%)</span>
              <span className="font-medium text-right">{data.factors.disputeHistory.score}/100</span>
            </div>
            {data.factors.paymentTimeliness.avgDaysLate > 0 && (
              <p className="text-xs text-muted-foreground">
                {t("avgDaysLate")}: {data.factors.paymentTimeliness.avgDaysLate}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
