-- Boîte de réception, lot 3 : la purge des recommandations traitées.
--
-- Une recommandation acceptée a déjà produit son effet (l'adresse est au
-- carnet, avec son origine), une refusée n'a plus rien à dire. Les garder
-- indéfiniment ne sert qu'à conserver une trace de ce qu'on a décliné — ce que
-- la décision « refuser ne se notifie pas » cherche justement à éviter.

create function public.delai_purge_recommandations_jours() returns integer
  language sql immutable as $$ select 90 $$;

/**
 * Supprime les recommandations traitées depuis plus de 90 jours. Renvoie le
 * nombre de lignes purgées.
 *
 * ⚠ Comme `purger_comptes_supprimes` (00039), cette fonction n'est appelée par
 * AUCUNE planification aujourd'hui : tant qu'un ordonnanceur n'est pas branché,
 * rien ne disparaît. C'est volontaire — mieux vaut une purge qui attend qu'une
 * purge qui efface sans qu'on l'ait décidé.
 */
create function public.purger_recommandations()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_purges integer;
begin
  with a_purger as (
    delete from public.recommandations
     where statut <> 'en_attente'
       and traitee_le is not null
       and traitee_le < now() - (public.delai_purge_recommandations_jours() || ' days')::interval
    returning id
  )
  select count(*) into v_purges from a_purger;
  return v_purges;
end $$;
-- Personne ne l'appelle depuis l'application : ni anon, ni un compte connecté.
revoke execute on function public.purger_recommandations() from anon, authenticated, public;
