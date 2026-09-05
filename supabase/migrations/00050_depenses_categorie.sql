-- Voyages, conformité maquette « Ajout d'une dépense » : la catégorie.
--
-- La maquette la montre au même rang que le libellé et le montant. Elle sert à
-- lire un budget d'un coup d'œil (« combien de restaurant sur ce voyage ? »),
-- ce qu'un libellé libre ne permet pas.
--
-- Colonne texte contrainte plutôt qu'un enum : la liste bougera (la maquette en
-- montre une, l'usage en réclamera d'autres), et un enum se modifie mal —
-- ALTER TYPE doit vivre seul dans sa migration, contrainte dont on se passe.
alter table public.voyage_depenses
  add column categorie text check (categorie is null or categorie in
    ('hebergement', 'restaurant', 'transport', 'activite', 'courses', 'autre'));
