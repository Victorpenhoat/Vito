-- Sonde d'existence de compte, pour le lien magique (lot 1 « mails », tâche 6
-- corrigée après revue).
--
-- Le fait qui a manqué la première fois : `generateLink` (Admin API) CRÉE le
-- compte pour `type: 'magiclink'` (comme pour 'signup' et 'invite') — voir
-- node_modules/@supabase/auth-js/dist/module/GoTrueAdminApi.d.ts. C'est une
-- opération privilégiée qui contourne délibérément `enable_signup = false`.
-- L'appeler pour une adresse inconnue provisionnait donc un compte, exactement
-- ce que l'inscription sur invitation interdit.
--
-- La parade : vérifier AVANT d'appeler generateLink, jamais après. `listUsers`
-- ne filtre pas par email (pagination seule) — une fonction SQL est le seul
-- moyen de poser la question sans lister tout le monde.
--
-- Cette fonction est elle-même une cible : une sonde d'existence de compte
-- accessible depuis le navigateur EST un endpoint d'énumération, la chose même
-- que le lien magique doit empêcher. Elle ne doit donc être exécutable que par
-- le rôle de service (l'admin client de lienMagique.ts), jamais par anon ni
-- authenticated — voir les assertions pgTAP plus bas.
create or replace function public.compte_existe(p_email text) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from auth.users where lower(email) = lower(p_email));
$$;

-- `revoke ... from public` ne suffit PAS : Supabase accorde EXECUTE à anon et
-- authenticated par défaut sur toute fonction créée dans public (leçon de
-- 00060_quotas.sql, où le choix inverse — laisser passer, refuser à
-- l'intérieur — était voulu ; ici il ne l'est pas, donc revoke explicite).
revoke all on function public.compte_existe(text) from public;
revoke execute on function public.compte_existe(text) from anon, authenticated;
-- Redondant avec le grant par défaut (service_role l'a déjà), mais explicite :
-- c'est le seul appelant voulu, et c'est lui qui exécute l'admin client.
grant execute on function public.compte_existe(text) to service_role;
