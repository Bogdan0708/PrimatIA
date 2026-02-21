CREATE TABLE IF NOT EXISTS "stripe_webhook_events" (
    "tenant_id" UUID NOT NULL,
    "stripe_event_id" VARCHAR(255) NOT NULL,
    "gateway_ref" VARCHAR(255),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stripe_webhook_events_pkey" PRIMARY KEY ("stripe_event_id")
);

CREATE INDEX IF NOT EXISTS "stripe_webhook_events_tenant_id_created_at_idx"
ON "stripe_webhook_events"("tenant_id", "created_at");

WITH ranked_events AS (
    SELECT
        id,
        stripe_event_id,
        ROW_NUMBER() OVER (
            PARTITION BY stripe_event_id
            ORDER BY confirmed_at DESC NULLS LAST, initiated_at DESC, id
        ) AS rn
    FROM online_payments
    WHERE stripe_event_id IS NOT NULL
)
UPDATE online_payments op
SET stripe_event_id = NULL
FROM ranked_events re
WHERE op.id = re.id
  AND re.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "online_payments_stripe_event_id_key"
ON "online_payments"("stripe_event_id");
