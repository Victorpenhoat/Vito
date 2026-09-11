-- Calendrier scolaire officiel, mis en cache.
--
-- La liste écrite à la main (vacancesScolaires.ts) ne couvrait qu'une zone et
-- une année, et portait son propre avertissement : « mieux vaut ce silence
-- qu'un calendrier périmé présenté comme vrai ». La source est désormais
-- data.education.gouv.fr, et cette table en est le cache.
--
-- Le cache n'est pas une optimisation, c'est la condition : le planning
-- s'ouvre souvent, et le faire dépendre d'un tiers à chaque rendu
-- contredirait l'habitude du dépôt (AucunTauxProvider, AucunMailProvider).
-- Si l'API tombe, le dernier calendrier connu s'affiche encore.

create table public.vacances_scolaires (
  id             uuid primary key default gen_random_uuid(),
  annee_scolaire text not null,          -- « 2026-2027 »
  -- Tel que la SOURCE le nomme : « Zone A », mais aussi « Corse », « Réunion »…
  -- Pas de contrainte d'énumération : le vocabulaire ne nous appartient pas, et
  -- une valeur inconnue affichée telle quelle vaut mieux qu'une migration à
  -- chaque évolution du jeu de données.
  zone           text not null,
  libelle        text not null,          -- « Vacances de Noël »
  -- Dates de PARIS, déjà converties (la source publie minuit de Paris exprimé
  -- en UTC : 2026-12-18T23:00:00Z est le 19 décembre).
  debut          date not null,
  fin            date not null,
  recupere_le    timestamptz not null default now(),
  unique (annee_scolaire, zone, libelle)
);

create index vacances_scolaires_zone_idx on public.vacances_scolaires (zone, debut);

alter table public.vacances_scolaires enable row level security;

-- Données publiques, mais l'écran qui les affiche est derrière la connexion.
-- L'écriture appartient au serveur : le rafraîchissement passe par le rôle de
-- service, qui contourne la RLS.
create policy "vacances_scolaires_select" on public.vacances_scolaires
  for select to authenticated using (true);

revoke all on public.vacances_scolaires from anon;
grant select on public.vacances_scolaires to authenticated;
revoke insert, update, delete on public.vacances_scolaires from authenticated;
