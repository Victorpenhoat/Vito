-- Comptes de dev. Le trigger handle_new_user crée TOUS les profils en 'client'
-- (le rôle n'est jamais lu depuis raw_user_meta_data — anti-escalade). Les rôles
-- agence/admin sont attribués juste après par UPDATE privilégié (le seed tourne en superuser).
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, reauthentication_token, phone_change, phone_change_token)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'client@vito.test',
   crypt('password123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"display_name":"Victor (client)","role":"client"}', now(), now(),
   '', '', '', '', '', '', '', ''),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'agence@vito.test',
   crypt('password123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"display_name":"Agence Démo","role":"agence"}', now(), now(),
   '', '', '', '', '', '', '', ''),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'admin@vito.test',
   crypt('password123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"display_name":"Admin","role":"admin"}', now(), now(),
   '', '', '', '', '', '', '', '');

-- Identities (requis pour le login email/password)
insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at)
values
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111',
   '{"sub":"11111111-1111-1111-1111-111111111111","email":"client@vito.test"}', 'email', now(), now()),
  (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222',
   '{"sub":"22222222-2222-2222-2222-222222222222","email":"agence@vito.test"}', 'email', now(), now()),
  (gen_random_uuid(), '33333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333',
   '{"sub":"33333333-3333-3333-3333-333333333333","email":"admin@vito.test"}', 'email', now(), now());

-- Attribution des rôles privilégiés (le trigger a tout créé en 'client').
update public.profiles set role = 'agence' where id = '22222222-2222-2222-2222-222222222222';
update public.profiles set role = 'admin'  where id = '33333333-3333-3333-3333-333333333333';

-- (Les tags système d'ambiance sont désormais dans la migration 00004_system_tags.sql
-- — données de référence livrées avec le schéma, présentes aussi en prod.)

-- Établissement démo (référentiel)
insert into public.etablissements (id, place_id, categorie, type, nom, adresse, ville, code_postal, arrondissement, source)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'demo_place_1', 'resto', 'bistrot',
  'Le Bistrot Démo', '10 rue de Démo', 'Paris', '75017', '17e', 'seed');

-- Le client a déjà un resto dans sa liste
insert into public.liste_items (user_id, etablissement_id, statut, is_favorite)
values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a_faire', true);

-- Vin + dégustation de démo pour le compte client (UUID v4 valides)
insert into public.vins (id, user_id, nom, domaine, millesime, region, couleur, cepages)
values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111',
  'Château Démo', 'Domaine de Démo', 2019, 'Bordeaux', 'rouge', '{"merlot","cabernet sauvignon"}');

insert into public.degustations (user_id, vin_id, etablissement_id, deguste_le, note, prix_paye, commentaire)
values ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', current_date, 4, 45.00, 'Très bon, à recommander');

-- Pool de démo pour la recherche/reco (UUID v4 valides ; PAS dans la liste du client)
insert into public.etablissements (id, place_id, categorie, type, nom, ville, code_postal, arrondissement, price_level, source) values
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'demo_p_c', 'resto', 'bistrot', 'Bistrot du 17e', 'Paris', '75017', '17e', 2, 'seed'),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'demo_p_d', 'resto', 'étoilé', 'La Table du 8e', 'Paris', '75008', '8e', 4, 'seed'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'demo_p_e', 'resto', 'brasserie', 'Brasserie du 17e', 'Paris', '75017', '17e', 2, 'seed'),
  ('ffffffff-ffff-4fff-8fff-ffffffffffff', 'demo_p_f', 'resto', 'café', 'Café du 1er', 'Paris', '75001', '1er', 1, 'seed');

-- Goûts de démo du client : aime bistrot, zone 17e
insert into public.profil_gouts (user_id, ambiances, budget_max, types_preferes, zones)
values ('11111111-1111-1111-1111-111111111111', '{}', 40, '{"bistrot"}', '{"17e"}');
