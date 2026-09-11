-- Zone de vacances du foyer.
--
-- Nullable et SANS contrainte d'énumération : le vocabulaire vient de la source
-- (« Zone A », mais aussi « Corse », « Réunion »…), et il ne nous appartient
-- pas. Une valeur inconnue affichée telle quelle vaut mieux qu'une migration à
-- chaque évolution du jeu de données du ministère.
--
-- Null = jamais choisie. L'écran propose alors la zone déduite de l'adresse du
-- foyer, sans l'enregistrer : déduire n'est pas décider.
alter table public.profiles add column zone_scolaire text;
