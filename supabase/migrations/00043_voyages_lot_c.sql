-- Refonte Voyages (Lot C) : ce que contient vraiment une réservation, et le
-- billet qui va avec.

-- 1) Détails propres au type. Un vol a un numéro et deux aéroports, une voiture
--    a une agence et deux lieux : une colonne par cas ferait une table à
--    trous. Le jsonb les porte, et le domaine les relit champ par champ — ce
--    qui vient de là n'est jamais présumé bien formé (même parti pris que
--    l'analyse d'étiquette des vins).
alter table public.reservations
  add column details jsonb;

-- 2) Le voucher rattaché à sa réservation.
--    `on delete set null` et non cascade : supprimer une réservation ne doit
--    pas emporter le billet déposé — il reste dans les documents du voyage.
alter table public.voyage_documents
  add column reservation_id uuid references public.reservations (id) on delete set null;
create index voyage_documents_reservation_idx on public.voyage_documents (reservation_id);
