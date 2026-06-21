-- GRANTS de table explicites pour le rôle `authenticated`.
--
-- La RLS restreint l'accès ligne par ligne mais ne suffit PAS : PostgREST exige
-- aussi les privilèges de table (GRANT) pour le rôle utilisé. Les versions récentes
-- de Supabase (et les projets hébergés) n'accordent plus ces privilèges
-- automatiquement aux rôles anon/authenticated — sinon « permission denied for
-- table » (42501). On accorde donc explicitement à `authenticated` les privilèges
-- correspondant aux policies RLS (lecture seule sur le référentiel, CRUD sur les
-- tables personnelles). `anon` ne reçoit rien : toutes les données exigent l'auth.

-- Référentiel partagé : lecture seule (écriture via la RPC security definer).
grant select on public.etablissements to authenticated;
grant select on public.tags to authenticated;

-- Tables personnelles : CRUD (la RLS limite aux lignes de l'utilisateur).
grant select, insert, update, delete on public.liste_items to authenticated;
grant select, insert, update, delete on public.liste_item_tags to authenticated;
grant select, insert, update, delete on public.avis to authenticated;

-- Profil : lecture (fallback getSessionRole) + mise à jour de son propre profil.
grant select, update on public.profiles to authenticated;
