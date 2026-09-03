-- Onboarding & Compte (Lot O-E) : appareils, sessions et historique de connexions
-- (design Onboarding écrans 14 et 15).
--
-- Le SDK Supabase ne sait pas lister les sessions d'un utilisateur : ces données
-- vivent dans le schéma `auth`, que PostgREST n'expose pas. Plutôt que de sortir
-- la clé de service dans l'application, on passe par des fonctions
-- `security definer` STRICTEMENT limitées à l'appelant (`auth.uid()`).

-- Sessions actives de l'appelant. `courante` repère celle du navigateur en cours
-- via le claim `session_id` du jeton — c'est elle qu'on n'affiche pas comme
-- révocable (design : « Cet appareil »).
create function public.mes_sessions()
returns table (
  id uuid,
  created_at timestamptz,
  refreshed_at timestamptz,
  user_agent text,
  ip text,
  courante boolean
)
language sql
security definer
set search_path = ''
stable
as $$
  select s.id,
         s.created_at,
         s.refreshed_at,
         s.user_agent,
         host(s.ip)::text,
         s.id::text = (auth.jwt() ->> 'session_id')
    from auth.sessions s
   where s.user_id = auth.uid()
   order by s.refreshed_at desc nulls last, s.created_at desc;
$$;
revoke execute on function public.mes_sessions() from anon, public;
grant execute on function public.mes_sessions() to authenticated;

-- Historique des connexions (design écran 14 : date, appareil, ville approximative).
-- L'adresse IP n'est pas exposée telle quelle : seule sa présence sert à situer
-- approximativement la connexion côté interface.
create function public.mes_connexions_recentes(p_limite integer default 10)
returns table (
  cree_le timestamptz,
  action text,
  ip text
)
language sql
security definer
set search_path = ''
stable
as $$
  select a.created_at,
         a.payload ->> 'action',
         a.ip_address
    from auth.audit_log_entries a
   where a.payload ->> 'actor_id' = auth.uid()::text
     and a.payload ->> 'action' in ('login', 'logout', 'token_refreshed', 'user_signedup')
   order by a.created_at desc
   limit least(greatest(coalesce(p_limite, 10), 1), 50);
$$;
revoke execute on function public.mes_connexions_recentes(integer) from anon, public;
grant execute on function public.mes_connexions_recentes(integer) to authenticated;

-- Révocation d'une session précise. Supprimer la ligne invalide le jeton de
-- rafraîchissement : l'appareil visé retombe sur l'écran de connexion.
-- La session courante n'est pas révocable par ce chemin (on ne se déconnecte
-- pas soi-même par mégarde : c'est le bouton Déconnexion qui le fait).
create function public.revoquer_session(p_session_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_supprimees integer;
begin
  if auth.uid() is null then return false; end if;
  if p_session_id::text = (auth.jwt() ->> 'session_id') then return false; end if;
  delete from auth.sessions
   where id = p_session_id and user_id = auth.uid();
  get diagnostics v_supprimees = row_count;
  return v_supprimees > 0;
end $$;
revoke execute on function public.revoquer_session(uuid) from anon, public;
grant execute on function public.revoquer_session(uuid) to authenticated;

-- « Déconnecter tous les autres appareils » (design écran 14).
create function public.revoquer_autres_sessions()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_supprimees integer;
begin
  if auth.uid() is null then return 0; end if;
  delete from auth.sessions
   where user_id = auth.uid()
     and id::text is distinct from (auth.jwt() ->> 'session_id');
  get diagnostics v_supprimees = row_count;
  return v_supprimees;
end $$;
revoke execute on function public.revoquer_autres_sessions() from anon, public;
grant execute on function public.revoquer_autres_sessions() to authenticated;
