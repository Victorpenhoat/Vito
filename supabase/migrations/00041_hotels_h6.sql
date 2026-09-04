-- Hôtels v2 (Lot H6) : une réservation de voyage peut désigner un hébergement
-- du carnet, et l'hôtel réservé y entre avec son origine — « Ajouté via
-- Voyages · Rome » (design Hôtels v2, écran 6, bloc « Pourquoi c'est là »).

-- 1) La réservation pointe vers l'établissement réservé.
--    ⚠ La FK ne garantit AUCUN accès : les FK ignorent la RLS. C'est l'action
--    qui vérifie, par un SELECT sous RLS, que le voyage est bien accessible
--    avant d'écrire (même pattern que setOrigine et marquerSejour).
--    on delete set null : un établissement supprimé ne doit pas emporter la
--    réservation — les dates et la référence restent utiles sans lui.
alter table public.reservations
  add column etablissement_id uuid references public.etablissements (id) on delete set null;
create index reservations_etablissement_idx on public.reservations (etablissement_id);

-- 2) Troisième origine : « arrivé par un voyage ». Le titre du voyage est
--    recopié dans origine_qui — c'est un libellé d'affichage, pas un lien : un
--    voyage supprimé ne doit pas effacer la raison de la présence de l'hôtel.
alter table public.liste_items drop constraint liste_items_origine_type_check;
alter table public.liste_items add constraint liste_items_origine_type_check
  check (origine_type in ('reco', 'trouve', 'voyage'));
