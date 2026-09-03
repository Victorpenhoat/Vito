-- Hôtels v2 (Lot H1) : séjours datés, type d'hébergement, équipements
-- fournisseur, infos perso (étoiles, prix/nuit, check-in/out).
-- Tranchage des données : etablissements = référentiel PARTAGÉ écrit uniquement
-- via upsert_etablissement (données fournisseur) ; liste_items/visites = per-user
-- (données saisies — Google Places New ne fournit ni étoiles ni prix/nuit).

-- 1) visites → séjours : plage de dates, voyage lié, occupation.
--    visite_le = date d'arrivée (sémantique inchangée pour les restos).
--    ⚠ La FK voyages ne vérifie PAS l'accès (RLS ignorée par les FK) :
--    l'action marquerSejour vérifie l'accès via un SELECT sous RLS
--    (pattern setOrigine/family_members, 00030).
alter table public.visites
  add column date_fin date check (date_fin is null or date_fin >= visite_le),
  add column voyage_id uuid references public.voyages (id) on delete set null,
  add column adultes  smallint check (adultes  is null or adultes  between 1 and 20),
  add column enfants  smallint check (enfants  is null or enfants  between 0 and 20),
  add column chambres smallint check (chambres is null or chambres between 1 and 10);
create index visites_voyage_idx on public.visites (voyage_id);

-- 2) etablissements : données FOURNISSEUR partagées.
--    type_hebergement dérivé des types[] Google (classifyHebergement) ;
--    equipements = booléens réellement fournis par Places API New
--    ({breakfast, parking, accessibility, goodForChildren, allowsDogs}).
alter table public.etablissements
  add column type_hebergement text check (type_hebergement in ('hotel', 'maison', 'appartement', 'chambre_hotes', 'autre')),
  add column equipements jsonb;

-- 3) liste_items : données PERSO saisies par l'utilisateur.
alter table public.liste_items
  add column etoiles smallint check (etoiles is null or etoiles between 1 and 5),
  add column prix_nuit numeric(8,2) check (prix_nuit is null or prix_nuit >= 0),
  add column checkin_heure time,
  add column checkout_heure time;

-- 4) upsert_etablissement : version 00020 + type_hebergement / equipements.
--    coalesce(excluded…, existant) pour ne pas écraser par null (pattern photo_ref).
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
     rating, rating_count, type_hebergement, equipements)
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
    v_rating_count,
    nullif(p ->> 'type_hebergement', ''),
    case when p ? 'equipements' then (p -> 'equipements') else null end
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
    rating_count = coalesce(excluded.rating_count, public.etablissements.rating_count),
    type_hebergement = coalesce(excluded.type_hebergement, public.etablissements.type_hebergement),
    equipements = coalesce(excluded.equipements, public.etablissements.equipements)
  returning id into v_id;

  return v_id;
end;
$$;

-- 5) Reprise des avis HÔTELS → visites (note /5 → /10), miroir exact du bloc
--    resto de 00030. `avis` + AvisForm restent en lecture (dépréciés côté hôtel,
--    retirés de la fiche au lot H3) — pas de drop.
insert into public.visites (user_id, liste_item_id, note, commentaire, visite_le, created_at)
select a.user_id, li.id, a.note * 2, a.commentaire,
       coalesce(a.visite_le, a.created_at::date), a.created_at
from public.avis a
join public.liste_items li
  on li.user_id = a.user_id and li.etablissement_id = a.etablissement_id
join public.etablissements e
  on e.id = a.etablissement_id and e.categorie = 'hotel';
