-- DÉFENSE EN PROFONDEUR (audit 04/07) : anon avait tous les privilèges de table
-- (héritage des default privileges Supabase) sur des données 100% owner-scoped.
-- La RLS bloque déjà anon (0 ligne / write refusé), mais le grant est une surface
-- inutile : une future table sans RLS ou une policy trop permissive exposerait anon.
-- Vérifié : aucune lecture de table en contexte anon (landing/auth n'utilisent que
-- supabase.auth.*, les data/queries sont sous guard getUser + layout (app) authentifié).
revoke all on all tables in schema public from anon;
-- Empêche les futures tables (créées par les migrations, rôle postgres) de re-hériter.
alter default privileges in schema public revoke all on tables from anon;
