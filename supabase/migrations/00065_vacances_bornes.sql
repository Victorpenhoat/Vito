-- Une période de vacances ne peut pas finir avant d'avoir commencé.
--
-- Le fournisseur DÉRIVE les grandes vacances quand la source n'en publie que
-- le marqueur d'un jour, en posant la fin au 31 août de la même année civile
-- (cf. `deriverEte` dans educationGouv.ts). Ce 31 août suppose un été boréal :
-- un marqueur pour la Réunion, dont les grandes vacances commencent
-- mi-décembre, produirait « du 18 décembre au 31 août » — une période à
-- l'envers. Le fournisseur refuse désormais de la former, mais la table est
-- un CACHE : ce qui y entre y reste, et une ligne fausse écrite une fois
-- survivrait à la correction du code. La contrainte est donc le seul endroit
-- où l'invariant tient pour de bon.
--
-- Bornes INCLUSES, d'où l'égalité permise : le « Pont de l'Ascension » dure un
-- seul jour, début et fin confondus (cf. le seed).
alter table public.vacances_scolaires
  add constraint vacances_scolaires_bornes_check check (fin >= debut);
