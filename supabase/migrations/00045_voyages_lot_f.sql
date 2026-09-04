-- Refonte Voyages (Lot F) : partager un voyage par LIEN.
--
-- Le socle est déjà là (00035, chantier Onboarding) : `invitations` porte un
-- `voyage_id`, et `consommer_invitation` inscrit le bénéficiaire dans
-- `voyage_membres`. Il manquait une chose : une invitation ne servait QU'UNE
-- fois. Or un lien de voyage s'envoie à un groupe — le premier arrivé aurait
-- fermé la porte aux autres.

-- 1) Nombre d'usages. Défaut 1 : les invitations de compte existantes gardent
--    exactement le comportement d'avant.
alter table public.invitations
  add column usages_max smallint not null default 1 check (usages_max between 1 and 50),
  add column usages smallint not null default 0 check (usages >= 0);

-- Les invitations déjà consommées comptent leur usage, pour que la nouvelle
-- règle (« usages < usages_max ») dise d'elles ce que disait l'ancienne.
update public.invitations set usages = 1 where consomme_le is not null;

-- 2) Révoquer un lien de voyage doit rester possible APRÈS un premier usage :
--    c'est même là que ça sert. Couper le lien n'expulse personne — les membres
--    déjà admis se retirent depuis la liste des membres, explicitement.
--    Les invitations de compte, elles, gardent leur trace : consommées, elles
--    ne s'effacent pas.
drop policy "invitations_delete_emetteur" on public.invitations;
create policy "invitations_delete_emetteur" on public.invitations
  for delete to authenticated
  using (
    cree_par = (select auth.uid())
    and (consomme_le is null or voyage_id is not null)
  );

-- 3) Les deux RPC raisonnent désormais en usages restants.
create or replace function public.invitation_infos(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_inv public.invitations;
  v_voyage public.voyages;
  v_nom text;
begin
  select * into v_inv from public.invitations where token = p_token;
  if v_inv.id is null or v_inv.usages >= v_inv.usages_max or v_inv.expire_le < now() then
    return jsonb_build_object('valide', false);
  end if;
  select display_name into v_nom from public.profiles where id = v_inv.cree_par;
  if v_inv.voyage_id is not null then
    select * into v_voyage from public.voyages where id = v_inv.voyage_id;
  end if;
  return jsonb_build_object(
    'valide', true,
    'role_vise', v_inv.role_vise,
    'invite_par', coalesce(v_nom, ''),
    'email_indice', case
      when v_inv.email is null then null
      else left(v_inv.email, 1) || '…@' || split_part(v_inv.email, '@', 2)
    end,
    'email_impose', v_inv.email is not null,
    'voyage_titre', coalesce(v_voyage.titre, null),
    'voyage_destination', coalesce(v_voyage.destination, null),
    'voyage_date_debut', v_voyage.date_debut,
    'voyage_date_fin', v_voyage.date_fin
  );
end $$;

create or replace function public.consommer_invitation(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv public.invitations;
  v_uid uuid := auth.uid();
  v_email text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'motif', 'non_authentifie');
  end if;
  select * into v_inv from public.invitations where token = p_token for update;
  if v_inv.id is null or v_inv.usages >= v_inv.usages_max or v_inv.expire_le < now() then
    return jsonb_build_object('ok', false, 'motif', 'invalide');
  end if;
  if v_inv.email is not null then
    select email into v_email from auth.users where id = v_uid;
    if lower(coalesce(v_email, '')) <> lower(v_inv.email) then
      return jsonb_build_object('ok', false, 'motif', 'invalide');
    end if;
  end if;

  -- Déjà membre : on ne brûle pas un usage pour rien (rouvrir le lien depuis
  -- son historique ne doit pas épuiser le quota du groupe).
  if v_inv.voyage_id is not null
     and exists (select 1 from public.voyage_membres
                  where voyage_id = v_inv.voyage_id and profile_id = v_uid) then
    return jsonb_build_object('ok', true, 'role_vise', v_inv.role_vise, 'voyage_id', v_inv.voyage_id);
  end if;

  update public.invitations
     set usages = usages + 1,
         -- `consomme_le` / `consomme_par` gardent leur sens : le PREMIER
         -- bénéficiaire, pour ne pas réécrire l'historique des invitations
         -- de compte.
         consomme_le = coalesce(consomme_le, now()),
         consomme_par = coalesce(consomme_par, v_uid)
   where id = v_inv.id;

  if v_inv.voyage_id is not null then
    insert into public.voyage_membres (voyage_id, profile_id, role)
    values (v_inv.voyage_id, v_uid, 'membre')
    on conflict (voyage_id, profile_id) do nothing;
  end if;

  return jsonb_build_object('ok', true, 'role_vise', v_inv.role_vise, 'voyage_id', v_inv.voyage_id);
end $$;
