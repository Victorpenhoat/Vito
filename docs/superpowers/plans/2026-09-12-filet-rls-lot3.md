# Filet RLS — Lot 3 : ce qui contourne la RLS par construction

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Éprouver les prédicats, les déclencheurs et les barrières de GRANT — les mécanismes `SECURITY DEFINER` qui s'exécutent EN DEHORS de la RLS, et que ni le socle ni la profondeur ne voient.

**Architecture :** 27 fonctions `SECURITY DEFINER` sur 54 échappent encore au filet. Relevées au catalogue et **lues une par une**, elles ne se traitent pas d'un seul geste : cinq sont des prédicats, cinq des déclencheurs, deux des fonctions de service dont la barrière est le GRANT et non un contrôle interne, et dix-sept agissent sur une cible ou sur l'appelant. Ce lot prend les douze premières — celles dont l'invariant est structurel et se teste sans monter de décor. Les dix-sept autres relèvent du lot 4.

**Tech Stack :** PostgreSQL 15, pgTAP, Supabase CLI (`supabase test db`), Docker.

**Spec :** `docs/superpowers/specs/2026-09-12-filet-rls-design.md` (§5)

## Global Constraints

- **Tout va dans `supabase/tests/rls_test.sql`.** Aucune migration, aucun seed, **aucune policy, aucune fonction** modifiée : un défaut trouvé est une décision produit à remonter au PO, jamais à corriger au passage.
- **Le bloc `-- SOCLE` doit rester le DERNIER contenu avant `select finish();`.** Tout ce que ce lot ajoute se place AVANT lui.
- **`select plan(n)` ligne 8 doit être exact.** Le nombre de départ dépend de ce qui est dans main — **174** au moment d'écrire ces lignes. Chaque tâche donne son **delta** ; l'implémenteur lit la valeur courante et ajoute. Ne jamais recopier un nombre absolu depuis ce plan. Compter les assertions par un grep NON ancré en début de ligne : certaines sont indentées.
- **Identités**, vérifiées au catalogue : `demo` = `de110000-0000-4000-8000-000000000000` · `client` = `11111111-1111-1111-1111-111111111111` · `agence` = `22222222-2222-2222-2222-222222222222` · `admin` = `33333333-3333-3333-3333-333333333333` · étranger synthétique = `deadbeef-0000-4000-8000-000000000000`.
- **Helpers disponibles** dans le fichier : `tests.count_as`, `tests.count_as_anon`, `tests.text_as`, `tests.bool_as`, `tests.bool_as_anon`, `tests.count_as_admin`, `tests.lecture_toleree`.
- **La base Docker est PARTAGÉE** avec d'autres sessions : **ne pas lancer `supabase db reset`** sauf après un run e2e ; `npx supabase test db` seul suffit, le fichier tourne dans sa propre transaction.
- **Le classifieur de l'environnement refuse `ALTER POLICY` / `CREATE POLICY`** : les preuves par mutation de policy ne sont pas exécutables. Celles de ce lot n'en ont pas besoin — elles mutent le fichier de test, pas le schéma.
- **Constructions shell complexes refusées** (fonctions, heredocs vers docker) : commandes simples et séparées.

## La règle qui gouverne ce lot

**Toute assertion d'absence doit avoir son témoin positif.** Cinq assertions creuses ont été trouvées dans le lot 2, toutes de la même famille : un test vert parce que la chose testée n'avait pas lieu, et non parce qu'elle était refusée. Le critère qui protège : **la ligne qu'on éprouve, on la crée** — et à défaut, une autre assertion doit rougir bruyamment si la source manque.

Concrètement ici : un `throws_ok` sans son jumeau qui réussit serait satisfait par une fonction que PERSONNE ne peut appeler.

---

## File Structure

| Fichier | Responsabilité | Action |
|---|---|---|
| `supabase/tests/rls_test.sql` | L'intégralité du filet RLS | Modifier : `plan()` en tête, nouvelles sections avant le bloc `-- SOCLE` |

