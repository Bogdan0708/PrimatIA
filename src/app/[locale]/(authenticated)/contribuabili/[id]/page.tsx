import { getLocale, getTranslations } from "next-intl/server";
import { requireStaff } from "@/lib/auth-utils";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CreditCard,
  Shield,
  Calculator,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getContribuabilById } from "../_actions/contribuabil-actions";
import { ComplianceScoreBadge } from "../_components/compliance-score-badge";
import { PropertiesTab } from "../_components/properties-tab";

export default async function ContribuabilDetailPage({
  params,
}: {
  params: { id: string };
}) {
  await requireStaff();
  const t = await getTranslations("taxpayer");
  const tc = await getTranslations("common");
  const tf = await getTranslations("fiscal");
  const ttax = await getTranslations("tax");
  const tpay = await getTranslations("payment");
  const tex = await getTranslations("exemption");
  const locale = await getLocale();
  const localePrefix = `/${locale}`;

  const contribuabil = await getContribuabilById(params.id);
  if (!contribuabil) notFound();

  const fs = contribuabil.fiscalSummary;

  const statusVariant = (status: string) => {
    switch (status) {
      case "activ":
        return "default" as const;
      case "inactiv":
        return "secondary" as const;
      default:
        return "outline" as const;
    }
  };

  const taxStatusVariant = (status: string) => {
    switch (status) {
      case "platit":
        return "default" as const;
      case "partial_platit":
        return "secondary" as const;
      case "executare":
        return "destructive" as const;
      default:
        return "outline" as const;
    }
  };

  const taxStatusLabel = (status: string) => {
    switch (status) {
      case "calculat":
        return ttax("calculated");
      case "emis":
        return ttax("issued");
      case "partial_platit":
        return ttax("partiallyPaid");
      case "platit":
        return ttax("paid");
      case "executare":
        return ttax("enforcement");
      default:
        return status;
    }
  };

  const exemptionStatusVariant = (status: string) => {
    switch (status) {
      case "approved":
        return "default" as const;
      case "pending":
        return "secondary" as const;
      case "rejected":
        return "destructive" as const;
      default:
        return "outline" as const;
    }
  };

  const exemptionStatusLabel = (status: string) => {
    switch (status) {
      case "pending":
        return tex("pending");
      case "approved":
        return tex("approved");
      case "rejected":
        return tex("rejected");
      case "expired":
        return tex("expired");
      default:
        return status;
    }
  };

  const methodLabel = (m: string) => {
    switch (m) {
      case "numerar":
        return tpay("cash");
      case "virament":
        return tpay("bankTransfer");
      case "mandat_postal":
        return tpay("postalOrder");
      case "ghiseul_ro":
        return tpay("ghiseulRo");
      case "card":
        return tpay("card");
      default:
        return m;
    }
  };

  const formatCurrency = (n: number) =>
    n.toLocaleString("ro-RO", { minimumFractionDigits: 2 }) + " lei";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`${localePrefix}/contribuabili`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">
              {contribuabil.nume} {contribuabil.prenume ?? ""}
            </h1>
            <Badge variant={contribuabil.tip === "PF" ? "secondary" : "outline"}>
              {contribuabil.tip === "PF" ? t("individual") : t("company")}
            </Badge>
            <Badge variant={statusVariant(contribuabil.status)}>
              {contribuabil.status === "activ"
                ? t("statusActive")
                : t("statusInactive")}
            </Badge>
            <ComplianceScoreBadge contribuabilId={params.id} />
          </div>
          {contribuabil.codRol && (
            <p className="text-sm text-muted-foreground mt-1">
              {t("rolNumber")}: {contribuabil.codRol}
            </p>
          )}
        </div>
        <Link href={`${localePrefix}/contribuabili/${params.id}/edit`}>
          <Button variant="outline">
            <Pencil className="mr-2 h-4 w-4" />
            {tc("edit")}
          </Button>
        </Link>
      </div>

      {/* Fiscal Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {tf("totalTaxes")}
            </CardTitle>
            <Calculator className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(fs.totalTaxes)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {tf("totalPaid")}
            </CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(fs.totalPaid)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {tf("totalPenalties")}
            </CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {formatCurrency(fs.totalPenalties)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {tf("totalOutstanding")}
            </CardTitle>
            <Calculator className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${fs.totalOutstanding > 0 ? "text-red-600" : "text-green-600"}`}
            >
              {formatCurrency(fs.totalOutstanding)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">{t("info")}</TabsTrigger>
          <TabsTrigger value="properties">
            {t("properties")} ({fs.totalBuildings + fs.totalLand + fs.totalVehicles})
          </TabsTrigger>
          <TabsTrigger value="taxes">
            {t("taxes")} ({contribuabil.impozite.length})
          </TabsTrigger>
          <TabsTrigger value="payments">
            {t("payments")} ({contribuabil.plati.length})
          </TabsTrigger>
        </TabsList>

        {/* INFO TAB */}
        <TabsContent value="info" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  {contribuabil.tip === "PF"
                    ? t("personalData")
                    : t("companyData")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <InfoRow label={t("name")} value={contribuabil.nume} />
                {contribuabil.prenume && (
                  <InfoRow label={t("firstName")} value={contribuabil.prenume} />
                )}
                {contribuabil.cui && (
                  <InfoRow label={t("cui")} value={contribuabil.cui} />
                )}
                {contribuabil.reprezentantLegal && (
                  <InfoRow
                    label={t("legalRepresentative")}
                    value={contribuabil.reprezentantLegal}
                  />
                )}
                {contribuabil.nrRegistruComert && (
                  <InfoRow
                    label={t("tradeRegister")}
                    value={contribuabil.nrRegistruComert}
                  />
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t("contactData")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {contribuabil.telefon && (
                  <InfoRow label={t("phone")} value={contribuabil.telefon} />
                )}
                {contribuabil.email && (
                  <InfoRow label={t("email")} value={contribuabil.email} />
                )}
                <InfoRow
                  label={t("preferredLanguage")}
                  value={(contribuabil.limbaPreferata ?? "ro").toUpperCase()}
                />
                {contribuabil.adresaDomiciliu && (
                  <InfoRow
                    label={t("addressDomiciliu")}
                    value={formatAddress(contribuabil.adresaDomiciliu)}
                  />
                )}
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t("fiscalData")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {contribuabil.codRol && (
                <InfoRow label={t("rolNumber")} value={contribuabil.codRol} />
              )}
              {contribuabil.nrDosarFiscal && (
                <InfoRow
                  label={t("fiscalRecord")}
                  value={contribuabil.nrDosarFiscal}
                />
              )}
              <InfoRow
                label={t("registrationDate")}
                value={new Date(contribuabil.createdAt).toLocaleDateString("ro-RO")}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* PROPERTIES TAB */}
        <TabsContent value="properties" className="space-y-4">
          <PropertiesTab
            buildings={contribuabil.proprietatiCladiri}
            land={contribuabil.proprietatiTerenuri}
            vehicles={contribuabil.proprietatiVehicule}
            noPropertiesLabel={tf("noProperties")}
          />
        </TabsContent>

        {/* TAXES TAB */}
        <TabsContent value="taxes" className="space-y-4">
          {contribuabil.impozite.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Calculator className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">{tf("noTaxes")}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="h-10 px-3 text-left font-medium">
                      {ttax("fiscalYear")}
                    </th>
                    <th className="h-10 px-3 text-left font-medium">
                      {ttax("taxType")}
                    </th>
                    <th className="h-10 px-3 text-left font-medium">
                      {ttax("amountOwed")}
                    </th>
                    <th className="h-10 px-3 text-left font-medium">
                      {ttax("amountPaid")}
                    </th>
                    <th className="h-10 px-3 text-left font-medium">
                      {ttax("penalties")}
                    </th>
                    <th className="h-10 px-3 text-left font-medium">
                      {ttax("outstanding")}
                    </th>
                    <th className="h-10 px-3 text-left font-medium">
                      {tc("status")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {contribuabil.impozite.map((imp) => {
                    const owed = Number(imp.sumaDatorata);
                    const paid = Number(imp.sumaPlatita);
                    const penalties = Number(imp.sumaPenalitati);
                    const outstanding = owed + penalties - paid;
                    return (
                      <tr
                        key={imp.id}
                        className="border-b transition-colors hover:bg-muted/50"
                      >
                        <td className="p-3 font-mono">{imp.fiscalYear}</td>
                        <td className="p-3">
                          {imp.taxType?.name
                            ? (imp.taxType.name as Record<string, string>)[locale] ||
                              (imp.taxType.name as Record<string, string>).ro ||
                              imp.taxType.code
                            : imp.taxTypeId}
                        </td>
                        <td className="p-3">{formatCurrency(owed)}</td>
                        <td className="p-3 text-green-600">
                          {formatCurrency(paid)}
                        </td>
                        <td className="p-3 text-orange-600">
                          {formatCurrency(penalties)}
                        </td>
                        <td
                          className={`p-3 font-medium ${outstanding > 0 ? "text-red-600" : "text-green-600"}`}
                        >
                          {formatCurrency(outstanding)}
                        </td>
                        <td className="p-3">
                          <Badge variant={taxStatusVariant(imp.status)}>
                            {taxStatusLabel(imp.status)}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Exemptions sub-section */}
          {contribuabil.scutiri.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center gap-2">
                <Shield className="h-5 w-5" />
                <CardTitle className="text-lg">
                  {tex("title")} ({contribuabil.scutiri.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="h-10 px-3 text-left font-medium">
                          {tex("ruleName")}
                        </th>
                        <th className="h-10 px-3 text-left font-medium">
                          {ttax("fiscalYear")}
                        </th>
                        <th className="h-10 px-3 text-left font-medium">
                          {tex("discountPercent")}
                        </th>
                        <th className="h-10 px-3 text-left font-medium">
                          {tc("status")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {contribuabil.scutiri.map((sc) => (
                        <tr
                          key={sc.id}
                          className="border-b transition-colors hover:bg-muted/50"
                        >
                          <td className="p-3">{sc.scutireRegula.nameRo}</td>
                          <td className="p-3 font-mono">{sc.fiscalYear}</td>
                          <td className="p-3">
                            {Number(sc.scutireRegula.discountPercent)}%
                          </td>
                          <td className="p-3">
                            <Badge
                              variant={exemptionStatusVariant(sc.status)}
                            >
                              {exemptionStatusLabel(sc.status)}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* PAYMENTS TAB */}
        <TabsContent value="payments" className="space-y-4">
          {contribuabil.plati.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CreditCard className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">{tc("noResults")}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="h-10 px-3 text-left font-medium">
                      {tpay("paymentDate")}
                    </th>
                    <th className="h-10 px-3 text-left font-medium">
                      {tpay("amount")}
                    </th>
                    <th className="h-10 px-3 text-left font-medium">
                      {tpay("paymentMethod")}
                    </th>
                    <th className="h-10 px-3 text-left font-medium">
                      {tpay("receiptNumber")}
                    </th>
                    <th className="h-10 px-3 text-left font-medium">
                      {tc("status")}
                    </th>
                    <th className="h-10 px-3 text-left font-medium">
                      {tc("actions")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {contribuabil.plati.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b transition-colors hover:bg-muted/50"
                    >
                      <td className="p-3">
                        {new Date(p.dataPlata).toLocaleDateString("ro-RO")}
                      </td>
                      <td className="p-3 font-mono font-medium">
                        {formatCurrency(Number(p.suma))}
                      </td>
                      <td className="p-3">{methodLabel(p.modalitate)}</td>
                      <td className="p-3 font-mono text-xs">
                        {p.nrChitanta ?? p.nrDocument ?? "-"}
                      </td>
                      <td className="p-3">
                        <Badge
                          variant={p.distribuit ? "default" : "secondary"}
                        >
                          {p.distribuit
                            ? tpay("distributed")
                            : tpay("notDistributed")}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <Link href={`/plati/${p.id}`}>
                          <Button variant="ghost" size="sm">
                            {tc("details")}
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

function formatAddress(addr: {
  strada?: string | null;
  numar?: string | null;
  localitate: string;
  judet: string;
}) {
  const parts: string[] = [];
  if (addr.strada) {
    parts.push(addr.strada);
    if (addr.numar) parts.push(`nr. ${addr.numar}`);
  }
  parts.push(addr.localitate);
  parts.push(addr.judet);
  return parts.join(", ");
}
