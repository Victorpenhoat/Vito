-- Onboarding & Compte (Lot O-D) : données protégées et verrouillage.
--
-- Constat à l'origine de ce lot : le numéro de document partait EN CLAIR dans
-- le HTML de la page, le masquage n'étant qu'un effet d'affichage — il suffisait
-- de lire le source. Désormais :
--   * la page ne reçoit qu'une forme masquée ;
--   * le numéro est chiffré au repos, comme les scans (AES-256-GCM applicatif) ;
--   * sa révélation, comme l'ouverture d'un scan, exige une re-authentification.

-- 1) Numéro chiffré. `doc_number` reste (colonne dépréciée) mais est vidée : les
--    seules valeurs existantes sont des données de démo, l'application n'ayant
--    jamais été déployée. Le seed réinsère des valeurs déjà chiffrées.
alter table public.family_documents
  add column doc_number_chiffre text;
update public.family_documents set doc_number = null where doc_number is not null;
comment on column public.family_documents.doc_number is
  'DÉPRÉCIÉ (00036) : ne plus écrire ni lire. Le numéro vit chiffré dans doc_number_chiffre.';
comment on column public.family_documents.doc_number_chiffre is
  'Numéro chiffré AES-256-GCM (base64 iv|tag|ct), même convention que contenu_chiffre.';

-- 2) Préférences de verrouillage de l'application (design écran 6).
alter table public.profiles
  add column verrou_delai_minutes smallint not null default 5
    check (verrou_delai_minutes in (0, 1, 5, 15)),
  add column biometrie_activee boolean not null default false;

-- 3) Tickets de révélation : une vérification d'identité ouvre l'accès à UN
--    document, une seule fois, très brièvement. C'est la garde serveur — le
--    verrouillage de l'app, lui, ne protège que l'affichage.
--    Seul le HACHÉ est stocké : le secret ne vit qu'en mémoire, côté client.
create table public.reauth_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  ticket_hash text not null unique,
  -- ressource visée, p. ex. « document:<uuid> » : un ticket ne vaut que pour elle
  cible text not null check (char_length(cible) <= 200),
  expire_le timestamptz not null default now() + interval '2 minutes',
  consomme_le timestamptz,
  created_at timestamptz not null default now()
);
create index reauth_tickets_user_idx on public.reauth_tickets (user_id);
create index reauth_tickets_expire_idx on public.reauth_tickets (expire_le);

alter table public.reauth_tickets enable row level security;
-- Aucun grant pour `authenticated` : la table n'est jamais lue ni écrite
-- directement depuis l'application. Tout passe par les fonctions ci-dessous.
revoke all on public.reauth_tickets from anon, authenticated;

-- Émission : appelée après vérification du mot de passe côté serveur.
create function public.emettre_reauth_ticket(p_hash text, p_cible text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'authentification requise'; end if;
  -- ménage opportuniste : les tickets périmés ne s'accumulent pas
  delete from public.reauth_tickets where expire_le < now() - interval '1 hour';
  insert into public.reauth_tickets (user_id, ticket_hash, cible)
  values (auth.uid(), p_hash, p_cible);
end $$;
revoke execute on function public.emettre_reauth_ticket(text, text) from anon, public;
grant execute on function public.emettre_reauth_ticket(text, text) to authenticated;

-- Consommation : vrai une seule fois, pour la bonne cible, avant expiration.
create function public.consommer_reauth_ticket(p_hash text, p_cible text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  if auth.uid() is null then return false; end if;
  select id into v_id
    from public.reauth_tickets
   where ticket_hash = p_hash
     and user_id = auth.uid()
     and cible = p_cible
     and consomme_le is null
     and expire_le > now()
   for update;
  if v_id is null then return false; end if;
  update public.reauth_tickets set consomme_le = now() where id = v_id;
  return true;
end $$;
revoke execute on function public.consommer_reauth_ticket(text, text) from anon, public;
grant execute on function public.consommer_reauth_ticket(text, text) to authenticated;
