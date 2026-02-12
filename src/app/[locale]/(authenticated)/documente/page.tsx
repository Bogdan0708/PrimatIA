import { getTranslations } from "next-intl/server";
import { requireStaff } from "@/lib/auth-utils";
import Link from "next/link";
import { ChevronLeft, ChevronRight, FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getDocuments, getDocumentDownloadUrl } from "./_actions/document-actions";

export default async function DocumentePage({
  searchParams,
}: {
  searchParams: { page?: string; tip?: string };
}) {
  await requireStaff();
  const t = await getTranslations("document");
  const tc = await getTranslations("common");

  const currentPage = searchParams.page ? parseInt(searchParams.page) : 1;
  const result = await getDocuments({
    page: currentPage,
    tip: searchParams.tip,
  });

  const buildFilterUrl = (params: Record<string, string | undefined>) => {
    const urlParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) urlParams.set(key, value);
    });
    const qs = urlParams.toString();
    return `/documente${qs ? `?${qs}` : ""}`;
  };

  const buildPageUrl = (page: number) => {
    const urlParams = new URLSearchParams();
    if (searchParams.tip) urlParams.set("tip", searchParams.tip);
    if (page > 1) urlParams.set("page", page.toString());
    const qs = urlParams.toString();
    return `/documente${qs ? `?${qs}` : ""}`;
  };

  const from = result.total === 0 ? 0 : (currentPage - 1) * result.perPage + 1;
  const to = Math.min(currentPage * result.perPage, result.total);

  const tipLabel = (tip: string) => {
    const labels: Record<string, string> = {
      decizie_impunere: t("tipDecizie"),
      somatie: t("tipSomatie"),
      certificat_atestare: t("tipCertificat"),
      chitanta: t("tipChitanta"),
      borderou_incasari: t("tipBorderou"),
      adeverinta_fiscala: t("tipAdeverinta"),
      titlu_executoriu: t("tipTitluExecutoriu"),
    };
    return labels[tip] || tip;
  };

  const documentTypes = [
    "decizie_impunere",
    "somatie",
    "certificat_atestare",
    "chitanta",
    "borderou_incasari",
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="flex rounded-md border border-input">
          <Link href={buildFilterUrl({})}>
            <Button
              variant={!searchParams.tip ? "default" : "ghost"}
              size="sm"
              className="rounded-r-none"
            >
              {tc("total")}
            </Button>
          </Link>
          {documentTypes.map((dt, i) => (
            <Link key={dt} href={buildFilterUrl({ tip: dt })}>
              <Button
                variant={searchParams.tip === dt ? "default" : "ghost"}
                size="sm"
                className={
                  i < documentTypes.length - 1
                    ? "rounded-none border-x"
                    : "rounded-l-none"
                }
              >
                {tipLabel(dt)}
              </Button>
            </Link>
          ))}
        </div>
      </div>

      {result.items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{tc("noResults")}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="h-12 px-4 text-left font-medium">{t("docNumber")}</th>
                  <th className="h-12 px-4 text-left font-medium">{t("docType")}</th>
                  <th className="h-12 px-4 text-left font-medium">{t("taxpayer")}</th>
                  <th className="h-12 px-4 text-left font-medium">{t("generatedAt")}</th>
                  <th className="h-12 px-4 text-left font-medium">{tc("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((item) => (
                  <tr key={item.id} className="border-b transition-colors hover:bg-muted/50">
                    <td className="p-4 font-mono text-xs">{item.numarDocument}</td>
                    <td className="p-4">
                      <Badge variant="outline">{tipLabel(item.tip)}</Badge>
                    </td>
                    <td className="p-4 font-medium">
                      {item.contribuabilName ? (
                        <Link
                          href={`/contribuabili/${item.contribuabilId}`}
                          className="hover:underline text-primary"
                        >
                          {item.contribuabilName}
                        </Link>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="p-4">
                      {new Date(item.createdAt).toLocaleDateString("ro-RO")}
                    </td>
                    <td className="p-4">
                      <DownloadButton documentId={item.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {from}-{to} / {result.total}
            </p>
            <div className="flex items-center gap-2">
              <p className="text-sm text-muted-foreground">
                {currentPage} / {result.totalPages}
              </p>
              {currentPage > 1 ? (
                <Link href={buildPageUrl(currentPage - 1)}>
                  <Button variant="outline" size="icon">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                </Link>
              ) : (
                <Button variant="outline" size="icon" disabled>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              )}
              {currentPage < result.totalPages ? (
                <Link href={buildPageUrl(currentPage + 1)}>
                  <Button variant="outline" size="icon">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              ) : (
                <Button variant="outline" size="icon" disabled>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

async function DownloadButton({ documentId }: { documentId: string }) {
  const result = await getDocumentDownloadUrl(documentId);
  if (!result.success || !result.data) return null;
  return (
    <a href={result.data.url} target="_blank" rel="noopener noreferrer">
      <Button variant="ghost" size="sm">
        <Download className="mr-2 h-4 w-4" />
        PDF
      </Button>
    </a>
  );
}