Aucun autre fichier n'est touché.

---

### Task 1 : Les cinq prédicats qu'aucune policy n'exerce

**Files:** Modify `supabase/tests/rls_test.sql`

**Delta de plan : +10.**

Cinq prédicats `SECURITY DEFINER` ne sont cités par aucune assertion : `est_mon_activite`, `is_agence`, `is_concierge`, `is_groupe_membre`, `is_premium`. Ils ne « refusent » pas — ils répondent. L'invariant est donc une paire par prédicat : **faux pour qui n'a pas le droit, vrai pour l'ayant droit.** Un prédicat coincé à `false` serait aussi grave qu'un prédicat coincé à `true`, et seule la paire attrape les deux.

- [ ] **Step 1 : Relever les valeurs réelles avant d'écrire**

Ne pas deviner les attendus. Pour chaque prédicat, mesurer hors RLS qui devrait rendre vrai :

```bash
docker exec -i supabase_db_Vito psql -U postgres -d postgres -Atc "select 'agence a le role: '||role from public.profiles where id='22222222-2222-2222-2222-222222222222';"
docker exec -i supabase_db_Vito psql -U postgres -d postgres -Atc "select 'demo premium: '||public.is_premium('de110000-0000-4000-8000-000000000000')::text;"
docker exec -i supabase_db_Vito psql -U postgres -d postgres -Atc "select 'groupes de demo: '||count(*) from public.depense_groupes where owner_id='de110000-0000-4000-8000-000000000000';"
docker exec -i supabase_db_Vito psql -U postgres -d postgres -Atc "select 'activites de client: '||count(*) from public.activites where user_id='11111111-1111-1111-1111-111111111111';"
```

Si l'un de ces relevés contredit ce que la tâche suppose, **écrire l'assertion sur la valeur MESURÉE** et le signaler dans le rapport.

- [ ] **Step 2 : Écrire les dix assertions**

À insérer avant le bloc `-- SOCLE` :

```sql
-- ── Lot 3 / les prédicats que rien n'exerçait ──────────────────────────────
-- Cinq prédicats SECURITY DEFINER ne sont cités par aucune policy testée. Ils
-- ne refusent pas, ils répondent : l'invariant est donc une PAIRE par prédicat.
-- Un prédicat coincé à false est aussi grave qu'un coincé à true, et seule la
-- paire attrape les deux — un seul « il rend false pour l'étranger » serait
-- satisfait par un prédicat qui rend false pour tout le monde.

select ok(tests.bool_as('22222222-2222-2222-2222-222222222222', 'select public.is_agence()'),
          'is_agence : vrai pour le compte agence');
select ok(not tests.bool_as('11111111-1111-1111-1111-111111111111', 'select public.is_agence()'),
          'is_agence : faux pour un client');

select ok(not tests.bool_as('11111111-1111-1111-1111-111111111111', 'select public.is_concierge()'),
          'is_concierge : faux pour un client ordinaire');
select ok(not tests.bool_as('deadbeef-0000-4000-8000-000000000000', 'select public.is_concierge()'),
          'is_concierge : faux pour un compte sans profil');

select ok(tests.bool_as('de110000-0000-4000-8000-000000000000',
          'select public.is_premium(''de110000-0000-4000-8000-000000000000'')'),
          'is_premium : vrai pour le compte abonné');
select ok(not tests.bool_as('de110000-0000-4000-8000-000000000000',
          'select public.is_premium(''deadbeef-0000-4000-8000-000000000000'')'),
          'is_premium : faux pour un compte sans abonnement');

select ok(tests.bool_as('11111111-1111-1111-1111-111111111111',
          'select public.est_mon_activite((select id from public.activites where user_id = ''11111111-1111-1111-1111-111111111111'' order by id limit 1))'),
          'est_mon_activite : vrai pour le propriétaire de l''activité');
select ok(not tests.bool_as('deadbeef-0000-4000-8000-000000000000',
          'select public.est_mon_activite((select id from public.activites order by id limit 1))'),
          'est_mon_activite : faux pour qui n''a pas créé l''activité');

select ok(tests.bool_as('de110000-0000-4000-8000-000000000000',
          'select public.is_groupe_membre((select id from public.depense_groupes where owner_id = ''de110000-0000-4000-8000-000000000000'' order by id limit 1), ''de110000-0000-4000-8000-000000000000'')'),
          'is_groupe_membre : vrai pour le propriétaire du groupe');
select ok(not tests.bool_as('de110000-0000-4000-8000-000000000000',
          'select public.is_groupe_membre((select id from public.depense_groupes where owner_id = ''de110000-0000-4000-8000-000000000000'' order by id limit 1), ''deadbeef-0000-4000-8000-000000000000'')'),
          'is_groupe_membre : faux pour un uuid étranger au groupe');
```

