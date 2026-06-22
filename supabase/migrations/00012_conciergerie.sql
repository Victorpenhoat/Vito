create type public.conciergerie_type as enum ('resto', 'hotel');
create type public.conciergerie_statut as enum ('nouvelle', 'en_cours', 'confirmee', 'refusee');

create table public.conciergerie_demandes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type public.conciergerie_type not null,
  etablissement_id uuid not null references public.etablissements (id) on delete restrict,
  statut public.conciergerie_statut not null default 'nouvelle',
  avec_enfants boolean not null default false,
  nb_enfants integer not null default 0 check (nb_enfants >= 0),
  commentaire text check (commentaire is null or char_length(commentaire) <= 2000),
  date_resa date,
  heure_resa time,
  nombre_convives integer check (nombre_convives is null or nombre_convives > 0),
  chaise_haute boolean,
  occasion text check (occasion is null or occasion in ('amis','famille','anniversaire','autre')),
  date_debut date,
  nombre_nuits integer check (nombre_nuits is null or nombre_nuits > 0),
  sejour_type text check (sejour_type is null or sejour_type in ('loisirs','pro')),
  enfants_ages integer[],
  reponse text check (reponse is null or char_length(reponse) <= 2000),
  repondu_par uuid references public.profiles (id) on delete set null,
  repondu_le timestamptz,
  created_at timestamptz not null default now(),
  check (type <> 'resto' or (date_resa is not null and heure_resa is not null and nombre_convives is not null)),
  check (type <> 'hotel' or (date_debut is not null and nombre_nuits is not null))
);

create index conciergerie_demandes_user_idx on public.conciergerie_demandes (user_id);
create index conciergerie_demandes_statut_idx on public.conciergerie_demandes (statut);

-- Staff concierge (agence/admin) via claim JWT
create function public.is_concierge() returns boolean
  language sql security definer set search_path = '' stable as $$
  select coalesce(auth.jwt() ->> 'user_role', '') in ('agence', 'admin');
$$;

alter table public.conciergerie_demandes enable row level security;

create policy "conciergerie_select" on public.conciergerie_demandes for select
  using (user_id = auth.uid() or public.is_concierge());

create policy "conciergerie_insert" on public.conciergerie_demandes for insert
  with check (user_id = auth.uid() and public.is_premium(auth.uid()));

create policy "conciergerie_update" on public.conciergerie_demandes for update
  using (public.is_concierge()) with check (public.is_concierge());

create policy "conciergerie_delete" on public.conciergerie_demandes for delete
  using (user_id = auth.uid() or public.is_concierge());

grant select, insert, update, delete on public.conciergerie_demandes to authenticated;

revoke execute on function public.is_concierge() from anon, public;
grant execute on function public.is_concierge() to authenticated;
