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
insert into public.liste_items (id, user_id, etablissement_id, statut, is_favorite)
values ('11111111-aaaa-4aaa-8aaa-bbbbbbbb0001', '11111111-1111-1111-1111-111111111111', '11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a_faire', false);
-- Tag ambiance « Spa » (tag hôtel existant, 00017) lié à l'Hôtel Démo
insert into public.liste_item_tags (liste_item_id, tag_id)
select '11111111-aaaa-4aaa-8aaa-bbbbbbbb0001', id from public.tags where slug = 'spa';
-- 2e hôtel sans tag (pour que le filtre ambiance fasse varier le nombre)
insert into public.etablissements (id, place_id, categorie, type, nom, ville, code_postal, arrondissement, source)
values ('22222222-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'demo_hotel_2', 'hotel', 'hotel', 'Hôtel Démo 2', 'Paris', '75002', '2e', 'seed');
insert into public.liste_items (user_id, etablissement_id, statut, is_favorite)
values ('11111111-1111-1111-1111-111111111111', '22222222-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a_faire', false);

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

-- ============================================================================
-- Compte de démo « riche » : demo@vito.test / password123.
-- Isolé des comptes e2e (client/agence/admin/…). Sert à explorer l'app avec du
-- contenu réaliste. Les établissements créés ici sont HORS zone 17e (et non
-- bistrot-17e) pour ne pas altérer la reco du compte client testée en e2e.
-- ============================================================================
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, reauthentication_token, phone_change, phone_change_token)
values
  ('de110000-0000-4000-8000-000000000000', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'demo@vito.test',
   crypt('password123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"display_name":"Démo Vito","role":"client"}', now(), now(),
   '', '', '', '', '', '', '', '');

insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at)
values
  (gen_random_uuid(), 'de110000-0000-4000-8000-000000000000', 'de110000-0000-4000-8000-000000000000',
   '{"sub":"de110000-0000-4000-8000-000000000000","email":"demo@vito.test"}', 'email', now(), now());

-- Restos (liste du compte démo)
insert into public.etablissements (id, place_id, categorie, type, nom, adresse, ville, code_postal, arrondissement, source, rating, price_level, lat, lng, photo_ref, photo_fetched_at) values
 ('a1000001-0000-4000-8000-000000000001','demo_r1','resto','bistrot','Chez Marceau','15 rue Marbeuf','Paris','75008','8e','seed',4.4,3,48.8686,2.3020,'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=70',now()),
 ('a1000001-0000-4000-8000-000000000002','demo_r2','resto','étoilé','Le Petit Nice','17 rue des Braves','Marseille','13007','7e','seed',4.8,4,43.2790,5.3560,'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&q=70',now()),
 ('a1000001-0000-4000-8000-000000000003','demo_r3','resto','italien','Osteria Bella','8 rue Oberkampf','Paris','75011','11e','seed',4.5,2,48.8640,2.3760,'https://images.unsplash.com/photo-1590846406792-0adc7f938f1d?w=1200&q=70',now()),
 ('a1000001-0000-4000-8000-000000000004','demo_r4','resto','brasserie','Le Grand Comptoir','5 rue de la Paix','Paris','75009','9e','seed',4.2,2,48.8700,2.3320,'https://images.unsplash.com/photo-1445019980597-93fa8acb246c?w=1200&q=70',now()),
 ('a1000001-0000-4000-8000-000000000005','demo_r5','resto','café','Café Lumière','22 rue de Bretagne','Paris','75003','3e','seed',4.6,1,48.8630,2.3630,'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=1200&q=70',now());

insert into public.liste_items (id, user_id, etablissement_id, statut, is_favorite) values
 ('b1000001-0000-4000-8000-000000000001','de110000-0000-4000-8000-000000000000','a1000001-0000-4000-8000-000000000001','visite',true),
 ('b1000001-0000-4000-8000-000000000002','de110000-0000-4000-8000-000000000000','a1000001-0000-4000-8000-000000000002','a_faire',false),
 ('b1000001-0000-4000-8000-000000000003','de110000-0000-4000-8000-000000000000','a1000001-0000-4000-8000-000000000003','visite',true),
 ('b1000001-0000-4000-8000-000000000004','de110000-0000-4000-8000-000000000000','a1000001-0000-4000-8000-000000000004','a_faire',false),
 ('b1000001-0000-4000-8000-000000000005','de110000-0000-4000-8000-000000000000','a1000001-0000-4000-8000-000000000005','visite',true);

