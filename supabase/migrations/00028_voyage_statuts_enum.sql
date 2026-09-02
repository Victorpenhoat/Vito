-- Refonte Voyages (Lot A) — statuts étendus : « Idées » et « En préparation ».
-- PG17 : ADD VALUE est autorisé en transaction TANT QUE la valeur n'est pas
-- utilisée dans la même transaction. Le CLI Supabase enveloppe chaque fichier
-- dans une transaction → ce fichier ne contient QUE ces deux ordres.
alter type public.voyage_statut add value if not exists 'idee' before 'planifie';
alter type public.voyage_statut add value if not exists 'en_preparation' after 'idee';
