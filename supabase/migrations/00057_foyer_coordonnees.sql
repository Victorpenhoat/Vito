-- Coordonnées de l'adresse du foyer.
--
-- L'onglet Activités annonce « ~22 min depuis chez nous » : il faut donc un
-- point de départ. L'adresse existait déjà (fiche « Moi » du Cercle, dont les
-- autres héritent), mais en TEXTE LIBRE — impossible d'en tirer une distance.
--
-- Les colonnes vivent sur family_members plutôt que dans une table à part : le
-- foyer, dans Vito, c'est la fiche « Moi ». En créer une seconde source
-- reviendrait à avoir deux adresses qui divergent.
alter table public.family_members
  add column lat double precision,
  add column lng double precision;

-- Un point est un couple : une latitude sans sa longitude ne situe rien.
alter table public.family_members
  add constraint family_members_point_complet
    check (num_nonnulls(lat, lng) in (0, 2));
