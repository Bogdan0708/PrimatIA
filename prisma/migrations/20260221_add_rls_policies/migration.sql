-- F-004: PrimatIA database-level RLS policies for tenant isolation
-- Uses app.current_tenant_id set by withTenantScope()/setTenantContext().

DO $$
DECLARE
  tenant_table text;
  policy_name text;
BEGIN
  FOREACH tenant_table IN ARRAY ARRAY[
    'tenant_users',
    'adrese',
    'zone_fiscale',
    'contribuabili',
    'proprietati_cladiri',
    'proprietati_terenuri',
    'proprietati_vehicule',
    'hcl_decisions',
    'tax_rate_tables',
    'scutiri_reguli',
    'scutiri_contribuabil',
    'impozite',
    'plati',
    'plati_distributie',
    'documente',
    'somatii',
    'consimtaminte',
    'penalitati',
    'proprietati_detinatori',
    'import_batches',
    'import_row_ledgers',
    'audit_logs',
    'export_jobs',
    'citizen_users',
    'password_reset_tokens',
    'citizen_contribuabil_links',
    'certificate_requests',
    'notificari',
    'online_payments',
    'stripe_webhook_events',
    'contact_messages',
    'chitanta_sequences'
  ]
  LOOP
    policy_name := tenant_table || '_tenant_isolation';

    IF to_regclass(format('public.%I', tenant_table)) IS NOT NULL THEN
      EXECUTE format(
        'ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',
        'public',
        tenant_table
      );
      EXECUTE format(
        'ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY',
        'public',
        tenant_table
      );

      EXECUTE format(
        'DROP POLICY IF EXISTS %I ON %I.%I',
        policy_name,
        'public',
        tenant_table
      );

      EXECUTE format(
        'CREATE POLICY %I ON %I.%I
          FOR ALL
          USING (tenant_id = current_setting(''app.current_tenant_id'', true)::uuid)
          WITH CHECK (tenant_id = current_setting(''app.current_tenant_id'', true)::uuid)',
        policy_name,
        'public',
        tenant_table
      );
    END IF;
  END LOOP;
END
$$;

-- Ensure the application DB role cannot bypass RLS.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'primaria_app') THEN
    ALTER ROLE primaria_app NOBYPASSRLS;
  END IF;
END
$$;
