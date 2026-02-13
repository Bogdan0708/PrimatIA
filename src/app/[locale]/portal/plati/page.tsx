import { requireCitizenAuth } from "@/lib/portal-auth";
import { prisma, setTenantContext } from "@/lib/db";
import { getLocale, getTranslations } from "next-intl/server";
import { formatLei, formatDate } from "@/lib/formatting";
import Link from "next/link";
import {
  Card,
  CardContent,
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
import { CreditCard, Download } from "lucide-react";

export default async function PortalPaymentsPage() {
  const citizen = await requireCitizenAuth();
  const t = await getTranslations("portal");
  const tPayment = await getTranslations("payment");
  const locale = await getLocale();
  const localePrefix = `/${locale}`;
  await setTenantContext(citizen.tenantId);

  const links = await prisma.citizenContribuabilLink.findMany({
    where: { citizenUserId: citizen.sub, isActive: true },
    select: { contribuabilId: true },
  });
  const contribuabilIds = links.map((l) => l.contribuabilId);

  const payments = await prisma.plata.findMany({
    where: { contribuabilId: { in: contribuabilIds } },
    orderBy: { dataPlata: "desc" },
    take: 50,
  });

  const modalitateLabels: Record<string, string> = {
    numerar: tPayment("cash"),
    virament: tPayment("bankTransfer"),
    mandat_postal: tPayment("postalOrder"),
    ghiseul_ro: tPayment("ghiseulRo"),
    card: tPayment("card"),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("paymentHistory")}</h1>
        <Button asChild className="bg-teal-600 hover:bg-teal-700">
          <Link href={`${localePrefix}/portal/plati/online`}>
            <CreditCard className="mr-2 h-4 w-4" />
            {t("payOnline")}
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {payments.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">{t("noPayments")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tPayment("paymentDate")}</TableHead>
                  <TableHead className="text-right">{tPayment("amount")}</TableHead>
                  <TableHead>{tPayment("paymentMethod")}</TableHead>
                  <TableHead>{tPayment("receiptNumber")}</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>{formatDate(payment.dataPlata)}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatLei(Number(payment.suma))}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {modalitateLabels[payment.modalitate] || payment.modalitate}
                      </Badge>
                    </TableCell>
                    <TableCell>{payment.nrChitanta || "-"}</TableCell>
                    <TableCell>
                      {payment.nrChitanta && (
                        <Button variant="ghost" size="sm">
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
