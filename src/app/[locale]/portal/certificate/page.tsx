import { requireCitizenAuth } from "@/lib/portal-auth";
import { prisma, setTenantContext } from "@/lib/db";
import { getTranslations } from "next-intl/server";
import { formatDate } from "@/lib/formatting";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, FileCheck } from "lucide-react";
import Link from "next/link";
import { CertificateRequestForm } from "./_components/certificate-request-form";

const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  processing: "secondary",
  ready: "default",
  rejected: "destructive",
  downloaded: "default",
};

export default async function PortalCertificatesPage() {
  const citizen = await requireCitizenAuth();
  const t = await getTranslations("portal");
  await setTenantContext(citizen.tenantId);

  const links = await prisma.citizenContribuabilLink.findMany({
    where: { citizenUserId: citizen.sub, isActive: true },
    include: {
      contribuabil: { select: { id: true, nume: true, prenume: true } },
    },
  });

  const requests = await prisma.certificateRequest.findMany({
    where: { citizenUserId: citizen.sub },
    include: {
      contribuabil: { select: { nume: true, prenume: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const contribuabilOptions = links.map((l) => ({
    id: l.contribuabil.id,
    name: l.contribuabil.prenume
      ? `${l.contribuabil.nume} ${l.contribuabil.prenume}`
      : l.contribuabil.nume,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("certificates")}</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Request form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-portal-primary" />
              {t("requestCertificate")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CertificateRequestForm
              contribuabili={contribuabilOptions}
            />
          </CardContent>
        </Card>

        {/* Existing requests */}
        <Card>
          <CardHeader>
            <CardTitle>{t("myRequests")}</CardTitle>
          </CardHeader>
          <CardContent>
            {requests.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4">{t("noRequests")}</p>
            ) : (
              <div className="space-y-3">
                {requests.map((req) => (
                  <div key={req.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium">{req.tipCertificat}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(req.createdAt)} — {req.contribuabil.nume} {req.contribuabil.prenume}
                      </p>
                      {req.scop && (
                        <p className="text-xs text-muted-foreground">{req.scop}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={statusColors[req.status] || "outline"}>
                        {t(`certStatus_${req.status}`)}
                      </Badge>
                      {req.status === "ready" && req.documentId && (
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/api/documents/${req.documentId}/download`}>
                            <Download className="h-4 w-4" />
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