> **Piège à surveiller** : deux de ces assertions s'appuient sur `(select id from … order by id limit 1)`. Si la table source était vide, le prédicat recevrait `null` et rendrait probablement `false` — l'assertion négative serait verte pour la mauvaise raison. C'est précisément pourquoi **chaque négative a ici sa positive jumelle sur la même source** : une source vide ferait rougir la positive. Ne pas séparer les paires.

- [ ] **Step 3 : Ajouter 10 au plan, lancer**

```bash
npx supabase test db 2>&1 | tail -6
```

Attendu : `Result: PASS`. Si une assertion rougit, **ne corriger aucune fonction** : relever la valeur réelle, la consigner, renvoyer DONE_WITH_CONCERNS.

- [ ] **Step 4 : Prouver que la section mord**

Muter le FICHIER DE TEST (pas le schéma) : inverser une attente — remplacer `not tests.bool_as(...)` par `tests.bool_as(...)` sur `is_agence : faux pour un client`. La suite doit échouer **sur cette assertion, nommément**. Relever son numéro et son libellé, comparer au fichier réel, puis restaurer.

- [ ] **Step 5 : Revérifier le vert et commiter**

---

### Task 2 : Les quatre déclencheurs qui gardent une invariance

**Files:** Modify `supabase/tests/rls_test.sql`

**Delta de plan : +7.**

Trois déclencheurs `*_lock_owner` empêchent de changer le propriétaire d'un objet — lus au catalogue, ils lèvent tous `owner_id immuable`. Le quatrième, `conciergerie_lock_insert`, force le statut d'une demande à sa création et efface toute réponse : un client ne peut pas se répondre à lui-même.

- [ ] **Step 1 : Écrire les six assertions**

