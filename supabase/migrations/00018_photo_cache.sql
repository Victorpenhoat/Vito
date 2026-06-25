-- Cache de référence photo Google (octets jamais stockés ; conformité ToS via fraîcheur)
alter table public.etablissements
  add column if not exists photo_ref text,
  add column if not exists photo_fetched_at timestamptz;

-- upsert_etablissement étendu : écrit photo_ref + photo_fetched_at quand fourni.
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
begin
  if auth.uid() is null then
    raise exception 'authentification requise';
  end if;

  insert into public.etablissements
    (place_id, categorie, type, nom, adresse, ville, code_postal, arrondissement,
     lat, lng, telephone, website, price_level, source, enriched_at, photo_ref, photo_fetched_at)
  values (
    v_place_id,
    coalesce((p ->> 'categorie')::public.etablissement_categorie, 'resto'),
    p ->> 'type', p ->> 'nom', p ->> 'adresse', p ->> 'ville', p ->> 'code_postal', p ->> 'arrondissement',
    (p ->> 'lat')::double precision, (p ->> 'lng')::double precision,
    p ->> 'telephone', p ->> 'website', (p ->> 'price_level')::smallint,
    coalesce(p ->> 'source', 'places'),
    case when p ? 'enriched_at' then (p ->> 'enriched_at')::timestamptz else null end,
    v_photo_ref,
    case when v_photo_ref is not null then now() else null end
  )
  on conflict (place_id) do update set
    categorie = excluded.categorie, type = excluded.type, nom = excluded.nom,
    adresse = excluded.adresse, ville = excluded.ville, code_postal = excluded.code_postal,
    arrondissement = excluded.arrondissement, lat = excluded.lat, lng = excluded.lng,
    telephone = excluded.telephone, website = excluded.website, price_level = excluded.price_level,
    source = excluded.source, enriched_at = excluded.enriched_at,
    -- garde l'ancienne réf si la nouvelle est nulle ; horodate seulement sur nouvelle réf
    photo_ref = coalesce(excluded.photo_ref, public.etablissements.photo_ref),
    photo_fetched_at = case when excluded.photo_ref is not null then now() else public.etablissements.photo_fetched_at end
  returning id into v_id;

  return v_id;
end;
$$;
revoke execute on function public.upsert_etablissement(jsonb) from anon;
grant execute on function public.upsert_etablissement(jsonb) to authenticated;

-- Remplissage paresseux de la réf photo (référentiel système → écriture via fonction security-definer)
create or replace function public.cache_etablissement_photo(p_etab uuid, p_ref text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'authentification requise';
  end if;
  if nullif(p_ref, '') is null then
    return;
  end if;
  update public.etablissements
    set photo_ref = p_ref, photo_fetched_at = now()
    where id = p_etab;
end;
$$;
revoke execute on function public.cache_etablissement_photo(uuid, text) from anon;
grant execute on function public.cache_etablissement_photo(uuid, text) to authenticated;
