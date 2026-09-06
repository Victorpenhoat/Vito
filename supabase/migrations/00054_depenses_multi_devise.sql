-- Voyages, dépenses en devise locale (maquette « Nouvelle dépense » : « 86,50
-- [EUR ▾] · saisie possible en devise locale », et « 52 $ · taux du 14/10 »
-- dans la liste).
--
-- `montant_cents` NE CHANGE PAS de sens : c'est toujours le montant dans la
-- devise du voyage, et c'est toujours lui qui fait les parts et les soldes. Les
-- colonnes ajoutées ne servent qu'à se souvenir d'où vient ce montant. Rien à
-- reprendre sur l'existant, et aucun solde ne peut bouger du fait de cette
-- migration.
--
-- Le taux est figé ici plutôt que relu à l'affichage : un taux qui bouge ferait
-- bouger tout seuls des soldes déjà réglés, pour des dettes qui, elles, n'ont
-- pas bougé.
alter table public.voyage_depenses
  add column devise_saisie      text     check (char_length(devise_saisie) = 3),
  add column montant_saisi_cents bigint  check (montant_saisi_cents > 0),
  -- 8 décimales : de quoi loger un taux en yens (0,0058...) sans perdre le
  -- centime à la conversion.
  add column taux               numeric(18, 8) check (taux > 0),
  -- Le jour du taux retenu — « taux du 14/10 » dans la maquette. Pas forcément
  -- celui de la dépense : les taux de référence ne sortent que les jours
  -- ouvrés, une dépense du dimanche prend donc le vendredi. C'est ce qu'on
  -- affiche, donc c'est ce qu'on garde.
  add column taux_date          date,
  -- Les quatre vont ensemble : un montant sans son taux ne se convertit pas, un
  -- taux sans montant ne se relit pas. Zéro pour une dépense saisie dans la
  -- devise du voyage — l'immense majorité.
  add constraint voyage_depenses_devise_complete
    check (num_nonnulls(devise_saisie, montant_saisi_cents, taux, taux_date) in (0, 4));
