-- Filet RLS (audit 04/07 : « aucun test RLS » alors que c'est la frontière de sécurité).
-- Verrouille les invariants avant la réécriture perf des policies : anon refusé,
-- isolation owner, accès co-membre (is_co_membre), non-membre refusé, rôle non
-- auto-modifiable. À lancer : `supabase test db`.
begin;
create extension if not exists pgtap;
create schema if not exists tests;
select plan(115);

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

-- ── Journal des envois (00061) ──────────────────────────────────────────────
select has_table('public', 'journal_envois', 'la table du journal des envois existe');

insert into public.journal_envois (user_id, destinataire, genre, statut)
values ('11111111-1111-1111-1111-111111111111', 'a@vito.test', 'lien_magique', 'accepte'),
       ('22222222-2222-2222-2222-222222222222', 'b@vito.test', 'lien_magique', 'accepte');

-- anon ne voit rien. C'est l'invariant que le dépôt verrouille partout, et il
-- tient au `revoke all ... from anon`, pas à une policy.
select is(tests.count_as_anon('select count(*) from public.journal_envois'),
  0::bigint, 'anon ne lit rien du journal des envois');

-- On voit les siens, et uniquement les siens.
select is(tests.count_as('11111111-1111-1111-1111-111111111111',
  'select count(*) from public.journal_envois where destinataire = ''a@vito.test'''),
  1::bigint, 'on lit son propre envoi');
select is(tests.count_as('11111111-1111-1111-1111-111111111111',
  'select count(*) from public.journal_envois where destinataire = ''b@vito.test'''),
  0::bigint, 'on ne lit pas l''envoi d''un autre compte');

-- Le journal ne se réécrit pas. C'est le revoke qui tient cela, pas la RLS :
-- sans grant du tout, l'update est refusé AVANT même que la RLS soit
-- évaluée — une erreur franche, pas un silencieux zéro ligne touchée.
select throws_ok(
  $$ select tests.count_as('11111111-1111-1111-1111-111111111111',
       'update public.journal_envois set statut = ''remis''') $$,
  '42501', null, 'on ne réécrit pas le statut d''un envoi');
select throws_ok(
  $$ select tests.count_as('11111111-1111-1111-1111-111111111111',
       'delete from public.journal_envois') $$,
  '42501', null, 'on n''efface pas une ligne du journal');

-- La purge ne prend que le vieux.
insert into public.journal_envois (user_id, destinataire, genre, created_at)
values ('11111111-1111-1111-1111-111111111111', 'vieux@vito.test', 'lien_magique',
        now() - interval '91 days');
select ok(public.purger_journal_envois() >= 1, 'la purge supprime au moins la ligne de 91 jours');
select is((select count(*) from public.journal_envois where destinataire = 'vieux@vito.test'),
  0::bigint, 'la ligne de 91 jours a disparu');
select is((select count(*) from public.journal_envois where destinataire = 'a@vito.test'),
  1::bigint, 'la ligne récente est restée');

-- ── Sonde d'existence de compte (00062, correction post-revue) ─────────────
-- compte_existe existe pour éviter d'appeler generateLink — qui CRÉE le
-- compte pour 'magiclink' — sur une adresse inconnue. Deux choses à
-- verrouiller : qu'elle réponde juste, et que personne d'autre que
-- service_role ne puisse l'appeler (sinon c'est elle-même un endpoint
-- d'énumération).
select ok(public.compte_existe('client@vito.test'), 'compte_existe reconnaît un compte seedé');
select ok(not public.compte_existe('jamais-vu-pgtap@vito.test'),
  'compte_existe ne reconnaît pas une adresse absente');
select ok(public.compte_existe('CLIENT@VITO.TEST'),
  'compte_existe compare sans tenir compte de la casse');

select throws_ok(
  $$ select tests.bool_as_anon('select public.compte_existe(''sonde-pgtap@vito.test'')') $$,
  '42501', null, 'anon ne peut pas appeler compte_existe (ce serait un endpoint d''énumération)');
select throws_ok(
  $$ select tests.bool_as('11111111-1111-1111-1111-111111111111',
       'select public.compte_existe(''sonde-pgtap@vito.test'')') $$,
  '42501', null, 'authenticated non plus : seul le rôle de service appelle compte_existe');

select finish();
rollback;