insert into public.liste_item_tags (liste_item_id, tag_id)
 select 'b1000001-0000-4000-8000-000000000001'::uuid, id from public.tags where slug='terrasse'
 union all select 'b1000001-0000-4000-8000-000000000003'::uuid, id from public.tags where slug='gastronomique'
 union all select 'b1000001-0000-4000-8000-000000000005'::uuid, id from public.tags where slug='cuisine_marche';

-- Hôtels (liste du compte démo)
insert into public.etablissements (id, place_id, categorie, type, nom, adresse, ville, code_postal, arrondissement, source, rating, price_level, lat, lng, photo_ref, photo_fetched_at) values
 ('a1000001-0000-4000-8000-000000000101','demo_h1','hotel','hotel','Hôtel des Grands Boulevards','17 bd Poissonnière','Paris','75002','2e','seed',4.3,3,48.8710,2.3450,'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&q=70',now()),
 ('a1000001-0000-4000-8000-000000000102','demo_h2','hotel','hotel','Le Roch Hôtel & Spa','28 rue Saint-Roch','Paris','75001','1er','seed',4.7,4,48.8660,2.3320,'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=1200&q=70',now()),
 ('a1000001-0000-4000-8000-000000000103','demo_h3','hotel','hotel','Hôtel Lutetia','45 bd Raspail','Paris','75006','6e','seed',4.9,4,48.8510,2.3260,'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=70',now());

insert into public.liste_items (id, user_id, etablissement_id, statut, is_favorite) values
 ('b1000001-0000-4000-8000-000000000101','de110000-0000-4000-8000-000000000000','a1000001-0000-4000-8000-000000000101','a_faire',false),
 ('b1000001-0000-4000-8000-000000000102','de110000-0000-4000-8000-000000000000','a1000001-0000-4000-8000-000000000102','visite',true),
 ('b1000001-0000-4000-8000-000000000103','de110000-0000-4000-8000-000000000000','a1000001-0000-4000-8000-000000000103','a_faire',false);

insert into public.liste_item_tags (liste_item_id, tag_id)
 select 'b1000001-0000-4000-8000-000000000101'::uuid, id from public.tags where slug='spa'
 union all select 'b1000001-0000-4000-8000-000000000102'::uuid, id from public.tags where slug='piscine'
 union all select 'b1000001-0000-4000-8000-000000000103'::uuid, id from public.tags where slug='petit_dej_inclus';

-- Voyages du compte démo (le trigger on_voyage_created insère la ligne membre 'owner')
insert into public.voyages (id, owner_id, titre, destination, date_debut, date_fin, statut) values
 ('de110001-0000-4000-8000-000000000001','de110000-0000-4000-8000-000000000000','Week-end à Rome','Rome','2026-09-12','2026-09-15','confirme'),
 ('de110001-0000-4000-8000-000000000002','de110000-0000-4000-8000-000000000000','Escapade à Lisbonne','Lisbonne','2026-11-05','2026-11-09','planifie');

insert into public.reservations (voyage_id, created_by, type, fournisseur, reference, date_debut, date_fin, conciergerie_tel, conciergerie_mail, lien) values
 ('de110001-0000-4000-8000-000000000001','de110000-0000-4000-8000-000000000000','hotel','Hotel Roma','CONF-RM-123','2026-09-12','2026-09-15','+39 06 0000 0000','concierge@hotelroma.test','https://airbnb.example/rome'),
 ('de110001-0000-4000-8000-000000000002','de110000-0000-4000-8000-000000000000','vol','TAP Air Portugal','TP-440','2026-11-05','2026-11-09',null,null,'https://flytap.example/booking');

