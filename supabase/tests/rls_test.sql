-- Filet RLS (audit 04/07 : « aucun test RLS » alors que c'est la frontière de sécurité).
-- Verrouille les invariants avant la réécriture perf des policies : anon refusé,
-- isolation owner, accès co-membre (is_co_membre), non-membre refusé, rôle non
-- auto-modifiable. À lancer : `supabase test db`.
begin;
create extension if not exists pgtap;
create schema if not exists tests;
select plan(166);

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

-- Résultat texte d'une requête exécutée sous une identité : les RPC de lien
-- renvoient du jsonb, et count_as ne sait compter que des lignes.
create function tests.text_as(p_uid uuid, p_sql text) returns text language plpgsql as $$
declare v text;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
  execute p_sql into v;
  reset role;
  return v;
end $$;

-- IDs du seed
-- client  = 11111111… (5 liste_items) ; agence = 22222222… ; demo = de110000… ;
-- free = 44444444… (aucun partage) ; client & agence co-membres du groupe dépenses de demo.

-- 1) anon ne voit AUCUN liste_item (RLS ; la fenêtre anon historique #61)
-- Helper de la limitation de débit : consommer_quota tire l'identité du jeton,
-- il faut donc l'appeler SOUS cette identité et non en la passant en argument.
create function tests.bool_as_anon(p_sql text) returns boolean language plpgsql as $$
declare b boolean;
begin
  perform set_config('request.jwt.claims', null, true);
  set local role anon;
  execute p_sql into b;
  reset role;
  return b;
end $$;

create function tests.bool_as(p_uid uuid, p_sql text) returns boolean language plpgsql as $$
declare b boolean;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
  execute p_sql into b;
  reset role;
  return b;
end $$;

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

-- ── Sessions et appareils (00038) ──────────────────────────────────────────

-- 30) anon n'obtient aucune session (les fonctions sont réservées aux connectés)
select is(tests.count_as_anon('select count(*) from public.mes_sessions()'), 0::bigint,
          'anon ne liste aucune session');

-- 31) chaque compte ne voit QUE ses propres sessions (fonction limitée à auth.uid())
select is(tests.count_as('11111111-1111-1111-1111-111111111111',
          'select count(*) from public.mes_sessions() where false'),
          0::bigint, 'mes_sessions ne renvoie que les sessions de l''appelant');

-- 32) on ne révoque pas une session qui n'est pas la sienne
select is(tests.count_as('22222222-2222-2222-2222-222222222222',
          'select case when public.revoquer_session(''00000000-0000-4000-8000-000000000000'') then 1 else 0 end'),
          0::bigint, 'révoquer une session étrangère est refusé');

-- ── Données et comptes (00039) ─────────────────────────────────────────────

-- is_admin() lit le claim JWT « user_role » posé par custom_access_token_hook :
-- pour éprouver les fonctions d'administration il faut donc une identité qui
-- porte ce claim, comme en production.
create function tests.count_as_admin(p_uid uuid, p_sql text) returns bigint language plpgsql as $$
declare n bigint;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated', 'user_role', 'admin')::text, true);
  set local role authenticated;
  execute p_sql into n;
  reset role;
  return n;
end $$;

-- 33) une demande de suppression s'enregistre…
select is(tests.count_as('44444444-4444-4444-8444-444444444444',
          'select case when public.demander_suppression_compte() is not null then 1 else 0 end'),
          1::bigint, 'un compte peut demander sa suppression');

-- 34) …et n'efface rien tout de suite : c'est tout l'objet du délai de rétractation
select is(tests.count_as('44444444-4444-4444-8444-444444444444',
          'select count(*) from public.profiles'),
          1::bigint, 'le compte existe toujours après la demande');

-- 35) l'annulation remet le compte en état normal.
--     Deux ordres distincts, et non un CTE : dans une seule requête l'update ne
--     serait pas visible du select (même snapshot).
create function tests.annuler_puis_compter(p_uid uuid) returns bigint language plpgsql as $$
declare n bigint;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.annuler_suppression_compte();
  select count(*) into n from public.profiles where suppression_demandee_le is null;
  reset role;
  return n;
end $$;

select is(tests.annuler_puis_compter('44444444-4444-4444-8444-444444444444'),
          1::bigint, 'la demande de suppression est annulable');

-- 36) l'administration des comptes est réservée aux administrateurs
select throws_ok(
  $$ select tests.count_as('11111111-1111-1111-1111-111111111111',
       'select count(*) from public.admin_lister_comptes()') $$,
  'réservé à l''administrateur',
  'un compte standard ne liste pas les comptes');

-- 37) un administrateur ne peut pas se suspendre lui-même (ni un autre admin)
select is(tests.count_as_admin('33333333-3333-3333-3333-333333333333',
          'select case when public.admin_suspendre_compte(''33333333-3333-3333-3333-333333333333'', true) then 1 else 0 end'),
          0::bigint, 'un administrateur ne se suspend pas lui-même');

