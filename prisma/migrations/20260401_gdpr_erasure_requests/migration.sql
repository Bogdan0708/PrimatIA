-- GDPR Art. 17 — Right to Erasure request tracking

CREATE TABLE "gdpr_erasure_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "citizen_user_id" UUID NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "reason" VARCHAR(500),
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMPTZ,
    "review_note" VARCHAR(500),
    "completed_at" TIMESTAMPTZ,
    "anonymized_data" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gdpr_erasure_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "gdpr_erasure_requests_tenant_id_status_idx"
    ON "gdpr_erasure_requests" ("tenant_id", "status");

CREATE INDEX "gdpr_erasure_requests_citizen_user_id_idx"
    ON "gdpr_erasure_requests" ("citizen_user_id");

ALTER TABLE "gdpr_erasure_requests"
    ADD CONSTRAINT "gdpr_erasure_requests_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "gdpr_erasure_requests"
    ADD CONSTRAINT "gdpr_erasure_requests_citizen_user_id_fkey"
    FOREIGN KEY ("citizen_user_id") REFERENCES "citizen_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enable RLS
ALTER TABLE "gdpr_erasure_requests" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gdpr_erasure_requests_tenant_isolation"
    ON "gdpr_erasure_requests"
    USING (tenant_id::text = current_setting('app.current_tenant_id', true));
