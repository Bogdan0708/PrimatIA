CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_type" VARCHAR(20) NOT NULL,
    "tenant_user_id" UUID,
    "citizen_user_id" UUID,
    "email" VARCHAR(255) NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "used_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");
CREATE INDEX "password_reset_tokens_tenant_id_user_type_email_idx" ON "password_reset_tokens"("tenant_id", "user_type", "email");
CREATE INDEX "password_reset_tokens_tenant_user_id_idx" ON "password_reset_tokens"("tenant_user_id");
CREATE INDEX "password_reset_tokens_citizen_user_id_idx" ON "password_reset_tokens"("citizen_user_id");

ALTER TABLE "password_reset_tokens"
    ADD CONSTRAINT "password_reset_tokens_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "password_reset_tokens"
    ADD CONSTRAINT "password_reset_tokens_tenant_user_id_fkey"
    FOREIGN KEY ("tenant_user_id") REFERENCES "tenant_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "password_reset_tokens"
    ADD CONSTRAINT "password_reset_tokens_citizen_user_id_fkey"
    FOREIGN KEY ("citizen_user_id") REFERENCES "citizen_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
