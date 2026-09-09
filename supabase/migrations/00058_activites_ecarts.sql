-- Écarts relevés le 8 septembre entre l'onglet Activités et sa maquette
-- (docs/design/ECARTS-ACTIVITES-2026-09-08.md), volet données.

-- 1. Périodicité « à la séance » : une formule au coup par coup, que
--    l'énumération arrêtait à « annuelle ».
alter table public.activite_paiements drop constraint activite_paiements_periodicite_check;
alter table public.activite_paiements add constraint activite_paiements_periodicite_check
  check (periodicite in ('seance', 'unique', 'mensuelle', 'trimestrielle', 'annuelle'));

-- 2. Type « soutien scolaire » : le neuvième de la maquette, oublié des huit.
alter table public.activites drop constraint activites_type_check;
alter table public.activites add constraint activites_type_check
  check (type in ('equitation','danse','football','musique','tennis','natation',
                  'theatre','soutien_scolaire','autre'));

-- 3. Un SECOND contact, avec son rôle : la maquette montre « 05 56 22 41 08 ·
--    club » ET « 06 12 88 04 51 · Claire, monitrice ». Le club et la personne
--    qu'on appelle vraiment quand l'enfant est en retard ne sont pas le même
--    numéro.
alter table public.activites
  add column contact_nom       text check (contact_nom is null or char_length(contact_nom) <= 120),
  add column contact_telephone text check (contact_telephone is null or char_length(contact_telephone) <= 40),
  -- Un numéro sans nom ne dit pas qui décroche ; un nom sans numéro n'appelle
  -- personne. Les deux vont ensemble, ou aucun.
  add constraint activites_contact_complet
    check (num_nonnulls(contact_nom, contact_telephone) in (0, 2));
