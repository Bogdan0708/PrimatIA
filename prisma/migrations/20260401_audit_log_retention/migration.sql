-- Add expires_at field to audit_logs for retention policy (7 years per Romanian fiscal law)

ALTER TABLE "audit_logs" ADD COLUMN "expires_at" TIMESTAMPTZ;

-- Backfill: set expiry for existing logs to 7 years from creation
UPDATE "audit_logs" SET "expires_at" = "created_at" + INTERVAL '7 years' WHERE "expires_at" IS NULL;

-- Index for efficient cleanup queries
CREATE INDEX "audit_logs_expires_at_idx" ON "audit_logs" ("expires_at");
