create table public.profil_gouts (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  ambiances text[] not null default '{}',
  budget_max numeric(10, 2) check (budget_max is null or budget_max >= 0),
  types_preferes text[] not null default '{}',
  zones text[] not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.profil_gouts enable row level security;
create policy "profil_gouts_all_owner" on public.profil_gouts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on public.profil_gouts to authenticated;
