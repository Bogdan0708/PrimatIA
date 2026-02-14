import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileSearch } from "lucide-react";
import { DocumentImportForm } from "./_components/document-import-form";

export default async function ImportDocumentePage() {
  await requireAdmin();
  const t = await getTranslations("documentImport");

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
      <p className="text-muted-foreground">{t("description")}</p>
      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <FileSearch className="h-5 w-5" />
          <CardTitle className="text-lg">{t("importDocument")}</CardTitle>
        </CardHeader>
        <CardContent>
          <DocumentImportForm />
        </CardContent>
      </Card>
    </div>
  );
}
