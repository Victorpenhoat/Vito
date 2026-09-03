-- Onboarding & Compte (Lot O-C) : inscription SUR INVITATION uniquement
-- (décision PO). Un lien ou un code est nécessaire pour créer un compte.
--
-- Deux verrous complémentaires :
--   1. `enable_signup = false` dans supabase/config.toml → l'API publique
--      /auth/v1/signup refuse tout, on ne peut donc pas contourner l'app.
--   2. La création passe par une action serveur qui valide le jeton puis
--      utilise l'Admin API (service role). C'est le seul chemin.

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  -- jeton porté par l'URL ; c'est le secret, d'où l'unicité et la longueur
  token text not null unique check (char_length(token) between 24 and 128),
  -- adresse ciblée : si renseignée, l'invitation ne vaut que pour elle
  email text check (email is null or char_length(email) <= 320),
  role_vise text not null default 'membre' check (role_vise in ('membre', 'invite', 'cercle')),
  -- invitation à un voyage précis (l'invité n'aura accès qu'à celui-là)
  voyage_id uuid references public.voyages (id) on delete cascade,
  cree_par uuid not null references public.profiles (id) on delete cascade,
  expire_le timestamptz not null default now() + interval '14 days',
  consomme_le timestamptz,
  consomme_par uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  -- une invitation consommée porte toujours son bénéficiaire
  constraint invitations_consommation_coherente
    check ((consomme_le is null) = (consomme_par is null))
);
create index invitations_cree_par_idx on public.invitations (cree_par);
create index invitations_voyage_idx on public.invitations (voyage_id);

alter table public.invitations enable row level security;

-- Seul l'émetteur voit ses invitations (l'invité, lui, passe par les RPC).
create policy "invitations_select_emetteur" on public.invitations
  for select to authenticated
  using (cree_par = (select auth.uid()));
create policy "invitations_insert_emetteur" on public.invitations
  for insert to authenticated
  with check (cree_par = (select auth.uid()));
create policy "invitations_delete_emetteur" on public.invitations
  for delete to authenticated
  using (cree_par = (select auth.uid()) and consomme_le is null);
grant select, insert, delete on public.invitations to authenticated;
-- Rien pour anon (00025) : l'accès anonyme se fait UNIQUEMENT via la RPC ci-dessous.

-- Acceptation explicite des conditions (design écran 7 « Confidentialité »).
alter table public.profiles
  add column conditions_acceptees_le timestamptz;

-- ── RPC ────────────────────────────────────────────────────────────────────

-- Ce que l'invité voit AVANT de créer son compte (design écran 12). Appelable
-- sans session. Anti-énumération : un jeton inconnu, expiré ou déjà consommé
-- renvoie la même forme avec valide = false, sans jamais dire lequel des trois.
-- L'email ciblé n'est pas renvoyé en clair (on ne confirme pas une adresse à un
-- tiers) : seul un indice masqué est exposé.
create function public.invitation_infos(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_inv public.invitations;
  v_voyage public.voyages;
  v_nom text;
begin
  select * into v_inv from public.invitations where token = p_token;
  if v_inv.id is null or v_inv.consomme_le is not null or v_inv.expire_le < now() then
    return jsonb_build_object('valide', false);
  end if;
  select display_name into v_nom from public.profiles where id = v_inv.cree_par;
  if v_inv.voyage_id is not null then
    select * into v_voyage from public.voyages where id = v_inv.voyage_id;
  end if;
  return jsonb_build_object(
    'valide', true,
    'role_vise', v_inv.role_vise,
    'invite_par', coalesce(v_nom, ''),
    'email_indice', case
      when v_inv.email is null then null
      -- « v…@gmail.com » : assez pour se reconnaître, pas pour découvrir l'adresse
      else left(v_inv.email, 1) || '…@' || split_part(v_inv.email, '@', 2)
    end,
    'email_impose', v_inv.email is not null,
    'voyage_titre', coalesce(v_voyage.titre, null),
    'voyage_destination', coalesce(v_voyage.destination, null),
    'voyage_date_debut', v_voyage.date_debut,
    'voyage_date_fin', v_voyage.date_fin
  );
end $$;
revoke execute on function public.invitation_infos(text) from public;
grant execute on function public.invitation_infos(text) to anon, authenticated;

-- Consommation : appelée par l'utilisateur FRAÎCHEMENT créé (donc authentifié).
-- Vérifie la validité, marque l'invitation, et donne l'accès promis (membre du
-- voyage le cas échéant). Le rôle applicatif de `profiles` n'est pas touché :
-- il reste sous le verrou de 00022 (anti-escalade).
create function public.consommer_invitation(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv public.invitations;
  v_uid uuid := auth.uid();
  v_email text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'motif', 'non_authentifie');
  end if;
  select * into v_inv from public.invitations where token = p_token for update;
  if v_inv.id is null or v_inv.consomme_le is not null or v_inv.expire_le < now() then
    return jsonb_build_object('ok', false, 'motif', 'invalide');
  end if;
  -- invitation nominative : l'adresse du compte doit correspondre
  if v_inv.email is not null then
    select email into v_email from auth.users where id = v_uid;
    if lower(coalesce(v_email, '')) <> lower(v_inv.email) then
      return jsonb_build_object('ok', false, 'motif', 'invalide');
    end if;
  end if;

  update public.invitations
     set consomme_le = now(), consomme_par = v_uid
   where id = v_inv.id;

  if v_inv.voyage_id is not null then
    insert into public.voyage_membres (voyage_id, profile_id, role)
    values (v_inv.voyage_id, v_uid, 'membre')
    on conflict (voyage_id, profile_id) do nothing;
  end if;

  return jsonb_build_object('ok', true, 'role_vise', v_inv.role_vise, 'voyage_id', v_inv.voyage_id);
end $$;
revoke execute on function public.consommer_invitation(text) from anon, public;
grant execute on function public.consommer_invitation(text) to authenticated;
