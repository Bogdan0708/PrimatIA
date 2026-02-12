import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth-utils";
import { FileSpreadsheet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getImportBatches } from "./_actions/import-actions";
import { ImportUpload } from "./_components/import-upload";

export default async function ImportPage() {
  await requireAdmin();
  const t = await getTranslations("import");
  const tc = await getTranslations("common");

  const batches = await getImportBatches();

  const statusVariant = (s: string) => {
    switch (s) {
      case "completed": return "default" as const;
      case "completed_with_errors": return "secondary" as const;
      case "failed": return "destructive" as const;
      case "rolled_back": return "outline" as const;
      case "processing": return "secondary" as const;
      default: return "outline" as const;
    }
  };

  const statusLabel = (s: string) => {
    switch (s) {
      case "completed": return t("completed");
      case "completed_with_errors": return t("completed") + " (!)";
      case "failed": return t("failed");
      case "rolled_back": return t("rolledBack");
      case "processing": return t("importing");
      default: return s;
    }
  };

  const entityLabel = (e: string) => {
    switch (e) {
      case "contribuabil": return "Contribuabili";
      case "proprietate_cladire": return "Cl\u0103diri";
      case "proprietate_teren": return "Terenuri";
      case "proprietate_vehicul": return "Vehicule";
      default: return e;
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>

      <ImportUpload />

      {/* Batch history */}
      {batches.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileSpreadsheet className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{tc("noResults")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="h-12 px-4 text-left font-medium">{t("entityType")}</th>
                <th className="h-12 px-4 text-left font-medium">Fi\u0219ier</th>
                <th className="h-12 px-4 text-left font-medium">{t("totalRows")}</th>
                <th className="h-12 px-4 text-left font-medium">{t("importedRows")}</th>
                <th className="h-12 px-4 text-left font-medium">{t("errorRows")}</th>
                <th className="h-12 px-4 text-left font-medium">{t("status")}</th>
                <th className="h-12 px-4 text-left font-medium">Importat de</th>
                <th className="h-12 px-4 text-left font-medium">Data</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((batch) => (
                <tr key={batch.id} className="border-b transition-colors hover:bg-muted/50">
                  <td className="p-4">{entityLabel(batch.entityType)}</td>
                  <td className="p-4 font-mono text-xs">{batch.filename}</td>
                  <td className="p-4">{batch.totalRows}</td>
                  <td className="p-4">{batch.importedRows}</td>
                  <td className="p-4">{batch.errorRows > 0 ? <span className="text-destructive font-medium">{batch.errorRows}</span> : "0"}</td>
                  <td className="p-4"><Badge variant={statusVariant(batch.status)}>{statusLabel(batch.status)}</Badge></td>
                  <td className="p-4">{batch.importedBy ? `${batch.importedBy.firstName} ${batch.importedBy.lastName}` : "-"}</td>
                  <td className="p-4 text-xs">{new Date(batch.createdAt).toLocaleString("ro-RO")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