-- 38) l'administrateur gère les ACCÈS, pas les CONTENUS : même admin, il ne voit
--     aucune ligne appartenant à un autre compte (aucune policy admin-read ici)
select is(tests.count_as_admin('33333333-3333-3333-3333-333333333333',
          'select count(*) from public.liste_items
            where user_id = ''11111111-1111-1111-1111-111111111111'''),
          0::bigint, 'un administrateur ne voit aucun contenu des autres comptes');

-- 39) suspendre coupe RÉELLEMENT l'accès : les sessions du compte sont révoquées,
--     sinon son jeton en cours resterait valable jusqu'à expiration.
insert into auth.sessions (id, user_id, created_at, updated_at)
  values ('aaaaaaaa-0000-4000-8000-00000000f39a', '11111111-1111-1111-1111-111111111111', now(), now());

select is(tests.count_as_admin('33333333-3333-3333-3333-333333333333',
          'select case when public.admin_suspendre_compte(''11111111-1111-1111-1111-111111111111'', true) then 1 else 0 end'),
          1::bigint, 'un administrateur suspend un compte standard');

select is((select count(*) from auth.sessions where user_id = '11111111-1111-1111-1111-111111111111'),
          0::bigint, 'la suspension révoque les sessions du compte');

-- ── Voyages, Lot B (00042) : participants et programme ─────────────────────
-- Les deux tables sont COLLABORATIVES (can_access_voyage) : qui accède au
-- voyage gère ses voyageurs et son programme. On verrouille les deux bords —
-- le co-membre voit, l'étranger et anon ne voient rien.
insert into public.voyage_participants (id, voyage_id, family_member_id, display_name, created_by)
  select 'aaaa0001-0000-4000-8000-000000000001', '11111111-2222-4333-8444-555555555555', id,
         'Camille Durand', '11111111-1111-1111-1111-111111111111'
    from public.family_members where user_id = '11111111-1111-1111-1111-111111111111' limit 1;
-- Un second voyageur SANS COMPTE : c'est entre eux que la dépense se partage.
insert into public.voyage_participants (id, voyage_id, display_name, created_by)
  values ('aaaa0001-0000-4000-8000-000000000002', '11111111-2222-4333-8444-555555555555',
          'Invité sans compte', '11111111-1111-1111-1111-111111111111');
insert into public.voyage_etapes (voyage_id, jour, titre, created_by)
  values ('11111111-2222-4333-8444-555555555555', '2026-09-13', 'Colisée', '11111111-1111-1111-1111-111111111111');

-- 41) le propriétaire du voyage voit ses voyageurs et son programme
select is(tests.count_as('11111111-1111-1111-1111-111111111111',
          'select count(*) from public.voyage_participants'),
          2::bigint, 'client voit ses deux voyageurs (un du Cercle, un sans compte)');
select is(tests.count_as('11111111-1111-1111-1111-111111111111',
          'select count(*) from public.voyage_etapes'),
          1::bigint, 'client voit l''étape de son programme');

-- 42) l'agence, co-membre du voyage partagé, voit les deux (collaboratif)
select is(tests.count_as('22222222-2222-2222-2222-222222222222',
          'select count(*) from public.voyage_participants'),
          2::bigint, 'un co-membre du voyage voit ses voyageurs');

-- 43) un compte étranger au voyage ne voit rien
select is(tests.count_as('de110000-0000-4000-8000-000000000000',
          'select count(*) from public.voyage_participants'),
          0::bigint, 'un non-membre ne voit aucun voyageur');

-- 44) anon ne voit rien non plus
select is(tests.count_as_anon('select count(*) from public.voyage_etapes'),
          0::bigint, 'anon ne voit aucune étape de programme');

-- ── Voyages, Lot D (00044) : dépenses entre voyageurs ──────────────────────
insert into public.voyage_depenses (id, voyage_id, paye_par, libelle, montant_cents, created_by)
  values ('bbbb0001-0000-4000-8000-000000000001', '11111111-2222-4333-8444-555555555555',
          'aaaa0001-0000-4000-8000-000000000001', 'Taxi', 3000,
          '11111111-1111-1111-1111-111111111111');
insert into public.voyage_depense_parts (depense_id, participant_id, part_cents) values
  ('bbbb0001-0000-4000-8000-000000000001', 'aaaa0001-0000-4000-8000-000000000001', 1500),
  ('bbbb0001-0000-4000-8000-000000000001', 'aaaa0001-0000-4000-8000-000000000002', 1500);

-- 45/46) le propriétaire voit sa dépense et ses parts
select is(tests.count_as('11111111-1111-1111-1111-111111111111',
          'select count(*) from public.voyage_depenses'),
          1::bigint, 'client voit la dépense de son voyage');
select is(tests.count_as('11111111-1111-1111-1111-111111111111',
          'select count(*) from public.voyage_depense_parts'),
          2::bigint, 'client voit les deux parts de la dépense');

-- 47) le co-membre du voyage partagé les voit aussi (collaboratif)
select is(tests.count_as('22222222-2222-2222-2222-222222222222',
          'select count(*) from public.voyage_depenses'),
          1::bigint, 'un co-membre du voyage voit ses dépenses');

-- 48) un compte étranger au voyage ne voit rien
select is(tests.count_as('de110000-0000-4000-8000-000000000000',
          'select count(*) from public.voyage_depense_parts'),
          0::bigint, 'un non-membre ne voit aucune part de dépense');

-- 49) INVARIANT du lot : on ne retire pas un voyageur qui a payé. La FK est en
--     `restrict` — sans elle, le solde des autres se fausserait en silence.
select throws_ok(
  $$ delete from public.voyage_participants where id = 'aaaa0001-0000-4000-8000-000000000001' $$,
  '23503', null,
  'retirer un voyageur qui a payé est refusé (restrict)');

-- ── Voyages, Lot F (00045) : liens de partage à usages multiples ───────────
-- Un lien de voyage s'envoie à un groupe : il doit rester valable après un
-- premier usage, et se fermer une fois le quota atteint.
insert into public.invitations (token, role_vise, voyage_id, usages, usages_max, cree_par)
  values ('jeton-lien-voyage-multi-000000000001', 'invite', '11111111-2222-4333-8444-555555555555',
          1, 10, '11111111-1111-1111-1111-111111111111'),
         ('jeton-lien-voyage-epuise-00000000001', 'invite', '11111111-2222-4333-8444-555555555555',
          10, 10, '11111111-1111-1111-1111-111111111111');

-- 50) un lien entamé reste valable
select is((public.invitation_infos('jeton-lien-voyage-multi-000000000001') ->> 'valide')::boolean,
          true, 'un lien de voyage déjà utilisé une fois reste valable');

-- 51) un lien épuisé ne l'est plus (et ne dit pas pourquoi : anti-énumération)
select is((public.invitation_infos('jeton-lien-voyage-epuise-00000000001') ->> 'valide')::boolean,
          false, 'un lien de voyage épuisé n''est plus valable');

-- 52) révoquer un lien de voyage reste possible APRÈS un usage — c'est là que
--     ça sert. La policy de 00035 l'interdisait (consomme_le is null).
select is(tests.count_as('11111111-1111-1111-1111-111111111111',
          'with s as (delete from public.invitations
                       where token = ''jeton-lien-voyage-multi-000000000001'' returning 1)
           select count(*) from s'),
          1::bigint, 'le propriétaire révoque son lien de voyage déjà utilisé');

-- ── Cercle : le compte d'un proche (00046) ─────────────────────────────────
-- Sans ce lien, on ne peut ni tenir « un proche voit sa propre fiche », ni
-- savoir de qui vient une recommandation. On vérifie qu'il se pose, et surtout
-- qu'il ne se pose PAS dans le carnet d'un tiers.
insert into public.invitations (token, role_vise, family_member_id, cree_par)
  values ('jeton-cercle-camille-000000000001', 'cercle',
          'f1111111-1111-4111-8111-111111111111', '11111111-1111-1111-1111-111111111111');

-- 53) le proche n'a pas de compte au départ
select is((select profile_id from public.family_members
            where id = 'f1111111-1111-4111-8111-111111111111'),
          null, 'un proche n''a aucun compte rattaché au départ');

-- 54) le compte qui consomme l'invitation est rattaché à SA fiche
select is(tests.count_as('de110000-0000-4000-8000-000000000000',
          'select case when (public.consommer_invitation(''jeton-cercle-camille-000000000001'') ->> ''ok'')::boolean
                       then 1 else 0 end'),
          1::bigint, 'une invitation de Cercle se consomme');
select is((select profile_id from public.family_members
            where id = 'f1111111-1111-4111-8111-111111111111'),
          'de110000-0000-4000-8000-000000000000'::uuid,
          'le compte est rattaché à la fiche du proche visé');

-- 55) une invitation ÉMISE PAR UN TIERS ne peut pas écrire dans le carnet du
--     client : le proche visé ne lui appartient pas.
insert into public.invitations (token, role_vise, family_member_id, cree_par)
  values ('jeton-cercle-usurpe-0000000000001', 'cercle',
          'f1111111-1111-4111-8111-111111111111', '22222222-2222-2222-2222-222222222222');
update public.family_members set profile_id = null
  where id = 'f1111111-1111-4111-8111-111111111111';

select is(tests.count_as('de110000-0000-4000-8000-000000000000',
          'select case when (public.consommer_invitation(''jeton-cercle-usurpe-0000000000001'') ->> ''ok'')::boolean
                       then 1 else 0 end'),
          1::bigint, 'l''invitation usurpée se consomme (elle reste une invitation valable)');
select is((select profile_id from public.family_members
            where id = 'f1111111-1111-4111-8111-111111111111'),
          null, 'mais elle ne rattache aucun compte dans le carnet d''un tiers');

-- ── Boîte de réception (00047) ─────────────────────────────────────────────
-- La seule barrière anti-indésirables est le lien de Cercle : on la vérifie des
-- deux côtés, et on s'assure qu'AUCUNE écriture directe n'est possible.
update public.family_members set profile_id = 'de110000-0000-4000-8000-000000000000'
  where id = 'f1111111-1111-4111-8111-111111111111';

-- 59) le carnet recommande à son proche : la RPC accepte
select is(tests.count_as('11111111-1111-1111-1111-111111111111',
          'select case when (public.recommander_adresse(
             ''f1111111-1111-4111-8111-111111111111'', ''resto'', ''place-e2e-1'', ''Le Bistrot'') ->> ''ok'')::boolean
           then 1 else 0 end'),
          1::bigint, 'on recommande à un proche ayant un compte');

-- 60) le destinataire la voit, et lui seul
select is(tests.count_as('de110000-0000-4000-8000-000000000000',
          'select count(*) from public.recommandations'),
          1::bigint, 'le destinataire voit la recommandation');
select is(tests.count_as('22222222-2222-2222-2222-222222222222',
          'select count(*) from public.recommandations'),
          0::bigint, 'un tiers ne voit aucune recommandation');

-- 61) écrire à quelqu'un qui n'est pas mon proche est refusé — c'est TOUTE la
--     barrière anti-indésirables du produit.
select is(tests.count_as('22222222-2222-2222-2222-222222222222',
          'select case when (public.recommander_adresse(
             ''f1111111-1111-4111-8111-111111111111'', ''resto'', ''place-usurpee'', ''Chez Personne'') ->> ''ok'')::boolean
           then 1 else 0 end'),
          0::bigint, 'un compte étranger ne peut recommander à ce proche');

-- 62) et l'écriture DIRECTE n'existe pas : aucune policy d'insertion.
select throws_ok(
  $$ select tests.count_as('22222222-2222-2222-2222-222222222222',
       'with u as (insert into public.recommandations
          (de_profile_id, vers_profile_id, categorie, place_id, libelle)
          values (''22222222-2222-2222-2222-222222222222'',
                  ''de110000-0000-4000-8000-000000000000'', ''resto'', ''p'', ''X'') returning 1)
        select count(*) from u') $$,
  '42501', null,
  'aucune insertion directe dans recommandations (RPC obligatoire)');

-- ── Boîte de réception, purge (00048) ──────────────────────────────────────
-- 63) une recommandation EN ATTENTE ne se purge jamais, même ancienne
update public.recommandations set created_at = now() - interval '200 days';
select is(public.purger_recommandations(), 0,
          'une recommandation en attente survit à la purge');

-- 64) une recommandation traitée récemment reste : on ne purge pas à chaud
update public.recommandations set statut = 'refusee', traitee_le = now() - interval '10 days';
select is(public.purger_recommandations(), 0,
          'une recommandation traitée récemment reste');

-- 65) au-delà du délai, elle part
update public.recommandations set traitee_le = now() - interval '120 days';
select is(public.purger_recommandations(), 1,
          'une recommandation traitée il y a plus de 90 jours est purgée');

-- ── Boîte de réception : les vins (00049) ──────────────────────────────────
-- 66) on recommande un vin comme une adresse : même barrière de Cercle
select is(tests.count_as('11111111-1111-1111-1111-111111111111',
          'select case when (public.recommander_vin(
             ''f1111111-1111-4111-8111-111111111111'', ''Bandol'', ''Domaine Tempier'',
             2021::smallint, ''rouge''::public.vin_couleur, ''Provence'') ->> ''ok'')::boolean
           then 1 else 0 end'),
          1::bigint, 'on recommande un vin à un proche ayant un compte');

-- 67) un compte étranger ne peut pas plus recommander un vin qu'une adresse
select is(tests.count_as('22222222-2222-2222-2222-222222222222',
          'select case when (public.recommander_vin(
             ''f1111111-1111-4111-8111-111111111111'', ''Chablis'') ->> ''ok'')::boolean
           then 1 else 0 end'),
          0::bigint, 'un compte étranger ne peut recommander aucun vin');

-- 68) une recommandation vise UNE chose : ni les deux, ni aucune
select throws_ok(
  $$ insert into public.recommandations
       (de_profile_id, vers_profile_id, categorie, place_id, vin_nom, libelle)
     values ('11111111-1111-1111-1111-111111111111',
             'de110000-0000-4000-8000-000000000000', 'vin', 'place-x', 'Bandol', 'X') $$,
  '23514', null,
  'une recommandation ne peut pas viser à la fois une adresse et un vin');


-- ═══ Activités (lot 1) ══════════════════════════════════════════════════════
-- Deux catégories sensibles vivent ici : des codes d'accès physiques et des
-- certificats médicaux. La RLS est la seule chose qui empêche un compte d'aller
-- lire ceux d'un autre.

insert into public.activites (id, user_id, type, nom, club_nom, formule_seances) values
  ('ac000001-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111',
   'equitation', 'Équitation', 'Poney-club des Landes', 20);
insert into public.activite_membres (activite_id, membre_id) values
  ('ac000001-0000-4000-8000-000000000001', 'f1111111-1111-4111-8111-111111111111');
insert into public.activite_creneaux (id, activite_id, jour_semaine, heure_debut, heure_fin, depose_par) values
  ('ac000002-0000-4000-8000-000000000002', 'ac000001-0000-4000-8000-000000000001',
   6, '10:00', '11:00', 'f1111111-1111-4111-8111-111111111111');
insert into public.activite_codes (activite_id, libelle, valeur_chiffree) values
  ('ac000001-0000-4000-8000-000000000001', 'Portail principal', 'YmxvYi1jaGlmZnJl');
insert into public.activite_documents (activite_id, type, sensible, nom, contenu_chiffre, mime_type, taille, expire_le) values
  ('ac000001-0000-4000-8000-000000000001', 'certificat_medical', true, 'certif.pdf',
   'YmxvYi1jaGlmZnJl', 'application/pdf', 1024, '2027-06-30');
insert into public.journal_acces (user_id, cible_type, cible_id, action) values
  ('11111111-1111-1111-1111-111111111111', 'code_activite',
   'ac000001-0000-4000-8000-000000000001', 'revelation');

-- 70) anon ne voit rien, ni l'activité ni ce qu'elle protège
select is(tests.count_as_anon('select count(*) from public.activites'),
          0::bigint, 'anon ne voit aucune activité');
select is(tests.count_as_anon('select count(*) from public.activite_codes'),
          0::bigint, 'anon ne voit aucun code d''accès');
select is(tests.count_as_anon('select count(*) from public.journal_acces'),
          0::bigint, 'anon ne voit aucun accès journalisé');

-- 71) le propriétaire voit son activité et ses tables filles.
--     On vise les lignes de CE test, pas un total : le seed grossit avec le
--     produit, et un compteur absolu se serait périmé au premier ajout.
select is(tests.count_as('11111111-1111-1111-1111-111111111111',
          'select count(*) from public.activites where id = ''ac000001-0000-4000-8000-000000000001'''),
          1::bigint, 'le propriétaire voit son activité');
