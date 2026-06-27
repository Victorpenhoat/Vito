-- liste_items : source de reco + archivage (orthogonaux statut/favori)
alter table public.liste_items add column if not exists reco_source text;
alter table public.liste_items add column if not exists is_archived boolean not null default false;
alter table public.liste_items add column if not exists archived_at timestamptz;

-- etablissements : note Google (stockée à l'enrichissement)
alter table public.etablissements add column if not exists rating numeric(2,1)
  check (rating is null or (rating >= 0 and rating <= 5));
alter table public.etablissements add column if not exists rating_count integer
  check (rating_count is null or rating_count >= 0);

-- upsert_etablissement : version 00018 + rating/rating_count
create or replace function public.upsert_etablissement(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_place_id text := nullif(p ->> 'place_id', '');
  v_photo_ref text := nullif(p ->> 'photo_ref', '');
  v_rating numeric(2,1) := nullif(p ->> 'rating', '')::numeric;
  v_rating_count integer := nullif(p ->> 'rating_count', '')::integer;
begin
  if auth.uid() is null then
    raise exception 'authentification requise';
  end if;

  insert into public.etablissements
    (place_id, categorie, type, nom, adresse, ville, code_postal, arrondissement,
     lat, lng, telephone, website, price_level, source, enriched_at, photo_ref, photo_fetched_at,
     rating, rating_count)
  values (
    v_place_id,
    coalesce((p ->> 'categorie')::public.etablissement_categorie, 'resto'),
    p ->> 'type', p ->> 'nom', p ->> 'adresse', p ->> 'ville', p ->> 'code_postal', p ->> 'arrondissement',
    (p ->> 'lat')::double precision, (p ->> 'lng')::double precision,
    p ->> 'telephone', p ->> 'website', (p ->> 'price_level')::smallint,
    coalesce(p ->> 'source', 'places'),
    case when p ? 'enriched_at' then (p ->> 'enriched_at')::timestamptz else null end,
    v_photo_ref,
    case when v_photo_ref is not null then now() else null end,
    v_rating,
    v_rating_count
  )
  on conflict (place_id) do update set
    categorie = excluded.categorie, type = excluded.type, nom = excluded.nom,
    adresse = excluded.adresse, ville = excluded.ville, code_postal = excluded.code_postal,
    arrondissement = excluded.arrondissement, lat = excluded.lat, lng = excluded.lng,
    telephone = excluded.telephone, website = excluded.website, price_level = excluded.price_level,
    source = excluded.source, enriched_at = excluded.enriched_at,
    photo_ref = coalesce(excluded.photo_ref, public.etablissements.photo_ref),
    photo_fetched_at = case when excluded.photo_ref is not null then now() else public.etablissements.photo_fetched_at end,
    rating = coalesce(excluded.rating, public.etablissements.rating),
    rating_count = coalesce(excluded.rating_count, public.etablissements.rating_count)
  returning id into v_id;

  return v_id;
end;
$$;
