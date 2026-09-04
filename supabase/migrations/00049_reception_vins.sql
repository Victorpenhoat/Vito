-- Boîte de réception : recommander un VIN.
--
-- Les adresses passaient par le fournisseur (un `place_id` suffit, l'acceptation
-- appelle `ajouterAuCarnet`). Un vin n'a pas de fournisseur : il se décrit, et
-- son acceptation crée une bouteille dans la Cave du destinataire via
-- `find_or_create_vin` — la même RPC de dédoublonnage que la capture
-- d'étiquette, pour qu'un vin recommandé et un vin photographié ne fassent
-- jamais deux entrées.

alter table public.recommandations
  add column vin_nom text check (vin_nom is null or char_length(vin_nom) between 1 and 200),
  add column vin_domaine text check (vin_domaine is null or char_length(vin_domaine) <= 200),
  add column vin_millesime smallint check (vin_millesime is null or vin_millesime between 1900 and 2100),
  add column vin_couleur public.vin_couleur,
  add column vin_region text check (vin_region is null or char_length(vin_region) <= 120);

-- Le place_id n'est plus obligatoire : un vin n'en a pas.
alter table public.recommandations alter column place_id drop not null;

alter table public.recommandations drop constraint recommandations_categorie_check;
alter table public.recommandations add constraint recommandations_categorie_check
  check (categorie in ('resto', 'hotel', 'vin'));

-- Une recommandation vise UNE chose : une adresse ou un vin, jamais les deux,
-- jamais aucune.
alter table public.recommandations add constraint recommandations_cible_unique
  check (num_nonnulls(place_id, vin_nom) = 1);

-- Anti-doublon des vins en attente, pendant de l'index des adresses. La clé
-- reprend celle de la Cave (nom + millésime + domaine, insensibles à la casse) :
-- deux fois le même vin ne doubleraient que la boîte du destinataire.
create unique index recommandations_vin_en_attente_uidx
  on public.recommandations (
    vers_profile_id, de_profile_id, lower(vin_nom),
    coalesce(vin_millesime, 0), lower(coalesce(vin_domaine, ''))
  )
  where statut = 'en_attente' and vin_nom is not null;

/**
 * Recommander un vin à un proche. Mêmes règles que pour une adresse : le
 * destinataire est désigné PAR SON PROCHE, jamais par une adresse e-mail, et il
 * doit être à moi avec un compte rattaché.
 */
create function public.recommander_vin(
  p_family_member_id uuid,
  p_nom text,
  p_domaine text default null,
  p_millesime smallint default null,
  p_couleur public.vin_couleur default null,
  p_region text default null,
  p_libelle text default null,
  p_mot text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_vers uuid;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'motif', 'non_authentifie');
  end if;
  if coalesce(btrim(p_nom), '') = '' then
    return jsonb_build_object('ok', false, 'motif', 'invalide');
  end if;

  select profile_id into v_vers
    from public.family_members
   where id = p_family_member_id and user_id = v_uid and profile_id is not null;
  if v_vers is null then
    return jsonb_build_object('ok', false, 'motif', 'destinataire_invalide');
  end if;
  if v_vers = v_uid then
    return jsonb_build_object('ok', false, 'motif', 'invalide');
  end if;

  insert into public.recommandations
    (de_profile_id, vers_profile_id, categorie, libelle, mot,
     vin_nom, vin_domaine, vin_millesime, vin_couleur, vin_region)
  values (v_uid, v_vers, 'vin',
          left(coalesce(nullif(btrim(p_libelle), ''), btrim(p_nom)), 200), left(p_mot, 500),
          left(btrim(p_nom), 200), left(nullif(btrim(p_domaine), ''), 200), p_millesime,
          p_couleur, left(nullif(btrim(p_region), ''), 120))
  on conflict do nothing;

  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.recommander_vin(uuid, text, text, smallint, public.vin_couleur, text, text, text)
  from anon, public;
grant execute on function public.recommander_vin(uuid, text, text, smallint, public.vin_couleur, text, text, text)
  to authenticated;
