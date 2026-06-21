create type public.voyage_statut as enum ('planifie', 'confirme', 'en_cours', 'termine');
create type public.reservation_type as enum ('hotel', 'vol', 'voiture', 'hebergement', 'autre');

create table public.voyages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  titre text not null check (char_length(titre) <= 200),
  destination text check (destination is null or char_length(destination) <= 200),
  date_debut date,
  date_fin date,
  statut public.voyage_statut not null default 'planifie',
  created_at timestamptz not null default now(),
  check (date_fin is null or date_debut is null or date_fin >= date_debut)
);

create table public.voyage_membres (
  voyage_id uuid not null references public.voyages (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'membre' check (role in ('owner', 'membre')),
  added_at timestamptz not null default now(),
  primary key (voyage_id, profile_id)
);

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  voyage_id uuid not null references public.voyages (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  type public.reservation_type not null default 'autre',
  fournisseur text,
  reference text,
  date_debut date,
  date_fin date,
  conciergerie_tel text,
  conciergerie_mail text,
  lien text,
  notes text,
  created_at timestamptz not null default now(),
  check (date_fin is null or date_debut is null or date_fin >= date_debut)
);

create index voyages_owner_idx on public.voyages (owner_id);
create index voyage_membres_profile_idx on public.voyage_membres (profile_id);
create index reservations_voyage_idx on public.reservations (voyage_id);

-- Helpers security definer (anti-récursion RLS)
create function public.is_voyage_owner(v_id uuid) returns boolean
  language sql security definer set search_path = '' stable as $$
  select exists (select 1 from public.voyages where id = v_id and owner_id = auth.uid());
$$;

create function public.can_access_voyage(v_id uuid) returns boolean
  language sql security definer set search_path = '' stable as $$
  select exists (select 1 from public.voyages where id = v_id and owner_id = auth.uid())
      or exists (select 1 from public.voyage_membres where voyage_id = v_id and profile_id = auth.uid());
$$;

-- RLS voyages (une policy par commande)
alter table public.voyages enable row level security;
create policy "voyages_select" on public.voyages for select using (public.can_access_voyage(id));
create policy "voyages_insert" on public.voyages for insert with check (owner_id = auth.uid());
create policy "voyages_update" on public.voyages for update using (public.can_access_voyage(id)) with check (public.can_access_voyage(id));
create policy "voyages_delete" on public.voyages for delete using (public.is_voyage_owner(id));

-- RLS reservations (collaboratif)
alter table public.reservations enable row level security;
create policy "reservations_all" on public.reservations for all
  using (public.can_access_voyage(voyage_id)) with check (public.can_access_voyage(voyage_id));

-- RLS voyage_membres (lecture = membres ; écriture = owner)
alter table public.voyage_membres enable row level security;
create policy "voyage_membres_select" on public.voyage_membres for select using (public.can_access_voyage(voyage_id));
create policy "voyage_membres_insert" on public.voyage_membres for insert with check (public.is_voyage_owner(voyage_id));
create policy "voyage_membres_delete" on public.voyage_membres for delete using (public.is_voyage_owner(voyage_id));

-- Trigger : auto-insertion du propriétaire dans voyage_membres à la création
create function public.add_voyage_owner_membre() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  insert into public.voyage_membres (voyage_id, profile_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (voyage_id, profile_id) do nothing;
  return new;
end;
$$;
create trigger on_voyage_created after insert on public.voyages
  for each row execute function public.add_voyage_owner_membre();

-- Grants explicites
grant select, insert, update, delete on public.voyages to authenticated;
grant select, insert, update, delete on public.voyage_membres to authenticated;
grant select, insert, update, delete on public.reservations to authenticated;

-- RPC de partage (owner-only, sans énumération d'e-mails)
create function public.share_voyage(p_voyage_id uuid, p_email text) returns text
  language plpgsql security definer set search_path = '' as $$
declare v_uid uuid;
begin
  if auth.uid() is null then raise exception 'authentification requise'; end if;
  if not public.is_voyage_owner(p_voyage_id) then raise exception 'non autorisé'; end if;
  select id into v_uid from auth.users where lower(email) = lower(p_email);
  if v_uid is null then return 'not_found'; end if;
  if v_uid = auth.uid() then return 'self'; end if;
  insert into public.voyage_membres (voyage_id, profile_id, role)
  values (p_voyage_id, v_uid, 'membre')
  on conflict (voyage_id, profile_id) do nothing;
  return 'ok';
end;
$$;

create function public.unshare_voyage(p_voyage_id uuid, p_profile_id uuid) returns void
  language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'authentification requise'; end if;
  if not public.is_voyage_owner(p_voyage_id) then raise exception 'non autorisé'; end if;
  delete from public.voyage_membres
  where voyage_id = p_voyage_id and profile_id = p_profile_id and role <> 'owner';
end;
$$;

revoke execute on function public.share_voyage(uuid, text) from anon, public;
grant execute on function public.share_voyage(uuid, text) to authenticated;
revoke execute on function public.unshare_voyage(uuid, uuid) from anon, public;
grant execute on function public.unshare_voyage(uuid, uuid) to authenticated;
revoke execute on function public.is_voyage_owner(uuid) from anon, public;
revoke execute on function public.can_access_voyage(uuid) from anon, public;
grant execute on function public.is_voyage_owner(uuid) to authenticated;
grant execute on function public.can_access_voyage(uuid) to authenticated;
