-- AlterTable: Add reversal/storno fields to plati
ALTER TABLE "plati" ADD COLUMN "reversal_status" VARCHAR(20);
ALTER TABLE "plati" ADD COLUMN "reversed_at" TIMESTAMPTZ;
ALTER TABLE "plati" ADD COLUMN "reversed_by" UUID;
ALTER TABLE "plati" ADD COLUMN "reversal_reason" VARCHAR(500);
ALTER TABLE "plati" ADD COLUMN "original_plata_id" UUID;

-- AddForeignKey
ALTER TABLE "plati" ADD CONSTRAINT "plati_reversed_by_fkey" FOREIGN KEY ("reversed_by") REFERENCES "tenant_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey (self-referencing for storno link)
ALTER TABLE "plati" ADD CONSTRAINT "plati_original_plata_id_fkey" FOREIGN KEY ("original_plata_id") REFERENCES "plati"("id") ON DELETE SET NULL ON UPDATE CASCADE;
