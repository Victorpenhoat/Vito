# Filet RLS — Lot 4 : les dix-sept fonctions à effet

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Éprouver les dix-sept fonctions `SECURITY DEFINER` qui AGISSENT — elles s'exécutent hors RLS, et si elles ne se contrôlent pas elles-mêmes, plus rien ne le fait.

**Architecture :** Lues une par une au catalogue, ces dix-sept ne partagent pas le même invariant. Quatre natures, relevées et **vérifiées par exécution** :

| Nature | Fonctions | Invariant |
|---|---|---|
| **À cible** | `share_voyage`, `unshare_voyage`, `share_groupe`, `unshare_groupe`, `lier_client`, `inviter_famille`, `retirer_membre_famille`, `creer_voyage_pour_client` | LÈVENT un message précis pour un appelant sans droit |
| **Portée-comme-autorisation** | `delier_client` | Ne lève PAS : sa portée est bornée par `auth.uid()`, donc un étranger n'affecte rien |
| **Auto-portées** | `cancel_subscription`, `quitter_famille`, `revoquer_autres_sessions`, `mock_subscribe`, `mes_connexions_recentes` | N'atteignent jamais les données d'autrui, et refusent l'anonyme |
| **De fabrique** | `find_or_create_vin`, `upsert_etablissement`, `cache_etablissement_photo` | Refusent l'anonyme, et sont la SEULE porte d'écriture du catalogue partagé |

**Tech Stack :** PostgreSQL 15, pgTAP, Supabase CLI, Docker.

**Spec :** `docs/superpowers/specs/2026-09-12-filet-rls-design.md` (§5, découpage révisé au lot 3)

## Global Constraints

- **Tout va dans `supabase/tests/rls_test.sql`.** Aucune migration, aucun seed, **aucune policy, aucune fonction** modifiée : un défaut trouvé est une décision produit, à remonter au PO.
- **Le bloc `-- SOCLE` reste le DERNIER contenu avant `select finish();`.** Tout s'insère avant lui.
- **`select plan(n)` ligne 8 doit être exact.** Départ : **197** au moment d'écrire. Chaque tâche donne son **delta** ; lire la valeur courante et ajouter. Compter par grep **NON ancré** en début de ligne, et **exclure les occurrences en commentaire** — les deux pièges ont déjà faussé un comptage.
- **Identités**, vérifiées : `demo` = `de110000-0000-4000-8000-000000000000` (premium) · `client` = `11111111-1111-1111-1111-111111111111` · `agence` = `22222222-2222-2222-2222-222222222222` (rôle `agence`) · `admin` = `33333333-3333-3333-3333-333333333333` · étranger synthétique = `deadbeef-0000-4000-8000-000000000000`.
- **Helpers** : `tests.count_as`, `tests.count_as_anon`, `tests.text_as`, `tests.bool_as`, `tests.bool_as_anon`, `tests.bool_as_role`, `tests.count_as_admin`, `tests.lecture_toleree`.
- **Base Docker PARTAGÉE** : **pas de `db reset`** sauf après un run e2e. `npx supabase test db` seul.
- **Le classifieur refuse `ALTER POLICY` / `CREATE POLICY` / `GRANT`.** Les preuves de ce lot mutent le FICHIER DE TEST, pas le schéma — ce qui suffit ici, les invariants vivant dans des corps de fonction.
- **Constructions shell complexes refusées** : commandes simples et séparées.

## Les deux règles qui gouvernent ce lot

**1. Toute assertion d'absence a son témoin positif.** Huit assertions creuses ont été trouvées sur les lots 2 et 3. Un `throws_ok` sans jumeau est satisfait par une fonction que PERSONNE ne peut appeler.

**2. L'épreuve par substitution d'entrée est OBLIGATOIRE sur chaque assertion négative.** C'est la technique dégagée au lot 3, et elle aurait attrapé les huit :

> Dans une assertion négative, remplacer l'identité par celle de son jumeau positif. Si elle reste VERTE, elle ne regarde pas ce que son libellé prétend.

Muter le fichier en inversant un `not` prouve seulement qu'une assertion est **câblée**. La substitution prouve qu'elle **discrimine**. Les deux sont exigées, et le rapport de chaque tâche doit porter les deux sorties.

---

## File Structure

| Fichier | Responsabilité | Action |
|---|---|---|
| `supabase/tests/rls_test.sql` | L'intégralité du filet RLS | Modifier : `plan()` en tête, nouvelles sections avant `-- SOCLE` |

---

### Task 1 : Le décor du lot 4

**Delta de plan : +0** (fixtures seules).

Les objets des lots 2 et 3 ne sont pas réutilisables : le lot 2 supprime les siens en fin de section, et ceux du lot 3 servent aux verrous d'owner. Ce lot crée les siens, préfixés `dd000000-…`.

