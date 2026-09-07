-- Onglet Activités (design docs/design/Onglet_Activites.dc.html) : les activités
-- régulières de la famille — équitation, danse, foot, musique — avec leurs
-- créneaux, leur lieu, leurs coûts, leurs codes d'accès et leurs documents.
--
-- Deux catégories de données à protection renforcée vivent ici :
--   - les CODES D'ACCÈS (portail, vestiaire) : secrets d'accès physique ;
--   - les CERTIFICATS MÉDICAUX : données de santé, catégorie particulière RGPD.
-- Aucune des deux n'est stockée en clair. Comme partout dans Vito, les octets
-- sont chiffrés en colonne (AES-256-GCM, cf. src/lib/crypto) et déchiffrés à la
-- demande par une route authentifiée : il n'y a aucun bucket, donc aucune URL
-- qui circule.

-- ── Activités ───────────────────────────────────────────────────────────────
create table public.activites (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  -- `check` plutôt qu'un enum : ajouter un type ne doit pas demander une
  -- migration de type, que Postgres ne sait pas défaire.
  type          text not null check (type in
                  ('equitation','danse','football','musique','tennis','natation','theatre','autre')),
  nom           text not null check (char_length(nom) between 1 and 200),
  statut        text not null default 'en_cours'
                  check (statut in ('en_cours','en_pause','terminee')),
  club_nom      text check (char_length(club_nom) <= 200),
  adresse       text,
  lat           double precision,
  lng           double precision,
  -- Référence du fournisseur d'adresses, comme les établissements du carnet :
  -- elle permet de retrouver le lieu sans re-payer une recherche.
  place_id      text,
  telephone     text,
  email         text,
  site_web      text,
  espace_famille_url text,
  saison_debut  date,
  saison_fin    date,
  -- « Se garer derrière le manège, entrer par la petite porte verte » : une
  -- consigne, pas un secret. Le secret, c'est le code — il a sa table.
  consignes_acces text,
  notes         text,
  -- Formule à la carte (« Formule 20 séances ») ; null = illimité. Le décompte
  -- « 13 / 20 · 7 restantes » se DÉRIVE des séances, il ne se stocke pas.
  formule_seances integer check (formule_seances is null or formule_seances > 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- Une saison qui se termine avant de commencer est une faute de saisie.
  constraint activites_saison_coherente check (saison_fin is null or saison_debut is null or saison_fin >= saison_debut)
);
create index activites_user_statut_idx on public.activites (user_id, statut);

-- Une activité peut concerner plusieurs membres du Cercle (« moi » y compris :
-- le compte est épinglé dans family_members, les activités d'adulte n'ont donc
-- rien de particulier).
create table public.activite_membres (
  activite_id uuid not null references public.activites (id) on delete cascade,
  membre_id   uuid not null references public.family_members (id) on delete cascade,
  primary key (activite_id, membre_id)
);
create index activite_membres_membre_idx on public.activite_membres (membre_id);

-- ── Créneaux ────────────────────────────────────────────────────────────────
create table public.activite_creneaux (
  id            uuid primary key default gen_random_uuid(),
  activite_id   uuid not null references public.activites (id) on delete cascade,
  -- 1 = lundi … 7 = dimanche (ISO), comme le calendrier du planning.
  jour_semaine  smallint not null check (jour_semaine between 1 and 7),
  heure_debut   time not null,
  heure_fin     time not null,
  lieu_precision text,   -- « manège couvert », « carrière extérieure »
  intervenant   text,    -- « Monitrice : Claire Dubois »
  -- Qui dépose (design : « Dépose : moi », « Dépose à définir »). Null porte du
  -- sens : c'est le « à définir » de la maquette, pas une donnée manquante.
  -- `set null` : retirer un proche ne doit pas emporter le créneau.
  depose_par    uuid references public.family_members (id) on delete set null,
  valide_du     date,
  valide_au     date,
  created_at    timestamptz not null default now(),
  constraint activite_creneaux_heures check (heure_fin > heure_debut),
  constraint activite_creneaux_validite check (valide_au is null or valide_du is null or valide_au >= valide_du)
);
-- Index de la vue « Cette semaine », qui interroge par jour.
create index activite_creneaux_jour_idx on public.activite_creneaux (activite_id, jour_semaine);

-- Annulations et séances hors créneau récurrent (« 1 annulation le 24 déc. »).
create table public.activite_creneau_exceptions (
  id          uuid primary key default gen_random_uuid(),
  creneau_id  uuid not null references public.activite_creneaux (id) on delete cascade,
  date        date not null,
  type        text not null check (type in ('annulation','ponctuelle')),
  heure_debut time,
  heure_fin   time,
  motif       text,
  created_at  timestamptz not null default now(),
  -- Deux exceptions le même jour sur le même créneau se contrediraient.
  unique (creneau_id, date)
);
create index activite_creneau_exceptions_date_idx on public.activite_creneau_exceptions (date);

-- ── Présence ────────────────────────────────────────────────────────────────
-- « ✓ 12 faites · ✗ 1 manquée · 7 restantes ». Le compteur n'est pas stocké :
-- un compteur se désynchronise, une liste de séances non.
create table public.activite_seances (
  id          uuid primary key default gen_random_uuid(),
  activite_id uuid not null references public.activites (id) on delete cascade,
  creneau_id  uuid references public.activite_creneaux (id) on delete set null,
  date        date not null,
  statut      text not null check (statut in ('faite','manquee')),
  motif       text,   -- « voyage à Rome »
  created_at  timestamptz not null default now(),
  -- Une séance par jour et par créneau : pointer deux fois le même cours
  -- fausserait le décompte de la formule.
  unique (activite_id, date, creneau_id)
);
create index activite_seances_activite_date_idx on public.activite_seances (activite_id, date);

-- ── Codes d'accès (donnée protégée) ─────────────────────────────────────────
create table public.activite_codes (
  id             uuid primary key default gen_random_uuid(),
  activite_id    uuid not null references public.activites (id) on delete cascade,
  libelle        text not null check (char_length(libelle) between 1 and 120),
  -- base64 du blob AES-256-GCM. La valeur en clair n'existe nulle part au
  -- repos, et n'est jamais renvoyée par les lectures ordinaires.
  valeur_chiffree text not null,
  -- Version de clé : une rotation doit pouvoir déchiffrer l'ancien.
  key_version    smallint not null default 1,
  note           text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index activite_codes_activite_idx on public.activite_codes (activite_id);

-- ── Paiements ───────────────────────────────────────────────────────────────
create table public.activite_paiements (
  id          uuid primary key default gen_random_uuid(),
  activite_id uuid not null references public.activites (id) on delete cascade,
  libelle     text not null check (char_length(libelle) between 1 and 200),
  montant_cents bigint not null check (montant_cents > 0),
  devise      text not null default 'EUR' check (char_length(devise) = 3),
  echeance    date,
  -- Deux états STOCKÉS seulement. « En retard » se dérive de l'échéance : un
  -- statut stocké se périmerait tout seul, comme le statut v2 des restos.
  statut      text not null default 'du' check (statut in ('du','paye')),
  paye_le     date,
  periodicite text check (periodicite in ('unique','mensuelle','trimestrielle','annuelle')),
  moyen       text check (moyen in ('prelevement','carte','virement','cheque','especes','autre')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index activite_paiements_echeance_idx on public.activite_paiements (echeance) where statut = 'du';

-- ── Documents (données protégées, dont des données de santé) ────────────────
create table public.activite_documents (
  id            uuid primary key default gen_random_uuid(),
  activite_id   uuid not null references public.activites (id) on delete cascade,
  -- Le certificat médical est une donnée de santé : `sensible` le marque, et
  -- l'application s'en sert pour exiger une re-authentification récente.
  type          text not null check (type in
                  ('licence','certificat_medical','assurance','autorisation','reglement','facture','autre')),
  sensible      boolean not null default false,
  nom           text not null,
  contenu_chiffre text not null,   -- base64 du blob AES-256-GCM
  mime_type     text not null,
  taille        integer not null check (taille > 0),
  delivre_le    date,
  expire_le     date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
-- Index des alertes : « expire dans 21 jours ».
create index activite_documents_expire_idx on public.activite_documents (expire_le);
create index activite_documents_activite_idx on public.activite_documents (activite_id);

-- ── Journal d'accès ─────────────────────────────────────────────────────────
-- Révéler un code ou ouvrir un document laisse une trace. Vaut aussi pour le
-- Cercle, qui exigeait déjà une re-authentification sans rien consigner.
--
-- On journalise QUI, QUOI et QUAND — jamais la valeur révélée, ni l'adresse IP :
-- un journal qui contiendrait le secret n'aurait fait que le déplacer.
create table public.journal_acces (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  cible_type  text not null check (cible_type in
                ('code_activite','document_activite','document_famille','numero_document')),
  cible_id    uuid not null,
  action      text not null check (action in ('revelation','ouverture')),
  created_at  timestamptz not null default now()
);
create index journal_acces_user_date_idx on public.journal_acces (user_id, created_at desc);

-- ── Fraîcheur ───────────────────────────────────────────────────────────────
create trigger activites_set_updated_at before update on public.activites
  for each row execute function public.set_updated_at();
create trigger activite_codes_set_updated_at before update on public.activite_codes
  for each row execute function public.set_updated_at();
create trigger activite_paiements_set_updated_at before update on public.activite_paiements
  for each row execute function public.set_updated_at();
create trigger activite_documents_set_updated_at before update on public.activite_documents
  for each row execute function public.set_updated_at();

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Une activité appartient à un compte, point : pas de partage, contrairement
-- aux voyages. Les tables filles en dérivent par cette fonction plutôt que de
-- recopier user_id — une colonne recopiée finit par diverger.
create function public.est_mon_activite(a_id uuid) returns boolean
  language sql security definer set search_path = '' stable as $$
  select exists (
    select 1 from public.activites
     where id = a_id and user_id = (select auth.uid())
  );
$$;

alter table public.activites                 enable row level security;
alter table public.activite_membres          enable row level security;
alter table public.activite_creneaux         enable row level security;
alter table public.activite_creneau_exceptions enable row level security;
alter table public.activite_seances          enable row level security;
alter table public.activite_codes            enable row level security;
alter table public.activite_paiements        enable row level security;
alter table public.activite_documents        enable row level security;
alter table public.journal_acces             enable row level security;

create policy "activites_owner" on public.activites for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "activite_membres_owner" on public.activite_membres for all to authenticated
  using (public.est_mon_activite(activite_id))
  with check (
    public.est_mon_activite(activite_id)
    -- Le proche doit m'appartenir aussi : sans cela, on rattacherait à son
    -- activité le membre du Cercle de quelqu'un d'autre.
    and exists (select 1 from public.family_members m
                 where m.id = membre_id and m.user_id = (select auth.uid()))
  );

create policy "activite_creneaux_owner" on public.activite_creneaux for all to authenticated
  using (public.est_mon_activite(activite_id)) with check (public.est_mon_activite(activite_id));

create policy "activite_creneau_exceptions_owner" on public.activite_creneau_exceptions for all to authenticated
  using (exists (select 1 from public.activite_creneaux c
                  where c.id = creneau_id and public.est_mon_activite(c.activite_id)))
  with check (exists (select 1 from public.activite_creneaux c
                       where c.id = creneau_id and public.est_mon_activite(c.activite_id)));

create policy "activite_seances_owner" on public.activite_seances for all to authenticated
  using (public.est_mon_activite(activite_id)) with check (public.est_mon_activite(activite_id));

create policy "activite_codes_owner" on public.activite_codes for all to authenticated
  using (public.est_mon_activite(activite_id)) with check (public.est_mon_activite(activite_id));

create policy "activite_paiements_owner" on public.activite_paiements for all to authenticated
  using (public.est_mon_activite(activite_id)) with check (public.est_mon_activite(activite_id));

create policy "activite_documents_owner" on public.activite_documents for all to authenticated
  using (public.est_mon_activite(activite_id)) with check (public.est_mon_activite(activite_id));

-- Journal : on lit le sien, on y ajoute. AUCUNE policy d'update ni de delete —
-- un journal qu'on peut réécrire ne prouve rien.
create policy "journal_acces_select_self" on public.journal_acces
  for select to authenticated using (user_id = (select auth.uid()));
create policy "journal_acces_insert_self" on public.journal_acces
  for insert to authenticated with check (user_id = (select auth.uid()));

-- ── Grants (anon exclu partout) ─────────────────────────────────────────────
revoke all on public.activites, public.activite_membres, public.activite_creneaux,
  public.activite_creneau_exceptions, public.activite_seances, public.activite_codes,
  public.activite_paiements, public.activite_documents, public.journal_acces from anon;

grant select, insert, update, delete on public.activites to authenticated;
grant select, insert, update, delete on public.activite_membres to authenticated;
grant select, insert, update, delete on public.activite_creneaux to authenticated;
grant select, insert, update, delete on public.activite_creneau_exceptions to authenticated;
grant select, insert, update, delete on public.activite_seances to authenticated;
grant select, insert, update, delete on public.activite_codes to authenticated;
grant select, insert, update, delete on public.activite_paiements to authenticated;
grant select, insert, update, delete on public.activite_documents to authenticated;
-- Le journal ne se modifie pas, même par son propriétaire. Le `revoke` est
-- explicite et non facultatif : `authenticated` reçoit des privilèges par
-- défaut sur le schéma public, et l'absence de policy ne ferait qu'annuler
-- SILENCIEUSEMENT l'écriture (zéro ligne touchée, aucune erreur). Ici, une
-- tentative de réécriture échoue franchement.
grant select, insert on public.journal_acces to authenticated;
revoke update, delete on public.journal_acces from authenticated;

revoke execute on function public.est_mon_activite(uuid) from anon, public;
grant execute on function public.est_mon_activite(uuid) to authenticated;
