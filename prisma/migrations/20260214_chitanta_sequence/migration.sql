CREATE TABLE "chitanta_sequences" (
    "tenant_id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "current_val" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "chitanta_sequences_pkey" PRIMARY KEY ("tenant_id","year"),
    CONSTRAINT "chitanta_sequences_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