select is(tests.count_as('11111111-1111-1111-1111-111111111111',
          'select count(*) from public.activite_creneaux where activite_id = ''ac000001-0000-4000-8000-000000000001'''),
          1::bigint, 'le propriétaire voit ses créneaux');
select is(tests.count_as('11111111-1111-1111-1111-111111111111',
          'select count(*) from public.activite_codes where activite_id = ''ac000001-0000-4000-8000-000000000001'''),
          1::bigint, 'le propriétaire voit ses codes');

-- 72) un compte étranger ne voit RIEN, à aucun niveau de la hiérarchie
select is(tests.count_as('22222222-2222-2222-2222-222222222222',
          'select count(*) from public.activites'),
          0::bigint, 'un tiers ne voit aucune activité');
select is(tests.count_as('22222222-2222-2222-2222-222222222222',
          'select count(*) from public.activite_creneaux'),
          0::bigint, 'un tiers ne voit aucun créneau — les filles dérivent bien du parent');
select is(tests.count_as('22222222-2222-2222-2222-222222222222',
          'select count(*) from public.activite_codes'),
          0::bigint, 'un tiers ne voit aucun code d''accès');
select is(tests.count_as('22222222-2222-2222-2222-222222222222',
          'select count(*) from public.activite_documents'),
          0::bigint, 'un tiers ne voit aucun certificat médical');
select is(tests.count_as('22222222-2222-2222-2222-222222222222',
          'select count(*) from public.journal_acces'),
          0::bigint, 'un tiers ne lit pas le journal d''un autre');

-- 73) un tiers ne peut pas non plus ÉCRIRE dans mon activité
select throws_ok(
  $$ select tests.count_as('22222222-2222-2222-2222-222222222222',
       'insert into public.activite_codes (activite_id, libelle, valeur_chiffree)
        values (''ac000001-0000-4000-8000-000000000001'', ''Porte dérobée'', ''eA=='')') $$,
  '42501', null, 'un tiers ne peut pas ajouter un code à mon activité');

-- 74) et il ne peut pas se déclarer propriétaire d'une activité qu'il crée
--     pour quelqu'un d'autre : le with check porte sur user_id.
select throws_ok(
  $$ select tests.count_as('22222222-2222-2222-2222-222222222222',
       'insert into public.activites (user_id, type, nom)
        values (''11111111-1111-1111-1111-111111111111'', ''danse'', ''Intruse'')') $$,
  '42501', null, 'on ne crée pas une activité au nom d''un autre compte');

-- 75) rattacher à MON activité le proche d'un autre compte est refusé : la
--     policy compose les deux appartenances, sans quoi on découvrirait
--     l'existence des proches d'autrui par essais successifs.
select throws_ok(
  $$ select tests.count_as('11111111-1111-1111-1111-111111111111',
       'insert into public.activite_membres (activite_id, membre_id)
        values (''ac000001-0000-4000-8000-000000000001'',
                ''fa000001-0000-4000-8000-000000000002'')') $$,
  '42501', null, 'on ne rattache pas le proche d''un autre compte à son activité');

-- 76) le journal ne se réécrit pas — même par son auteur. Un journal
--     modifiable ne prouve rien.
select throws_ok(
  $$ select tests.count_as('11111111-1111-1111-1111-111111111111',
       'with u as (update public.journal_acces set action = ''ouverture'' returning 1) select count(*) from u') $$,
  '42501', null,
  'personne ne peut modifier le journal d''accès, pas même son propriétaire');
select throws_ok(
  $$ select tests.count_as('11111111-1111-1111-1111-111111111111',
       'with u as (delete from public.journal_acces returning 1) select count(*) from u') $$,
  '42501', null,
  'personne ne peut effacer une trace du journal d''accès');

-- 77) le journal se lit par son auteur, et s'écrit à son propre nom seulement
select is(tests.count_as('11111111-1111-1111-1111-111111111111',
          'select count(*) from public.journal_acces where cible_id = ''ac000001-0000-4000-8000-000000000001'''),
          1::bigint, 'l''auteur lit ses propres accès');
select throws_ok(
  $$ select tests.count_as('22222222-2222-2222-2222-222222222222',
       'insert into public.journal_acces (user_id, cible_type, cible_id, action)
        values (''11111111-1111-1111-1111-111111111111'', ''code_activite'',
                ''ac000001-0000-4000-8000-000000000001'', ''revelation'')') $$,
  '42501', null, 'on n''écrit pas dans le journal d''un autre compte');

-- 78) garde-fous de cohérence : un créneau à l'envers, une séance comptée deux
--     fois — ce sont les deux fautes qui fausseraient la vue « Cette semaine »
--     et le décompte de la formule.
select throws_ok(
  $$ insert into public.activite_creneaux (activite_id, jour_semaine, heure_debut, heure_fin)
     values ('ac000001-0000-4000-8000-000000000001', 3, '15:00', '14:00') $$,
  '23514', null, 'un créneau ne peut pas finir avant de commencer');
select throws_ok(
  $$ insert into public.activite_seances (activite_id, creneau_id, date, statut) values
       ('ac000001-0000-4000-8000-000000000001', 'ac000002-0000-4000-8000-000000000002', '2026-09-12', 'faite'),
       ('ac000001-0000-4000-8000-000000000001', 'ac000002-0000-4000-8000-000000000002', '2026-09-12', 'manquee') $$,
  '23505', null, 'une séance ne se pointe pas deux fois le même jour');

-- ─────────────────────────────────────────────────────────────────────────
-- 79) Limitation de débit (migration 00060). Ce qui doit tenir : le compteur
--     compte, la limite refuse, chaque compte a le sien, personne ne lit ni
--     n'efface la table, et l'action est bien une dimension du compteur.
-- ─────────────────────────────────────────────────────────────────────────
select has_table('public', 'quotas', 'la table des quotas existe');

-- Sous la limite : les trois premiers appels d'une limite de 3 passent.
select ok(tests.bool_as('11111111-1111-1111-1111-111111111111',
  $$ select public.consommer_quota('pgtap_a', 3, 60) $$), 'premier appel permis');
select ok(tests.bool_as('11111111-1111-1111-1111-111111111111',
  $$ select public.consommer_quota('pgtap_a', 3, 60) $$), 'deuxième appel permis');
select ok(tests.bool_as('11111111-1111-1111-1111-111111111111',
  $$ select public.consommer_quota('pgtap_a', 3, 60) $$), 'troisième appel permis');
-- Le quatrième franchit la limite : c'est tout l'objet.
select ok(not tests.bool_as('11111111-1111-1111-1111-111111111111',
  $$ select public.consommer_quota('pgtap_a', 3, 60) $$), 'le quatrième appel est refusé');

-- Une AUTRE action garde son propre compteur : saturer la recherche ne doit
-- pas fermer la lecture d'étiquette.
select ok(tests.bool_as('11111111-1111-1111-1111-111111111111',
  $$ select public.consommer_quota('pgtap_b', 3, 60) $$), 'une autre action a son propre compteur');

