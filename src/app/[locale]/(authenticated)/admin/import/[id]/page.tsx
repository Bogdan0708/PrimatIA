import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  getImportBatchById,
  getRollbackPreview,
} from "../_actions/import-actions";
import { RollbackControls } from "./_components/rollback-controls";

export default async function ImportBatchDetailPage({
  params,
}: {
  params: { id: string };
}) {
  await requireAdmin();
  const t = await getTranslations("import");
  const tCommon = await getTranslations("common");
  const locale = await getLocale();
  const localePrefix = `/${locale}`;

  const batch = await getImportBatchById(params.id);
  if (!batch) notFound();
  const preview = await getRollbackPreview(params.id);
  if (!preview.success || !preview.data) notFound();

  const counts = preview.data.countsByEntity;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{batch.filename}</h1>
        <Link href={`${localePrefix}/admin/import`}>
          <Button variant="outline">{tCommon("back")}</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("status")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("entityType")}</span>
            <span>{batch.entityType}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("totalRows")}</span>
            <span>{batch.totalRows}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("importedRows")}</span>
            <span>{batch.importedRows}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("errorRows")}</span>
            <span>{batch.errorRows}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("status")}</span>
            <span>{batch.status}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("rollbackImpact")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("rollbackRecords")}</span>
            <span>{preview.data.importedRecords}</span>
          </div>
          <div className="grid gap-1 text-xs">
            <div>Contribuabili: {counts.contribuabil}</div>
            <div>Clădiri: {counts.proprietate_cladire}</div>
            <div>Terenuri: {counts.proprietate_teren}</div>
            <div>Vehicule: {counts.proprietate_vehicul}</div>
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">{t("sampleRecords")}</p>
            {preview.data.sampleRecordIds.length === 0 ? (
              <p className="text-xs text-muted-foreground">-</p>
            ) : (
              <ul className="space-y-1">
                {preview.data.sampleRecordIds.map((id) => (
                  <li key={id} className="font-mono text-xs">
                    {id}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("rollback")}</CardTitle>
        </CardHeader>
        <CardContent>
          <RollbackControls batchId={batch.id} canRollback={preview.data.canRollback} />
        </CardContent>
      </Card>
    </div>
  );
}