-- Documents chiffrés (AES-256-GCM via DOCUMENTS_ENCRYPTION_KEY) — Rome + Lisbonne
insert into public.voyage_documents (id, voyage_id, nom, mime_type, taille, contenu_chiffre, uploaded_by) values
  ('d0000001-0000-4000-8000-000000000001', 'de110001-0000-4000-8000-000000000001', 'Passeport - Client Démo.pdf', 'application/pdf', 561, 'ayGIhvRQCvN/fV6hBBERmNpq+tHWGEC/xvH6Mmsg10rdZCZ834g5TKulT8lUfO7japZYwRf95A+A+8Ectki90/+jgCItMvUA6HaIoYDrgteAhS+10vP/lG0kCHALbxBsCiS1K1Qm/yFsV8hD06CtXnNxofgS9x+Y9Uw3L5R77ft9EkJX1wfNL8l2sDp6yVTOW3uU4M0GOX4PWjooTFxoLFlvXcZ6/wG++spCQeMszGsrvfXr4EYQl2Acy8SVfPfLDqi9I/492bH7sHLJICu6K3Cf6e5MY5WJnOMKNuHWydYiYVFMzUnKffzOGGAg1/9Li+1PXA9lyn8t1Zn+2B61q/Cf+hCKYkAWwHROnKD4b/u53krX9XMckW5KMGLoSm87Lr9FZq24RDFihjrpx55XaHLaKFO0Bguxy00hnjaJi0GG/t6FEQKf344JwfUgq0Lry7iVmwTxQ8j/i+0SKbIEWHZQtEEslGfQY3CSw8URFNBch1GNIJwMRxKw0s4np8mXpUB6pCF5A6hEtyH2ElTGv65X8YpCk4cVu3PbBmdLBeITlUJN4zM4xnOrApeyio1PBAevjYcrVF5EMUf3vUsCsHqHEwKAaTWYkYGU0shhSYQoVu/qAn+G1Sb7mvjS5qCVpiiBtI4oNuoyI/g3yjtLS0AZuk25Viucbg9idQGJqdRCEDQq5vRgbzgrQj599pGvW8nXAfIWnXNdWELz2awJDm4WAzgOP9DmagbBXZL6/knM/Y2FqHiUpmTggM01QNkHNDaIKOr/BvItfzLWYA==', 'de110000-0000-4000-8000-000000000000'),
  ('d0000001-0000-4000-8000-000000000002', 'de110001-0000-4000-8000-000000000001', 'Billet avion CDG-FCO.pdf', 'application/pdf', 561, 'ron5GZqpFycFMGQXnAixfI58qwP++qFPlIdtaphDMDMsnoOHIgbjbtEKBhXD0oAAnKbRvQlIXs/h7LjHQ9q52bv6wvlDzjkTJe+3DhZXirGqxu0yqI+e3BXULCPNMwN6uAhzhpzCfqKwen1HTeINB9OwtpcHhGVccI8Glq0yJzKl1sDOGT06McO42P0D6cMt+Vsc9B90jADdx2sJIY8tt6Ra99rdeXB3WpY7Mr3LkuYn0Bn9vtzEGKTbqZZ4am8eiUcn53DO5BIz2DDMQLhx9Lb54rAHPZe1DkLfDVx8mLsFozj4pRyn2soO54Ezs0p/j9I3u2lwRi0iEDSqqqbiA3N2VPPfEL0EhsDulsZ0BFvIysUkhMUpojWumRUlgcJ0hEjH7OZ/N8tdxBJrMBRPvRt51U71sQ3Oj+bkt9gsMHNP8NMlzAljMw4H+wSebdRA5uNQv8Ii2js7rS/AUArh7oOvKOo++fNSJYYk8M2XPK1ECqcOurRKYZKOqDPSiwWZiZMo+w4Cfn8NR7JJi/vp4gpoTtiY31sluMBGxa5Qgd1bLT61658MRWjH7PLuWdCuXmk5BL765UftQ1FOTRyr4X2/m6q+uWwkP9EKgTCvvMsP94tgYRlfERfklmp6Vn+HQyzaJ9auqM7Hjsm+j1RmxP6S6iiMeNahsX85AkOM3Gb5mLJ6dsiMlnuBJt66mXgKDt7ckLxZHLSGXRmQfNaVAoBBcV0RzPV+megYf4MTnT0HLr9hECsxbefxp26swgiSIu0lHiYBhGASUouIvw==', 'de110000-0000-4000-8000-000000000000'),
  ('d0000001-0000-4000-8000-000000000003', 'de110001-0000-4000-8000-000000000001', 'Reservation Hotel Roma.pdf', 'application/pdf', 561, '4zAd7hJQ6GMk7nBHct68lAguF2SQjbG8OyEUj4NPrFe4k84oapcKJhr+W039wvgFAh8CyET4QQrc/I0mVV8jYm19ATatVQmYt3FB+2hfgt4X6TQ/0MrgfWmk3yF4RpjPT2DEiFVOOAP9j/6UFmENN9CyZHkxvmLPe5kJaMqaAaPepA6uU6CAIPk9bqDLmz5ib6nlYlbAy4YQmuozH/gJ5FSOtSXJQrD5huZi5jxW2NXLSaK9yVMn7KHUK3mi8II2kTMdf+W5tU7H9NyM3s6zCP5ClL830ohuS1p2BNOhPLQI5doDfW4zeOkEgZuu3o1uCMbcGGpnnSouE2bjS5OakikLs8G8zxalr1SjP+WZScXNPKGXWK3G6SxmLGfY/ENUftsv7zxCzhJbu2kEekNroEuM4W6peu6LvLvckoiio7CQf81hN/vXW6xhHIigIvXAy0RVBbcI+RbCMPJdrsxoTsPeRvzZld/3icgyEtntv4WvR8AxhYeZhsUEiCRqdy7B9QVUuKoSKEGNNSOfrFThDjnhPONO5acIUBEPT934FV+wmbn0rpJavpOgVWUkzxkU4KbEQjnanGx9eZrfn+yrr+HBjdnDnkPy20pUkY1At/5hlGXlVfwgLd/z0k+uNjCCmuCqmfsL9V7Xt4ciQXeSMzrRo3RZfvYprP/ttwtUPNT1xJSEvjojH/pt64aJgwkYGPJsx3WEIeR1CqsA4k7M6GN2F3oIxP0SqmApV+dZggVZw1GntLsLXxzSiY+mORuOXPGXnmbor7k+whuitg==', 'de110000-0000-4000-8000-000000000000'),
  ('d0000001-0000-4000-8000-000000000004', 'de110001-0000-4000-8000-000000000002', 'Billet avion ORY-LIS.pdf', 'application/pdf', 565, 'b/Mt0p0E0ZH4kQRqBkEkybb5XEzHgj/7kU4yUv1wcxFVr3XiWDoT6uoune8/FpRGUEl01OaPy4h6nKhOJLaYBiS7VaojP7bBLd9VBslp6fwUQXOjEvPOiqdRa3YER3LLugct3G452MOExT1Ett0g3p5BVOPB2urmU6hZ5AwcWzSoIE9dcPQ3IVNVcq0k+lm2nBLc0j77OxEPb3Jov94xhVvi1O21jo5F1rD/81OVk69eNn8Px2kUzNNxiafXMcWGp6uw7P+g5WhJMWTy2LJS2QvLfQLcB/qP3YzbU/gvdYe8Byaao0B1uVyF43pctfGWFdDaRFAVYwFdYqa0K1vGAzP8sKxAlBXvcBPAnQEkkryV/2PjTht1+PLEzUqJX4vDgtl9lw4RkxyohVmh8sfOmf/QpDZdjePeK3GArpOHM47/dZCGa9hBV63zfIS758qG/XS11Cs9qQ+RFj/PLJl0sHapTQ0EuupqEAnxlnUbomeycvD4LAVeTvAPzVrrVGKsG4q+vLWc3Erhapdebr3eV6ZdXW1Yk0bVXNLvHkbREoc+61KFhUx8CrpwQE9dccdMGQhgwVrzNN0fYXD7IvWrUHwYVmru0Y/raY3cOu7tlL3DjunxZKv2Iwh0WSLLMS3E0tLangHKlH7REVDm475fDVQ03HhMd+FdNaLiQg41mv4HOcfSlAy/c7NtNzDXwiiDWRBjfFZKpRWsKPrGbjNfzzjlEzRcQLSkxWmgqN18w6S3CaOvOYpiojVE6WqsCcUIr42O4IfLA0YUDAGzxZWYuAg=', 'de110000-0000-4000-8000-000000000000'),
  ('d0000001-0000-4000-8000-000000000005', 'de110001-0000-4000-8000-000000000002', 'Voucher Airbnb Alfama.pdf', 'application/pdf', 559, 'TSsTJMgG4q4lqBUoAly9SANzFVpFIuwVqlWjNfthBUY5S8FEEAUWlgaEeKoGWxhjbQS/qnxRRwp7cW4E+muYMAOdRFTjgQ4oU9YhSwDrO+y+oQ3pTpAEviWg9/5pMCdCy0WEmcFI57pk1X/0rOoWfRKo/h8c1zLpuDRteaGAZR7E1dzQ6PtKbLoCQ3uVJt65NAf4y/k5qXG+I30j2E5K44uklrCh55+bd/v7+/Vh2FFaAfiyaa2kCgPIKqDOdGim0rkhu+wl+hogHRWeo9AtMtcYyWV7tMIyC8zSq+NP/Qdilnh/UG9rImcNhPqO1zPHD+AkG2iWhmbQ+WwM9cdd80nLvIiGo3DTx4SCfeXyWnzMWj17l2ZYJBlen6vYUB4RvyIXEEYwX5CbCG5j5DP84gKF5D88BzZCrpDSxkKVEOcTmW124jpp21IGdpwp9BJqZPiW4Lh9RuHm4RT9vNaumgvy2pG7QFLUat0i8fIZTfHb7RjR1bqpjI1WrAK+otQhu9ae+cAEpeB6XDMhfmWCkewtRvkVT/4TFoNdEcrh+LNpkG0WnK8vCQKYRl0/SIJV9xW+vqrLLS46FhE5qUD/kXoWHjOIdkmKr5Sxg/+OXIdmX5BmGxPONb22LUZuqKNXSvfqBO3ZJ9pdXu2nvPfJVqXUYkc8wbMVCy0fl6M8XH6+dEyi3coGbmyuvXfQsNW5W6YUmWUJYRM0tVAb1XP6EPJbDuGv4iK7dJMUI9ctB0vTTkwg0+qYfY/QLrjW+xHJAmHr27BVcuZvV4Q=', 'de110000-0000-4000-8000-000000000000');