- [ ] **Step 1 : Relever les colonnes obligatoires AVANT d'écrire**

C'est l'étape qui a évité trois rondes au lot 3. Pour chaque table touchée :

```bash
docker exec -i supabase_db_Vito psql -U postgres -d postgres -Atc "select table_name||' :: '||string_agg(column_name||' '||udt_name, ', ' order by ordinal_position) from information_schema.columns where table_schema='public' and table_name in ('voyages','depense_groupes','familles','agence_clients') and is_nullable='NO' and column_default is null group by table_name;"
docker exec -i supabase_db_Vito psql -U postgres -d postgres -Atc "select conrelid::regclass||' CHECK '||pg_get_constraintdef(oid) from pg_constraint where contype='c' and conrelid::regclass::text in ('voyages','depense_groupes','familles','agence_clients');"
```

Écrire les insertions sur ce qui est MESURÉ, jamais sur ce qui est supposé.

- [ ] **Step 2 : Écrire les fixtures**

Un voyage et un groupe appartenant à `demo`, plus le lien agence→client dont le lot 4 a besoin :

```sql
-- ── Lot 4 / décor des fonctions à effet ────────────────────────────────────
-- Objets PROPRES à ce lot : ceux du lot 2 sont supprimés en fin de leurs
-- sections (c'est leur témoin positif), ceux du lot 3 servent aux verrous
-- d'owner. Réutiliser les uns ou les autres ferait porter ces assertions sur
-- des objets disparus ou déjà mutés.
insert into public.voyages (id, owner_id, titre)
values ('dd000000-0000-4000-8000-000000000001',
        'de110000-0000-4000-8000-000000000000', 'pgtap lot4 voyage');
insert into public.depense_groupes (id, owner_id, titre)
values ('dd000000-0000-4000-8000-000000000002',
        'de110000-0000-4000-8000-000000000000', 'pgtap lot4 groupe');
```

> **Pas d'insertion `agence_clients` ici — vérifié en base.** Le lot 1 en pose
> une (agence → client) et le lot 2 la lit sans la supprimer : elle est encore
> vivante à cet endroit. Un `insert … on conflict do nothing` aurait masqué une
> insertion qui n'insère rien, c'est-à-dire le motif exact des huit assertions
> creuses déjà trouvées.

- [ ] **Step 3 : Lancer, vérifier que chaque fixture existe**

Aucune assertion n'est ajoutée, donc rien ne prouvera qu'une insertion a créé sa ligne. **Vérifier explicitement** par comptage hors RLS dans une transaction annulée, et recopier les comptes dans le rapport.

- [ ] **Step 4 : Commit**

---

### Task 2 : Les quatre fonctions de partage

**Delta de plan : +12.**

`share_voyage`, `unshare_voyage`, `share_groupe`, `unshare_groupe` lèvent toutes `non autorisé` pour un appelant qui n'est pas propriétaire — vérifié au catalogue, et `share_voyage` éprouvée par exécution (l'étranger lève, le propriétaire rend `ok`).

Trois assertions par fonction : **le non-propriétaire lève** · **le propriétaire réussit** · **l'effet en base est celui annoncé**.

- [ ] **Step 1 : Relever les signatures et les retours**

```bash
docker exec -i supabase_db_Vito psql -U postgres -d postgres -Atc "select p.proname||'('||pg_get_function_identity_arguments(p.oid)||') -> '||t.typname from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_type t on t.oid=p.prorettype where n.nspname='public' and p.proname in ('share_voyage','unshare_voyage','share_groupe','unshare_groupe');"
```

