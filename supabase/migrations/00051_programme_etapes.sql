-- Voyages, conformité maquette « Programme (jour par jour) ».
--
-- La maquette type chaque étape — Trajet, Restaurant, Activité, Note — et
-- affiche un moment plutôt qu'une heure quand celle-ci n'est pas connue
-- (« Soir · Note : gelato puis balade »). Sans ces deux champs, le programme
-- était une liste de titres, là où le design en fait une journée lisible d'un
-- coup d'œil.
alter table public.voyage_etapes
  add column categorie text check (categorie is null or categorie in
    ('trajet', 'hebergement', 'restaurant', 'activite', 'note', 'autre')),
  -- Moment de la journée, quand l'heure exacte n'a pas de sens. Exclusif avec
  -- `heure` : donner les deux serait se contredire.
  add column moment text check (moment is null or moment in ('matin', 'midi', 'apres_midi', 'soir')),
  add constraint voyage_etapes_heure_ou_moment check (num_nonnulls(heure, moment) <= 1);
