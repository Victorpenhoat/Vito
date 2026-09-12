-- La requête de page cesse de DEMANDER la colonne chiffrée.
--
-- Depuis que le masque est une constante (« •••• »), plus rien ne dérive du
-- contenu du numéro : seule sa PRÉSENCE compte. La page transportait pourtant
-- encore le blob chiffré de la base jusqu'au serveur, pour le jeter aussitôt —
-- travail mort sur une donnée sensible, et écart littéral avec la règle que le
-- projet s'est donnée (docs/security.md §2 : « les requêtes de page ne
-- sélectionnent jamais la colonne chiffrée »). Les Activités, elles, la
-- respectaient déjà.
--
-- Une colonne générée plutôt qu'une vue : elle suit la table, hérite de sa RLS,
-- et ne peut pas se désynchroniser de la valeur qu'elle décrit — Postgres la
-- recalcule à chaque écriture.
alter table public.family_documents
  add column doc_number_present boolean
    generated always as (doc_number_chiffre is not null) stored;

comment on column public.family_documents.doc_number_present is
  'Présence d''un numéro chiffré, pour que les requêtes de page n''aient jamais à sélectionner doc_number_chiffre.';
