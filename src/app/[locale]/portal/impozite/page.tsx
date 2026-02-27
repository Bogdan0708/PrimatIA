import { requireCitizenAuth } from "@/lib/portal-auth";
import { prisma, setTenantContext } from "@/lib/db";
import { getTranslations } from "next-intl/server";
import { formatLei, formatDate } from "@/lib/formatting";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { TaxExplanationRow } from "@/components/portal/tax-explanation";
import { getOutstanding } from "@/lib/tax-engine/liability-utils";

const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  calculat: "outline",
  emis: "secondary",
  partial_platit: "default",
  platit: "default",
  executare: "destructive",
};

export default async function PortalTaxesPage() {
  const citizen = await requireCitizenAuth();
  const t = await getTranslations("portal");
  const tTax = await getTranslations("tax");
  await setTenantContext(citizen.tenantId);

  const links = await prisma.citizenContribuabilLink.findMany({
    where: { citizenUserId: citizen.sub, isActive: true },
    select: { contribuabilId: true },
  });
  const contribuabilIds = links.map((l) => l.contribuabilId);

  const taxes = await prisma.impozit.findMany({
    where: { contribuabilId: { in: contribuabilIds } },
    include: {
      taxType: true,
      documente: {
        where: { tip: "decizie_impunere" },
        select: { id: true, fileUrl: true },
        take: 1,
      },
    },
    orderBy: [{ fiscalYear: "desc" }, { createdAt: "desc" }],
  });

  // Group by year
  const taxesByYear = taxes.reduce<Record<number, typeof taxes>>((acc, tax) => {
    if (!acc[tax.fiscalYear]) acc[tax.fiscalYear] = [];
    acc[tax.fiscalYear].push(tax);
    return acc;
  }, {});

  const years = Object.keys(taxesByYear)
    .map(Number)
    .sort((a, b) => b - a);

  const explanationTranslations = {
    showCalculation: t("showCalculation"),
    hideCalculation: t("hideCalculation"),
    loading: t("explanationLoading"),
    error: t("explanationError"),
    installments: t("explanationInstallments"),
    bonificatie: t("explanationBonificatie"),
    bonificatieDetail: t("explanationBonificatieDetail"),
    hclBasis: t("explanationHclBasis"),
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("myTaxes")}</h1>

      {years.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">{t("noTaxes")}</p>
          </CardContent>
        </Card>
      ) : (
        years.map((year) => (
          <Card key={year}>
            <CardHeader>
              <CardTitle>{t("fiscalYear")} {year}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tTax("taxType")}</TableHead>
                    <TableHead className="text-right">{tTax("amountOwed")}</TableHead>
                    <TableHead className="text-right">{tTax("amountPaid")}</TableHead>
                    <TableHead className="text-right">{tTax("outstanding")}</TableHead>
                    <TableHead>{tTax("installment1")}</TableHead>
                    <TableHead>{tTax("installment2")}</TableHead>
                    <TableHead>{t("status")}</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {taxesByYear[year].map((tax) => {
                    const outstanding = getOutstanding(tax);
                    const taxName = (tax.taxType.name as Record<string, string>)?.ro || tax.taxType.code;
                    return (
                      <TableRow key={tax.id}>
                        <TableCell>
                          <div>
                            <span className="font-medium">{taxName}</span>
                            <TaxExplanationRow
                              taxId={tax.id}
                              translations={explanationTranslations}
                            />
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{formatLei(Number(tax.sumaDatorata))}</TableCell>
                        <TableCell className="text-right">{formatLei(Number(tax.sumaPlatita))}</TableCell>
                        <TableCell className={`text-right font-semibold ${outstanding > 0 ? "text-destructive" : "text-portal-primary"}`}>
                          {formatLei(outstanding)}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p>{formatLei(Number(tax.rata1))}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(tax.rata1Scadenta)}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p>{formatLei(Number(tax.rata2))}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(tax.rata2Scadenta)}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusColors[tax.status] || "outline"}>
                            {tTax(tax.status as "calculat" | "emis" | "partial_platit" | "platit" | "enforcement")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {tax.documente[0]?.fileUrl && (
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`/api/documents/${tax.documente[0].id}/download`}>
                                <Download className="h-4 w-4" />
                              </Link>
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