```sql
-- ── Lot 3 / les déclencheurs ───────────────────────────────────────────────
-- Un déclencheur ne s'appelle pas : on éprouve son EFFET. Les trois verrous
-- d'owner lèvent « owner_id immuable » — vérifié au catalogue. Chaque refus est
-- apparié à une modification LÉGITIME qui doit passer : sans elle, « on ne peut
-- pas changer l'owner » serait satisfait par une table qu'on ne peut pas
-- modifier du tout.

select throws_ok(
  $$ select tests.count_as('de110000-0000-4000-8000-000000000000',
       'with u as (update public.voyages set owner_id = ''11111111-1111-1111-1111-111111111111'' where id = ''bb000000-0000-4000-8000-000000000001'' returning 1) select count(*) from u') $$,
  'owner_id immuable',
  'voyages : le propriétaire ne peut pas se dessaisir du voyage');
select is(tests.count_as('de110000-0000-4000-8000-000000000000',
          'with u as (update public.voyages set titre = ''pgtap renomme'' where id = ''bb000000-0000-4000-8000-000000000001'' returning 1) select count(*) from u'),
          1::bigint, 'voyages : mais il peut le renommer — le verrou ne bloque que l''owner');

select throws_ok(
  $$ select tests.count_as('de110000-0000-4000-8000-000000000000',
       'with u as (update public.depense_groupes set owner_id = ''11111111-1111-1111-1111-111111111111'' where id = ''bb000000-0000-4000-8000-000000000002'' returning 1) select count(*) from u') $$,
  'owner_id immuable',
  'depense_groupes : le propriétaire ne peut pas se dessaisir du groupe');
select is(tests.count_as('de110000-0000-4000-8000-000000000000',
          'with u as (update public.depense_groupes set titre = ''pgtap renomme'' where id = ''bb000000-0000-4000-8000-000000000002'' returning 1) select count(*) from u'),
          1::bigint, 'depense_groupes : mais il peut le renommer');

select throws_ok(
  $$ select tests.count_as('de110000-0000-4000-8000-000000000000',
       'with u as (update public.familles set owner_id = ''11111111-1111-1111-1111-111111111111'' where id = ''fa000000-0000-4000-8000-000000000001'' returning 1) select count(*) from u') $$,
  'owner_id immuable',
  'familles : le propriétaire ne peut pas se dessaisir du foyer');

-- conciergerie_lock_insert : le demandeur ne se répond pas à lui-même. On insère
-- une demande EN PRÉTENDANT qu'elle est déjà confirmée et répondue ; le
-- déclencheur doit remettre le statut à « nouvelle » et effacer la réponse.
--
-- L'identité est `demo` et non `client` : la policy d'insertion exige
-- `is_premium(auth.uid())`, et seul demo l'est. C'est un invariant en soi —
-- la conciergerie est réservée aux abonnés — d'où l'assertion qui suit.
select is(tests.text_as('de110000-0000-4000-8000-000000000000',
          'with u as (insert into public.conciergerie_demandes (user_id, type, etablissement_id, commentaire, statut, reponse, date_resa, heure_resa, nombre_convives) select ''de110000-0000-4000-8000-000000000000'', ''resto'', e.id, ''pgtap'', ''confirmee'', ''je me reponds'', ''2027-01-01'', ''20:00'', 2 from public.etablissements e order by e.id limit 1 returning statut::text || ''/'' || coalesce(reponse, ''(null)'')) select * from u'),
          'nouvelle/(null)',
          'conciergerie : une demande naît « nouvelle » et sans réponse, quoi qu''en dise le client');

-- Témoin de l'autre bord : un compte NON abonné ne peut pas ouvrir de demande.
-- Sans lui, l'assertion ci-dessus serait satisfaite par une table où personne
-- n'écrit. Le refus vient de la clause WITH CHECK, donc il LÈVE.
select throws_ok(
  $$ select tests.text_as('11111111-1111-1111-1111-111111111111',
       'with u as (insert into public.conciergerie_demandes (user_id, type, etablissement_id, commentaire, date_resa, heure_resa, nombre_convives) select ''11111111-1111-1111-1111-111111111111'', ''resto'', e.id, ''pgtap'', ''2027-01-01'', ''20:00'', 2 from public.etablissements e order by e.id limit 1 returning statut::text) select * from u') $$,
  '42501',
  null,
  'conciergerie : un compte non abonné ne peut pas ouvrir de demande');
```

