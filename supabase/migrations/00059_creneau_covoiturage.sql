-- Covoiturage (écart 6 de l'audit du 8 septembre).
--
-- La maquette en fait un TROISIÈME CHOIX de « Qui dépose », à côté de « Moi »
-- et d'un proche nommé — pas un système d'alternance entre familles. On ajoute
-- donc un état, pas une table.
--
-- Trois états, et chacun dit quelque chose de différent :
--   depose_par renseigné   → cette personne-là dépose
--   covoiturage à vrai     → un arrangement existe, hors du foyer
--   ni l'un ni l'autre     → « à définir », qui reste une réponse
alter table public.activite_creneaux
  add column depose_covoiturage boolean not null default false,
  -- Les deux à la fois se contrediraient : on ne dépose pas soi-même ET en
  -- covoiturage. La base refuse, plutôt que de laisser l'écran trancher.
  add constraint activite_creneaux_depose_coherent
    check (not (depose_covoiturage and depose_par is not null));
