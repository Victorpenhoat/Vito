-- Lier deux comptes qui existent déjà (Cercle).
--
-- L'invitation de 00046 suppose que l'autre n'a PAS de compte : elle en fait
-- créer un. Deux personnes déjà inscrites — un couple, chacun son compte —
-- n'avaient aucun chemin pour se reconnaître. Ce lot en ouvre un : un code
-- court, montré aussi en QR, qu'on se passe en face à face.
--
-- Le lien est RÉCIPROQUE : la fiche de l'un pointe vers le compte de l'autre
-- des deux côtés. Il ne donne accès à rien : la policy de family_members reste
-- « user_id = auth.uid() ». Ce lien dit QUI est cette personne, pas ce qu'elle
-- a le droit de lire.

-- 1) Le code court porté par l'invitation.
--    Alphabet sans I/L/O/U ni 0/1 : il se dicte au téléphone (miroir de
--    src/features/famille/domain/lienCompte.ts, qui le tire).
alter table public.invitations
  add column code text check (code is null or code ~ '^[2-9A-HJKMNP-TV-Z]{8}$'),
  -- relation que l'ÉMETTEUR attribue à l'invité dans son propre carnet
  add column relation text check (relation is null or relation in
    ('conjoint','enfant','parent','beau_parent','ami','autre','fille','fils','pere','mere'));

-- Unicité définitive, et non « parmi les codes vivants » : un index partiel sur
-- l'expiration demanderait now(), qui n'est pas immuable. Trente caractères sur
-- huit rangs laissent de quoi ne jamais retomber sur un code brûlé.
create unique index invitations_code_uidx on public.invitations (code) where code is not null;

-- 2) Un nom de famille peut manquer.
--    Les fiches créées par la liaison prennent le nom du PROFIL de l'autre, et
--    beaucoup de comptes n'ont qu'un prénom. Inventer un tiret pour satisfaire
--    la contrainte afficherait « Camille — » dans le carnet : autant accepter
--    l'absence. La saisie manuelle, elle, continue d'exiger un nom (zod).
alter table public.family_members
  drop constraint family_members_last_name_check;
alter table public.family_members
  add constraint family_members_last_name_check check (char_length(last_name) between 0 and 120);

-- 3) Ce que voit celui qui reçoit le code, AVANT d'accepter.
--
--    Réservée aux comptes connectés, contrairement à `invitation_infos` : ici
--    les deux personnes ont déjà un compte, donc rien n'est perdu, et un code
--    de 39 bits cesse d'être interrogeable par n'importe qui. Le plafond de
--    tentatives ferme la porte restante.
create function public.lien_infos(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv public.invitations;
  v_uid uuid := auth.uid();
  v_nom text;
begin
  if v_uid is null then
    return jsonb_build_object('valide', false);
  end if;
  if not public.consommer_quota('lien_lecture', 30, 600) then
    return jsonb_build_object('valide', false, 'motif', 'trop_de_tentatives');
  end if;

  select * into v_inv from public.invitations
   where code = upper(p_code) and role_vise = 'cercle';

  -- inconnu, expiré, déjà consommé : une seule et même réponse.
  if v_inv.id is null or v_inv.usages >= v_inv.usages_max or v_inv.expire_le < now() then
    return jsonb_build_object('valide', false);
  end if;

  select coalesce(display_name, '') into v_nom from public.profiles where id = v_inv.cree_par;
  return jsonb_build_object(
    'valide', true,
    'invite_par', v_nom,
    'relation_proposee', v_inv.relation,
    'soi_meme', v_inv.cree_par = v_uid
  );
end $$;
revoke execute on function public.lien_infos(text) from anon, public;
grant execute on function public.lien_infos(text) to authenticated;

-- 4) La liaison elle-même.
create function public.lier_comptes(p_code text, p_relation text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv      public.invitations;
  v_uid      uuid := auth.uid();
  v_fiche_id uuid;
  v_prenom   text;
  v_nom      text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'motif', 'non_authentifie');
  end if;

  -- « moi » désigne sa propre fiche (index partiel de 00027) : elle ne peut
  -- pas décrire quelqu'un d'autre. Vérifié AVANT de toucher au code, pour ne
  -- pas brûler un code sur une simple faute de saisie.
  if p_relation is null or p_relation not in
     ('conjoint','enfant','parent','beau_parent','ami','autre','fille','fils','pere','mere') then
    return jsonb_build_object('ok', false, 'motif', 'relation_invalide');
  end if;

  -- Un code de 39 bits ne tient que si on ne peut pas l'essayer en boucle.
  if not public.consommer_quota('lien_code', 10, 600) then
    return jsonb_build_object('ok', false, 'motif', 'trop_de_tentatives');
  end if;

  select * into v_inv from public.invitations
   where code = upper(p_code) and role_vise = 'cercle'
   for update;

  if v_inv.id is null or v_inv.usages >= v_inv.usages_max or v_inv.expire_le < now() then
    return jsonb_build_object('ok', false, 'motif', 'invalide');
  end if;
  if v_inv.cree_par = v_uid then
    return jsonb_build_object('ok', false, 'motif', 'soi_meme');
  end if;

  -- ── Côté émetteur : sa fiche pour moi ────────────────────────────────────
  -- Un lien déjà posé entre ces deux comptes n'est jamais dupliqué (l'index
  -- unique l'interdirait de toute façon) : on le retrouve et on s'arrête là.
  select id into v_fiche_id from public.family_members
   where user_id = v_inv.cree_par and profile_id = v_uid;

  if v_fiche_id is null then
    select coalesce(nullif(p.first_name, ''), nullif(split_part(coalesce(p.display_name, ''), ' ', 1), ''), 'Compte'),
           coalesce(p.last_name, '')
      into v_prenom, v_nom
      from public.profiles p where p.id = v_uid;

    -- La fiche visée par le code, si l'émetteur en avait déjà une pour moi.
    if v_inv.family_member_id is not null then
      update public.family_members
         set profile_id = v_uid
       where id = v_inv.family_member_id
         and user_id = v_inv.cree_par
         and profile_id is null
      returning id into v_fiche_id;
    end if;

    if v_fiche_id is null then
      insert into public.family_members (user_id, first_name, last_name, relation, profile_id)
      values (v_inv.cree_par, v_prenom, v_nom, coalesce(v_inv.relation, 'autre'), v_uid)
      returning id into v_fiche_id;
    end if;
  end if;

  -- ── Côté invité : ma fiche pour l'émetteur ───────────────────────────────
  if not exists (select 1 from public.family_members
                  where user_id = v_uid and profile_id = v_inv.cree_par) then
    select coalesce(nullif(p.first_name, ''), nullif(split_part(coalesce(p.display_name, ''), ' ', 1), ''), 'Compte'),
           coalesce(p.last_name, '')
      into v_prenom, v_nom
      from public.profiles p where p.id = v_inv.cree_par;

    insert into public.family_members (user_id, first_name, last_name, relation, profile_id)
    values (v_uid, v_prenom, v_nom, p_relation, v_inv.cree_par);
  end if;

  update public.invitations
     set usages = usages + 1,
         consomme_le = coalesce(consomme_le, now()),
         consomme_par = coalesce(consomme_par, v_uid)
   where id = v_inv.id;

  return jsonb_build_object('ok', true, 'fiche_id', v_fiche_id);
end $$;
revoke execute on function public.lier_comptes(text, text) from anon, public;
grant execute on function public.lier_comptes(text, text) to authenticated;
