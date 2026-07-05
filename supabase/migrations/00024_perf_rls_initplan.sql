-- PERF (audit 04/07) : pattern Supabase (select auth.uid()) / (select auth.jwt()).
-- Sans le sous-select, auth.uid()/auth.jwt() sont ré-évalués PAR LIGNE dans les policies ;
-- enveloppés, le planner les évalue une seule fois par requête (initplan). Changement
-- purement de performance : ALTER POLICY ne modifie que l'expression, jamais le rôle/la
-- commande/la sémantique. Les policies bâties sur les fonctions security-definer
-- can_access_*/is_*_owner ne sont PAS touchées (mécanisme anti-récursion, cf. 00009/00010/00013).
-- Filet : supabase/tests/rls_test.sql (8 invariants) doit rester vert.

alter policy "agence_clients_delete" on public.agence_clients using (((agence_id = (select auth.uid())) OR (client_id = (select auth.uid()))));
alter policy "agence_clients_insert" on public.agence_clients with check (((agence_id = (select auth.uid())) AND is_agence()));
alter policy "agence_clients_select" on public.agence_clients using (((agence_id = (select auth.uid())) OR (client_id = (select auth.uid()))));
alter policy "avis_all_owner" on public.avis using ((user_id = (select auth.uid()))) with check ((user_id = (select auth.uid())));
alter policy "conciergerie_delete" on public.conciergerie_demandes using (((user_id = (select auth.uid())) OR is_concierge()));
alter policy "conciergerie_insert" on public.conciergerie_demandes with check (((user_id = (select auth.uid())) AND is_premium((select auth.uid()))));
alter policy "conciergerie_select" on public.conciergerie_demandes using (((user_id = (select auth.uid())) OR is_concierge()));
alter policy "degustations_all_owner" on public.degustations using ((user_id = (select auth.uid()))) with check ((user_id = (select auth.uid())));
alter policy "depense_groupes_insert" on public.depense_groupes with check ((owner_id = (select auth.uid())));
alter policy "depense_groupes_select" on public.depense_groupes using (((owner_id = (select auth.uid())) OR can_access_groupe(id)));
alter policy "familles_insert" on public.familles with check ((owner_id = (select auth.uid())));
alter policy "family_documents_owner" on public.family_documents using ((user_id = (select auth.uid()))) with check ((user_id = (select auth.uid())));
alter policy "family_members_owner" on public.family_members using ((user_id = (select auth.uid()))) with check ((user_id = (select auth.uid())));
alter policy "liste_items_all_owner" on public.liste_items using ((user_id = (select auth.uid()))) with check ((user_id = (select auth.uid())));
alter policy "profil_gouts_all_owner" on public.profil_gouts using ((user_id = (select auth.uid()))) with check ((user_id = (select auth.uid())));
alter policy "profiles_select_self_or_admin" on public.profiles using (((id = (select auth.uid())) OR (COALESCE(((select auth.jwt()) ->> 'user_role'::text), ''::text) = 'admin'::text)));
alter policy "profiles_update_self" on public.profiles using ((id = (select auth.uid()))) with check ((id = (select auth.uid())));
alter policy "subscriptions_select_own" on public.subscriptions using ((user_id = (select auth.uid())));
alter policy "vins_all_owner" on public.vins using ((user_id = (select auth.uid()))) with check ((user_id = (select auth.uid())));
alter policy "voyages_insert" on public.voyages with check ((owner_id = (select auth.uid())));
alter policy "liste_item_tags_all_owner" on public.liste_item_tags
  using (exists (select 1 from public.liste_items li where li.id = liste_item_tags.liste_item_id and li.user_id = (select auth.uid())))
  with check (exists (select 1 from public.liste_items li where li.id = liste_item_tags.liste_item_id and li.user_id = (select auth.uid())));
