import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import { RateComparisonTable } from "./_components/rate-comparison-table";

export async function generateMetadata() {
  const t = await getTranslations("rateComparison");
  return { title: t("title") };
}

type RateRow = {
  taxType: string;
  category: string | null;
  zona: string | null;
  descriptionRo: string | null;
  previousRate: number;
  currentRate: number;
  changePercent: number | null;
};

export default async function RateComparisonPage() {
  const session = await requireAdmin();
  const t = await getTranslations("rateComparison");
  const tenantId = session.user.tenantId;

  // Get all HCL decisions ordered by fiscal year
  const hclDecisions = await prisma.hclDecision.findMany({
    where: { tenantId, status: "active" },
    orderBy: { fiscalYear: "asc" },
    select: { id: true, fiscalYear: true },
  });

  if (hclDecisions.length < 2) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("noData")}</p>
      </div>
    );
  }

  // Compare last two HCL decisions
  const prev = hclDecisions[hclDecisions.length - 2];
  const curr = hclDecisions[hclDecisions.length - 1];

  const [prevRates, currRates] = await Promise.all([
    prisma.taxRateTable.findMany({
      where: { tenantId, hclDecisionId: prev.id },
      orderBy: [{ taxType: "asc" }, { category: "asc" }, { zona: "asc" }],
    }),
    prisma.taxRateTable.findMany({
      where: { tenantId, hclDecisionId: curr.id },
      orderBy: [{ taxType: "asc" }, { category: "asc" }, { zona: "asc" }],
    }),
  ]);

  // Build comparison rows
  const currMap = new Map(
    currRates.map((r) => [`${r.taxType}|${r.category || ""}|${r.zona || ""}`, r])
  );
  const prevMap = new Map(
    prevRates.map((r) => [`${r.taxType}|${r.category || ""}|${r.zona || ""}`, r])
  );

  const allKeys = Array.from(new Set([
    ...Array.from(currMap.keys()),
    ...Array.from(prevMap.keys()),
  ]));
  const rows: RateRow[] = [];

  for (const key of allKeys) {
    const p = prevMap.get(key);
    const c = currMap.get(key);
    const prevRate = p ? Number(p.rateValue) : 0;
    const currRate = c ? Number(c.rateValue) : 0;
    const changePercent = prevRate > 0 ? ((currRate - prevRate) / prevRate) * 100 : null;

    rows.push({
      taxType: (c || p)!.taxType,
      category: (c || p)!.category,
      zona: (c || p)!.zona,
      descriptionRo: (c || p)!.descriptionRo,
      previousRate: prevRate,
      currentRate: currRate,
      changePercent: changePercent !== null ? Math.round(changePercent * 100) / 100 : null,
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("description")}</p>
      </div>
      <RateComparisonTable
        rows={rows}
        previousYear={prev.fiscalYear}
        currentYear={curr.fiscalYear}
      />
    </div>
  );
}
