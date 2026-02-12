-- PrimărIA: Row-Level Security policies
-- Applied AFTER Prisma schema migrations
-- All tenant-scoped tables use the same pattern

-- Enable RLS on all tenant-scoped tables
ALTER TABLE tenant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE adrese ENABLE ROW LEVEL SECURITY;
ALTER TABLE zone_fiscale ENABLE ROW LEVEL SECURITY;
ALTER TABLE contribuabili ENABLE ROW LEVEL SECURITY;
ALTER TABLE proprietati_cladiri ENABLE ROW LEVEL SECURITY;
ALTER TABLE proprietati_terenuri ENABLE ROW LEVEL SECURITY;
ALTER TABLE proprietati_vehicule ENABLE ROW LEVEL SECURITY;
ALTER TABLE hcl_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_rate_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE scutiri_reguli ENABLE ROW LEVEL SECURITY;
ALTER TABLE scutiri_contribuabil ENABLE ROW LEVEL SECURITY;
ALTER TABLE impozite ENABLE ROW LEVEL SECURITY;
ALTER TABLE plati ENABLE ROW LEVEL SECURITY;
ALTER TABLE plati_distributie ENABLE ROW LEVEL SECURITY;
ALTER TABLE documente ENABLE ROW LEVEL SECURITY;
ALTER TABLE somatii ENABLE ROW LEVEL SECURITY;
ALTER TABLE consimtaminte ENABLE ROW LEVEL SECURITY;
ALTER TABLE penalitati ENABLE ROW LEVEL SECURITY;
ALTER TABLE proprietati_detinatori ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Standard tenant isolation policies (FOR ALL: SELECT, INSERT, UPDATE, DELETE)
CREATE POLICY tenant_isolation ON tenant_users FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID AND deleted_at IS NULL);

CREATE POLICY tenant_isolation ON adrese FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation ON zone_fiscale FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation ON contribuabili FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID AND deleted_at IS NULL);

CREATE POLICY tenant_isolation ON proprietati_cladiri FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID AND deleted_at IS NULL);

CREATE POLICY tenant_isolation ON proprietati_terenuri FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID AND deleted_at IS NULL);

CREATE POLICY tenant_isolation ON proprietati_vehicule FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID AND deleted_at IS NULL);

CREATE POLICY tenant_isolation ON hcl_decisions FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation ON tax_rate_tables FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation ON scutiri_reguli FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation ON scutiri_contribuabil FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation ON impozite FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation ON plati FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation ON plati_distributie FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation ON documente FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation ON somatii FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation ON consimtaminte FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation ON penalitati FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation ON proprietati_detinatori FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation ON import_batches FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Audit logs: INSERT + SELECT only (immutable)
CREATE POLICY audit_logs_insert ON audit_logs FOR INSERT
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY audit_logs_select ON audit_logs FOR SELECT
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
-- No UPDATE or DELETE policies — audit logs are immutable

-- Additional indexes for performance
CREATE INDEX IF NOT EXISTS idx_contribuabili_cnp_hash ON contribuabili(tenant_id, cnp_hash) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contribuabili_cui ON contribuabili(tenant_id, cui) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contribuabili_search ON contribuabili USING gin(
    to_tsvector('romanian', coalesce(nume,'') || ' ' || coalesce(prenume,'') || ' ' || coalesce(cui,''))
) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_cladiri_contribuabil ON proprietati_cladiri(tenant_id, contribuabil_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cladiri_zona ON proprietati_cladiri(tenant_id, zona, destinatie) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_terenuri_contribuabil ON proprietati_terenuri(tenant_id, contribuabil_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_vehicule_contribuabil ON proprietati_vehicule(tenant_id, contribuabil_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_vehicule_nr ON proprietati_vehicule(tenant_id, numar_inmatriculare) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_hcl_fiscal_year ON hcl_decisions(tenant_id, fiscal_year, status);
CREATE INDEX IF NOT EXISTS idx_rate_tables_lookup ON tax_rate_tables(tenant_id, hcl_decision_id, tax_type, category, zona);

CREATE INDEX IF NOT EXISTS idx_impozite_contribuabil ON impozite(tenant_id, contribuabil_id, fiscal_year);
CREATE INDEX IF NOT EXISTS idx_impozite_restante ON impozite(tenant_id, fiscal_year) WHERE suma_platita < suma_datorata;

CREATE INDEX IF NOT EXISTS idx_plati_contribuabil ON plati(tenant_id, contribuabil_id, data_plata);
CREATE INDEX IF NOT EXISTS idx_plati_nedistribuite ON plati(tenant_id) WHERE distribuit = false;

CREATE INDEX IF NOT EXISTS idx_somatii_contribuabil ON somatii(tenant_id, contribuabil_id);
CREATE INDEX IF NOT EXISTS idx_somatii_status ON somatii(tenant_id, status, termen_plata);

CREATE INDEX IF NOT EXISTS idx_penalitati_impozit ON penalitati(tenant_id, impozit_id, data_calcul);
CREATE INDEX IF NOT EXISTS idx_detinatori_proprietate ON proprietati_detinatori(proprietate_type, proprietate_id);
CREATE INDEX IF NOT EXISTS idx_detinatori_contribuabil ON proprietati_detinatori(tenant_id, contribuabil_id);

CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(tenant_id, entity_type, entity_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(tenant_id, user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_documente_contribuabil ON documente(tenant_id, contribuabil_id, tip);
CREATE INDEX IF NOT EXISTS idx_documente_numar ON documente(tenant_id, numar_document);
