create type public.vin_couleur as enum ('rouge', 'blanc', 'rose', 'petillant', 'autre');

create table public.vins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  nom text not null check (char_length(nom) <= 200),
  domaine text check (domaine is null or char_length(domaine) <= 200),
  millesime smallint check (millesime is null or (millesime between 1900 and 2100)),
  region text,
  couleur public.vin_couleur,
  cepages text[] not null default '{}',
  achat_url text,
  created_at timestamptz not null default now()
);

-- Dédoublonnage par cave : (nom, millésime, domaine) normalisés = un seul vin
create unique index vins_dedup_uidx on public.vins
  (user_id, lower(nom), coalesce(millesime, 0), lower(coalesce(domaine, '')));
create index vins_user_idx on public.vins (user_id);

alter table public.vins enable row level security;
create policy "vins_all_owner" on public.vins
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.degustations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  vin_id uuid not null references public.vins (id) on delete cascade,
  etablissement_id uuid references public.etablissements (id) on delete set null,
  avis_id uuid references public.avis (id) on delete set null,
  deguste_le date not null default current_date,
  note smallint check (note is null or note between 1 and 5),
  prix_paye numeric(10, 2) check (prix_paye is null or prix_paye >= 0),
  commentaire text,
  created_at timestamptz not null default now()
);

create index degustations_user_idx on public.degustations (user_id);
create index degustations_vin_idx on public.degustations (vin_id);
create index degustations_etab_idx on public.degustations (etablissement_id);
create index degustations_date_idx on public.degustations (deguste_le);

alter table public.degustations enable row level security;
create policy "degustations_all_owner" on public.degustations
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Grants explicites (la RLS ne suffit pas pour PostgREST)
grant select, insert, update, delete on public.vins to authenticated;
grant select, insert, update, delete on public.degustations to authenticated;
