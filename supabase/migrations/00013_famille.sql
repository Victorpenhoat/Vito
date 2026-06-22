create table public.familles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  nom text not null check (char_length(nom) between 1 and 120),
  created_at timestamptz not null default now()
);

create table public.famille_membres (
  famille_id uuid not null references public.familles (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'membre' check (role in ('owner', 'membre')),
  added_at timestamptz not null default now(),
  primary key (famille_id, profile_id),
  unique (profile_id)
);

create table public.famille_restos (
  famille_id uuid not null references public.familles (id) on delete cascade,
  etablissement_id uuid not null references public.etablissements (id) on delete cascade,
  added_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (famille_id, etablissement_id)
);

create index familles_owner_idx on public.familles (owner_id);
create index famille_restos_famille_idx on public.famille_restos (famille_id);

-- Helpers security definer (anti-récursion RLS)
create function public.is_famille_owner(f_id uuid) returns boolean
  language sql security definer set search_path = '' stable as $$
  select exists (select 1 from public.familles where id = f_id and owner_id = auth.uid());
$$;

create function public.can_access_famille(f_id uuid) returns boolean
  language sql security definer set search_path = '' stable as $$
  select exists (select 1 from public.familles where id = f_id and owner_id = auth.uid())
      or exists (select 1 from public.famille_membres where famille_id = f_id and profile_id = auth.uid());
$$;

-- Trigger : owner_id immuable
create function public.familles_lock_owner() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  if new.owner_id <> old.owner_id then raise exception 'owner_id immuable'; end if;
  return new;
end;
$$;
create trigger familles_owner_immutable before update on public.familles
  for each row execute function public.familles_lock_owner();

-- Trigger : auto-insertion du owner dans famille_membres (échoue si déjà dans une famille -> UNIQUE)
create function public.add_famille_owner_membre() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  insert into public.famille_membres (famille_id, profile_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;
create trigger on_famille_created after insert on public.familles
  for each row execute function public.add_famille_owner_membre();

-- RLS familles
alter table public.familles enable row level security;
create policy "familles_select" on public.familles for select using (public.can_access_famille(id));
create policy "familles_insert" on public.familles for insert with check (owner_id = auth.uid());
create policy "familles_update" on public.familles for update using (public.can_access_famille(id)) with check (public.can_access_famille(id));
create policy "familles_delete" on public.familles for delete using (public.is_famille_owner(id));

-- RLS famille_membres (lecture = membres ; écriture owner ; owner non retirable)
alter table public.famille_membres enable row level security;
create policy "famille_membres_select" on public.famille_membres for select using (public.can_access_famille(famille_id));
create policy "famille_membres_insert" on public.famille_membres for insert with check (public.is_famille_owner(famille_id));
create policy "famille_membres_delete" on public.famille_membres for delete using (public.is_famille_owner(famille_id) and role <> 'owner');

-- RLS famille_restos (collaboratif)
alter table public.famille_restos enable row level security;
create policy "famille_restos_all" on public.famille_restos for all
  using (public.can_access_famille(famille_id)) with check (public.can_access_famille(famille_id));

-- Grants explicites
grant select, insert, update, delete on public.familles to authenticated;
grant select, insert, update, delete on public.famille_membres to authenticated;
grant select, insert, update, delete on public.famille_restos to authenticated;

-- RPC invitation (owner-only, sans énumération, gère l'unicité de foyer)
create function public.inviter_famille(p_famille_id uuid, p_email text) returns text
  language plpgsql security definer set search_path = '' as $$
declare v_uid uuid;
begin
  if auth.uid() is null then raise exception 'authentification requise'; end if;
  if not public.is_famille_owner(p_famille_id) then raise exception 'non autorisé'; end if;
  select id into v_uid from auth.users where lower(email) = lower(p_email);
  if v_uid is null then return 'not_found'; end if;
  if v_uid = auth.uid() then return 'self'; end if;
  begin
    insert into public.famille_membres (famille_id, profile_id, role) values (p_famille_id, v_uid, 'membre');
  exception when unique_violation then
    return 'deja_famille';
  end;
  return 'ok';
end;
$$;

create function public.quitter_famille() returns void
  language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'authentification requise'; end if;
  delete from public.famille_membres where profile_id = auth.uid() and role <> 'owner';
end;
$$;

create function public.retirer_membre_famille(p_famille_id uuid, p_profile_id uuid) returns void
  language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'authentification requise'; end if;
  if not public.is_famille_owner(p_famille_id) then raise exception 'non autorisé'; end if;
  delete from public.famille_membres where famille_id = p_famille_id and profile_id = p_profile_id and role <> 'owner';
end;
$$;

revoke execute on function public.inviter_famille(uuid, text) from anon, public;
grant execute on function public.inviter_famille(uuid, text) to authenticated;
revoke execute on function public.quitter_famille() from anon, public;
grant execute on function public.quitter_famille() to authenticated;
revoke execute on function public.retirer_membre_famille(uuid, uuid) from anon, public;
grant execute on function public.retirer_membre_famille(uuid, uuid) to authenticated;
revoke execute on function public.is_famille_owner(uuid) from anon, public;
revoke execute on function public.can_access_famille(uuid) from anon, public;
grant execute on function public.is_famille_owner(uuid) to authenticated;
grant execute on function public.can_access_famille(uuid) to authenticated;
