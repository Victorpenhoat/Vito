-- Restos v2 (Lot R-A) : visites multiples + origine structurée.
-- Le statut v2 (favori / à tester / testé) reste DÉRIVÉ côté domaine
-- (is_favorite + statut) : aucune migration d'enum, réversible, et le
-- dashboard accueil (statut='visite' / 'a_faire') reste vrai.

-- 1) Visites (plusieurs par liste_item, note /10 au dixième — slider design « 8,2 »)
create table public.visites (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  liste_item_id uuid not null references public.liste_items (id) on delete cascade,
  note          numeric(3,1) check (note is null or (note >= 0 and note <= 10)),
  commentaire   text check (commentaire is null or char_length(commentaire) <= 2000),
  visite_le     date not null default current_date,
  created_at    timestamptz not null default now()
);
create index visites_liste_item_idx on public.visites (liste_item_id);
create index visites_user_idx on public.visites (user_id);

alter table public.visites enable row level security;
-- Owner direct (pattern initplan 00024) + cohérence parent au WITH CHECK
create policy "visites_all_owner" on public.visites
  for all using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.liste_items li
                where li.id = liste_item_id and li.user_id = (select auth.uid()))
  );
grant select, insert, update, delete on public.visites to authenticated;
revoke all on public.visites from anon;

-- 2) Reprise des avis RESTO existants -> visites (note /5 -> /10).
--    `avis` est conservé (encore utilisé par les fiches hôtel). Les avis sans
--    liste_item correspondant ne sont pas migrés (pas de relation cible).
insert into public.visites (user_id, liste_item_id, note, commentaire, visite_le, created_at)
select a.user_id, li.id, a.note * 2, a.commentaire,
       coalesce(a.visite_le, a.created_at::date), a.created_at
from public.avis a
join public.liste_items li
  on li.user_id = a.user_id and li.etablissement_id = a.etablissement_id
join public.etablissements e
  on e.id = a.etablissement_id and e.categorie = 'resto';

-- 3) Origine structurée (recommandé par qui / trouvé où).
--    La FK family_members ne garantit PAS l'ownership (RLS ignorée par les FK) :
--    l'action setOrigine vérifie l'appartenance via un SELECT sous RLS.
alter table public.liste_items
  add column origine_type text check (origine_type in ('reco', 'trouve')),
  add column origine_qui  text check (origine_qui is null or char_length(origine_qui) <= 120),
  add column origine_family_member_id uuid references public.family_members (id) on delete set null,
  add column origine_source text check (origine_source is null or char_length(origine_source) <= 120);
create index liste_items_origine_fm_idx on public.liste_items (origine_family_member_id);

-- Backfill : reco_source (déprécié, conservé en lecture) -> origine structurée
update public.liste_items
set origine_type = 'reco', origine_qui = reco_source
where reco_source is not null and origine_type is null;