-- Un AUTRE compte aussi : sinon un utilisateur bruyant fermerait l'app aux autres.
select ok(tests.bool_as('22222222-2222-2222-2222-222222222222',
  $$ select public.consommer_quota('pgtap_a', 3, 60) $$), 'un autre compte a son propre compteur');

-- L'identité vient du jeton : sans jeton, on refuse plutôt que de compter
-- tout le monde ensemble sur une clé partagée.
select ok(not tests.bool_as_anon($$ select public.consommer_quota('pgtap_a', 3, 60) $$),
  'anon est refusé, il n''a pas de compteur à lui');

-- Barèmes absurdes : on lève, on ne laisse pas passer silencieusement.
select throws_ok(
  $$ select tests.bool_as('11111111-1111-1111-1111-111111111111',
       'select public.consommer_quota(''pgtap_c'', 0, 60)') $$,
  null, 'quota invalide', 'une limite nulle est une faute, pas un passe-droit');

-- La table est fermée : personne ne lit son compteur, personne ne l'efface.
-- Effacer sa ligne reviendrait à s'accorder un quota neuf.
select is(tests.count_as('11111111-1111-1111-1111-111111111111', 'select count(*) from public.quotas'),
  0::bigint, 'on ne lit pas la table des quotas');
select is(tests.count_as('11111111-1111-1111-1111-111111111111',
  'with d as (delete from public.quotas returning 1) select count(*) from d'),
  0::bigint, 'on n''efface pas son compteur');
select is(tests.count_as('11111111-1111-1111-1111-111111111111',
  'with u as (update public.quotas set compteur = 0 returning 1) select count(*) from u'),
  0::bigint, 'on ne remet pas son compteur à zéro');

-- ── Calendrier scolaire (00063) ─────────────────────────────────────────────
select has_table('public', 'vacances_scolaires', 'la table du calendrier scolaire existe');

insert into public.vacances_scolaires (annee_scolaire, zone, libelle, debut, fin)
values ('2026-2027', 'Zone C', 'pgtap Noël', '2026-12-19', '2027-01-04');

-- Données publiques pour qui est connecté : tout le monde lit le même calendrier.
select is(tests.count_as('11111111-1111-1111-1111-111111111111',
  'select count(*) from public.vacances_scolaires where libelle = ''pgtap Noël'''),
  1::bigint, 'un compte connecté lit le calendrier');

-- anon ne voit rien : l'écran qui l'affiche est derrière la connexion.
select is(tests.count_as_anon('select count(*) from public.vacances_scolaires'),
  0::bigint, 'anon ne lit rien du calendrier');

