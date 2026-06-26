-- Fonction trigger updated_at générique (réutilisable)
create or replace function public.set_updated_at() returns trigger
  language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Répertoire de proches (privé : owner-only)
create table public.family_members (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  first_name   text not null check (char_length(first_name) between 1 and 120),
  last_name    text not null check (char_length(last_name) between 1 and 120),
  relation     text not null check (relation in ('conjoint','enfant','parent','beau_parent','ami','autre')),
  circle       text not null default 'proche' check (circle in ('proche','elargie','amis')),
  phone        text,
  email        text,
  birth_date   date,
  avatar_color text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Documents rattachés (octets CHIFFRÉS en colonne — pas de bucket)
create table public.family_documents (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  member_id     uuid not null references public.family_members (id) on delete cascade,
  doc_type      text not null check (doc_type in
                  ('passeport','carte_identite','permis_conduire','permis_bateau','visa','titre_sejour','autre')),
  doc_number    text,
  country       text,
  holder_name   text,
  issue_date    date,
  expiry_date   date,
  issue_place   text,
  contenu_chiffre text not null,      -- base64 du blob AES-256-GCM (encryptDocument)
  mime_type     text not null,
  taille        integer not null,
  ocr_raw       jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index family_members_user_idx on public.family_members (user_id);
create index family_documents_user_member_idx on public.family_documents (user_id, member_id);
create index family_documents_expiry_idx on public.family_documents (expiry_date);

create trigger family_members_set_updated_at before update on public.family_members
  for each row execute function public.set_updated_at();
create trigger family_documents_set_updated_at before update on public.family_documents
  for each row execute function public.set_updated_at();

-- RLS owner-only (répertoire privé)
alter table public.family_members enable row level security;
alter table public.family_documents enable row level security;

create policy "family_members_owner" on public.family_members
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "family_documents_owner" on public.family_documents
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Grants explicites (anon exclu)
revoke all on public.family_members from anon;
revoke all on public.family_documents from anon;
grant select, insert, update, delete on public.family_members to authenticated;
grant select, insert, update, delete on public.family_documents to authenticated;
