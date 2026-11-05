-- Shut the Supabase Data API off this schema.
--
-- WHY THIS EXISTS
--
-- Supabase exposes the `public` schema through PostgREST and grants the `anon`
-- and `authenticated` roles full DML on every table in it, including tables
-- created later by a migration. The `anon` key is a *public* credential by
-- design — it ships to browsers. With RLS disabled, that combination meant
-- every table in this database was readable AND writable by anyone holding a
-- key that is meant to be public:
--
--   GET  /rest/v1/user    -> 200
--   GET  /rest/v1/session -> 200
--   GET  /rest/v1/account -> 200
--   POST /rest/v1/food    -> 400 PGRST204   (a *column* error, not a denial)
--
-- This was missed on the first pass because Prisma connects as the table owner,
-- so `auth.uid()` is always null and an owner-path RLS policy can never match.
-- That reasoning was right about the Prisma path and wrong about the database:
-- PostgREST is a second door into the same tables, and it does not care which
-- ORM we chose. Access control cannot be argued from our own query path when
-- another path exists.
--
-- WHAT THIS DOES
--
-- Three layers, because any one of them alone is a single point of failure:
--
--   1. Revoke the grants, so the roles cannot reach the tables at all.
--   2. Change DEFAULT PRIVILEGES, so tables added by future migrations are not
--      silently granted the same access. Without this, step 1 fixes today and
--      regresses on the next `prisma migrate`.
--   3. Enable RLS with NO policies, which is deny-all. This is the backstop if
--      a grant is ever restored by hand or by the platform.
--
-- The app is unaffected: Prisma connects as `postgres` (rolbypassrls = true)
-- and Storage uses the service-role key, which bypasses RLS by design. Nothing
-- in this project ever talks to the Data API — the browser never receives a
-- Supabase credential, and meal photos are proxied through our own route
-- handler for exactly this reason.
--
-- If a client-side Supabase path is ever wanted, the work is to add real
-- policies for the specific tables involved, not to undo this file.

-- 1. Take the grants away from the two public-facing roles.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', r.tablename);
  END LOOP;
END $$;

REVOKE ALL ON SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;

-- 2. Stop the grant being re-applied to tables created from now on.
--    Both grantors matter: objects created by `postgres` (our migrations) and
--    by `supabase_admin` (the platform) carry separate default ACLs.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON FUNCTIONS FROM anon, authenticated;

-- 3. Deny-all RLS as the backstop. No policies are created on purpose: a table
--    with RLS enabled and no policy denies every non-bypassing role, which is
--    precisely the intent. The owner and service_role still read and write.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;
