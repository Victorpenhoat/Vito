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
insert into public.etablissements (id, place_id, categorie, type, nom, adresse, ville, code_postal, arrondissement, source, photo_ref, photo_fetched_at, rating, lat, lng)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'demo_place_1', 'resto', 'bistrot',
  'Le Bistrot Démo', '10 rue de Démo', 'Paris', '75017', '17e', 'seed', 'mock_photo_1', now(), 4.6, 48.8841, 2.3219);

-- Le client a déjà un resto dans sa liste
insert into public.liste_items (id, user_id, etablissement_id, statut, is_favorite, reco_source)
values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb0001', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a_faire', true, 'Camille');

-- Tag « Terrasse » lié au liste_item du Bistrot
insert into public.liste_item_tags (liste_item_id, tag_id)
select 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb0001', id from public.tags where slug = 'terrasse';

-- 2e resto « Le Comptoir Démo » (a_faire, non-favori, avec coords, sans tag)
insert into public.etablissements (id, place_id, categorie, type, nom, ville, code_postal, arrondissement, source, lat, lng)
values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'demo_place_2', 'resto', 'bistrot', 'Le Comptoir Démo', 'Paris', '75001', '1er', 'seed', 48.8566, 2.3522);
insert into public.liste_items (user_id, etablissement_id, statut, is_favorite)
values ('11111111-1111-1111-1111-111111111111', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'a_faire', false);

-- Resto déjà archivé (vue Archivés) — sans coords (n'affecte pas le comptage Carte)
insert into public.etablissements (id, place_id, categorie, type, nom, ville, code_postal, arrondissement, source)
values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'demo_place_archive', 'resto', 'bistrot', 'Le Resto Archivé Démo', 'Paris', '75002', '2e', 'seed');
insert into public.liste_items (user_id, etablissement_id, statut, is_favorite, is_archived)
values ('11111111-1111-1111-1111-111111111111', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'a_faire', false, true);

-- Hôtel démo (catégorie hotel) + dans la liste du client (à tester)
insert into public.etablissements (id, place_id, categorie, type, nom, ville, code_postal, arrondissement, source, photo_ref, photo_fetched_at)
values ('11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'demo_hotel_1', 'hotel', 'hotel',
  'Hôtel Démo', 'Paris', '75001', '1er', 'seed', 'mock_photo_1', now());
insert into public.liste_items (user_id, etablissement_id, statut, is_favorite)
values ('11111111-1111-1111-1111-111111111111', '11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a_faire', false);

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
  ('dddddddd-dddd-4ddd-8ddd-eeeeeeeeeeee', 'demo_p_d', 'resto', 'étoilé', 'La Table du 8e', 'Paris', '75008', '8e', 4, 'seed'),
  ('eeeeeeee-eeee-4eee-8eee-000000000001', 'demo_p_e', 'resto', 'brasserie', 'Brasserie du 17e', 'Paris', '75017', '17e', 2, 'seed'),
  ('ffffffff-ffff-4fff-8fff-ffffffffffff', 'demo_p_f', 'resto', 'café', 'Café du 1er', 'Paris', '75001', '1er', 1, 'seed');

-- Goûts de démo du client : aime bistrot, zone 17e
insert into public.profil_gouts (user_id, ambiances, budget_max, types_preferes, zones)
values ('11111111-1111-1111-1111-111111111111', '{}', 40, '{"bistrot"}', '{"17e"}');

-- Voyage de démo du client, partagé avec l'agence (UUID v4 valides)
insert into public.voyages (id, owner_id, titre, destination, date_debut, date_fin, statut)
values ('11111111-2222-4333-8444-555555555555', '11111111-1111-1111-1111-111111111111',
  'Week-end à Rome', 'Rome', '2026-09-12', '2026-09-15', 'confirme');

-- Le trigger on_voyage_created insère déjà la ligne 'owner' (client). On ajoute juste l'agence.
insert into public.voyage_membres (voyage_id, profile_id, role) values
  ('11111111-2222-4333-8444-555555555555', '22222222-2222-2222-2222-222222222222', 'membre')
on conflict (voyage_id, profile_id) do nothing;

insert into public.reservations (voyage_id, created_by, type, fournisseur, reference, date_debut, date_fin, conciergerie_tel, conciergerie_mail, lien)
values ('11111111-2222-4333-8444-555555555555', '11111111-1111-1111-1111-111111111111', 'hotel',
  'Hotel Roma', 'CONF-123', '2026-09-12', '2026-09-15', '+39 06 0000 0000', 'concierge@hotelroma.test', 'https://airbnb.example/rome');

-- Comptes partagés : groupe lié au voyage Rome, partagé client <-> agence (UUID v4 valides)
insert into public.depense_groupes (id, owner_id, voyage_id, titre, devise)
values ('66666666-6666-4666-8666-666666666666', '11111111-1111-1111-1111-111111111111',
  '11111111-2222-4333-8444-555555555555', 'Dépenses Rome', 'EUR');

-- Le trigger on_groupe_created insère déjà la ligne 'owner' (client). On ajoute l'agence.
insert into public.depense_groupe_membres (groupe_id, profile_id, role) values
  ('66666666-6666-4666-8666-666666666666', '22222222-2222-2222-2222-222222222222', 'membre')
on conflict (groupe_id, profile_id) do nothing;

-- Dépense 1 : hôtel 200,00 € payé par le client, split égal (100/100)
insert into public.depenses (id, groupe_id, paye_par, libelle, montant_cents, date, mode, created_by)
values ('66666666-6666-4666-8666-aaaaaaaaaaaa', '66666666-6666-4666-8666-666666666666',
  '11111111-1111-1111-1111-111111111111', 'Hôtel', 20000, '2026-09-12', 'egal',
  '11111111-1111-1111-1111-111111111111');
