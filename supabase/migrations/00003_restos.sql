-- Référentiel partagé des établissements (lecture seule pour les clients)
create type public.etablissement_categorie as enum ('resto', 'hotel');

create table public.etablissements (
  id uuid primary key default gen_random_uuid(),
  place_id text unique,
  categorie public.etablissement_categorie not null default 'resto',
  type text,                         -- étoilé / bistrot / brasserie… (classification)
  nom text not null,
  adresse text,
  ville text,
  code_postal text,
  arrondissement text,
  lat double precision,
  lng double precision,
  telephone text,
  website text,
  price_level smallint,
  source text not null default 'manual',
  enriched_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.etablissements enable row level security;

-- Lecture pour tout authentifié ; AUCUNE écriture directe (passe par la RPC)
create policy "etab_select_authenticated" on public.etablissements
  for select to authenticated using (true);

-- Taxonomie de tags (ambiance…), extensible
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  label text not null,
  categorie text not null default 'ambiance',
  is_system boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.tags enable row level security;
create policy "tags_select_authenticated" on public.tags
  for select to authenticated using (true);

-- Relation perso user <-> établissement (liste « à faire » + favoris fusionnés)
create type public.liste_statut as enum ('a_faire', 'visite');

create table public.liste_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  etablissement_id uuid not null references public.etablissements (id) on delete cascade,
  statut public.liste_statut not null default 'a_faire',
  is_favorite boolean not null default false,
  montant_par_personne numeric(10, 2),
  added_at timestamptz not null default now(),
  unique (user_id, etablissement_id)
);

alter table public.liste_items enable row level security;
create policy "liste_items_all_owner" on public.liste_items
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Tags appliqués par l'utilisateur sur son item (classification perso)
create table public.liste_item_tags (
  liste_item_id uuid not null references public.liste_items (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (liste_item_id, tag_id)
);

alter table public.liste_item_tags enable row level security;
-- L'ownership dérive du liste_item parent
create policy "liste_item_tags_all_owner" on public.liste_item_tags
  for all using (
    exists (
      select 1 from public.liste_items li
      where li.id = liste_item_id and li.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.liste_items li
      where li.id = liste_item_id and li.user_id = auth.uid()
    )
  );

-- Avis perso libres, plusieurs par établissement
create table public.avis (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  etablissement_id uuid not null references public.etablissements (id) on delete cascade,
  note smallint check (note is null or note between 1 and 5),  -- note optionnelle (avis libre possible)
  commentaire text,
  visite_le date,
  created_at timestamptz not null default now()
);

alter table public.avis enable row level security;
create policy "avis_all_owner" on public.avis
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- RPC contrôlée : seul moyen d'écrire dans etablissements.
-- Upsert par place_id si fourni, sinon insert. Retourne l'id.
create function public.upsert_etablissement(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_place_id text := nullif(p ->> 'place_id', '');
begin
  if auth.uid() is null then
    raise exception 'authentification requise';
  end if;

  -- Vrai upsert par place_id : insère, ou rafraîchit les champs enrichis si le place_id existe déjà.
  -- (un place_id NULL ne déclenche jamais de conflit -> insertion simple, ce qui est voulu.)
  insert into public.etablissements
    (place_id, categorie, type, nom, adresse, ville, code_postal, arrondissement,
     lat, lng, telephone, website, price_level, source, enriched_at)
  values (
    v_place_id,
    coalesce((p ->> 'categorie')::public.etablissement_categorie, 'resto'),
    p ->> 'type',
    p ->> 'nom',
    p ->> 'adresse',
    p ->> 'ville',
    p ->> 'code_postal',
    p ->> 'arrondissement',
    (p ->> 'lat')::double precision,
    (p ->> 'lng')::double precision,
    p ->> 'telephone',
    p ->> 'website',
    (p ->> 'price_level')::smallint,
    coalesce(p ->> 'source', 'places'),
    case when p ? 'enriched_at' then (p ->> 'enriched_at')::timestamptz else null end
  )
  on conflict (place_id) do update set
    categorie      = excluded.categorie,
    type           = excluded.type,
    nom            = excluded.nom,
    adresse        = excluded.adresse,
    ville          = excluded.ville,
    code_postal    = excluded.code_postal,
    arrondissement = excluded.arrondissement,
    lat            = excluded.lat,
    lng            = excluded.lng,
    telephone      = excluded.telephone,
    website        = excluded.website,
    price_level    = excluded.price_level,
    source         = excluded.source,
    enriched_at    = excluded.enriched_at
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.upsert_etablissement(jsonb) from anon;
grant execute on function public.upsert_etablissement(jsonb) to authenticated;
