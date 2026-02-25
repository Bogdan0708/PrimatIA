"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Calculator, Scale, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TaxExplanation } from "@/lib/tax-engine/tax-explainer";

interface TaxExplanationRowProps {
  taxId: string;
  translations: {
    showCalculation: string;
    hideCalculation: string;
    loading: string;
    error: string;
    installments: string;
    bonificatie: string;
    bonificatieDetail: string;
    hclBasis: string;
  };
}

export function TaxExplanationRow({ taxId, translations }: TaxExplanationRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [data, setData] = useState<TaxExplanation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function toggle() {
    if (expanded) {
      setExpanded(false);
      return;
    }

    if (data) {
      setExpanded(true);
      return;
    }

    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/portal/taxes/${taxId}/explain`);
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      setData(json.data);
      setExpanded(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Button
        variant="ghost"
        size="sm"
        onClick={toggle}
        disabled={loading}
        className="text-xs text-muted-foreground hover:text-portal-primary gap-1"
      >
        <Calculator className="h-3 w-3" />
        {loading
          ? translations.loading
          : expanded
            ? translations.hideCalculation
            : translations.showCalculation}
        {!loading && (expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
      </Button>

      {error && (
        <p className="text-xs text-destructive mt-1">{translations.error}</p>
      )}

      {expanded && data && (
        <div className="mt-3 rounded-lg border bg-muted/30 p-4 text-sm space-y-3">
          {/* Property description */}
          {data.propertyDescription && (
            <div className="font-medium text-foreground">
              {data.propertyDescription}
            </div>
          )}

          {/* Calculation steps */}
          <div className="space-y-1.5">
            {data.steps.map((step, i) => {
              const isFinal = step.label === "Total datorat";
              return (
                <div
                  key={i}
                  className={`flex items-start justify-between gap-4 ${
                    isFinal ? "border-t pt-2 font-semibold text-foreground" : ""
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <span className={isFinal ? "" : "text-muted-foreground"}>
                      {step.label}
                    </span>
                    {step.detail && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        ({step.detail})
                      </span>
                    )}
                    {step.legalBasis && (
                      <span className="ml-1.5 inline-flex items-center gap-0.5 text-xs text-portal-primary">
                        <Scale className="h-2.5 w-2.5" />
                        {step.legalBasis}
                      </span>
                    )}
                  </div>
                  <div className={`text-right whitespace-nowrap ${isFinal ? "" : "text-muted-foreground"}`}>
                    {step.value}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Installments */}
          <div className="border-t pt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span>
              {translations.installments}: {fmtLei(data.installments.rata1)} ({data.installments.rata1Due})
              {" + "}
              {fmtLei(data.installments.rata2)} ({data.installments.rata2Due})
            </span>
            {data.bonificatie > 0 && (
              <span className="text-portal-primary flex items-center gap-1">
                <Info className="h-3 w-3" />
                {translations.bonificatie}: {fmtLei(data.bonificatie)} {translations.bonificatieDetail}
              </span>
            )}
          </div>

          {/* HCL reference */}
          {data.hclReference && (
            <div className="text-xs text-muted-foreground">
              {translations.hclBasis}: {data.hclReference}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function fmtLei(v: number): string {
  return `${v.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} lei`;
}
