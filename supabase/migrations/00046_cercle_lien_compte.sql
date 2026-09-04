-- Boîte de réception, lot 1 : rattacher un proche du Cercle à SON compte.
--
-- Jusqu'ici les deux tables s'ignoraient : `family_members` décrit des
-- personnes, `profiles` des comptes, et l'invitation de rôle « cercle » (00035)
-- créait un compte sans jamais dire pour QUI. La promesse du lot O-F (« un
-- proche voit sa propre fiche ») n'était donc pas tenable, et la boîte de
-- réception ne peut pas l'être non plus : elle doit savoir que le compte qui
-- écrit est bien Camille.

-- 1) Le lien, côté proche.
--    `on delete set null` et jamais cascade : un compte supprimé ne doit pas
--    emporter la fiche du proche — elle décrit une personne, pas un compte.
alter table public.family_members
  add column profile_id uuid references public.profiles (id) on delete set null;

-- Deux proches d'un même carnet ne peuvent pas désigner le même compte.
create unique index family_members_profil_uidx
  on public.family_members (user_id, profile_id) where profile_id is not null;

-- 2) L'invitation sait désormais pour quel proche elle est émise.
--    `on delete cascade` : un proche supprimé emporte l'invitation qui le
--    visait — elle n'aurait plus personne à rattacher.
alter table public.invitations
  add column family_member_id uuid references public.family_members (id) on delete cascade;
create index invitations_family_member_idx on public.invitations (family_member_id);

-- 3) La consommation rattache le compte au proche.
--    Le lien n'est posé que si l'invitation vise le Cercle ET que le proche
--    appartient bien à l'émetteur : une invitation ne doit jamais pouvoir
--    écrire dans le carnet d'un tiers.
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

  -- Déjà membre du voyage : on ne brûle pas un usage pour rien.
  if v_inv.voyage_id is not null
     and exists (select 1 from public.voyage_membres
                  where voyage_id = v_inv.voyage_id and profile_id = v_uid) then
    return jsonb_build_object('ok', true, 'role_vise', v_inv.role_vise, 'voyage_id', v_inv.voyage_id);
  end if;

  update public.invitations
     set usages = usages + 1,
         consomme_le = coalesce(consomme_le, now()),
         consomme_par = coalesce(consomme_par, v_uid)
   where id = v_inv.id;

  if v_inv.voyage_id is not null then
    insert into public.voyage_membres (voyage_id, profile_id, role)
    values (v_inv.voyage_id, v_uid, 'membre')
    on conflict (voyage_id, profile_id) do nothing;
  end if;

  -- Rattachement au Cercle de l'émetteur. On n'écrase pas un lien existant :
  -- une fiche déjà rattachée garde son compte, et l'index unique empêche de
  -- toute façon deux proches de pointer le même.
  if v_inv.role_vise = 'cercle' and v_inv.family_member_id is not null then
    update public.family_members
       set profile_id = v_uid
     where id = v_inv.family_member_id
       and user_id = v_inv.cree_par
       and profile_id is null;
  end if;

  return jsonb_build_object('ok', true, 'role_vise', v_inv.role_vise, 'voyage_id', v_inv.voyage_id);
end $$;
