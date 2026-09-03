-- Onboarding & Compte (Lot O-F) : export, suppression de compte et
-- administration des accès (design Onboarding écran 16 et écran « Comptes »).

-- ── Cycle de vie du compte ─────────────────────────────────────────────────
-- Suppression en trois étapes avec délai de rétractation : la demande est
-- ENREGISTRÉE, rien n'est effacé tout de suite. Se reconnecter l'annule.
alter table public.profiles
  add column suppression_demandee_le timestamptz,
  add column suspendu_le timestamptz;

comment on column public.profiles.suppression_demandee_le is
  'Demande de suppression : purge effective 30 jours après. Annulée en se reconnectant.';
comment on column public.profiles.suspendu_le is
  'Compte suspendu par un administrateur : accès bloqué, contenus intacts.';

-- Délai de rétractation, à un seul endroit (repris par l''UI et la purge).
create function public.delai_retractation_jours()
returns integer language sql immutable set search_path = '' as $$ select 30 $$;
grant execute on function public.delai_retractation_jours() to authenticated;

/**
 * Demande de suppression du compte. Volontairement réversible : c'est le rôle
 * du délai de rétractation annoncé à l'écran.
 */
create function public.demander_suppression_compte()
returns timestamptz
language plpgsql
security invoker
set search_path = ''
as $$
declare v_quand timestamptz := now();
begin
  if auth.uid() is null then raise exception 'authentification requise'; end if;
  update public.profiles set suppression_demandee_le = v_quand where id = auth.uid();
  return v_quand;
end $$;
revoke execute on function public.demander_suppression_compte() from anon, public;
grant execute on function public.demander_suppression_compte() to authenticated;

/** Annulation (« vous pouvez annuler en vous reconnectant »). */
create function public.annuler_suppression_compte()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'authentification requise'; end if;
  update public.profiles set suppression_demandee_le = null where id = auth.uid();
end $$;
revoke execute on function public.annuler_suppression_compte() from anon, public;
grant execute on function public.annuler_suppression_compte() to authenticated;

/**
 * Purge des comptes dont le délai est écoulé.
 * ⚠ Aucun ordonnanceur n'est configuré dans ce projet : cette fonction doit
 * être appelée par une tâche planifiée (pg_cron ou appel externe). Tant que ce
 * n'est pas branché, les comptes restent en attente — l'utilisateur n'a donc
 * jamais l'illusion d'une suppression qui n'aurait pas lieu, et rien n'est
 * détruit par accident.
 * Supprimer la ligne auth.users suffit : toutes les tables métier référencent
 * profiles(id) en ON DELETE CASCADE.
 */
create function public.purger_comptes_supprimes()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_purges integer;
begin
  with a_purger as (
    delete from auth.users u
     using public.profiles p
     where p.id = u.id
       and p.suppression_demandee_le is not null
       and p.suppression_demandee_le < now() - (public.delai_retractation_jours() || ' days')::interval
    returning u.id
  )
  select count(*) into v_purges from a_purger;
  return v_purges;
end $$;
revoke execute on function public.purger_comptes_supprimes() from anon, authenticated, public;

-- ── Administration des accès ───────────────────────────────────────────────
-- L'administrateur gère les ACCÈS, jamais les contenus : ces fonctions
-- n'exposent que l'identité et l'état des comptes — aucune fiche, aucun
-- document, aucun voyage. C'est vérifié en pgTAP.

create function public.admin_lister_comptes()
returns table (
  id uuid,
  email text,
  display_name text,
  role public.app_role,
  statut text,
  created_at timestamptz,
  derniere_connexion timestamptz
)
language plpgsql
security definer
set search_path = ''
stable
as $$
begin
  if not public.is_admin() then raise exception 'réservé à l''administrateur'; end if;
  return query
    select p.id,
           u.email::text,
           p.display_name,
           p.role,
           case
             when p.suspendu_le is not null then 'suspendu'
             when p.suppression_demandee_le is not null then 'suppression'
             when p.role = 'admin' then 'administrateur'
             when u.last_sign_in_at is null then 'invite'
             else 'actif'
           end,
           p.created_at,
           u.last_sign_in_at
      from public.profiles p
      join auth.users u on u.id = p.id
     order by p.created_at desc;
end $$;
revoke execute on function public.admin_lister_comptes() from anon, public;
grant execute on function public.admin_lister_comptes() to authenticated;

/** Suspend un accès (les contenus restent intacts). Un administrateur ne peut
 *  ni se suspendre lui-même, ni suspendre un autre administrateur. */
create function public.admin_suspendre_compte(p_user_id uuid, p_suspendre boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_role public.app_role;
begin
  if not public.is_admin() then raise exception 'réservé à l''administrateur'; end if;
  if p_user_id = auth.uid() then return false; end if;
  select role into v_role from public.profiles where id = p_user_id;
  if v_role is null or v_role = 'admin' then return false; end if;
  update public.profiles
     set suspendu_le = case when p_suspendre then now() else null end
   where id = p_user_id;

  -- Suspendre doit RÉELLEMENT couper l'accès, pas seulement poser un état :
  -- on révoque les sessions du compte, sinon son jeton en cours continuerait
  -- de fonctionner (y compris sur les routes API) jusqu'à expiration.
  if p_suspendre then
    delete from auth.sessions where user_id = p_user_id;
  end if;

  return true;
end $$;
revoke execute on function public.admin_suspendre_compte(uuid, boolean) from anon, public;
grant execute on function public.admin_suspendre_compte(uuid, boolean) to authenticated;
