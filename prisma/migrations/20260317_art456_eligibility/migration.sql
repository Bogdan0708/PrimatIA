-- Art. 456 Auto-Eligibility Detection: add demographic flags to contribuabili
-- and property-level flags to buildings and land

-- Contribuabil eligibility flags
ALTER TABLE "contribuabili" ADD COLUMN "handicap_grav" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "contribuabili" ADD COLUMN "handicap_cert_nr" VARCHAR(50);
ALTER TABLE "contribuabili" ADD COLUMN "handicap_cert_exp" DATE;
ALTER TABLE "contribuabili" ADD COLUMN "veteran_razboi" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "contribuabili" ADD COLUMN "vaduva_veteran" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "contribuabili" ADD COLUMN "erou_revolutie" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "contribuabili" ADD COLUMN "organizatie_nonpro" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "contribuabili" ADD COLUMN "pensionar" BOOLEAN NOT NULL DEFAULT false;

-- Building property flags
ALTER TABLE "proprietati_cladiri" ADD COLUMN "is_cult_religios" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "proprietati_cladiri" ADD COLUMN "is_monument_istoric" BOOLEAN NOT NULL DEFAULT false;

-- Land property flags
ALTER TABLE "proprietati_terenuri" ADD COLUMN "is_cult_religios" BOOLEAN NOT NULL DEFAULT false;

-- Deduplicate any existing rows before adding the constraint.
-- Keep the newest row per logical key, with id as a deterministic tie-breaker.
WITH ranked_duplicates AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY
        tenant_id,
        contribuabil_id,
        scutire_regula_id,
        fiscal_year,
        proprietate_type,
        proprietate_id
      ORDER BY created_at DESC, id DESC
    ) AS row_num
  FROM "scutiri_contribuabil"
)
DELETE FROM "scutiri_contribuabil"
WHERE id IN (
  SELECT id
  FROM ranked_duplicates
  WHERE row_num > 1
);

-- Unique constraint to prevent duplicate exemptions (race-condition protection).
-- NULLS NOT DISTINCT ensures (NULL, NULL) is treated as equal so taxpayer-scope
-- exemptions (where proprietate_type and proprietate_id are both NULL) are
-- also protected against duplicates.
CREATE UNIQUE INDEX "scutiri_contribuabil_dedup_idx"
  ON "scutiri_contribuabil" ("tenant_id", "contribuabil_id", "scutire_regula_id", "fiscal_year", "proprietate_type", "proprietate_id")
  NULLS NOT DISTINCT;
