-- CreateTable
CREATE TABLE "document_sequences" (
    "tenant_id" UUID NOT NULL,
    "prefix" VARCHAR(10) NOT NULL,
    "year" INTEGER NOT NULL,
    "current_val" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "document_sequences_pkey" PRIMARY KEY ("tenant_id","prefix","year")
);

-- AddForeignKey
ALTER TABLE "document_sequences" ADD CONSTRAINT "document_sequences_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill sequences from existing documents so numbering continues where it left off
INSERT INTO "document_sequences" ("tenant_id", "prefix", "year", "current_val")
SELECT
  d."tenant_id",
  CASE
    WHEN d."tip" = 'decizie_impunere' THEN 'DI'
    WHEN d."tip" = 'somatie' THEN 'SM'
    WHEN d."tip" = 'certificat_atestare' THEN 'CA'
    WHEN d."tip" = 'chitanta' THEN 'CH'
    WHEN d."tip" = 'borderou_incasari' THEN 'BI'
    ELSE UPPER(LEFT(d."tip", 2))
  END AS prefix,
  EXTRACT(YEAR FROM d."data_document")::int AS year,
  COUNT(*)::int AS current_val
FROM "documente" d
WHERE d."numar_document" IS NOT NULL
GROUP BY d."tenant_id", prefix, year
ON CONFLICT ("tenant_id", "prefix", "year") DO NOTHING;
