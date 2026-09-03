-- Onboarding & Compte (Lot O-A) : le profil devient une vraie identité
-- (prénom + nom), reprise du design « Votre profil » — « ce profil devient
-- votre fiche dans le Cercle ».
-- `display_name` est conservé : tout le shell et les écrans de partage
-- l'affichent déjà. Il reste la valeur dérivée, recalculée à l'enregistrement.

alter table public.profiles
  add column first_name text check (first_name is null or char_length(first_name) <= 80),
  add column last_name  text check (last_name  is null or char_length(last_name)  <= 80);

-- Backfill : « Victor Penhoat » → prénom = premier mot, nom = le reste.
-- Les display_name d'une seule pièce (« Admin ») ne donnent qu'un prénom.
update public.profiles
set first_name = nullif(split_part(display_name, ' ', 1), ''),
    last_name  = nullif(trim(substr(display_name, length(split_part(display_name, ' ', 1)) + 1)), '')
where display_name is not null and first_name is null and last_name is null;

comment on column public.profiles.first_name is 'Prénom saisi dans Réglages > Profil ; display_name en est dérivé.';
comment on column public.profiles.last_name  is 'Nom saisi dans Réglages > Profil ; display_name en est dérivé.';
