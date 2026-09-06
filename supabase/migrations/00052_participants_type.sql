-- Voyages, conformité maquette « Participants ».
--
-- La maquette distingue les adultes des enfants (« Enfant · 9 ans ») et sépare
-- deux groupes : les voyageurs venus du Cercle, et les invités externes qu'on
-- convie par e-mail. Le premier point demande une colonne ; le second existe
-- déjà (`email`), il lui manquait l'invitation qui va avec.
--
-- L'ÂGE, lui, n'est pas stocké : pour un proche du Cercle il se déduit de sa
-- date de naissance (elle y est déjà), et le dupliquer ici garantirait qu'il
-- devienne faux au premier anniversaire.
alter table public.voyage_participants
  add column type_voyageur text not null default 'adulte'
    check (type_voyageur in ('adulte', 'enfant'));
