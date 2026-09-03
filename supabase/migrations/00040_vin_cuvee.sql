-- Vins & Cave (Lot V-C) : la cuvée manquait.
--
-- Le tunnel de capture la LIT sur l'étiquette depuis le lot V-B (« Initial »
-- chez Selosse, « La Tourtine » chez Tempier) et l'utilisateur peut la corriger
-- — mais elle était jetée à l'enregistrement faute de colonne. La Cave et la
-- fiche vin l'affichent : « Selosse · Initial » n'est pas « Selosse ».
alter table public.vins add column cuvee text check (cuvee is null or char_length(cuvee) <= 200);

comment on column public.vins.cuvee is
  'Cuvée lue sur l''étiquette (distincte du domaine et de l''appellation).';
