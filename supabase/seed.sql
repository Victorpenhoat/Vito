-- Comptes de dev. Le trigger handle_new_user crée TOUS les profils en 'client'
-- (le rôle n'est jamais lu depuis raw_user_meta_data — anti-escalade). Les rôles
-- agence/admin sont attribués juste après par UPDATE privilégié (le seed tourne en superuser).
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'client@vito.test',
   crypt('password123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"display_name":"Victor (client)","role":"client"}', now(), now()),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'agence@vito.test',
   crypt('password123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"display_name":"Agence Démo","role":"agence"}', now(), now()),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'admin@vito.test',
   crypt('password123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"display_name":"Admin","role":"admin"}', now(), now());

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

-- Tags système d'ambiance
insert into public.tags (slug, label, categorie) values
  ('en_amoureux', 'En amoureux', 'ambiance'),
  ('entre_amis', 'Entre amis', 'ambiance'),
  ('terrasse', 'Terrasse', 'ambiance'),
  ('avec_vue', 'Avec vue', 'ambiance'),
  ('en_famille', 'En famille', 'ambiance'),
  ('business', 'Business', 'ambiance');

-- Établissement démo (référentiel)
insert into public.etablissements (id, place_id, categorie, type, nom, adresse, ville, code_postal, arrondissement, source)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'demo_place_1', 'resto', 'bistrot',
  'Le Bistrot Démo', '10 rue de Démo', 'Paris', '75017', '17e', 'seed');

-- Le client a déjà un resto dans sa liste
insert into public.liste_items (user_id, etablissement_id, statut, is_favorite)
values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a_faire', true);
