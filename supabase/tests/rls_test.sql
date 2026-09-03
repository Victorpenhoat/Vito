-- Filet RLS (audit 04/07 : « aucun test RLS » alors que c'est la frontière de sécurité).
-- Verrouille les invariants avant la réécriture perf des policies : anon refusé,
-- isolation owner, accès co-membre (is_co_membre), non-membre refusé, rôle non
-- auto-modifiable. À lancer : `supabase test db`.
begin;
create extension if not exists pgtap;
create schema if not exists tests;
select plan(29);

-- Helpers : exécuter une requête sous une identité (role + claim JWT), puis réinitialiser
-- même en cas d'erreur (le reset role doit toujours courir pour ne pas fuiter l'identité).
create function tests.count_as(p_uid uuid, p_sql text) returns bigint language plpgsql as $$
declare n bigint;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
  execute p_sql into n;
  reset role;
  return n;
end $$;

-- anon : on mesure ce qu'il VOIT. La sécurité de Vito repose sur la RLS (anon a des
-- grants de table mais aucune policy ne matche auth.uid() null → 0 ligne), pas sur
-- l'absence de grant. L'invariant à verrouiller est donc « anon ne voit rien ».
create function tests.count_as_anon(p_sql text) returns bigint language plpgsql as $$
declare n bigint;
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  execute p_sql into n;
  reset role;
  return n;
exception when insufficient_privilege then
  reset role; return 0; -- refusé au niveau grant = 0 donnée exposée, invariant respecté
end $$;

-- IDs du seed
-- client  = 11111111… (5 liste_items) ; agence = 22222222… ; demo = de110000… ;
-- free = 44444444… (aucun partage) ; client & agence co-membres du groupe dépenses de demo.

-- 1) anon ne voit AUCUN liste_item (RLS ; la fenêtre anon historique #61)
select is(tests.count_as_anon('select count(*) from public.liste_items'), 0::bigint, 'anon ne voit aucun liste_item');

-- 2) anon ne voit AUCUN profil_gouts (#63)
select is(tests.count_as_anon('select count(*) from public.profil_gouts'), 0::bigint, 'anon ne voit aucun profil_gouts');

-- 3) isolation owner : le client ne voit que ses 5 liste_items
select is(tests.count_as('11111111-1111-1111-1111-111111111111', 'select count(*) from public.liste_items'),
          5::bigint, 'client voit ses 5 liste_items (RLS owner)');

-- 4) le client ne voit AUCUN liste_item de demo (isolation entre users)
select is(tests.count_as('11111111-1111-1111-1111-111111111111',
          'select count(*) from public.liste_items where user_id = ''de110000-0000-4000-8000-000000000000'''),
          0::bigint, 'client ne voit pas les liste_items de demo');

-- 5) co-membre : agence peut lire le profil de demo (is_co_membre, via groupe de dépenses partagé)
select is(tests.count_as('22222222-2222-2222-2222-222222222222',
          'select count(*) from public.profiles where id = ''de110000-0000-4000-8000-000000000000'''),
          1::bigint, 'agence (co-membre) voit le profil de demo');

-- 6) non-membre : free ne voit pas le profil de demo (aucun partage)
select is(tests.count_as('44444444-4444-4444-8444-444444444444',
          'select count(*) from public.profiles where id = ''de110000-0000-4000-8000-000000000000'''),
          0::bigint, 'free (non-membre) ne voit pas le profil de demo');

-- 7) chaque user voit son propre profil
select is(tests.count_as('44444444-4444-4444-8444-444444444444',
          'select count(*) from public.profiles where id = ''44444444-4444-4444-8444-444444444444'''),
          1::bigint, 'un user voit son propre profil');

-- 8) rôle non auto-modifiable (fix #86) : le client ne peut pas se promouvoir admin
select throws_ok(
  $$ select tests.count_as('11111111-1111-1111-1111-111111111111',
       'with u as (update public.profiles set role=''admin'' where id=''11111111-1111-1111-1111-111111111111'' returning 1) select count(*) from u') $$,
  'role non modifiable',
  'client ne peut pas se promouvoir admin');

-- ── Restos v2 (00030/00031) ────────────────────────────────────────────────

-- 9) anon ne voit AUCUNE visite
select is(tests.count_as_anon('select count(*) from public.visites'), 0::bigint, 'anon ne voit aucune visite');

-- 10) le client voit ses visites seedées (1 visite resto + 1 séjour hôtel) ;
--     11) l'agence n'en voit aucune (isolation owner)
select is(tests.count_as('11111111-1111-1111-1111-111111111111', 'select count(*) from public.visites'),
          2::bigint, 'client voit ses 2 visites/séjours (RLS owner)');
select is(tests.count_as('22222222-2222-2222-2222-222222222222', 'select count(*) from public.visites'),
          0::bigint, 'agence ne voit pas les visites du client');

-- 12) tags perso : le client peut créer un tag à lui
select is(tests.count_as('11111111-1111-1111-1111-111111111111',
          'with u as (insert into public.tags (user_id, slug, label, categorie, scope, is_system) values (''11111111-1111-1111-1111-111111111111'', ''test_pgtap'', ''Test pgTAP'', ''ambiance'', ''restaurant'', false) returning 1) select count(*) from u'),
          1::bigint, 'client crée un tag perso');

