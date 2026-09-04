-- Boîte de réception, lot 2 : recommander une adresse à un proche.
--
-- Jusqu'ici, celui qui recommandait n'avait rien à faire dans Vito : c'est le
-- destinataire qui saisissait l'adresse PUIS notait « recommandé par Camille ».
-- Le sens s'inverse.
--
-- Décision PO : seuls les proches de mon Cercle AYANT UN COMPTE RATTACHÉ (lot
-- 1, 00046) peuvent m'écrire — d'où aucune modération ni blocage à construire.
-- Les vins viendront plus tard : ici, uniquement des adresses (resto, hôtel),
-- dont l'acceptation réutilise la mécanique du lot H6.

create table public.recommandations (
  id uuid primary key default gen_random_uuid(),
  de_profile_id uuid not null references public.profiles (id) on delete cascade,
  vers_profile_id uuid not null references public.profiles (id) on delete cascade,
  categorie text not null check (categorie in ('resto', 'hotel')),
  -- L'établissement n'est créé qu'à l'acceptation : tant qu'on n'a pas dit oui,
  -- rien n'entre dans le carnet — pas même une ligne d'établissement.
  place_id text not null check (char_length(place_id) between 1 and 300),
  -- Instantané du nom : la carte de la boîte reste lisible même si le
  -- fournisseur ne répond pas, et l'historique garde un sens.
  libelle text not null check (char_length(libelle) between 1 and 200),
  mot text check (mot is null or char_length(mot) <= 500),
  statut text not null default 'en_attente' check (statut in ('en_attente', 'acceptee', 'refusee')),
  traitee_le timestamptz,
  created_at timestamptz not null default now(),
  -- On ne se recommande pas à soi-même.
  constraint recommandations_distincts check (de_profile_id <> vers_profile_id),
  -- Une recommandation traitée porte sa date, et réciproquement.
  constraint recommandations_traitement_coherent
    check ((statut = 'en_attente') = (traitee_le is null))
);
create index recommandations_destinataire_idx
  on public.recommandations (vers_profile_id, statut);
create index recommandations_expediteur_idx on public.recommandations (de_profile_id);
-- Deux fois la même adresse au même destinataire, tant qu'elle est en attente,
-- n'apporte rien : la seconde ne ferait que doubler la carte dans sa boîte.
create unique index recommandations_en_attente_uidx
  on public.recommandations (vers_profile_id, de_profile_id, place_id)
  where statut = 'en_attente';

alter table public.recommandations enable row level security;

-- Le destinataire lit les siennes et les traite (accepter / refuser).
create policy "recommandations_select_destinataire" on public.recommandations
  for select to authenticated using (vers_profile_id = (select auth.uid()));
create policy "recommandations_update_destinataire" on public.recommandations
  for update to authenticated
  using (vers_profile_id = (select auth.uid()))
  with check (vers_profile_id = (select auth.uid()));

-- L'expéditeur relit ce qu'il a envoyé — sans jamais voir la suite donnée :
-- décision PO, refuser ne se notifie pas. C'est l'application qui n'affiche pas
-- le statut ; la ligne, elle, reste la sienne.
create policy "recommandations_select_expediteur" on public.recommandations
  for select to authenticated using (de_profile_id = (select auth.uid()));

-- AUCUNE policy d'insertion : sans elle, n'importe quel compte pourrait écrire
-- une ligne vers n'importe qui. L'écriture passe uniquement par la RPC
-- ci-dessous, qui vérifie le lien de Cercle.
grant select, update on public.recommandations to authenticated;

/**
 * Recommander une adresse à un proche.
 *
 * On désigne le destinataire par SON PROCHE (family_member_id), jamais par son
 * adresse e-mail : on ne découvre personne avec cette fonction, et on ne peut
 * écrire qu'à quelqu'un qu'on a déjà dans son Cercle, avec un compte rattaché.
 *
 * Le lien n'est pas symétrique, et c'est assumé (décision PO) : pour répondre,
 * il faut avoir l'autre dans son propre Cercle.
 */
create function public.recommander_adresse(
  p_family_member_id uuid,
  p_categorie text,
  p_place_id text,
  p_libelle text,
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
  if p_categorie not in ('resto', 'hotel') then
    return jsonb_build_object('ok', false, 'motif', 'invalide');
  end if;

  -- Le proche doit être À MOI et avoir un compte : les deux conditions dans la
  -- même requête, pour ne pas distinguer « pas à moi » de « sans compte ».
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
    (de_profile_id, vers_profile_id, categorie, place_id, libelle, mot)
  values (v_uid, v_vers, p_categorie, p_place_id, left(p_libelle, 200), left(p_mot, 500))
  -- Déjà en attente chez lui : on ne double pas sa boîte, et on ne le lui
  -- reproche pas non plus.
  on conflict do nothing;

  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.recommander_adresse(uuid, text, text, text, text) from anon, public;
grant execute on function public.recommander_adresse(uuid, text, text, text, text) to authenticated;
