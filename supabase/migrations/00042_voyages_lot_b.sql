-- Refonte Voyages (Lot B) : QUI part, et QUOI faire sur place.
--
-- Deux notions distinctes, volontairement séparées de `voyage_membres` :
-- celui-ci dit avec quels COMPTES le voyage est partagé (accès), tandis que les
-- participants disent qui VOYAGE — un enfant du Cercle, un ami sans compte,
-- soi-même. Partager n'est pas voyager, et voyager ne donne aucun accès.

-- 1) Participants : polymorphes (compte / proche du Cercle / personne libre).
create table public.voyage_participants (
  id uuid primary key default gen_random_uuid(),
  voyage_id uuid not null references public.voyages (id) on delete cascade,
  -- Au plus UNE source. `on delete set null` et jamais cascade : un proche
  -- retiré du Cercle ou un compte supprimé ne doit pas effacer un voyageur du
  -- programme — c'est tout l'intérêt de l'instantané ci-dessous.
  profile_id uuid references public.profiles (id) on delete set null,
  family_member_id uuid references public.family_members (id) on delete set null,
  -- Instantané du nom au moment de l'ajout : il survit à la disparition de sa
  -- source, et reste modifiable (« Papa » plutôt que « Jean Dupont »).
  display_name text not null check (char_length(display_name) between 1 and 120),
  email text check (email is null or char_length(email) <= 200),
  role text not null default 'voyageur' check (role in ('organisateur', 'voyageur')),
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint voyage_participants_source_unique check (num_nonnulls(profile_id, family_member_id) <= 1)
);
create index voyage_participants_voyage_idx on public.voyage_participants (voyage_id);
-- Un même proche (ou un même compte) ne peut pas figurer deux fois sur un voyage.
create unique index voyage_participants_membre_uidx
  on public.voyage_participants (voyage_id, family_member_id) where family_member_id is not null;
create unique index voyage_participants_profil_uidx
  on public.voyage_participants (voyage_id, profile_id) where profile_id is not null;

-- 2) Programme : les étapes d'un voyage.
create table public.voyage_etapes (
  id uuid primary key default gen_random_uuid(),
  voyage_id uuid not null references public.voyages (id) on delete cascade,
  -- Jour nullable : une envie sans date reste au programme, dans « à caler ».
  jour date,
  heure time,
  titre text not null check (char_length(titre) between 1 and 200),
  lieu text check (lieu is null or char_length(lieu) <= 200),
  -- Étape sur un lieu du carnet (resto, hôtel) : le titre reste libre, le lien
  -- mène à la fiche. Même parti pris qu'en H6 — la FK ne garantit aucun accès.
  etablissement_id uuid references public.etablissements (id) on delete set null,
  notes text check (notes is null or char_length(notes) <= 2000),
  -- Rang dans la journée, pour les étapes sans heure.
  ordre integer not null default 0,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index voyage_etapes_voyage_idx on public.voyage_etapes (voyage_id, jour);

-- 3) RLS : collaboratif comme les réservations — qui accède au voyage gère son
--    programme et ses voyageurs. Forme `(select auth.uid())` de 00024.
alter table public.voyage_participants enable row level security;
create policy "voyage_participants_all" on public.voyage_participants for all to authenticated
  using (public.can_access_voyage(voyage_id)) with check (public.can_access_voyage(voyage_id));

alter table public.voyage_etapes enable row level security;
create policy "voyage_etapes_all" on public.voyage_etapes for all to authenticated
  using (public.can_access_voyage(voyage_id)) with check (public.can_access_voyage(voyage_id));

-- Grants explicites (la RLS ne suffit pas pour PostgREST)
grant select, insert, update, delete on public.voyage_participants to authenticated;
grant select, insert, update, delete on public.voyage_etapes to authenticated;
