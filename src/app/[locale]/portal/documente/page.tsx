import { requireCitizenAuth } from "@/lib/portal-auth";
import { prisma, setTenantContext } from "@/lib/db";
import { getTranslations } from "next-intl/server";
import { formatDate } from "@/lib/formatting";
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
import { Download, FileText, FileCheck, Receipt, AlertTriangle } from "lucide-react";

const DOC_GROUPS = [
  {
    key: "assessments",
    labelKey: "groupAssessments",
    icon: FileText,
    types: ["decizie_impunere"],
  },
  {
    key: "receipts",
    labelKey: "groupReceipts",
    icon: Receipt,
    types: ["chitanta", "borderou_incasari"],
  },
  {
    key: "certificates",
    labelKey: "groupCertificates",
    icon: FileCheck,
    types: ["certificat_atestare", "adeverinta_fiscala"],
  },
  {
    key: "enforcement",
    labelKey: "groupEnforcement",
    icon: AlertTriangle,
    types: ["somatie", "titlu_executoriu"],
  },
] as const;

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
    take: 100,
  });

  const docTypeLabels: Record<string, string> = {
    decizie_impunere: tDoc("tipDecizie"),
    somatie: tDoc("tipSomatie"),
    certificat_atestare: tDoc("tipCertificat"),
    adeverinta_fiscala: tDoc("tipAdeverinta"),
    borderou_incasari: tDoc("tipBorderou"),
    titlu_executoriu: tDoc("tipTitluExecutoriu"),
    chitanta: tDoc("tipChitanta"),
  };

  // Group documents by category
  const grouped = DOC_GROUPS.map((group) => ({
    ...group,
    label: tDoc(group.labelKey),
    docs: documents.filter((d) => (group.types as readonly string[]).includes(d.tip)),
  }));

  // Any documents not matching a group
  const allGroupTypes: string[] = DOC_GROUPS.flatMap((g) => [...g.types]);
  const ungrouped = documents.filter((d) => !allGroupTypes.includes(d.tip));

  const hasAnyDocs = documents.length > 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("myDocuments")}</h1>

      {!hasAnyDocs ? (
        <Card>
          <CardContent className="py-8 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">{t("noDocuments")}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {grouped.map((group) => {
            if (group.docs.length === 0) return null;
            const Icon = group.icon;
            return (
              <Card key={group.key}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                    {group.label}
                    <Badge variant="secondary" className="ml-auto text-xs">
                      {group.docs.length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
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
                      {group.docs.map((doc) => (
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
                </CardContent>
              </Card>
            );
          })}

          {ungrouped.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  {tDoc("title")}
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {ungrouped.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
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
                    {ungrouped.map((doc) => (
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
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