-- Famille du compte démo : répertoire de proches + documents chiffrés
insert into public.family_members (id, user_id, first_name, last_name, relation, circle, avatar_color) values
 ('fa000001-0000-4000-8000-000000000001','de110000-0000-4000-8000-000000000000','Léa','Martin','conjoint','proche','#B24C63'),
 ('fa000001-0000-4000-8000-000000000002','de110000-0000-4000-8000-000000000000','Hugo','Martin','enfant','proche','#4C9AB2'),
 ('fa000001-0000-4000-8000-000000000003','de110000-0000-4000-8000-000000000000','Jeanne','Martin','parent','elargie','#7A6FB2');

insert into public.family_documents (id, user_id, member_id, doc_type, doc_number, country, holder_name, issue_date, expiry_date, contenu_chiffre, mime_type, taille) values
 ('fd000001-0000-4000-8000-000000000001','de110000-0000-4000-8000-000000000000','fa000001-0000-4000-8000-000000000001','passeport','22FR11234','FR','Léa Martin','2021-05-10','2031-05-10','vlBxBRqqDaFwHsoM2oS/A5AP4VigFxeGAEfbPRNqt4YnA33fhwXYG2iptZcl7mY5qhiZuFigcttbfVAgoTYPYM87cID1/x3g3QpB5KLWda3FOAkRJdetPzoRQNEPb8Ls7MmMYT9eS0jivfDeiZrRvd44WXjZoKLnwefygboZCs9R/Jw0I7XKpw5oABQP4OX0rQLgDlfrwu2aaNpjc3WJ+viWkYsxI2+lT/z62rCGoi+A0z56OknNezmcXNKnOEQ77ighEqCjplSA7bWmWN70g7OYkF9wtgUhbxWITkrgKgWbX+9F5+pzudk9GNWSi4D5bqYRZa+Un5HAxJTM7KlbLcaTCtsysPt28MiBkSZJZqJpFIyB5QOg3VHbr9ApkGMFa3GRh1yTcl/0i/WK8vKgJEGVzfT4wYh5Zpaa+fdmSgPOr7id9oIo/kRYDmjV0KbdVOtRsN+ARn97t3lvLi72ki4cr42nLxVCN9q5VaA8aDaGwFX9SKSlVZda7W9gAOviRXfJ/qWmzE+nbhhrFfyQYrbJ+f/g1/TZ+GuHhPC/+dvojPegp14bx9ovbtxlml0IOKrjzzAsOiLkcgoV4MoTLY8Y/LMLflQbc6At1iswxOqwnXrY096I7u7yRwk/Q3LirXYVtH91BqQf/UBwq+opjfnG4/V09yQkFn7GFkLI26kKHFzfsTeQK6WUurbQ48Yt4/QVi1Fy/YILxx1u4ww8R7hzjk68oc/EcsG++iUoXMVF9lh9qBWjGa/5H6S83xbx1lEQh7JuOQDAStse','application/pdf',560),
 ('fd000001-0000-4000-8000-000000000002','de110000-0000-4000-8000-000000000000','fa000001-0000-4000-8000-000000000001','carte_identite','CI-778812','FR','Léa Martin','2016-09-15','2026-09-15','NUK9bwt1hkwgmt30oFekFKdPat7AOLpipsiYdjSbtFb7vgJo6cIWDGuMKgH1ZjAomYrQwazQTrE+3m708igbTt/hnUF87NHLSDeiEU5A3tC/WgODl+cVaQKWY12kXHVNoG7MQnFHYsQF4opkppP+vWoR5ZfBtDqbFzfH34JXqcQd6lleUZ9HhPjHe3jJI0zs8e9lfqiVAVeyFXp0Ux60HHVcz1bqtXwWX+2Qd3LpcplRjLUTk7HgV+JOfJUjRrO2T6OYtXJEwTqdrERx4QtBpjmQxC+02Oi+PeF92p2MYqQwLyMX1UZPljP2UoHI9DoSCJML4qs30380y+o4J73aQbshTdJ6AhJfOwPIwlOVmguIQ6hsSoje9cRCyz84ZwwmH6zXSXumQHMc2aMS3ju6kQa4xH0wvV1fSTmvHtJvS39I0+lY3e4uuAO//sHQsXwhu+yS2VPI/k9xpILAhqdkzBvptTo5x6zkHxLDccYNtobnJF/sUaYUeNI1T7ymJP03tp/xmo6Vz86FdwRsR3OR+jWuA5XpDkFl8JSQD8n6z1SnuMam3PODE7b+uOyyhT3DLdzrnqs1rG9N8tLCvsVa4PtPiD2S5C8AHNcDjCm+sEk/uZi8j/EfYO3GOzhQ/76eblgdhi/UFSTdnZZQkHwYIdhDYCsmzlsCl2L2gex7JPLzZshYlRefUa8Pq9jpwoVR0S20oAwwELo7OiTzspgmgCCY8harUUs+SoBGZu6eBqP27MX5NSRZu6TXSe8JXSBwvAxl8o7uaEhV4IPFPNnkbK4=','application/pdf',565),
 ('fd000001-0000-4000-8000-000000000003','de110000-0000-4000-8000-000000000000','fa000001-0000-4000-8000-000000000002','passeport','22FR55110','FR','Hugo Martin','2016-06-01','2026-06-01','A+f1JppG+4ZU4E8F1pKsFkatlH9s3x2ZlQaulciM9keJAckBmZ6Yi82bxTdAjhlOvuJKrnusOx6n0DMQfehnKDZvPl+SDoG4jGNJaWSVRNA4x/Q6VPD8ez9aQpUiISoYfm3glE+FZswykOg+s/CPE6KV2GEP7DSvIz9feCtbn/3rpF+ohPCPmJN0Ib3GFUUZhYNIGJpdYcz1QqYV0cgJSw/1nHDE4clCrdX7R7OMXMpe7JKyGA2ai8aibwtTIrXCZAuIZ4i1cyqdLwbKCo3ARgOgpYrG1Ehj/IV/Vr4RF5AHsvql7kxV0oFUfDuRyDwxsC8VA2i+zoOcCE2lutKafqv2srmailArkWykamtq5cfhctayuMJGTAcI9i2LKjqDHNdX9bGIOOlLAIGzGrQDgwH+vsIYYD+eHoi5RTtzSBMxhBV3n9tdKAlzweTxOz/6rexu+ZKTxqZVd0eXOOXzY4zZqrhsnRwPeG5cxtwLSxaY14hNBKYNmwwKYRNygBGQWM7G5JruN8w2QqsgfoNEynP+J6ME8wOKYTV3rSLIi5IWvZNIMEx9N+s2As9bfss6/97SXgwdFBu4yvk46MTVZJVAWl0tudMhqMki7pm82z6tZ9Vxhx+gEGz+TWodbQkhgpAOPyHXqkKSEuaY21mM8mVI2UTriJttCk/4bHU8FwVDmYWw1P7dMNW0JmQ9VjCwxFT3IKrOtKkq6a8WkoV8DjuO9IWKFH4x5xGYcrC1WzKtAUV2BfPKeFGziEVSpD3Ju4Zhf7HAtrdmYuJh3A==','application/pdf',561),
 ('fd000001-0000-4000-8000-000000000004','de110000-0000-4000-8000-000000000000','fa000001-0000-4000-8000-000000000003','carte_identite','CI-330199','FR','Jeanne Martin','2020-01-01','2030-01-01','8ZWVwPdbpMp6obmcD5HSPJHMid1gX9KDKLAB7HywTLUzSOyTD/Baw5aYPJ8/fgSXZ/NKyjFyU2rdAaSrqH1EUtAXVtl2fEKG6pngf1f3OhA/NYAGd+v1wV5eMPe/R8DQLHg6TIKgCC4bDsSF8qiNcQAJzH8kmoOT0Vr9bxfBX/8TmaeF+u0O9I+TzSsTZHi9DasUdIxv/DdxSwhSFaT9avCYabyb1ZKk+xIU7Kt+aDkFkhqm0Im7ZaMa3cRQUF3oyiDavv/1VOIAnFYzpHuuHEyXO1TktEz4gL9Z45mu8Z+DZJ4esMfishLMFR7F1sEWVWau6lejnHPvvNvYQVdf/MgxVkXwVyQ+omLpZMDT1fttxvKhzHlG7JGA+QkSb1/6WsDD7Fc1L+72IcRp/x0925WfkyxHnkyGlqLRQFSRm/syHhhHj6eS0lKxxSnJ/PoxP1Mi3wri3LMM+YmxlXUralRpp7DPki0b7X7Y6xdLcDSjQDpw+PF5+enaoYzIeEAoaK42NQQy7Oqtifx1FLWhreB7uLvXxADWRMvFuhOi28yWQD8vGezxIE9aHlPyaodhRVZgftL48Je6r04nrXAz8RyjtgO/mEzztz/jTeM+blAw73K5mLwtoGzKTv5k+X32B8NINeqcPaC8wdgDKaqTFmpmvRKM83HOih6iqRXD+gR0FzBhuPYNbsaD3RKN8UXiul1pg44kiDTUJUNpUaLHJJJkMU+t0aOcVYFpWPELn0gaO4XnBuFVGWkxcOfymvcLZjUVPiRChQOI99mda9S3ikPjzck=','application/pdf',568);

