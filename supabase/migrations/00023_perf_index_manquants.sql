-- PERF (audit 04/07) : index manquants sur des colonnes filtrées/triées par des
-- requêtes réelles, provoquant des seq scans. Migration purement additive (aucun
-- changement de schéma ni de comportement).

-- avis n'avait AUCUN index. Lu par etablissement_id (fiche resto/hôtel : getFiche)
-- et par note (reco : gte('note',4)) ; la policy avis_all_owner filtre par user_id.
create index if not exists avis_etab_idx on public.avis (etablissement_id);
create index if not exists avis_user_idx on public.avis (user_id);

-- Dashboard : KPI dépenses du mois filtre depenses par plage de date (gte/lt date) ;
-- seul depenses(groupe_id) existait.
create index if not exists depenses_date_idx on public.depenses (date);

-- Dashboard : « voyages à venir » filtre voyages par date_debut (+ statut) ;
-- seul voyages(owner_id) existait.
create index if not exists voyages_date_debut_idx on public.voyages (date_debut);