`share_*` rendent `text` (donc `tests.text_as`), `unshare_*` rendent `void` (donc mesurer l'EFFET, pas le retour).

- [ ] **Step 2 : Écrire les douze assertions**

Motif pour chaque fonction, illustré sur `share_voyage` — le décliner pour les trois autres :

```sql
-- ── Lot 4 / les fonctions de partage ───────────────────────────────────────
-- Elles élargissent l'accès : ce sont celles qui peuvent, en silence, donner à
-- quelqu'un ce qu'il ne devait pas avoir. Trois assertions chacune — le refus,
-- le succès légitime, et l'effet réellement produit en base.

select throws_ok(
  $$ select tests.text_as('deadbeef-0000-4000-8000-000000000000',
       'select public.share_voyage(''dd000000-0000-4000-8000-000000000001'', ''client@vito.test'')') $$,
  'non autorisé',
  'share_voyage : un non-propriétaire ne partage pas le voyage d''autrui');

select is(tests.text_as('de110000-0000-4000-8000-000000000000',
          'select public.share_voyage(''dd000000-0000-4000-8000-000000000001'', ''client@vito.test'')'),
          'ok', 'share_voyage : le propriétaire, lui, partage');

select is(tests.count_as('de110000-0000-4000-8000-000000000000',
          'select count(*) from public.voyage_membres where voyage_id = ''dd000000-0000-4000-8000-000000000001'' and profile_id = ''11111111-1111-1111-1111-111111111111'''),
          1::bigint, 'share_voyage : et le partage a réellement inscrit le membre');
```

> **L'ordre compte.** Le refus doit venir AVANT le succès : une fois le partage
> fait, le bénéficiaire devient membre, et un `unshare` testé ensuite changerait
> de sens. Grouper chaque fonction et enchaîner `share_*` puis `unshare_*` sur
> le même objet, dans cet ordre.

- [ ] **Step 3 : Ajouter 12 au plan, lancer**

- [ ] **Step 4 : Les deux épreuves, sur CHAQUE assertion négative**

D'abord la mutation du fichier (inverser l'attente ou fausser le message) — elle prouve le câblage. Puis, et c'est la nouvelle exigence, **la substitution d'entrée** : remplacer `deadbeef-…` par `de110000-…` (le propriétaire) dans le `throws_ok`. Il doit alors ÉCHOUER, puisque le propriétaire ne lève pas. S'il reste vert, l'assertion ne regarde pas l'identité.

Recopier les deux sorties pour chaque fonction.

- [ ] **Step 5 : Revérifier le vert, commiter**

---

### Task 3 : Le Cercle et l'agence

**Delta de plan : +13.**

`inviter_famille` et `retirer_membre_famille` lèvent `non autorisé` ; `lier_client` et `creer_voyage_pour_client` lèvent `réservé aux agences` ; `creer_voyage_pour_client` lève en plus `client non lié`.

**`delier_client` est le cas à part, et il ne s'écrit pas comme les autres** — vérifié par exécution : elle ne lève PAS pour un étranger. Son `delete` est borné par `agence_id = auth.uid()`, donc la portée EST l'autorisation. Mesuré : l'étranger laisse le lien intact (compte = 1), l'agence le retire (compte = 0).

- [ ] **Step 1 : Écrire les treize assertions**

Pour les quatre fonctions qui lèvent, le motif de la tâche 2. Pour `delier_client`, ce motif-ci :

```sql
-- delier_client ne LÈVE PAS pour un appelant sans droit : son delete est borné
-- par `agence_id = auth.uid()`, donc la portée est l'autorisation. Un étranger
-- n'obtient pas un refus, il n'affecte simplement rien. C'est une troisième
-- forme d'invariant, et l'écrire en throws_ok serait faux.
select is(tests.count_as('deadbeef-0000-4000-8000-000000000000',
          'with u as (select public.delier_client(''11111111-1111-1111-1111-111111111111'')) select count(*) from public.agence_clients where agence_id = ''22222222-2222-2222-2222-222222222222'' and client_id = ''11111111-1111-1111-1111-111111111111'''),
          1::bigint, 'delier_client : un étranger n''affecte pas le lien d''une agence');

select is(tests.count_as('22222222-2222-2222-2222-222222222222',
          'with u as (select public.delier_client(''11111111-1111-1111-1111-111111111111'')) select count(*) from public.agence_clients where agence_id = ''22222222-2222-2222-2222-222222222222'' and client_id = ''11111111-1111-1111-1111-111111111111'''),
          0::bigint, 'delier_client : l''agence, elle, délie bien son client');
```

> **L'ordre est impératif** : la tentative de l'étranger AVANT celle de l'agence,
> sinon le lien n'existe plus et la première assertion serait verte pour la
> mauvaise raison — la forme exacte des huit vacuités déjà trouvées.

**ET IL FAUT RE-CRÉER LE LIEN APRÈS.** Mesuré en base : `agence_clients` ne contient QUE la ligne posée par le lot 1. La déliaison par l'agence la supprime donc réellement, et le garde-fou de vacuité du bloc `-- SOCLE` — qui exige qu'aucune table hors exceptions ne soit vide — échouerait en nommant `agence_clients`.

C'est la situation qu'a rencontrée la section Cercle du lot 2, et le remède est le même :

```sql
-- Le lien est re-créé, et ce n'est pas une scorie : c'était la SEULE ligne
-- d'`agence_clients` du fichier, et le garde-fou de vacuité du socle exige que
-- la table ne soit pas vide. La supprimer ferait rougir le socle sur une table
-- que personne n'aurait touchée.
insert into public.agence_clients (agence_id, client_id)
values ('22222222-2222-2222-2222-222222222222',
        '11111111-1111-1111-1111-111111111111');
```

Sans ce commentaire, le prochain lecteur y verra un doublon, le supprimera, et fera rougir le socle sans comprendre — c'est exactement ce qui a motivé le même commentaire au lot 2.