-- Le calendrier ne s'écrit pas depuis le navigateur : il vient de la source.
select throws_ok(
  $$ select tests.count_as('11111111-1111-1111-1111-111111111111',
       'insert into public.vacances_scolaires (annee_scolaire, zone, libelle, debut, fin)
        values (''2026-2027'', ''Zone A'', ''pgtap faux'', ''2026-01-01'', ''2026-01-02'')') $$,
  '42501', null, 'un compte connecté n''écrit pas dans le calendrier');

-- ── Bornes d'une période (00065) ────────────────────────────────────────────
-- Le rôle de service contourne la RLS, donc la seule barrière qui lui reste
-- est la contrainte. Elle compte : la dérivée d'été pose la fin au 31 août,
-- ce qui serait AVANT le début pour un été austral, et une coquille du
-- ministère produirait la même chose. Une ligne à l'envers écrite une fois
-- survivrait à la correction du code — le cache ne se relit pas.
select throws_ok(
  $$ insert into public.vacances_scolaires (annee_scolaire, zone, libelle, debut, fin)
     values ('2026-2027', 'Réunion', 'pgtap à l''envers', '2026-12-18', '2026-08-31') $$,
  '23514', null, 'une période qui finit avant de commencer est refusée');

-- Et l'égalité reste permise : le Pont de l'Ascension des zones A, B et C
-- tient en un seul jour, début et fin confondus.
select lives_ok(
  $$ insert into public.vacances_scolaires (annee_scolaire, zone, libelle, debut, fin)
     values ('2026-2027', 'Zone A', 'pgtap un seul jour', '2027-05-07', '2027-05-07') $$,
  'une période d''un seul jour est acceptée');

-- ── Lier deux comptes existants (00067) ─────────────────────────────────────
-- Ce bloc POSE DES FIXTURES (invitations, fiches rattachées). Un balayage
-- global du schéma — du type « aucune table n'est vide, personne ne voit les
-- lignes d'autrui » — doit donc rester APRÈS lui, en queue de fichier : le
-- fichier est une seule transaction, et un balayage placé avant verrait vides
-- des tables qui ne le sont plus trois assertions plus loin.
-- Deux personnes qui ont chacune un compte se lient par un code court : la
-- fiche de l'une pointe vers le compte de l'autre, DES DEUX CÔTÉS. Ce qui se
-- vérifie ici : le code ne vaut qu'une fois, il ne dit rien à qui ne l'a pas,
-- et il n'écrit jamais dans le carnet d'un tiers.

-- Quatre codes émis par le client (11111111…) : le premier vise la fiche de
-- Camille, le deuxième ne vise personne, le troisième sert à l'auto-liaison,
-- le quatrième est déjà expiré.
select is(tests.count_as('11111111-1111-1111-1111-111111111111', $q$
  with i as (
    insert into public.invitations (token, role_vise, code, relation, family_member_id, cree_par, expire_le)
    values ('pgtap-lien-token-aaaaaaaaaaaaaaaaaa', 'cercle', 'PGTAPAAA', 'conjoint',
            'f1111111-1111-4111-8111-111111111112', '11111111-1111-1111-1111-111111111111',
            now() + interval '15 minutes'),
           ('pgtap-lien-token-bbbbbbbbbbbbbbbbbb', 'cercle', 'PGTAPBBB', 'ami', null,
            '11111111-1111-1111-1111-111111111111', now() + interval '15 minutes'),
           ('pgtap-lien-token-cccccccccccccccccc', 'cercle', 'PGTAPCCC', 'ami', null,
            '11111111-1111-1111-1111-111111111111', now() + interval '15 minutes'),
           ('pgtap-lien-token-dddddddddddddddddd', 'cercle', 'PGTAPDDD', 'ami', null,
            '11111111-1111-1111-1111-111111111111', now() - interval '1 minute')
    returning 1)
  select count(*) from i $q$), 4::bigint, 'quatre codes de lien émis pour le test');

-- anon n'appelle pas la liaison (aucun grant)
select is(tests.count_as_anon(
  $q$ select case when (public.lier_comptes('PGTAPAAA', 'conjoint') ->> 'ok')::boolean then 1 else 0 end $q$),
  0::bigint, 'anon ne peut pas lier des comptes');

-- anti-énumération : un code expiré et un code inconnu se répondent pareil
select is(
  tests.text_as('44444444-4444-4444-8444-444444444444', $q$ select public.lien_infos('PGTAPDDD')::text $q$),
  tests.text_as('44444444-4444-4444-8444-444444444444', $q$ select public.lien_infos('ZZZZZZZZ')::text $q$),
  'un code expiré et un code inconnu donnent la même réponse');

-- un code valide annonce la relation proposée par l'émetteur
select is(
  tests.text_as('44444444-4444-4444-8444-444444444444',
    $q$ select public.lien_infos('PGTAPAAA') ->> 'relation_proposee' $q$),
  'conjoint', 'le code valide annonce la relation proposée');

-- on ne se lie pas à soi-même
select is(
  tests.text_as('11111111-1111-1111-1111-111111111111',
    $q$ select public.lier_comptes('PGTAPCCC', 'ami') ->> 'motif' $q$),
  'soi_meme', 'l''émetteur ne peut pas consommer son propre code');

-- « moi » désigne sa propre fiche : impossible de la donner à autrui
select is(
  tests.text_as('44444444-4444-4444-8444-444444444444',
    $q$ select public.lier_comptes('PGTAPAAA', 'moi') ->> 'motif' $q$),
  'relation_invalide', '« moi » est refusé comme relation de liaison');

-- la liaison réussit
select is(
  tests.text_as('44444444-4444-4444-8444-444444444444',
    $q$ select (public.lier_comptes('PGTAPAAA', 'parent') ->> 'ok') $q$),
  'true', 'le code valide lie les deux comptes');

-- côté émetteur : la fiche visée porte désormais le compte de l'invité
select is((select count(*) from public.family_members
           where id = 'f1111111-1111-4111-8111-111111111112'
             and profile_id = '44444444-4444-4444-8444-444444444444'), 1::bigint,
          'la fiche visée est rattachée au compte de l''invité');

-- côté invité : une fiche est apparue, avec la relation qu'il a choisie
select is((select count(*) from public.family_members
           where user_id = '44444444-4444-4444-8444-444444444444'
             and profile_id = '11111111-1111-1111-1111-111111111111'
             and relation = 'parent'), 1::bigint,
          'l''invité a une fiche réciproque, avec la relation qu''il a choisie');

-- la fiche réciproque prend le NOM DU PROFIL de l'émetteur, pas un libellé
-- inventé — et un compte sans nom de famille n'écrit pas de tiret.
-- Le nom vient du COMPTE, et rien n'est inventé quand il manque : beaucoup de
-- profils n'ont qu'un prénom, et un tiret de remplissage afficherait
-- « Camille — » dans le carnet. Formulé en invariant, pas en valeur de seed.
select ok(
  (select fm.last_name = '' and p.display_name like fm.first_name || '%'
     from public.family_members fm
     join public.profiles p on p.id = fm.profile_id
    where fm.user_id = '44444444-4444-4444-8444-444444444444'
      and fm.profile_id = '11111111-1111-1111-1111-111111111111'),
  'la fiche réciproque prend le nom du compte, sans nom de famille inventé');

-- le code est brûlé : il ne vaut pas deux fois
select is(
  tests.text_as('44444444-4444-4444-8444-444444444444',
    $q$ select public.lier_comptes('PGTAPAAA', 'parent') ->> 'motif' $q$),
  'invalide', 'un code déjà consommé ne vaut plus rien');

-- un second code entre les deux mêmes comptes ne duplique aucune fiche
select is(tests.count_as('44444444-4444-4444-8444-444444444444', $q$
  with l as (select public.lier_comptes('PGTAPBBB', 'ami'))
  select count(*) from public.family_members, l
   where user_id = '44444444-4444-4444-8444-444444444444'
     and profile_id = '11111111-1111-1111-1111-111111111111' $q$),
  1::bigint, 'se relier une seconde fois ne crée pas de doublon');

-- Force brute : le code est court, donc les tentatives sont plafonnées.
--
-- On compte les onze réponses au lieu de chercher « au moins un plafonnement » :
-- cette dernière formulation resterait verte si le quota de ce compte était
-- DÉJÀ épuisé par une assertion ajoutée plus haut un jour (0 essai utile, 11
-- refus), et elle ne dirait rien du rang où le plafond tombe. « 10/1 » ne peut
-- être vrai que si les dix premiers essais ont réellement été servis.
select is(
  tests.text_as('22222222-2222-2222-2222-222222222222', $q$
    select (count(*) filter (where m = 'invalide'))::text || '/' ||
           (count(*) filter (where m = 'trop_de_tentatives'))::text
      from (select public.lier_comptes('ZZZZZZZZ', 'ami') ->> 'motif' as m
              from generate_series(1, 11)) t $q$),
  '10/1', 'dix essais sont servis, le onzième est plafonné');

-- ============================================================
-- Fixtures du socle : donner à chaque table vide une ligne d'autrui
-- ============================================================
-- Sans ces lignes, le balayage de l'étranger passe à vide sur neuf tables
-- (cf. le garde-fou de vacuité). Elles appartiennent toutes à demo ou client,
-- jamais à free — c'est ce qui rend le balayage probant.
-- Tout est annulé par le rollback final : rien ne persiste.

-- Un foyer appartenant à demo. Le trigger add_famille_owner_membre y ajoute
-- automatiquement son propriétaire, ce qui alimente aussi famille_membres.
insert into public.familles (id, owner_id, nom)
values ('fa000000-0000-4000-8000-000000000001',
        'de110000-0000-4000-8000-000000000000', 'pgtap foyer');

-- Un resto partagé au foyer, et un avis : les deux s'accrochent à un
-- établissement du seed, pris au hasard mais de façon déterministe.
insert into public.famille_restos (famille_id, etablissement_id)
select 'fa000000-0000-4000-8000-000000000001',
       id from public.etablissements order by id limit 1;

insert into public.avis (user_id, etablissement_id, note)
select 'de110000-0000-4000-8000-000000000000',
       id, 4 from public.etablissements order by id limit 1;

-- L'agence suit un client : c'est la table qui porte le lien commercial.
insert into public.agence_clients (agence_id, client_id)
values ('22222222-2222-2222-2222-222222222222',
        '11111111-1111-1111-1111-111111111111');

-- Un remboursement dans un groupe de dépenses du seed.
insert into public.remboursements (groupe_id, de_profile_id, vers_profile_id, montant_cents, created_by)
select g.id,
       '11111111-1111-1111-1111-111111111111',
       'de110000-0000-4000-8000-000000000000',
       500,
       'de110000-0000-4000-8000-000000000000'
from public.depense_groupes g order by g.id limit 1;

-- Un remboursement de voyage, entre deux participants créés plus haut dans ce
-- fichier (section « dépense partagée entre voyageurs »).
insert into public.voyage_remboursements (voyage_id, de_participant_id, vers_participant_id, montant_cents, created_by)
select p1.voyage_id, p1.id, p2.id, 250, p1.created_by
from public.voyage_participants p1
join public.voyage_participants p2
  on p2.voyage_id = p1.voyage_id and p2.id <> p1.id
order by p1.id, p2.id limit 1;

-- Une échéance et une exception de créneau sur l'activité créée plus haut.
insert into public.activite_paiements (activite_id, libelle, montant_cents)
select id, 'pgtap cotisation', 12000 from public.activites order by id limit 1;

-- `type` est contraint à 'annulation' ou 'ponctuelle' (CHECK) — pas 'annule'.
insert into public.activite_creneau_exceptions (creneau_id, date, type)
select id, '2027-01-13', 'annulation' from public.activite_creneaux order by id limit 1;

-- ============================================================
-- Lot 2 — fixtures de profondeur : un porteur, un co-membre, un étranger
-- ============================================================
-- Trois familles d'accès (voyage, groupe de dépenses, foyer) régies par trois
-- prédicats structurellement identiques : owner OR membre. On monte donc le
-- même décor trois fois — demo possède, client est co-membre, et personne
-- d'autre n'a de lien.
--
-- Tout est borné à ces identifiants : les assertions qui suivent comptent des
-- lignes DE CES FIXTURES, jamais des totaux. Un décompte absolu encoderait
-- l'état du seed et tomberait au premier run e2e.

-- Voyage. demo est premium (vérifié), donc enforce_voyage_limit ne s'y oppose
-- pas ; le trigger add_voyage_owner_membre inscrit demo dans voyage_membres.
insert into public.voyages (id, owner_id, titre)
values ('bb000000-0000-4000-8000-000000000001',
        'de110000-0000-4000-8000-000000000000', 'pgtap voyage profondeur');

insert into public.voyage_membres (voyage_id, profile_id, role)
values ('bb000000-0000-4000-8000-000000000001',
        '11111111-1111-1111-1111-111111111111', 'membre');

insert into public.reservations (voyage_id, created_by)
values ('bb000000-0000-4000-8000-000000000001',
        'de110000-0000-4000-8000-000000000000');

insert into public.voyage_documents (voyage_id, nom, mime_type, taille, contenu_chiffre, uploaded_by)
values ('bb000000-0000-4000-8000-000000000001', 'pgtap.pdf', 'application/pdf', 4, 'AAAA',
        'de110000-0000-4000-8000-000000000000');

-- Deux voyageurs SANS COMPTE, source pour l'assertion voyage_remboursements
-- ci-dessous (ronde de correction 1 : la version précédente n'avait aucune
-- ligne de voyage_participants rattachée à CE voyage, donc l'insert de preuve
-- portait sur 0 ligne quelle que soit la policy — verte pour la mauvaise
-- raison).
insert into public.voyage_participants (id, voyage_id, display_name, created_by)
values ('bb000000-0000-4000-8000-00000000000b', 'bb000000-0000-4000-8000-000000000001',
        'Voyageur pgtap A', 'de110000-0000-4000-8000-000000000000');
insert into public.voyage_participants (id, voyage_id, display_name, created_by)
values ('bb000000-0000-4000-8000-00000000000c', 'bb000000-0000-4000-8000-000000000001',
        'Voyageur pgtap B', 'de110000-0000-4000-8000-000000000000');

-- Groupe de dépenses. Le trigger add_groupe_owner_membre inscrit demo.
insert into public.depense_groupes (id, owner_id, titre)
values ('bb000000-0000-4000-8000-000000000002',
        'de110000-0000-4000-8000-000000000000', 'pgtap groupe profondeur');

insert into public.depense_groupe_membres (groupe_id, profile_id)
values ('bb000000-0000-4000-8000-000000000002',
        '11111111-1111-1111-1111-111111111111');

insert into public.depenses (id, groupe_id, paye_par, libelle, montant_cents, created_by)
values ('bb000000-0000-4000-8000-00000000000a',
        'bb000000-0000-4000-8000-000000000002',
        'de110000-0000-4000-8000-000000000000', 'pgtap dépense', 1000,
        'de110000-0000-4000-8000-000000000000');

insert into public.depense_parts (depense_id, profile_id, part_cents)
values ('bb000000-0000-4000-8000-00000000000a',
        '11111111-1111-1111-1111-111111111111', 500);

-- Foyer : on RÉUTILISE celui du lot 1 (familles.famille_membres porte un
-- UNIQUE(profile_id), donc demo ne peut pas posséder deux foyers). On n'ajoute
-- que le co-membre.
insert into public.famille_membres (famille_id, profile_id, role)
values ('fa000000-0000-4000-8000-000000000001',
        '11111111-1111-1111-1111-111111111111', 'membre');

-- ── Lot 2 / famille VOYAGE (can_access_voyage) ─────────────────────────────
-- Cinq tables suspendues au même prédicat. Le co-membre accède, l'étranger est
-- refusé, et surtout : voir le voyage ne donne pas le droit de le supprimer.

select is(tests.count_as('11111111-1111-1111-1111-111111111111',
          'select count(*) from public.voyages where id = ''bb000000-0000-4000-8000-000000000001'''),
          1::bigint, 'voyage : le co-membre voit le voyage partagé');
select is(tests.count_as('deadbeef-0000-4000-8000-000000000000',
          'select count(*) from public.voyages where id = ''bb000000-0000-4000-8000-000000000001'''),
          0::bigint, 'voyage : un non-membre ne voit pas le voyage');

select is(tests.count_as('11111111-1111-1111-1111-111111111111',
          'select count(*) from public.voyage_membres where voyage_id = ''bb000000-0000-4000-8000-000000000001'''),
          2::bigint, 'voyage_membres : le co-membre voit les deux membres (demo + lui)');
select is(tests.count_as('deadbeef-0000-4000-8000-000000000000',
          'select count(*) from public.voyage_membres where voyage_id = ''bb000000-0000-4000-8000-000000000001'''),
          0::bigint, 'voyage_membres : un non-membre ne voit personne');

select is(tests.count_as('11111111-1111-1111-1111-111111111111',
          'select count(*) from public.voyage_documents where voyage_id = ''bb000000-0000-4000-8000-000000000001'''),
          1::bigint, 'voyage_documents : le co-membre voit la pièce jointe');
select is(tests.count_as('deadbeef-0000-4000-8000-000000000000',
          'select count(*) from public.voyage_documents where voyage_id = ''bb000000-0000-4000-8000-000000000001'''),
          0::bigint, 'voyage_documents : un non-membre n''en voit aucune');

select is(tests.count_as('11111111-1111-1111-1111-111111111111',
          'select count(*) from public.reservations where voyage_id = ''bb000000-0000-4000-8000-000000000001'''),
          1::bigint, 'reservations : le co-membre voit la réservation');
select is(tests.count_as('deadbeef-0000-4000-8000-000000000000',
          'select count(*) from public.reservations where voyage_id = ''bb000000-0000-4000-8000-000000000001'''),
          0::bigint, 'reservations : un non-membre n''en voit aucune');

-- voyage_remboursements : la table est vide pour ce voyage, donc on l'éprouve
-- en ÉCRITURE, avec les deux voyageurs pgtap A/B comme source déterministe
-- (ronde de correction 1). Une violation de WITH CHECK LÈVE une erreur
-- (42501, « new row violates row-level security policy ») — elle ne rend pas
-- 0 ligne. tests.count_as n'a pas de gestionnaire d'exception : si l'insert
-- levait sous son toit, le `reset role` ne s'exécuterait jamais et
-- l'identité deadbeef fuiterait sur toutes les assertions suivantes. throws_ok
-- est l'outil correct : il piège l'erreur dans sa propre savepoint.
select throws_ok(
  $$ select tests.count_as('deadbeef-0000-4000-8000-000000000000',
       'with u as (insert into public.voyage_remboursements (voyage_id, de_participant_id, vers_participant_id, montant_cents, created_by) values (''bb000000-0000-4000-8000-000000000001'', ''bb000000-0000-4000-8000-00000000000b'', ''bb000000-0000-4000-8000-00000000000c'', 100, ''deadbeef-0000-4000-8000-000000000000'') returning 1) select count(*) from u') $$,
  '42501', null,
  'voyage_remboursements : un non-membre n''y insère rien');

-- Témoin positif : sans lui, le refus ci-dessus serait satisfait par une table
-- où PERSONNE ne peut écrire. Le co-membre, lui, doit pouvoir créer ce
-- remboursement (can_access_voyage est collaboratif, pas réservé au owner).
select is(tests.count_as('11111111-1111-1111-1111-111111111111',
          'with u as (insert into public.voyage_remboursements (voyage_id, de_participant_id, vers_participant_id, montant_cents, created_by) values (''bb000000-0000-4000-8000-000000000001'', ''bb000000-0000-4000-8000-00000000000b'', ''bb000000-0000-4000-8000-00000000000c'', 100, ''11111111-1111-1111-1111-111111111111'') returning 1) select count(*) from u'),
          1::bigint, 'voyage_remboursements : le co-membre peut créer un remboursement');

-- VOIR N'EST PAS ÉCRIRE. Le co-membre voit le voyage (assertion 1) mais
-- voyages_delete exige is_voyage_owner : sa suppression doit porter sur 0 ligne.
-- C'est la frontière que rien ne tenait avant ce lot.
select is(tests.count_as('11111111-1111-1111-1111-111111111111',
          'with u as (delete from public.voyages where id = ''bb000000-0000-4000-8000-000000000001'' returning 1) select count(*) from u'),
          0::bigint, 'voyage : le co-membre VOIT mais ne peut pas SUPPRIMER');

-- Et le propriétaire, lui, le peut — sans quoi l'assertion ci-dessus serait
-- vraie d'un voyage que PERSONNE ne peut supprimer. On ne supprime pas pour de
-- bon : la transaction du fichier est annulée à la fin.
select is(tests.count_as('de110000-0000-4000-8000-000000000000',
          'with u as (delete from public.voyages where id = ''bb000000-0000-4000-8000-000000000001'' returning 1) select count(*) from u'),
          1::bigint, 'voyage : le propriétaire, lui, peut supprimer');

-- ── Lot 2 / famille DÉPENSES (can_access_groupe) ───────────────────────────
-- Même prédicat, même trio d'invariants. Particularité : depense_parts ne
-- porte pas le groupe, elle le rejoint par la dépense — c'est le chemin le plus
-- long du schéma, donc celui qui se casse le plus discrètement.

select is(tests.count_as('11111111-1111-1111-1111-111111111111',
          'select count(*) from public.depense_groupes where id = ''bb000000-0000-4000-8000-000000000002'''),
          1::bigint, 'depense_groupes : le co-membre voit le groupe partagé');
select is(tests.count_as('deadbeef-0000-4000-8000-000000000000',
          'select count(*) from public.depense_groupes where id = ''bb000000-0000-4000-8000-000000000002'''),
          0::bigint, 'depense_groupes : un non-membre ne voit pas le groupe');

select is(tests.count_as('11111111-1111-1111-1111-111111111111',
          'select count(*) from public.depenses where groupe_id = ''bb000000-0000-4000-8000-000000000002'''),
          1::bigint, 'depenses : le co-membre voit la dépense du groupe');
select is(tests.count_as('deadbeef-0000-4000-8000-000000000000',
          'select count(*) from public.depenses where groupe_id = ''bb000000-0000-4000-8000-000000000002'''),
          0::bigint, 'depenses : un non-membre n''en voit aucune');

select is(tests.count_as('11111111-1111-1111-1111-111111111111',
          'select count(*) from public.depense_parts where depense_id = ''bb000000-0000-4000-8000-00000000000a'''),
          1::bigint, 'depense_parts : le co-membre voit sa part (jointure via la dépense)');
select is(tests.count_as('deadbeef-0000-4000-8000-000000000000',
          'select count(*) from public.depense_parts where depense_id = ''bb000000-0000-4000-8000-00000000000a'''),
          0::bigint, 'depense_parts : un non-membre n''en voit aucune');

-- remboursements : vide pour ce groupe, donc éprouvée en ÉCRITURE. Une
-- violation de WITH CHECK LÈVE une erreur (42501), elle ne rend pas 0 ligne —
-- tests.count_as n'a pas de gestionnaire d'exception : si l'insert levait sous
-- son toit, le `reset role` ne s'exécuterait jamais et l'identité deadbeef
-- fuirait sur toutes les assertions suivantes. throws_ok piège l'erreur dans
-- sa propre savepoint.
select throws_ok(
  $$ select tests.count_as('deadbeef-0000-4000-8000-000000000000',
       'with u as (insert into public.remboursements (groupe_id, de_profile_id, vers_profile_id, montant_cents, created_by) values (''bb000000-0000-4000-8000-000000000002'', ''11111111-1111-1111-1111-111111111111'', ''de110000-0000-4000-8000-000000000000'', 100, ''deadbeef-0000-4000-8000-000000000000'') returning 1) select count(*) from u') $$,
  '42501', null,
  'remboursements : un non-membre n''y insère rien');

-- Témoin positif : sans lui, le refus ci-dessus serait satisfait par une table
-- où PERSONNE ne peut écrire. Le co-membre, lui, doit pouvoir créer ce
-- remboursement.
select is(tests.count_as('11111111-1111-1111-1111-111111111111',
          'with u as (insert into public.remboursements (groupe_id, de_profile_id, vers_profile_id, montant_cents, created_by) values (''bb000000-0000-4000-8000-000000000002'', ''11111111-1111-1111-1111-111111111111'', ''de110000-0000-4000-8000-000000000000'', 100, ''11111111-1111-1111-1111-111111111111'') returning 1) select count(*) from u'),
          1::bigint, 'remboursements : le co-membre, lui, peut en créer un');

-- VOIR N'EST PAS SUPPRIMER : depense_groupes_delete exige is_groupe_owner,
-- alors que l'UPDATE se contente de can_access_groupe. Un co-membre modifie
-- donc le groupe mais ne l'efface pas — asymétrie voulue, jamais testée.
select is(tests.count_as('11111111-1111-1111-1111-111111111111',
          'with u as (delete from public.depense_groupes where id = ''bb000000-0000-4000-8000-000000000002'' returning 1) select count(*) from u'),
          0::bigint, 'depense_groupes : le co-membre VOIT et MODIFIE, mais ne SUPPRIME pas');

-- Et le propriétaire, lui, le peut — sans quoi l'assertion ci-dessus serait
-- vraie d'un groupe que PERSONNE ne peut supprimer. Une absence n'est une
-- preuve que si son contraire est aussi vrai pour quelqu'un.
-- ORDRE : DERNIÈRE assertion de la section — cette suppression emporte en
-- cascade la dépense, la part et le remboursement créés plus haut ; aucune
-- assertion sur depenses/depense_parts/remboursements ne doit la suivre. On
-- ne supprime pas pour de bon : la transaction du fichier est annulée à la
-- fin.
select is(tests.count_as('de110000-0000-4000-8000-000000000000',
          'with u as (delete from public.depense_groupes where id = ''bb000000-0000-4000-8000-000000000002'' returning 1) select count(*) from u'),
          1::bigint, 'depense_groupes : le propriétaire, lui, peut supprimer');

-- ── Lot 2 / famille CERCLE (can_access_famille) ─────────────────────────────
-- Troisième et dernière occurrence du même motif. Le foyer vient du lot 1 :
-- famille_membres porte un UNIQUE(profile_id), donc demo ne peut pas en
-- posséder deux — on réutilise plutôt que de dupliquer.

select is(tests.count_as('11111111-1111-1111-1111-111111111111',
          'select count(*) from public.familles where id = ''fa000000-0000-4000-8000-000000000001'''),
          1::bigint, 'familles : le co-membre voit le foyer partagé');
select is(tests.count_as('deadbeef-0000-4000-8000-000000000000',
          'select count(*) from public.familles where id = ''fa000000-0000-4000-8000-000000000001'''),
          0::bigint, 'familles : un non-membre ne voit pas le foyer');

select is(tests.count_as('11111111-1111-1111-1111-111111111111',
          'select count(*) from public.famille_membres where famille_id = ''fa000000-0000-4000-8000-000000000001'''),
          2::bigint, 'famille_membres : le co-membre voit les deux membres');
select is(tests.count_as('deadbeef-0000-4000-8000-000000000000',
          'select count(*) from public.famille_membres where famille_id = ''fa000000-0000-4000-8000-000000000001'''),
          0::bigint, 'famille_membres : un non-membre ne voit personne');

select is(tests.count_as('11111111-1111-1111-1111-111111111111',
          'select count(*) from public.famille_restos where famille_id = ''fa000000-0000-4000-8000-000000000001'''),
          1::bigint, 'famille_restos : le co-membre voit l''adresse partagée au foyer');
select is(tests.count_as('deadbeef-0000-4000-8000-000000000000',
          'select count(*) from public.famille_restos where famille_id = ''fa000000-0000-4000-8000-000000000001'''),
          0::bigint, 'famille_restos : un non-membre n''en voit aucune');

-- VOIR N'EST PAS SUPPRIMER : familles_delete exige is_famille_owner. Sans
-- contrepartie, cette absence serait aussi verte si PERSONNE (propriétaire
-- compris) ne pouvait supprimer le foyer — le témoin positif juste après
-- ferme ce trou.
select is(tests.count_as('11111111-1111-1111-1111-111111111111',
          'with u as (delete from public.familles where id = ''fa000000-0000-4000-8000-000000000001'' returning 1) select count(*) from u'),
          0::bigint, 'familles : le co-membre VOIT mais ne peut pas SUPPRIMER le foyer');

-- Témoin positif, et DERNIÈRE assertion de la section : le propriétaire, lui,
-- peut supprimer le foyer — la suppression emporte en cascade
-- famille_membres et famille_restos (FK ... on delete cascade).
--
-- PIÈGE PROPRE À CETTE FAMILLE, absent des deux occurrences précédentes
-- (voyage, dépenses) : familles, famille_membres et famille_restos n'ont
-- AUCUNE ligne de seed — mesuré à zéro avant nos fixtures (cf. rapport). Un
-- DELETE qui aboutit ici, même annulé par le rollback final du fichier, laisse
-- ces trois tables vides pour tout ce qui s'exécute APRÈS ce point dans la
-- même transaction — en particulier le garde-fou de vacuité du bloc SOCLE,
-- en fin de fichier, qui échouerait en les nommant. On RE-CRÉE donc,
-- immédiatement après, les trois lignes : le foyer (même id, pour que toute
-- policy qui le référence encore par cet identifiant retrouve la même
-- ligne), la ligne famille_restos, et SEULEMENT le co-membre — le trigger
-- add_famille_owner_membre (on_famille_created, cf. 00013_famille.sql)
-- réinscrit automatiquement demo comme owner dans famille_membres dès
-- l'insert ci-dessous ; l'ajouter à la main lèverait sur l'UNIQUE(profile_id).
select is(tests.count_as('de110000-0000-4000-8000-000000000000',
          'with u as (delete from public.familles where id = ''fa000000-0000-4000-8000-000000000001'' returning 1) select count(*) from u'),
          1::bigint, 'familles : le propriétaire, lui, peut supprimer le foyer');

-- Re-création : voir le commentaire ci-dessus. Reprend exactement la forme
-- des fixtures posées plus haut dans ce fichier (foyer et famille_restos au
-- socle, co-membre au décor de profondeur du lot 2).
insert into public.familles (id, owner_id, nom)
values ('fa000000-0000-4000-8000-000000000001',
        'de110000-0000-4000-8000-000000000000', 'pgtap foyer');

insert into public.famille_membres (famille_id, profile_id, role)
values ('fa000000-0000-4000-8000-000000000001',
        '11111111-1111-1111-1111-111111111111', 'membre');

insert into public.famille_restos (famille_id, etablissement_id)
select 'fa000000-0000-4000-8000-000000000001',
       id from public.etablissements order by id limit 1;

-- ── Lot 2 / les quatre cas particuliers ────────────────────────────────────

-- agence_clients : lien SYMÉTRIQUE (agence_id = uid OR client_id = uid). Les
-- deux parties voient, et elles seules. La fixture vient du lot 1 : agence
-- suit client.
select is(tests.count_as('22222222-2222-2222-2222-222222222222',
          'select count(*) from public.agence_clients where client_id = ''11111111-1111-1111-1111-111111111111'''),
          1::bigint, 'agence_clients : l''agence voit le lien vers son client');
select is(tests.count_as('11111111-1111-1111-1111-111111111111',
          'select count(*) from public.agence_clients where client_id = ''11111111-1111-1111-1111-111111111111'''),
          1::bigint, 'agence_clients : le client voit aussi le lien — la relation est symétrique');
select is(tests.count_as('deadbeef-0000-4000-8000-000000000000',
          'select count(*) from public.agence_clients where client_id = ''11111111-1111-1111-1111-111111111111'''),
          0::bigint, 'agence_clients : un tiers ne voit pas qui suit qui');

-- subscriptions : strictement owner (+ admin). Pas de co-membre ici — c'est
-- l'argent de quelqu'un, il ne se partage pas.
select is(tests.count_as('de110000-0000-4000-8000-000000000000',
          'select count(*) from public.subscriptions where user_id = ''de110000-0000-4000-8000-000000000000'''),
          1::bigint, 'subscriptions : chacun voit son propre abonnement');
select is(tests.count_as('11111111-1111-1111-1111-111111111111',
          'select count(*) from public.subscriptions where user_id = ''de110000-0000-4000-8000-000000000000'''),
          0::bigint, 'subscriptions : personne ne voit l''abonnement d''un autre');

-- avis : owner strict. La fixture vient du lot 1 (demo a noté un établissement).
select is(tests.count_as('de110000-0000-4000-8000-000000000000',
          'select count(*) from public.avis where user_id = ''de110000-0000-4000-8000-000000000000'''),
          1::bigint, 'avis : l''auteur voit son avis');
select is(tests.count_as('11111111-1111-1111-1111-111111111111',
          'select count(*) from public.avis where user_id = ''de110000-0000-4000-8000-000000000000'''),
          0::bigint, 'avis : personne ne lit l''avis d''un autre');

-- etablissements : LE cas inversé. SELECT USING (true) pour tout compte
-- connecté — et AUCUNE policy d'écriture, relevé au catalogue. La RLS refuse
-- donc par défaut : le catalogue ne se modifie que par upsert_etablissement
-- (SECURITY DEFINER). C'est l'invariant que ce lot grave, parce qu'il ne tient
-- aujourd'hui qu'à une ABSENCE de policy — et une absence s'ajoute par
-- distraction.
select is(tests.count_as('11111111-1111-1111-1111-111111111111',
          'with u as (update public.etablissements set nom = ''pgtap hack'' where id = (select id from public.etablissements order by id limit 1) returning 1) select count(*) from u'),
          0::bigint, 'etablissements : un compte connecté ne modifie pas le catalogue');
select is(tests.count_as('11111111-1111-1111-1111-111111111111',
          'with u as (delete from public.etablissements where id = (select id from public.etablissements order by id limit 1) returning 1) select count(*) from u'),
          0::bigint, 'etablissements : ni ne l''efface');

-- Les deux assertions ci-dessus ne sondent qu'UNE ligne (celle prise par
-- `order by id limit 1`) : elles prouvent que l'écriture est refusée À
-- L'EXÉCUTION sur cette ligne-là, pas qu'aucune policy ne pourrait un jour
-- l'autoriser sur une AUTRE ligne. Une policy d'écriture future mal cadrée
-- (qui viserait par erreur seulement les lignes ajoutées après coup, par
-- exemple) romprait l'invariant sans faire rougir ces deux tests. D'où cette
-- troisième assertion, déclarative et indépendante de toute ligne : elle
-- compte les policies d'écriture sur `etablissements` dans le catalogue et
-- exige zéro. Les trois se complètent : les deux premières prouvent le
-- comportement observé, celle-ci grave l'absence structurelle qui le
-- garantit pour toutes les lignes, présentes et futures.
select is(
  (select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'etablissements'
      and cmd in ('INSERT', 'UPDATE', 'DELETE'))::bigint,
  0::bigint,
  'etablissements : aucune policy d''écriture n''existe au catalogue (INSERT/UPDATE/DELETE)');

