-- Les co-partageurs doivent pouvoir lire le profil (display_name) les uns des autres :
-- la policy profiles_select_self_or_admin (00001) limite la lecture à soi-même/admin,
-- donc tout co-membre s'affichait en UUID (dépenses, voyages, famille, agence).
--
-- Helper security definer (pattern can_access_famille, 00013) : contourne la RLS des
-- tables d'appartenance pour un simple test d'existence pairwise. Invariant vérifié :
-- l'owner est toujours matérialisé dans la table de membres (role 'owner'), les joins
-- pairwise couvrent donc aussi les owners.
create function public.is_co_membre(target uuid) returns boolean
  language sql security definer set search_path = '' stable as $$
  select
    -- même foyer
    exists (
      select 1 from public.famille_membres a
      join public.famille_membres b on b.famille_id = a.famille_id
      where a.profile_id = auth.uid() and b.profile_id = target
    )
    -- même groupe de dépenses
    or exists (
      select 1 from public.depense_groupe_membres a
      join public.depense_groupe_membres b on b.groupe_id = a.groupe_id
      where a.profile_id = auth.uid() and b.profile_id = target
    )
    -- même voyage
    or exists (
      select 1 from public.voyage_membres a
      join public.voyage_membres b on b.voyage_id = a.voyage_id
      where a.profile_id = auth.uid() and b.profile_id = target
    )
    -- relation agence <-> client (dans les deux sens)
    or exists (
      select 1 from public.agence_clients
      where (agence_id = auth.uid() and client_id = target)
         or (client_id = auth.uid() and agence_id = target)
    );
$$;

-- Policy SELECT additionnelle (permissive, s'ajoute en OR à self_or_admin).
-- Lecture seule : profiles_update_self reste inchangée.
create policy "profiles_select_co_membre" on public.profiles
  for select using (public.is_co_membre(id));
