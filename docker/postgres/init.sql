-- PrimărIA - PostgreSQL Initialization Script
-- Runs once when the container is first created (via docker-entrypoint-initdb.d)
-- The database "primaria" is already created by POSTGRES_DB env var.

-- ============================================================
-- Extensions
-- ============================================================
\c primaria;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- Roles
-- ============================================================

-- Application role: used by the Next.js app via PgBouncer.
-- NO BYPASSRLS so every query is subject to row-level security.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'primaria_app') THEN
    CREATE ROLE primaria_app LOGIN PASSWORD 'primaria_dev_password' NOBYPASSRLS;
  END IF;
END
$$;

-- Admin role: used for migrations and administrative tasks.
-- BYPASSRLS so migrations can touch any row.
-- (primaria_admin already exists as the POSTGRES_USER; ensure BYPASSRLS is set)
ALTER ROLE primaria_admin BYPASSRLS;

-- Service role: used by background workers, cron jobs, webhooks.
-- BYPASSRLS so it can operate across tenants when needed.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'primaria_service') THEN
    CREATE ROLE primaria_service LOGIN PASSWORD 'primaria_dev_password' BYPASSRLS;
  END IF;
END
$$;

-- ============================================================
-- Permissions
-- ============================================================

-- Allow all three roles to connect to the primaria database
GRANT CONNECT ON DATABASE primaria TO primaria_app;
GRANT CONNECT ON DATABASE primaria TO primaria_service;

-- Schema permissions (public schema)
GRANT USAGE ON SCHEMA public TO primaria_app;
GRANT USAGE ON SCHEMA public TO primaria_service;
GRANT ALL   ON SCHEMA public TO primaria_admin;

-- Default privileges: ensure future tables/sequences are accessible
ALTER DEFAULT PRIVILEGES FOR ROLE primaria_admin IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO primaria_app;

ALTER DEFAULT PRIVILEGES FOR ROLE primaria_admin IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO primaria_service;

ALTER DEFAULT PRIVILEGES FOR ROLE primaria_admin IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO primaria_app;

ALTER DEFAULT PRIVILEGES FOR ROLE primaria_admin IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO primaria_service;