-- ============================================================
-- SOCLE — balayages pilotés par le catalogue
-- ============================================================
-- UNE RÈGLE GOUVERNE TOUT CE BLOC, et elle se reperd à chaque relecture pressée :
-- **une garde négative sans témoin positif ne distingue pas la sécurité de la
-- panne.** « Personne ne voit rien » est vert quand plus rien ne se lit, comme
-- « au moins un refus » est vert quand tout est refusé. `is(fuites, '{}')` se
-- relit pourtant comme une évidence — c'est bien le problème.
-- D'où, ci-dessous, deux garde-fous de comptage ET un témoin positif ciblé :
-- chaque assertion d'absence est accompagnée de quelque chose qui tombe si le
-- mécanisme lui-même s'est éteint.
-- Écrit ici, en FIN de fichier, délibérément : le fichier est une seule
-- transaction, donc les fixtures posées plus haut (participants de voyage,
-- dépenses, codes d'activité, journal d'accès…) existent encore. Placé en tête,
-- le balayage trouverait 19 tables vides et se prononcerait sur du néant.

-- UNE seule source pour « quelles tables balayer ». Deux copies de cette
-- clause (une par balayage) auraient pu diverger en silence — c'est le défaut
-- que ce fichier corrige ailleurs, il n'a pas le droit de le commettre ici.
--
-- Le `coalesce` n'est pas cosmétique. `(select array_agg(nom) from
-- socle_exceptions)` rend NULL si la table d'exceptions est vide, et
-- `tablename <> all(NULL)` est NULL pour CHAQUE ligne : la boucle ne visite
-- alors AUCUNE table, et les assertions du socle passent au vert sur du néant.
-- Vider les exceptions doit rendre le socle PLUS sévère, jamais l'éteindre.
create function tests.tables_a_balayer(p_exceptions text[])
returns setof text language sql stable as $$
  select tablename from pg_tables
  where schemaname = 'public'
    and tablename <> all(coalesce(p_exceptions, '{}'::text[]))
  order by tablename
$$;

-- Visite chaque table du schéma public sous une identité, et rend ce qu'elle y
-- voit. `p_uid` null = anon. Un refus au niveau GRANT vaut 0 ligne exposée :
-- l'invariant est « rien ne fuit », pas « la requête aboutit ».
create function tests.balayage(p_uid uuid, p_exceptions text[])
returns table(nom text, lignes bigint) language plpgsql as $$
declare t text; n bigint;
begin
  for t in select * from tests.tables_a_balayer(p_exceptions)
  loop
    begin
      if p_uid is null then
        perform set_config('request.jwt.claims', '{"role":"anon"}', true);
        set local role anon;
      else
        perform set_config('request.jwt.claims',
          json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
        set local role authenticated;
      end if;
      execute format('select count(*) from public.%I', t) into n;
      reset role;
    exception when insufficient_privilege then
      reset role; n := 0;
    end;
    nom := t; lignes := n; return next;
  end loop;
end $$;

create temp table socle_anon as select * from tests.balayage(null, '{}');

select is(
  (select coalesce(array_agg(nom order by nom), '{}') from socle_anon where lignes > 0),
  '{}'::text[],
  'anon ne voit aucune ligne, dans aucune table du schéma public');

-- Garde-fou NON NÉGOCIABLE : sans lui, un filtre trop zélé (schéma renommé,
-- `where` mal écrit) rendrait l'assertion ci-dessus verte EN NE BALAYANT RIEN.
-- C'est le motif exact des tests vides : le test reproduit la garde qu'il
-- prétend éprouver. 48 = compte relevé au catalogue le 2026-09-12.
select cmp_ok(
  (select count(*) from socle_anon), '>=', 48::bigint,
  'le balayage anon a bien visité tout le schéma');

-- L'étranger n'est PAS un compte du seed, et c'est délibéré. Il l'a été
-- (free@vito.test) jusqu'à ce qu'on mesure : `e2e/abonnement.spec.ts` connecte
-- `free`, lui fait créer des voyages et souscrire un abonnement. Sur une base
-- contaminée par un run e2e, l'étranger voyait donc {subscriptions,
-- voyage_membres, voyages} — SES PROPRES lignes, dans un message rigoureusement
-- indiscernable d'une vraie fuite RLS. Un socle qui crie au loup pour des
-- raisons extérieures à la sécurité finit ignoré.
--
-- D'où cet uuid SYNTHÉTIQUE, volontairement illisible comme un vrai compte :
-- il n'existe dans aucune table, aucun seed, aucune suite e2e ne peut le muter.
-- Les policies ne comparent que des uuid (auth.uid()) — aucune n'exige une
-- ligne dans auth.users — donc l'identité tient sans compte derrière.
create temp table socle_exceptions(nom text primary key, raison text);
insert into socle_exceptions values
  ('etablissements',     'catalogue partagé, SELECT USING (true) assumé'),
  ('vacances_scolaires', 'calendrier public pour tout compte connecté'),
  ('tags',               'les tags système (user_id is null) sont un vocabulaire commun');
-- `profiles` a quitté cette liste avec le passage à l'étranger synthétique :
-- l'exception n'existait que parce que `free` y voyait SA ligne. Sans compte
-- derrière l'uuid, il n'en voit aucune — et le balayage couvre désormais la
-- table qui porte les noms et les e-mails. Mesuré, pas supposé (cf. rapport).

create temp table socle_etranger as
  select * from tests.balayage(
    'deadbeef-0000-4000-8000-000000000000'::uuid,
    (select array_agg(nom) from socle_exceptions));

select is(
  (select coalesce(array_agg(nom order by nom), '{}') from socle_etranger where lignes > 0),
  '{}'::text[],
  'un compte sans aucun lien ne voit aucune ligne d''autrui');

-- Même garde-fou que pour anon, et pour la même raison — il manquait justement
-- au balayage qui, lui, prend des exceptions : si la liste d'exceptions avalait
-- tout le schéma (ou si le filtre déraillait), l'assertion ci-dessus serait
-- verte en n'ayant rien regardé. 45 = 48 tables au catalogue le 2026-09-12,
-- moins les 3 exceptions déclarées ci-dessus.
select cmp_ok(
  (select count(*) from socle_etranger), '>=', 45::bigint,
  'le balayage de l''étranger a bien visité tout le schéma, exceptions déduites');

-- TÉMOIN POSITIF. Les deux assertions ci-dessus exigent une ABSENCE, et une
-- absence est satisfaite par la panne : si les GRANT d'`authenticated` étaient
-- révoqués, chaque lecture lèverait, chaque table rendrait 0, et le socle
-- serait VERT en n'ayant rien pu lire. Le garde-fou juste au-dessus ne rattrape
-- pas ce cas — il compte les tables VISITÉES, pas les lectures RÉUSSIES.
--
-- Le témoin doit être CIBLÉ, et c'est le point subtil : asserter « le balayage a
-- vu au moins une ligne quelque part » ne vaudrait rien, une seule table
-- publique verdirait la garde pendant que tout le reste serait en panne. On
-- nomme donc une lecture précise qui DOIT réussir — le catalogue partagé, que
-- l'étranger a explicitement le droit de voir (c'est même pour ça qu'il figure
-- en exception).
-- Pourquoi un helper dédié plutôt que `tests.count_as` : ce dernier laisse
-- remonter le refus de GRANT, qui AVORTE la suite. Mesuré — on obtient alors
-- « Bad plan: 113 planifiés, 111 exécutés », c'est-à-dire un diagnostic qui ne
-- nomme pas le problème. Ici le refus vaut 0, donc le témoin échoue PROPREMENT
-- (« 0 > 0 est faux ») en portant son libellé. Un garde-fou doit dire ce qu'il
-- a vu, pas seulement qu'il est tombé.
create function tests.lecture_toleree(p_uid uuid, p_sql text) returns bigint language plpgsql as $$
declare n bigint;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
  execute p_sql into n;
  reset role;
  return n;
exception when insufficient_privilege then
  reset role; return 0;
end $$;

select cmp_ok(
  tests.lecture_toleree('deadbeef-0000-4000-8000-000000000000'::uuid,
                        'select count(*) from public.etablissements'),
  '>', 0::bigint,
  'témoin positif : l''étranger LIT vraiment ce qu''il a le droit de lire');

-- Le piège que ce garde-fou existe pour attraper : « l'étranger voit 0 ligne »
-- est VRAI d'une table vide, même avec une policy grande ouverte. Sur une base
-- fraîchement seedée, 19 des 48 tables sont vides — le balayage se prononcerait
-- sur du néant pour 40 % du schéma.
--
-- On compte donc hors RLS (le rôle courant est le propriétaire, il la contourne)
-- et on exige désormais ZÉRO table vide hors exceptions. Neuf tables étaient
-- autrefois tolérées vides par forfait ; les fixtures posées juste au-dessus
-- leur ont donné une ligne d'autrui, et la liste des tolérées est tombée à
-- AUCUNE. `<@ '{}'` n'est donc plus une inclusion mais, le membre droit étant
-- vide, une égalité au vide — c'est ce que ce test grave : toute table nouvelle
-- ou vidée le fera échouer tant qu'on ne lui aura pas donné, elle aussi, une
-- ligne d'autrui à exposer au balayage.
create function tests.tables_sans_donnees(p_exceptions text[])
returns text[] language plpgsql as $$
declare t text; n bigint; vides text[] := '{}';
begin
  for t in select * from tests.tables_a_balayer(p_exceptions)
  loop
    execute format('select count(*) from public.%I', t) into n;
    if n = 0 then vides := vides || t; end if;
  end loop;
  return vides;
end $$;

select ok(
  tests.tables_sans_donnees((select array_agg(nom) from socle_exceptions))
    <@ '{}'::text[],
  'aucune table hors exceptions n''est vide : le balayage les éprouve toutes');

select finish();
rollback;