> **Ce bloc a été EXÉCUTÉ avant d'entrer dans ce plan** (2026-09-12), et trois
> erreurs y ont été corrigées par la mesure — sans quoi elles auraient coûté une
> ronde chacune :
> - il n'y a **pas de colonne `message`**, c'est `commentaire` ;
> - `type` est un ENUM `conciergerie_type` valant `resto | hotel` — « autre »
>   n'existe pas ; et `statut` vaut `nouvelle | en_cours | confirmee | refusee`,
>   pas « traitee » ;
> - `etablissement_id` est **NOT NULL**, et avec `type = 'resto'` une contrainte
>   CHECK exige en plus `date_resa`, `heure_resa` et `nombre_convives`.
>
> Sortie obtenue : `RESULTAT = nouvelle/(null)`. Le delta de cette tâche passe
> donc de +6 à **+7** (le témoin « non abonné » s'ajoute).

- [ ] **Step 2 : Ajouter 6 au plan, lancer, puis prouver**

Preuve par mutation du fichier de test : remplacer le message attendu `'owner_id immuable'` par un autre texte dans le premier `throws_ok`. La suite doit échouer sur cette assertion nommément — ce qui démontre qu'elle vérifie bien le MESSAGE et pas seulement qu'une erreur quelconque survient. Restaurer.

- [ ] **Step 3 : Revérifier le vert et commiter**

---

### Task 3 : `handle_new_user` — le rôle ne vient jamais du client

**Files:** Modify `supabase/tests/rls_test.sql`

**Delta de plan : +2.**

Ce déclencheur porte un invariant de sécurité énoncé dans son propre commentaire : « le rôle n'est jamais lu depuis `raw_user_meta_data` (contrôlé par le client). Tout nouvel utilisateur est 'client'. » **Rien ne le garde.** C'est le cas d'école de ce chantier : un arbitrage de sécurité écrit en commentaire et tenu par rien.

- [ ] **Step 1 : Écrire les deux assertions**

```sql
-- ── Lot 3 / handle_new_user : le rôle ne vient jamais du client ────────────
-- L'invariant est écrit dans le commentaire de la fonction : raw_user_meta_data
-- est contrôlé par le client, donc le rôle n'en est JAMAIS tiré. Jusqu'ici rien
-- ne le gardait. Un compte qui s'inscrirait en réclamant « role: admin » dans
-- ses métadonnées doit ressortir « client ».
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                        created_at, updated_at)
values ('ba000000-0000-4000-8000-00000000000f', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'pgtap-escalade@vito.test', 'x', now(),
        '{"provider":"email"}'::jsonb,
        '{"role":"admin","display_name":"Escalade"}'::jsonb, now(), now());

select is((select role::text from public.profiles where id = 'ba000000-0000-4000-8000-00000000000f'),
          'client',
          'handle_new_user : un compte qui réclame « admin » dans ses métadonnées naît client');
select is((select display_name from public.profiles where id = 'ba000000-0000-4000-8000-00000000000f'),
          'Escalade',
          'handle_new_user : mais le nom affiché, lui, est bien repris des métadonnées');
```

> La seconde assertion est le témoin positif, et elle n'est pas décorative : sans elle, la première serait satisfaite par un déclencheur qui **ignore entièrement** `raw_user_meta_data` — voire qui ne crée aucun profil, auquel cas `role` serait `null` et non `'client'`. Elle prouve que les métadonnées sont bien lues, et que seule la partie « rôle » est écartée.

- [ ] **Step 2 : Vérifier les colonnes obligatoires de `auth.users` AVANT de lancer**

```bash
docker exec -i supabase_db_Vito psql -U postgres -d postgres -Atc "select column_name from information_schema.columns where table_schema='auth' and table_name='users' and is_nullable='NO' and column_default is null order by ordinal_position;"
```

Si l'insertion échoue, compléter les colonnes manquantes — **ne pas** contourner en modifiant l'assertion.

- [ ] **Step 3 : Ajouter 2 au plan, lancer, prouver, commiter**

Preuve : remplacer `'client'` par `'admin'` dans la première assertion — elle doit échouer nommément, ce qui établit que le déclencheur écarte réellement le rôle réclamé. Restaurer.

---

### Task 4 : Les fonctions de service, gardées par le GRANT et non par un contrôle

**Files:** Modify `supabase/tests/rls_test.sql`

**Delta de plan : +3.**

`purger_comptes_supprimes()` et `purger_recommandations()` n'ont **aucun contrôle d'autorisation interne** — et c'est correct : elles ne sont pas exécutables par `authenticated`. Leur barrière est le GRANT. Cet invariant ne tient donc qu'à une **absence de privilège**, et une absence s'accorde par distraction — un `grant execute on all functions in schema public to authenticated` suffirait à l'effacer.

Mesuré au catalogue le 2026-09-12 : `has_function_privilege('authenticated', …)` rend `false` pour les deux, et `true` pour `mock_subscribe(text)`.

- [ ] **Step 1 : Écrire les trois assertions**

```sql
-- ── Lot 3 / les fonctions de service : la barrière est le GRANT ────────────
-- Ces deux fonctions suppriment des comptes et des recommandations, et n'ont
-- AUCUN contrôle interne — c'est correct, puisqu'elles ne sont pas exécutables
-- par `authenticated`. Mais leur sécurité ne tient alors qu'à une absence de
-- privilège, qu'un `grant execute on all functions` effacerait sans bruit.
select ok(not has_function_privilege('authenticated', 'public.purger_comptes_supprimes()', 'execute'),
          'purger_comptes_supprimes : hors de portée d''un compte connecté');
select ok(not has_function_privilege('authenticated', 'public.purger_recommandations()', 'execute'),
          'purger_recommandations : hors de portée d''un compte connecté');
-- Témoin : sans lui, les deux assertions ci-dessus seraient satisfaites par un
-- has_function_privilege cassé qui rendrait false pour tout.
select ok(has_function_privilege('authenticated', 'public.mock_subscribe(text)', 'execute'),
          'témoin : une fonction destinée aux comptes connectés leur est bien accessible');
```

- [ ] **Step 2 : Ajouter 3 au plan, lancer, prouver, commiter**

Preuve : remplacer `not has_function_privilege(...)` par `has_function_privilege(...)` sur la première — elle doit échouer nommément. Restaurer. (Muter le GRANT lui-même serait plus probant mais n'est pas nécessaire : le témoin établit déjà que la fonction `has_function_privilege` discrimine.)

---

## Ce que ce lot ne fait pas, et pourquoi le découpage a changé

La spec (§5) prévoyait un lot 3 « refus uniforme sur les 18 fonctions à effet », puis un lot 4 « profondeur sur les 8 fonctions de partage ». **Ce découpage est abandonné**, et la raison vient de ce que le lot 2 a appris à ses dépens : un refus écrit sans son témoin positif est satisfait par une fonction que personne ne peut appeler. Écrire d'abord 18 refus, puis leurs témoins dans un lot ultérieur, serait donc produire délibérément 18 assertions creuses et vivre avec jusqu'au lot suivant.

Le nouveau découpage suit la nature des mécanismes, pas la profondeur du test :
- **Lot 3 (celui-ci)** — les douze mécanismes dont l'invariant est STRUCTUREL : prédicats, déclencheurs, barrières de GRANT. Ils se testent sans monter de décor.
- **Lot 4** — les dix-sept fonctions À EFFET, chacune avec son refus ET son témoin dans le même lot. Elles demandent un décor (voyages, groupes, foyers, comptes liés) et se répartiront par famille comme au lot 2.

Les fonctions à effet se répartissent elles-mêmes en trois natures, relevées en lisant leur corps — à confirmer au moment de planifier le lot 4 :
- **à cible** (`share_voyage`, `lier_client`, `retirer_membre_famille`…) : lèvent `non autorisé` / `réservé aux agences` pour un appelant sans droit ;
- **auto-portées** (`cancel_subscription`, `quitter_famille`, `revoquer_autres_sessions`…) : n'agissent que sur `auth.uid()`. Il n'existe pas d'appelant « non autorisé » — l'invariant est qu'elles n'atteignent JAMAIS les données d'un autre, et qu'elles refusent l'anonyme ;
- **de fabrique** (`find_or_create_vin`, `upsert_etablissement`, `cache_etablissement_photo`) : écrivent dans des tables partagées, et c'est par elles que doit passer toute écriture au catalogue.
