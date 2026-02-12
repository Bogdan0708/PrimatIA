import { requireCitizenAuth } from "@/lib/portal-auth";
import { prisma, setTenantContext } from "@/lib/db";
import { getTranslations } from "next-intl/server";
import { formatDate } from "@/lib/formatting";
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
import { Download, FileText } from "lucide-react";

export default async function PortalDocumentsPage() {
  const citizen = await requireCitizenAuth();
  const t = await getTranslations("portal");
  const tDoc = await getTranslations("document");
  await setTenantContext(citizen.tenantId);

  const links = await prisma.citizenContribuabilLink.findMany({
    where: { citizenUserId: citizen.sub, isActive: true },
    select: { contribuabilId: true },
  });
  const contribuabilIds = links.map((l) => l.contribuabilId);

  const documents = await prisma.document.findMany({
    where: { contribuabilId: { in: contribuabilIds } },
    orderBy: { dataDocument: "desc" },
    take: 50,
  });

  const docTypeLabels: Record<string, string> = {
    decizie_impunere: tDoc("tipDecizie"),
    somatie: tDoc("tipSomatie"),
    certificat_atestare: tDoc("tipCertificat"),
    adeverinta_fiscala: tDoc("tipAdeverinta"),
    borderou_incasari: tDoc("tipBorderou"),
    titlu_executoriu: tDoc("tipTitluExecutoriu"),
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("myDocuments")}</h1>

      <Card>
        <CardContent className="pt-6">
          {documents.length === 0 ? (
            <div className="py-8 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">{t("noDocuments")}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tDoc("docType")}</TableHead>
                  <TableHead>{tDoc("docNumber")}</TableHead>
                  <TableHead>{tDoc("generatedAt")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">
                      {docTypeLabels[doc.tip] || doc.tip}
                    </TableCell>
                    <TableCell>{doc.numarDocument}</TableCell>
                    <TableCell>{formatDate(doc.dataDocument)}</TableCell>
                    <TableCell>
                      <Badge variant={doc.semnat ? "default" : "outline"}>
                        {doc.semnat ? tDoc("signed") : tDoc("unsigned")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {doc.fileUrl && (
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/api/documents/${doc.id}/download`}>
                            <Download className="h-4 w-4 mr-1" />
                            {tDoc("download")}
                          </Link>
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
