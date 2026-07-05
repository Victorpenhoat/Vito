-- SÉCURITÉ (critique) : profiles.role est injecté dans le JWT (claim user_role, 00002)
-- et pilote is_admin/is_agence/is_concierge. Or profiles_update_self (00001) autorise
-- l'UPDATE de sa propre ligne sans restreindre les colonnes, et le grant (00005) porte
-- sur toute la table → tout authentifié pouvait s'auto-promouvoir admin via PostgREST
-- (update profiles set role='admin' where id = auth.uid()). Les autres tables à rôle
-- privilégié (voyages/familles/depense_groupes) ont un trigger *_lock_owner ; profiles
-- n'en avait aucun. On matérialise le même verrou : le rôle ne change que via une
-- opération privilégiée (postgres/service_role/supabase_auth_admin), jamais par
-- l'utilisateur lui-même. Le display_name et la locale restent librement modifiables.
--
-- NB : SECURITY INVOKER (pas DEFINER) est indispensable ici — sous SECURITY DEFINER,
-- current_user vaut le propriétaire de la fonction (postgres), qui est dans l'allowlist,
-- et le garde ne bloquerait jamais. En invoker, current_user = le rôle appelant réel
-- ('authenticated' via PostgREST). La fonction ne lit aucune table, definer est inutile.
create function public.profiles_lock_role() returns trigger
  language plpgsql set search_path = '' as $$
begin
  if new.role <> old.role
     and current_user not in ('postgres', 'service_role', 'supabase_auth_admin') then
    raise exception 'role non modifiable';
  end if;
  return new;
end;
$$;

create trigger profiles_role_immutable before update on public.profiles
  for each row execute function public.profiles_lock_role();
