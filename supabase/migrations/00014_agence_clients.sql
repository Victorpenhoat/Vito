create table public.agence_clients (
  agence_id uuid not null references public.profiles (id) on delete cascade,
  client_id uuid not null references public.profiles (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (agence_id, client_id),
  check (agence_id <> client_id)
);

create index agence_clients_client_idx on public.agence_clients (client_id);

-- Rôle agence (agence/admin) via claim JWT
create function public.is_agence() returns boolean
  language sql security definer set search_path = '' stable as $$
  select coalesce(auth.jwt() ->> 'user_role', '') in ('agence', 'admin');
$$;

-- RLS
alter table public.agence_clients enable row level security;
create policy "agence_clients_select" on public.agence_clients for select
  using (agence_id = auth.uid() or client_id = auth.uid());
create policy "agence_clients_insert" on public.agence_clients for insert
  with check (agence_id = auth.uid() and public.is_agence());
create policy "agence_clients_delete" on public.agence_clients for delete
  using (agence_id = auth.uid() or client_id = auth.uid());
grant select, insert, update, delete on public.agence_clients to authenticated;

-- RPC : lier un client par e-mail (sans énumération)
create function public.lier_client(p_email text) returns text
  language plpgsql security definer set search_path = '' as $$
declare v_uid uuid;
begin
  if auth.uid() is null then raise exception 'authentification requise'; end if;
  if not public.is_agence() then raise exception 'réservé aux agences'; end if;
  select id into v_uid from auth.users where lower(email) = lower(p_email);
  if v_uid is null then return 'not_found'; end if;
  if v_uid = auth.uid() then return 'self'; end if;
  insert into public.agence_clients (agence_id, client_id) values (auth.uid(), v_uid)
  on conflict (agence_id, client_id) do nothing;
  return 'ok';
end;
$$;

create function public.delier_client(p_client_id uuid) returns void
  language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'authentification requise'; end if;
  delete from public.agence_clients where agence_id = auth.uid() and client_id = p_client_id;
end;
$$;

-- RPC : créer un voyage POUR un client lié (client owner, agence membre)
create function public.creer_voyage_pour_client(
  p_client_id uuid, p_titre text, p_destination text, p_date_debut date, p_date_fin date, p_statut public.voyage_statut
) returns uuid
  language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'authentification requise'; end if;
  if not public.is_agence() then raise exception 'réservé aux agences'; end if;
  if not exists (select 1 from public.agence_clients where agence_id = auth.uid() and client_id = p_client_id) then
    raise exception 'client non lié';
  end if;
  insert into public.voyages (owner_id, titre, destination, date_debut, date_fin, statut)
  values (p_client_id, p_titre, nullif(p_destination, ''), p_date_debut, p_date_fin, coalesce(p_statut, 'planifie'))
  returning id into v_id;
  insert into public.voyage_membres (voyage_id, profile_id, role) values (v_id, auth.uid(), 'membre')
  on conflict (voyage_id, profile_id) do nothing;
  return v_id;
end;
$$;

revoke execute on function public.is_agence() from anon, public;
grant execute on function public.is_agence() to authenticated;
revoke execute on function public.lier_client(text) from anon, public;
grant execute on function public.lier_client(text) to authenticated;
revoke execute on function public.delier_client(uuid) from anon, public;
grant execute on function public.delier_client(uuid) to authenticated;
revoke execute on function public.creer_voyage_pour_client(uuid, text, text, date, date, public.voyage_statut) from anon, public;
grant execute on function public.creer_voyage_pour_client(uuid, text, text, date, date, public.voyage_statut) to authenticated;
