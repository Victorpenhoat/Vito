-- Refonte Voyages (Lot A) — champs noyau de la liste/fiche redessinées :
-- période libre pour les idées (« Japon, printemps 2028 »), photo de couverture
-- (référence Places servie par le proxy /api/places/photo — patron 00018,
-- octets jamais stockés — OU URL https libre), devise du voyage (préparée pour
-- le lot Dépenses).
alter table public.voyages
  add column periode_texte    text check (periode_texte is null or char_length(periode_texte) <= 120),
  add column cover_photo_ref  text,
  add column cover_url        text check (cover_url is null or cover_url like 'https://%'),
  add column cover_fetched_at timestamptz,
  add column devise           text not null default 'EUR' check (char_length(devise) = 3),
  -- au plus une source de couverture
  add constraint voyages_cover_unique check (num_nonnulls(cover_photo_ref, cover_url) <= 1);
