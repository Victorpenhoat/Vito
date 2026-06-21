-- Rôles RBAC explicites, extensibles
create type public.app_role as enum ('client', 'agence', 'admin');

-- Profil 1:1 avec auth.users
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.app_role not null default 'client',
  display_name text check (display_name is null or char_length(display_name) <= 100),
  locale text not null default 'fr' check (locale ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Lecture/écriture de son propre profil ; admin lit tout (claim JWT, voir 00002)
create policy "profiles_select_self_or_admin" on public.profiles
  for select using (
    id = auth.uid()
    or coalesce(auth.jwt() ->> 'user_role', '') = 'admin'
  );

create policy "profiles_update_self" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- Pas de policy INSERT : les profils sont créés exclusivement par le trigger
-- handle_new_user (security definer). Tout INSERT direct via l'API est volontairement bloqué.

-- Création automatique du profil à l'inscription
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- SÉCURITÉ : le rôle n'est jamais lu depuis raw_user_meta_data (contrôlé par le client).
  -- Tout nouvel utilisateur est 'client' (défaut de colonne). Les rôles agence/admin sont
  -- attribués uniquement par une opération privilégiée (seed SQL, ou RPC admin du back-office).
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
