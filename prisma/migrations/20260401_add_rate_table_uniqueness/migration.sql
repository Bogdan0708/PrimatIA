-- Replace the existing index with a unique constraint on tax_rate_tables.
-- Prevents duplicate rate entries for the same tenant/HCL/taxType/category/zone combination.

DROP INDEX IF EXISTS "tax_rate_tables_tenant_id_hcl_decision_id_tax_type_category_idx";

CREATE UNIQUE INDEX "tax_rate_tables_tenant_id_hcl_decision_id_tax_type_category_zon"
  ON "tax_rate_tables" ("tenant_id", "hcl_decision_id", "tax_type", "category", "zona");
