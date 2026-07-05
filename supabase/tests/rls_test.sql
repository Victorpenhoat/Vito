-- Filet RLS (audit 04/07 : « aucun test RLS » alors que c'est la frontière de sécurité).
-- Verrouille les invariants avant la réécriture perf des policies : anon refusé,
-- isolation owner, accès co-membre (is_co_membre), non-membre refusé, rôle non
-- auto-modifiable. À lancer : `supabase test db`.
begin;
create extension if not exists pgtap;
create schema if not exists tests;
select plan(8);

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

select finish();
rollback;
