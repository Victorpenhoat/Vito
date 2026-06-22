create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  tier text not null default 'premium' check (tier in ('premium')),
  status text not null check (status in ('active', 'canceled')),
  period text not null check (period in ('monthly', 'yearly')),
  current_period_end timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index subscriptions_user_idx on public.subscriptions (user_id);

-- Statut premium (security definer : lit subscriptions sans exposer les lignes d'autrui)
create function public.is_premium(uid uuid) returns boolean
  language sql security definer set search_path = '' stable as $$
  select exists (
    select 1 from public.subscriptions
    where user_id = uid
      and (status = 'active' or (status = 'canceled' and current_period_end > now()))
  );
$$;

-- Souscription mock (le vrai Stripe passera par un webhook service-role)
create function public.mock_subscribe(p_period text) returns void
  language plpgsql security definer set search_path = '' as $$
declare v_uid uuid; v_end timestamptz;
begin
  v_uid := auth.uid();
  if v_uid is null then raise exception 'authentification requise'; end if;
  if p_period not in ('monthly', 'yearly') then raise exception 'période invalide'; end if;
  v_end := now() + (case p_period when 'monthly' then interval '1 month' else interval '1 year' end);
  insert into public.subscriptions (user_id, tier, status, period, current_period_end)
  values (v_uid, 'premium', 'active', p_period, v_end)
  on conflict (user_id) do update
    set status = 'active', period = excluded.period,
        current_period_end = excluded.current_period_end, updated_at = now();
end;
$$;

create function public.cancel_subscription() returns void
  language plpgsql security definer set search_path = '' as $$
declare v_uid uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then raise exception 'authentification requise'; end if;
  update public.subscriptions set status = 'canceled', updated_at = now()
  where user_id = v_uid;
end;
$$;

-- Limite de voyages en Free (gating DB-level ; FREE_VOYAGE_LIMIT = 2, à garder synchro avec la constante domain)
create function public.enforce_voyage_limit() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_premium(new.owner_id)
     and (select count(*) from public.voyages where owner_id = new.owner_id) >= 2 then
    raise exception 'limite_voyages_free' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger voyages_free_limit before insert on public.voyages
  for each row execute function public.enforce_voyage_limit();

-- RLS : lecture de sa propre ligne uniquement ; AUCUNE écriture directe par authenticated
alter table public.subscriptions enable row level security;
create policy "subscriptions_select_own" on public.subscriptions
  for select using (user_id = auth.uid());
grant select on public.subscriptions to authenticated;

-- Grants des fonctions
revoke execute on function public.is_premium(uuid) from anon, public;
revoke execute on function public.mock_subscribe(text) from anon, public;
revoke execute on function public.cancel_subscription() from anon, public;
grant execute on function public.is_premium(uuid) to authenticated;
grant execute on function public.mock_subscribe(text) to authenticated;
grant execute on function public.cancel_subscription() to authenticated;
