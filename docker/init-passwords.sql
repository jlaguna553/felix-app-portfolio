-- Runs during first DB initialization (supabase/postgres migrate.sh hook).
-- Password must match POSTGRES_PASSWORD in .env.docker.

-- Service account passwords
ALTER USER supabase_auth_admin    WITH PASSWORD 'postgres';
ALTER USER supabase_storage_admin WITH PASSWORD 'postgres';
ALTER USER authenticator          WITH PASSWORD 'postgres';
ALTER USER pgbouncer              WITH PASSWORD 'postgres';

-- Schema required by Supabase Realtime
CREATE SCHEMA IF NOT EXISTS _realtime;
GRANT ALL ON SCHEMA _realtime TO postgres;
