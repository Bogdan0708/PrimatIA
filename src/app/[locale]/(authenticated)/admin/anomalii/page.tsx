import { requireAdmin } from "@/lib/auth-utils";
import { setTenantContext } from "@/lib/db";
import { detectAnomalies, type Anomaly } from "@/lib/ai/anomaly-detection";
import { getTranslations } from "next-intl/server";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
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
import Link from "next/link";
import { getLocale } from "next-intl/server";

const severityColors: Record<string, "destructive" | "default" | "secondary" | "outline"> = {
  critical: "destructive",
  high: "destructive",
  medium: "default",
  low: "secondary",
};

const severityLabels: Record<string, string> = {
  critical: "Critic",
  high: "Ridicat",
  medium: "Mediu",
  low: "Scăzut",
};

const typeLabels: Record<string, string> = {
  zero_tax: "Impozit zero",
  outlier_amount: "Sumă atipică",
  overpayment: "Plată excesivă",
  duplicate: "Duplicat",
  missing_data: "Date lipsă",
  zero_value: "Valoare zero",
  implausible: "Date implauzibile",
  value_change: "Schimbare valoare",
};

function getEntityLink(locale: string, anomaly: Anomaly): string | null {
  switch (anomaly.entityType) {
    case "contribuabil":
      return `/${locale}/contribuabili/${anomaly.entityId}`;
    case "cladire":
      return `/${locale}/proprietati/cladiri`;
    case "teren":
      return `/${locale}/proprietati/terenuri`;
    case "vehicul":
      return `/${locale}/proprietati/vehicule`;
    default:
      return null;
  }
}

export default async function AdminAnomaliiPage() {
  const session = await requireAdmin();
  const t = await getTranslations("anomaly");
  const locale = await getLocale();
  await setTenantContext(session.user.tenantId);

  const anomalies = await detectAnomalies(session.user.tenantId);

  const stats = {
    total: anomalies.length,
    critical: anomalies.filter((a) => a.severity === "critical").length,
    high: anomalies.filter((a) => a.severity === "high").length,
    medium: anomalies.filter((a) => a.severity === "medium").length,
    low: anomalies.filter((a) => a.severity === "low").length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("description")}</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("total")}</CardDescription>
            <CardTitle className="text-2xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("critical")}</CardDescription>
            <CardTitle className="text-2xl text-red-600">{stats.critical}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("high")}</CardDescription>
            <CardTitle className="text-2xl text-orange-500">{stats.high}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("medium")}</CardDescription>
            <CardTitle className="text-2xl text-yellow-500">{stats.medium}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("low")}</CardDescription>
            <CardTitle className="text-2xl text-blue-500">{stats.low}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t("anomalyList")}</CardTitle>
          <CardDescription>{t("anomalyListDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          {anomalies.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">{t("noAnomalies")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("severity")}</TableHead>
                  <TableHead>{t("type")}</TableHead>
                  <TableHead>{t("entity")}</TableHead>
                  <TableHead className="max-w-md">{t("descriptionCol")}</TableHead>
                  <TableHead>{t("action")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {anomalies.map((anomaly, idx) => {
                  const link = getEntityLink(locale, anomaly);
                  return (
                    <TableRow key={`${anomaly.entityId}-${anomaly.type}-${idx}`}>
                      <TableCell>
                        <Badge variant={severityColors[anomaly.severity]}>
                          {severityLabels[anomaly.severity]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{typeLabels[anomaly.type]}</span>
                      </TableCell>
                      <TableCell>
                        {link ? (
                          <Link href={link} className="text-primary hover:underline text-sm">
                            {anomaly.entityType}
                          </Link>
                        ) : (
                          <span className="text-sm">{anomaly.entityType}</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-md">
                        <p className="text-sm">{anomaly.description}</p>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm text-muted-foreground">{anomaly.suggestedAction}</p>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
