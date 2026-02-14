import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileOutput } from "lucide-react";
import { DocumentGeneratorDashboard } from "./_components/document-generator-dashboard";

export default async function GenerareDocumentePage() {
  await requireAdmin();
  const t = await getTranslations("documentGenerate");

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
      <p className="text-muted-foreground">{t("description")}</p>
      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <FileOutput className="h-5 w-5" />
          <CardTitle className="text-lg">{t("generateDocument")}</CardTitle>
        </CardHeader>
        <CardContent>
          <DocumentGeneratorDashboard />
        </CardContent>
      </Card>
    </div>
  );
}
