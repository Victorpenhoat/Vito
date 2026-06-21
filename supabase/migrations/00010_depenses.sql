create type public.depense_mode as enum ('egal', 'exact');

create table public.depense_groupes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  voyage_id uuid references public.voyages (id) on delete set null,
  titre text not null check (char_length(titre) <= 200),
  devise text not null default 'EUR' check (char_length(devise) = 3),
  created_at timestamptz not null default now()
);

create table public.depense_groupe_membres (
  groupe_id uuid not null references public.depense_groupes (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'membre' check (role in ('owner', 'membre')),
  added_at timestamptz not null default now(),
  primary key (groupe_id, profile_id)
);

create table public.depenses (
  id uuid primary key default gen_random_uuid(),
  groupe_id uuid not null references public.depense_groupes (id) on delete cascade,
  paye_par uuid not null references public.profiles (id) on delete cascade,
  libelle text not null check (char_length(libelle) <= 200),
  montant_cents bigint not null check (montant_cents > 0),
  date date,
  mode public.depense_mode not null default 'egal',
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.depense_parts (
  depense_id uuid not null references public.depenses (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  part_cents bigint not null check (part_cents >= 0),
  primary key (depense_id, profile_id)
);

create table public.remboursements (
  id uuid primary key default gen_random_uuid(),
  groupe_id uuid not null references public.depense_groupes (id) on delete cascade,
  de_profile_id uuid not null references public.profiles (id) on delete cascade,
  vers_profile_id uuid not null references public.profiles (id) on delete cascade,
  montant_cents bigint not null check (montant_cents > 0),
  date date,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (de_profile_id <> vers_profile_id)
);

create index depense_groupes_owner_idx on public.depense_groupes (owner_id);
create index depense_groupes_voyage_idx on public.depense_groupes (voyage_id);
create index depense_groupe_membres_profile_idx on public.depense_groupe_membres (profile_id);
create index depenses_groupe_idx on public.depenses (groupe_id);
create index depense_parts_profile_idx on public.depense_parts (profile_id);
create index remboursements_groupe_idx on public.remboursements (groupe_id);

-- Helpers security definer (anti-récursion RLS)
create function public.is_groupe_owner(g_id uuid) returns boolean
  language sql security definer set search_path = '' stable as $$
  select exists (select 1 from public.depense_groupes where id = g_id and owner_id = auth.uid());
$$;

create function public.can_access_groupe(g_id uuid) returns boolean
  language sql security definer set search_path = '' stable as $$
  select exists (select 1 from public.depense_groupes where id = g_id and owner_id = auth.uid())
      or exists (select 1 from public.depense_groupe_membres where groupe_id = g_id and profile_id = auth.uid());
$$;

create function public.is_groupe_membre(g_id uuid, p_id uuid) returns boolean
  language sql security definer set search_path = '' stable as $$
  select exists (select 1 from public.depense_groupe_membres where groupe_id = g_id and profile_id = p_id);
$$;

-- Trigger : owner_id immuable (anti-escalade de privilèges, leçon C4)
create function public.depense_groupes_lock_owner() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  if new.owner_id <> old.owner_id then
    raise exception 'owner_id immuable';
  end if;
  return new;
end;
$$;
create trigger depense_groupes_owner_immutable before update on public.depense_groupes
  for each row execute function public.depense_groupes_lock_owner();

-- Trigger : auto-insertion du propriétaire dans depense_groupe_membres à la création
create function public.add_groupe_owner_membre() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  insert into public.depense_groupe_membres (groupe_id, profile_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (groupe_id, profile_id) do nothing;
  return new;
end;
$$;
create trigger on_groupe_created after insert on public.depense_groupes
  for each row execute function public.add_groupe_owner_membre();

-- RLS depense_groupes (une policy par commande)
alter table public.depense_groupes enable row level security;
-- Note: owner_id = auth.uid() is required as a direct check so that INSERT ... RETURNING works:
-- the newly inserted row is not visible to can_access_groupe() within the same INSERT statement
-- (PostgreSQL row visibility rules), so without the direct owner check, INSERT ... select().single()
-- would fail with an RLS violation on the RETURNING clause.
create policy "depense_groupes_select" on public.depense_groupes for select using (owner_id = auth.uid() or public.can_access_groupe(id));
create policy "depense_groupes_insert" on public.depense_groupes for insert with check (owner_id = auth.uid());
create policy "depense_groupes_update" on public.depense_groupes for update using (public.can_access_groupe(id)) with check (public.can_access_groupe(id));
create policy "depense_groupes_delete" on public.depense_groupes for delete using (public.is_groupe_owner(id));

-- RLS depense_groupe_membres (lecture = membres ; écriture = owner ; owner non retirable)
alter table public.depense_groupe_membres enable row level security;
create policy "depense_groupe_membres_select" on public.depense_groupe_membres for select using (public.can_access_groupe(groupe_id));
create policy "depense_groupe_membres_insert" on public.depense_groupe_membres for insert with check (public.is_groupe_owner(groupe_id));
create policy "depense_groupe_membres_delete" on public.depense_groupe_membres for delete
  using (public.is_groupe_owner(groupe_id) and role <> 'owner');

-- RLS depenses (collaboratif)
alter table public.depenses enable row level security;
create policy "depenses_all" on public.depenses for all
  using (public.can_access_groupe(groupe_id))
  with check (public.can_access_groupe(groupe_id) and public.is_groupe_membre(groupe_id, paye_par));

-- RLS depense_parts (gardé via le groupe de la dépense parente)
alter table public.depense_parts enable row level security;
create policy "depense_parts_all" on public.depense_parts for all
  using (public.can_access_groupe((select groupe_id from public.depenses where id = depense_id)))
  with check (
    public.can_access_groupe((select groupe_id from public.depenses where id = depense_id))
    and public.is_groupe_membre((select groupe_id from public.depenses where id = depense_id), profile_id)
  );

-- RLS remboursements (collaboratif)
alter table public.remboursements enable row level security;
create policy "remboursements_all" on public.remboursements for all
  using (public.can_access_groupe(groupe_id))
  with check (
    public.can_access_groupe(groupe_id)
    and public.is_groupe_membre(groupe_id, de_profile_id)
    and public.is_groupe_membre(groupe_id, vers_profile_id)
  );

-- Grants explicites
grant select, insert, update, delete on public.depense_groupes to authenticated;
grant select, insert, update, delete on public.depense_groupe_membres to authenticated;
grant select, insert, update, delete on public.depenses to authenticated;
grant select, insert, update, delete on public.depense_parts to authenticated;
grant select, insert, update, delete on public.remboursements to authenticated;

-- RPC de partage (owner-only, sans énumération d'e-mails)
create function public.share_groupe(p_groupe_id uuid, p_email text) returns text
  language plpgsql security definer set search_path = '' as $$
declare v_uid uuid;
begin
  if auth.uid() is null then raise exception 'authentification requise'; end if;
  if not public.is_groupe_owner(p_groupe_id) then raise exception 'non autorisé'; end if;
  select id into v_uid from auth.users where lower(email) = lower(p_email);
  if v_uid is null then return 'not_found'; end if;
  if v_uid = auth.uid() then return 'self'; end if;
  insert into public.depense_groupe_membres (groupe_id, profile_id, role)
  values (p_groupe_id, v_uid, 'membre')
  on conflict (groupe_id, profile_id) do nothing;
  return 'ok';
end;
$$;

create function public.unshare_groupe(p_groupe_id uuid, p_profile_id uuid) returns void
  language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'authentification requise'; end if;
  if not public.is_groupe_owner(p_groupe_id) then raise exception 'non autorisé'; end if;
  delete from public.depense_groupe_membres
  where groupe_id = p_groupe_id and profile_id = p_profile_id and role <> 'owner';
end;
$$;

revoke execute on function public.share_groupe(uuid, text) from anon, public;
grant execute on function public.share_groupe(uuid, text) to authenticated;
revoke execute on function public.unshare_groupe(uuid, uuid) from anon, public;
grant execute on function public.unshare_groupe(uuid, uuid) to authenticated;
revoke execute on function public.is_groupe_owner(uuid) from anon, public;
revoke execute on function public.can_access_groupe(uuid) from anon, public;
grant execute on function public.is_groupe_owner(uuid) to authenticated;
grant execute on function public.can_access_groupe(uuid) to authenticated;
revoke execute on function public.is_groupe_membre(uuid, uuid) from anon, public;
grant execute on function public.is_groupe_membre(uuid, uuid) to authenticated;
