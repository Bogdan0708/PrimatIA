import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CreditCard, User, ArrowRightLeft } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/ui/page-header";
import { formatLei, formatDate } from "@/lib/formatting";
import { requireStaff } from "@/lib/auth-utils";
import { getPlataById } from "../_actions/plata-actions";

interface Props {
  params: {
    id: string;
    locale: string;
  };
}

export async function generateMetadata() {
  const t = await getTranslations("paymentDetail");
  return { title: t("title") };
}

export default async function PaymentDetailPage({ params }: Props) {
  await requireStaff();

  const { id } = params;
  const plata = await getPlataById(id);
  const t = await getTranslations("paymentDetail");
  if (!plata) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={plata.nrChitanta || plata.nrDocument || id}
        breadcrumb={[
          { label: t("back"), href: `/${params.locale}/plati` },
          { label: t("title") },
        ]}
        actions={
          <Badge variant={plata.distribuit ? "default" : "secondary"}>
            {plata.distribuit ? t("distributed") : t("pending")}
          </Badge>
        }
      />

      <div className="grid gap-6 md:grid-cols-3">
        {/* Payment Summary */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              {t("summary")}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">{t("amount")}</p>
              <p className="text-2xl font-bold text-primary">{formatLei(plata.suma)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">{t("date")}</p>
              <p className="text-lg font-semibold">{formatDate(plata.dataPlata)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">{t("method")}</p>
              <Badge variant="outline" className="capitalize">
                {plata.modalitate.replace("_", " ")}
              </Badge>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">{t("receipt")}</p>
              <p className="font-mono">{plata.nrChitanta || "—"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">{t("document")}</p>
              <p className="font-mono">{plata.nrDocument || "—"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">{t("registeredBy")}</p>
              <p>
                {plata.inregistratDe
                  ? `${plata.inregistratDe.firstName} ${plata.inregistratDe.lastName}`
                  : t("system")}
              </p>
            </div>
          </CardContent>
          {plata.nota && (
            <CardContent className="border-t pt-4">
              <p className="text-sm font-medium text-muted-foreground mb-1">{t("notes")}</p>
              <p className="text-sm italic">{plata.nota}</p>
            </CardContent>
          )}
        </Card>

        {/* Taxpayer Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              {t("contribuabil")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t("taxpayerName")}</p>
              <Link
                href={`/${params.locale}/contribuabili/${plata.contribuabil.id}`}
                className="font-semibold text-primary hover:underline"
              >
                {plata.contribuabil.nume} {plata.contribuabil.prenume}
              </Link>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t("cnpCui")}</p>
              <p className="font-mono">{plata.contribuabil.cui || "—"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t("codRol")}</p>
              <p className="font-mono">{plata.contribuabil.codRol || "—"}</p>
            </div>
            <Button variant="outline" size="sm" className="w-full" asChild>
              <Link href={`/${params.locale}/contribuabili/${plata.contribuabil.id}`}>
                {t("viewProfile")}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Distributions Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-primary" />
            {t("distributions")}
          </CardTitle>
          <CardDescription>
            {t("distributionsDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("taxType")}</TableHead>
                <TableHead className="text-center">{t("year")}</TableHead>
                <TableHead className="text-right">{t("principal")}</TableHead>
                <TableHead className="text-right">{t("penalties")}</TableHead>
                <TableHead className="text-right">{t("total")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plata.platiDistributie.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    {t("pending")}
                  </TableCell>
                </TableRow>
              ) : (
                plata.platiDistributie.map((dist) => {
                  const names = dist.impozit.taxType.name as Record<string, string>;
                  const taxName = names[params.locale] || names["ro"] || dist.impozit.taxType.code;
                  return (
                    <TableRow key={dist.id}>
                      <TableCell>
                        <div className="font-medium">{taxName}</div>
                        <div className="text-xs text-muted-foreground uppercase">
                          {dist.impozit.taxType.code.replace(/_/g, " ")}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">{dist.impozit.fiscalYear}</TableCell>
                      <TableCell className="text-right">{formatLei(dist.sumaDebit)}</TableCell>
                      <TableCell className="text-right">{formatLei(dist.sumaPenalitati)}</TableCell>
                      <TableCell className="text-right font-bold">
                        {formatLei(dist.sumaDebit + dist.sumaPenalitati)}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