- [ ] **Step 2 : Ajouter 13 au plan, lancer, éprouver (mutation ET substitution), commiter**

---

### Task 4 : Les cinq fonctions auto-portées

**Delta de plan : +10.**

`cancel_subscription`, `quitter_famille`, `revoquer_autres_sessions`, `mock_subscribe`, `mes_connexions_recentes` agissent toutes sur `auth.uid()`. **Il n'existe pas d'« appelant non autorisé » pour elles** — un étranger qui les appelle agit sur ses propres données (inexistantes). Écrire un `throws_ok` d'autorisation serait donc faux.

Leur invariant est double : **elles n'atteignent JAMAIS les données d'autrui**, et **elles refusent l'anonyme**.

- [ ] **Step 1 : Relever le comportement anonyme de chacune**

Certaines lèvent `authentification requise`, d'autres rendent simplement 0 — vérifié pour `revoquer_autres_sessions`, qui rend `0` au lieu de lever. **Mesurer chacune** avant d'écrire, et écrire l'assertion sur le comportement RÉEL :

```bash
docker exec -i supabase_db_Vito psql -U postgres -d postgres -Atc "select p.proname||' -> '||coalesce((select string_agg(m[1],' | ') from regexp_matches(p.prosrc,'raise exception ''([^'']+)''','g') m),'(ne lève pas)') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('cancel_subscription','quitter_famille','revoquer_autres_sessions','mock_subscribe','mes_connexions_recentes');"
```

- [ ] **Step 2 : Écrire les dix assertions** — deux par fonction : l'anonyme est refusé (ou rend zéro, selon la mesure), et l'appel par un compte n'altère QUE ses propres données. Pour la seconde, la forme est : compter les données d'un AUTRE compte avant et après l'appel, et exiger qu'elles soient inchangées.

- [ ] **Step 3 : Ajouter 10 au plan, lancer, éprouver, commiter**

---

### Task 5 : Les trois fonctions de fabrique, et la porte du catalogue

**Delta de plan : +8.**

`find_or_create_vin` crée un vin appartenant à `auth.uid()`. `upsert_etablissement` et `cache_etablissement_photo` écrivent dans le catalogue partagé — et c'est tout leur intérêt ici.

**Cette tâche complète une assertion du lot 2.** Celui-ci a gravé qu'`etablissements` n'a AUCUNE policy d'écriture : un compte connecté ne peut donc ni le modifier ni l'effacer directement. Restait à établir l'autre moitié : **le catalogue EST écrivable, par la porte prévue**. Sans elle, « personne ne peut écrire » serait satisfait par un catalogue que personne ne peut alimenter — et le filet dirait « sûr » là où l'application serait cassée.

- [ ] **Step 1 : Écrire les huit assertions**

Pour chaque fonction : l'anonyme est refusé, et l'appel légitime produit son effet. Plus, pour `cache_etablissement_photo`, l'assertion qui ferme la boucle avec le lot 2 :

```sql
-- La porte du catalogue. Le lot 2 a gravé qu'aucune policy ne permet d'écrire
-- dans `etablissements` — reste à prouver qu'on y écrit tout de même, par la
-- fonction prévue. Sans cette assertion, « personne ne peut écrire » serait
-- satisfait par un catalogue que personne ne peut alimenter : le filet dirait
-- « sûr » là où l'application serait cassée.
select is(tests.count_as('11111111-1111-1111-1111-111111111111',
          'with u as (select public.cache_etablissement_photo((select id from public.etablissements order by id limit 1), ''pgtap-ref'')) select count(*) from public.etablissements where photo_ref = ''pgtap-ref'''),
          1::bigint,
          'cache_etablissement_photo : le catalogue s''écrit par la porte prévue, là où l''écriture directe est refusée');
```

- [ ] **Step 2 : Ajouter 8 au plan, lancer, éprouver, commiter**

---

## Ce que ce lot ne fait pas

**Le hook de production reste hors filet.** Les assertions de ce lot et du lot 3 posent le claim `user_role` que `custom_access_token_hook` est censé produire à chaque connexion. Si ce hook cessait de le poser — mauvaise configuration, jeton hérité —, `is_agence()` rendrait `false` pour tout le monde en production et **tous nos tests resteraient verts**. C'est l'autre moitié du scénario de régression, et elle demande un test d'une autre nature : vérifier que le hook PRODUIT le claim, pas qu'une fonction réagit à un claim fourni. À planifier séparément.

**Les preuves par mutation de POLICY restent impossibles** dans cet environnement. Elles ne manquent pas à ce lot, dont les invariants vivent dans des corps de fonction — mais la dette reste ouverte sur les lots 1 et 2.