-- 13) tags système : intouchables (update → 0 ligne, la RLS filtre)
select is(tests.count_as('11111111-1111-1111-1111-111111111111',
          'with u as (update public.tags set label = ''hack'' where slug = ''terrasse'' and user_id is null returning 1) select count(*) from u'),
          0::bigint, 'client ne peut pas modifier un tag système');

-- 14) fusionner_tags refuse un tag système en source
select throws_ok(
  $$ select tests.count_as('11111111-1111-1111-1111-111111111111',
       'with u as (select public.fusionner_tags((select id from public.tags where slug = ''terrasse'' and user_id is null), (select id from public.tags where slug = ''en_famille'' and user_id is null))) select 1 from u') $$,
  'tag source introuvable ou non modifiable',
  'fusion depuis un tag système rejetée');

-- ── Hôtels v2 (00032) ──────────────────────────────────────────────────────

-- 15) un séjour avec départ avant l'arrivée est rejeté (check date_fin >= visite_le)
select throws_ok(
  $$ select tests.count_as('11111111-1111-1111-1111-111111111111',
       'with u as (insert into public.visites (user_id, liste_item_id, visite_le, date_fin) values (''11111111-1111-1111-1111-111111111111'', ''22222222-aaaa-4aaa-8aaa-bbbbbbbb0002'', ''2026-09-15'', ''2026-09-12'') returning 1) select count(*) from u') $$,
  '23514', null,
  'séjour avec date_fin < arrivée rejeté (check)');

-- 16) le client voit son séjour lié à un voyage ; 17) l'agence ne voit pas les
--     infos perso hôtel du client (prix_nuit — isolation liste_items)
select is(tests.count_as('11111111-1111-1111-1111-111111111111',
          'select count(*) from public.visites where voyage_id is not null'),
          1::bigint, 'client voit son séjour lié au voyage Rome');
select is(tests.count_as('22222222-2222-2222-2222-222222222222',
          'select count(*) from public.liste_items where prix_nuit is not null'),
          0::bigint, 'agence ne voit pas le prix/nuit saisi par le client');

-- ── Vins & Cave (00033) ────────────────────────────────────────────────────

-- 18) anon ne voit aucun vin ni aucune dégustation
select is(tests.count_as_anon('select count(*) from public.vins'), 0::bigint, 'anon ne voit aucun vin');
select is(tests.count_as_anon('select count(*) from public.degustations'), 0::bigint, 'anon ne voit aucune dégustation');

-- 20) isolation owner : l'agence ne voit pas les dégustations du client
select is(tests.count_as('22222222-2222-2222-2222-222222222222', 'select count(*) from public.degustations'),
          0::bigint, 'agence ne voit pas les dégustations du client');

-- 21) degustation_tags : visibilité dérivée du parent (le client voit son tag de
--     verdict, l'agence non — la policy passe par degustations.user_id)
select is(tests.count_as('11111111-1111-1111-1111-111111111111', 'select count(*) from public.degustation_tags'),
          1::bigint, 'client voit le tag de verdict de sa dégustation');

-- ── Invitations (00035) ────────────────────────────────────────────────────

-- 22) anon ne voit AUCUNE invitation en lecture directe (l'accès passe par la RPC)
select is(tests.count_as_anon('select count(*) from public.invitations'), 0::bigint,
          'anon ne lit aucune invitation en direct');

-- 23) l'émetteur voit les siennes ; 24) un autre compte n'en voit aucune
select is(tests.count_as('11111111-1111-1111-1111-111111111111', 'select count(*) from public.invitations'),
          3::bigint, 'le client voit les 3 invitations qu''il a émises');
select is(tests.count_as('22222222-2222-2222-2222-222222222222', 'select count(*) from public.invitations'),
          0::bigint, 'l''agence ne voit pas les invitations du client');

-- 25) la RPC publique ne distingue pas expiré / inexistant (anti-énumération)
select is(
  (select (public.invitation_infos('e2e-invitation-expiree-00000000001') ->> 'valide')),
  (select (public.invitation_infos('jeton-totalement-inexistant-00000') ->> 'valide')),
  'invitation expirée et jeton inconnu donnent la même réponse');

-- ── Données protégées (00036) ──────────────────────────────────────────────

-- 26) le numéro n'existe plus en clair : la colonne dépréciée est vide partout
select is((select count(*) from public.family_documents where doc_number is not null), 0::bigint,
          'aucun numéro de document en clair en base');

-- 27) anon ne lit aucun ticket de re-authentification (aucun grant)
select is(tests.count_as_anon('select count(*) from public.reauth_tickets'), 0::bigint,
          'anon ne lit aucun ticket');

-- 28) un ticket inconnu n'est jamais consommable
select is(tests.count_as('11111111-1111-1111-1111-111111111111',
          'select case when public.consommer_reauth_ticket(''hash-inconnu'', ''document:x:recto'') then 1 else 0 end'),
          0::bigint, 'un ticket inconnu est refusé');

-- 29) un ticket émis pour une cible ne vaut pas pour une autre
select is(tests.count_as('11111111-1111-1111-1111-111111111111',
          'with e as (select public.emettre_reauth_ticket(''hash-test-cible'', ''document:aaa:recto''))
           select case when (select public.consommer_reauth_ticket(''hash-test-cible'', ''document:bbb:recto'') from e) then 1 else 0 end'),
          0::bigint, 'un ticket ne vaut que pour sa cible');

select finish();
rollback;
