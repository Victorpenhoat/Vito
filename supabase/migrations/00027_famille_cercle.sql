-- Refonte Onglet Cercle (design Onglet_Cercle.dc.html) :
-- proches enrichis (lieu de naissance, adresse + héritage foyer, relations gendrées
-- + fiche « moi » unique), documents avec verso chiffré, rappel d'expiration et
-- type libre (doc_label). Les anciennes valeurs de relation restent valides.

-- family_members : nouveaux champs
alter table public.family_members
  add column birth_place     text,
  add column address         text,
  add column address_inherit boolean not null default false;

-- relation : étendre le CHECK (contrainte inline de 00019, nom auto postgres).
-- drop SANS "if exists" : si le nom diffère, la migration doit échouer bruyamment
-- plutôt que laisser l'ancien CHECK refuser 'moi'/'fille'/…
alter table public.family_members
  drop constraint family_members_relation_check;
alter table public.family_members
  add constraint family_members_relation_check check (relation in
    ('conjoint','enfant','parent','beau_parent','ami','autre',
     'moi','fille','fils','pere','mere'));

-- au plus UN membre relation='moi' par utilisateur
create unique index family_members_moi_unique
  on public.family_members (user_id) where relation = 'moi';

-- family_documents : verso chiffré, rappel, type libre
alter table public.family_documents
  add column contenu_chiffre_verso text,
  add column mime_type_verso       text,
  add column taille_verso          integer,
  add column reminder              boolean not null default true,
  add column doc_label             text check (doc_label is null or char_length(doc_label) between 1 and 120);

-- cohérence verso : les 3 colonnes renseignées ensemble ou pas du tout
alter table public.family_documents
  add constraint family_documents_verso_coherent check (
    ((contenu_chiffre_verso is null) = (mime_type_verso is null))
    and ((contenu_chiffre_verso is null) = (taille_verso is null))
  );

-- doc_type : étendre le CHECK (+ securite_sociale)
alter table public.family_documents
  drop constraint family_documents_doc_type_check;
alter table public.family_documents
  add constraint family_documents_doc_type_check check (doc_type in
    ('passeport','carte_identite','permis_conduire','permis_bateau',
     'visa','titre_sejour','autre','securite_sociale'));