insert into public.depense_parts (depense_id, profile_id, part_cents) values
  ('66666666-6666-4666-8666-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 10000),
  ('66666666-6666-4666-8666-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 10000);

-- Dépense 2 : dîner 90,00 € payé par l'agence, exact (client 50,00 / agence 40,00)
insert into public.depenses (id, groupe_id, paye_par, libelle, montant_cents, date, mode, created_by)
values ('66666666-6666-4666-8666-bbbbbbbbbbbb', '66666666-6666-4666-8666-666666666666',
  '22222222-2222-2222-2222-222222222222', 'Dîner', 9000, '2026-09-13', 'exact',
  '22222222-2222-2222-2222-222222222222');
insert into public.depense_parts (depense_id, profile_id, part_cents) values
  ('66666666-6666-4666-8666-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 5000),
  ('66666666-6666-4666-8666-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 4000);

-- Comptes dédiés au Chantier 6 (isolés des autres e2e). UUID v4 valides.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, reauthentication_token, phone_change, phone_change_token)
values
  ('44444444-4444-4444-8444-444444444444', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'free@vito.test',
   crypt('password123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"display_name":"Free Démo","role":"client"}', now(), now(),
   '', '', '', '', '', '', '', ''),
  ('55555555-5555-4555-8555-555555555555', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'premium@vito.test',
   crypt('password123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"display_name":"Premium Démo","role":"client"}', now(), now(),
   '', '', '', '', '', '', '', '');

insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at)
values
  (gen_random_uuid(), '44444444-4444-4444-8444-444444444444', '44444444-4444-4444-8444-444444444444',
   '{"sub":"44444444-4444-4444-8444-444444444444","email":"free@vito.test"}', 'email', now(), now()),
  (gen_random_uuid(), '55555555-5555-4555-8555-555555555555', '55555555-5555-4555-8555-555555555555',
   '{"sub":"55555555-5555-4555-8555-555555555555","email":"premium@vito.test"}', 'email', now(), now());

-- premium@vito.test : abonnement premium actif (annuel, expire dans 1 an)
insert into public.subscriptions (user_id, tier, status, period, current_period_end)
values ('55555555-5555-4555-8555-555555555555', 'premium', 'active', 'yearly', now() + interval '1 year');

-- Conciergerie : une demande resto démo du compte premium (statut nouvelle, commentaire stable)
insert into public.conciergerie_demandes (user_id, type, etablissement_id, statut, date_resa, heure_resa, nombre_convives, occasion, commentaire)
values ('55555555-5555-4555-8555-555555555555', 'resto', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'nouvelle', '2026-10-10', '20:00', 2, 'amis', 'Demande démo conciergerie');

-- Comptes dédiés au Chantier 7a (famille). Aucune famille pré-créée (l'e2e les crée).
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, reauthentication_token, phone_change, phone_change_token)
values
  ('77777777-7777-4777-8777-777777777777', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'famille1@vito.test',
   crypt('password123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"display_name":"Famille Un","role":"client"}', now(), now(),
   '', '', '', '', '', '', '', ''),
  ('88888888-8888-4888-8888-888888888888', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'famille2@vito.test',
   crypt('password123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"display_name":"Famille Deux","role":"client"}', now(), now(),
   '', '', '', '', '', '', '', '');

insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at)
values
  (gen_random_uuid(), '77777777-7777-4777-8777-777777777777', '77777777-7777-4777-8777-777777777777',
   '{"sub":"77777777-7777-4777-8777-777777777777","email":"famille1@vito.test"}', 'email', now(), now()),
  (gen_random_uuid(), '88888888-8888-4888-8888-888888888888', '88888888-8888-4888-8888-888888888888',
   '{"sub":"88888888-8888-4888-8888-888888888888","email":"famille2@vito.test"}', 'email', now(), now());

-- Compte client dédié au Chantier 7b (Free, 0 voyage ; aucun lien agence pré-créé).
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, reauthentication_token, phone_change, phone_change_token)
values
  ('99999999-9999-4999-8999-999999999999', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'client7b@vito.test',
   crypt('password123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"display_name":"Client 7b","role":"client"}', now(), now(),
   '', '', '', '', '', '', '', '');

insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at)
values
  (gen_random_uuid(), '99999999-9999-4999-8999-999999999999', '99999999-9999-4999-8999-999999999999',
   '{"sub":"99999999-9999-4999-8999-999999999999","email":"client7b@vito.test"}', 'email', now(), now());

-- Famille : répertoire de proches (Slice 3) pour client@vito.test (11111111-1111-1111-1111-111111111111)
insert into public.family_members (id, user_id, first_name, last_name, relation, circle, avatar_color) values
  ('f1111111-1111-4111-8111-111111111111', '11111111-1111-1111-1111-111111111111', 'Camille', 'Durand', 'enfant', 'proche', '#6B7A8F');

insert into public.family_documents (id, user_id, member_id, doc_type, doc_number, country, holder_name, issue_date, expiry_date, contenu_chiffre, mime_type, taille) values
  ('d1111111-1111-4111-8111-111111111111', '11111111-1111-1111-1111-111111111111', 'f1111111-1111-4111-8111-111111111111',
   'passeport', '19FR99892', 'FR', 'Camille Durand', '2019-03-01', '2029-03-01',
   'z8qW2rZIWU40NFWX7FWy65T8NMMW06ozKgn3AQrM2dJLSJXyRoZFRHm9zmXN2eETafYyNJRDZ6TqEGgpEfBAGi8dee3//rtH',
   'application/pdf', 48);
