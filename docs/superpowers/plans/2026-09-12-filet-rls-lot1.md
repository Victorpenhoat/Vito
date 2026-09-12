# Filet RLS — Lot 1 : le socle

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Qu'une policy ouverte par erreur — sur n'importe quelle table, y compris une table qui n'existe pas encore — fasse échouer `supabase test db`.

**Architecture :** Trois balayages pilotés par le catalogue `pg_tables`, écrits comme une fonction plpgsql unique (`tests.balayage`) qui visite chaque table sous une identité donnée et rend ce qu'elle y voit. Les assertions portent sur des listes agrégées : le plan reste un nombre fixe, et un échec **nomme les tables coupables**. Deux garde-fous empêchent le filet d'être creux : l'un exige que le balayage ait vraiment visité tout le schéma, l'autre qu'aucune table ne passe le test simplement parce qu'elle est vide.

**Tech Stack :** PostgreSQL 15, pgTAP, Supabase CLI (`supabase test db`), Docker.

**Spec :** `docs/superpowers/specs/2026-09-12-filet-rls-design.md`

## Global Constraints

- **Un seul fichier** : tout va dans `supabase/tests/rls_test.sql`. `supabase test db` isole chaque `.sql` dans sa propre transaction ; dupliquer les helpers dans un second fichier les ferait dériver (spec §6).
- **Le socle va à la FIN du fichier**, juste avant `select finish();`. Le fichier est une seule transaction : les fixtures créées par les tests existants (`voyage_participants`, `voyage_depenses`, `activite_codes`, `journal_acces`, `recommandations`…) sont encore là à ce moment, et le balayage en profite. Placé au début, il verrait 19 tables vides au lieu de 9.
- **`select plan(n)` ligne 8 doit être exact.** pgTAP échoue si le nombre d'assertions exécutées diffère. Valeur de départ : `107`. Chaque tâche dit de combien l'incrémenter.
- **Toujours `npx supabase db reset` avant `npx supabase test db`.** Lancer l'e2e avant le pgTAP laisse des lignes en base (comptes `invite…`, `proche…`) qui faussent les comptages — c'est mesuré, pas théorique.
- **Aucune migration n'est modifiée dans ce lot.** Les mutations de preuve s'appliquent à la base locale (`alter policy …`) puis sont annulées par `supabase db reset`. Si une policy se révèle réellement trop ouverte, on s'arrête et on pose la question au PO (spec §7).
- **UUID des comptes du seed**, vérifiés au catalogue :
  - `client@vito.test` = `11111111-1111-1111-1111-111111111111`
  - `agence@vito.test` = `22222222-2222-2222-2222-222222222222`
  - `demo@vito.test` = `de110000-0000-4000-8000-000000000000`
  - `free@vito.test` = `44444444-4444-4444-8444-444444444444` (aucun partage : c'est l'étranger)

---

## File Structure

| Fichier | Responsabilité | Action |
|---|---|---|
| `supabase/tests/rls_test.sql` | L'intégralité du filet RLS | Modifier : `plan()` en tête, nouvelle section « SOCLE » en fin |

Aucun autre fichier n'est touché par ce lot.

---

### Task 1 : Le balayage, et la preuve qu'il voit tout

**Files:**
- Modify: `supabase/tests/rls_test.sql` (ligne 8 pour `plan()`, puis insertion avant `select finish();`)

**Interfaces:**
- Produces: `tests.balayage(p_uid uuid, p_exceptions text[]) returns table(nom text, lignes bigint)` — visite chaque table du schéma `public` sauf les exceptions, sous l'identité `p_uid` (`null` = anon), et rend une ligne par table avec le nombre de lignes VUES. Les tâches 2 à 4 la réutilisent telle quelle.

- [ ] **Step 1 : Écrire le helper et les deux assertions du balayage anon**

À insérer juste avant `select finish();` :

```sql
-- ============================================================
-- SOCLE — balayages pilotés par le catalogue
-- ============================================================
-- Écrit ici, en FIN de fichier, délibérément : le fichier est une seule
-- transaction, donc les fixtures posées plus haut (participants de voyage,
-- dépenses, codes d'activité, journal d'accès…) existent encore. Placé en tête,
-- le balayage trouverait 19 tables vides et se prononcerait sur du néant.

-- Visite chaque table du schéma public sous une identité, et rend ce qu'elle y
-- voit. `p_uid` null = anon. Un refus au niveau GRANT vaut 0 ligne exposée :
-- l'invariant est « rien ne fuit », pas « la requête aboutit ».
create function tests.balayage(p_uid uuid, p_exceptions text[])
returns table(nom text, lignes bigint) language plpgsql as $$
declare t text; n bigint;
begin
  for t in select tablename from pg_tables
           where schemaname = 'public'
             and tablename <> all(p_exceptions)
           order by tablename
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
```

- [ ] **Step 2 : Passer `plan(107)` à `plan(109)`**

Ligne 8 du fichier :

```sql
select plan(109);
```

- [ ] **Step 3 : Lancer, et constater le VERT**

```bash
npx supabase db reset && npx supabase test db
```

Attendu : `Result: PASS`, 109 tests. Ce vert ne prouve **rien** encore — anon est déjà bloqué partout. La preuve vient à l'étape suivante.

- [ ] **Step 4 : Prouver que l'assertion mord — ouvrir une table à anon**

```bash
docker exec -i supabase_db_Vito psql -U postgres -d postgres -Atc \
  "create policy pgtap_fuite_anon on public.voyages for select to anon using (true);"
docker exec -i supabase_db_Vito psql -U postgres -d postgres -Atc \
  "grant select on public.voyages to anon;"
npx supabase test db 2>&1 | grep -E "^not ok|# +Failed|^Result:"
```

> **Le `grant` n'est pas décoratif — vérifié le 2026-09-12.** La policy seule ne
> fuit pas : `00025_revoke_anon_grants.sql` a fait un `revoke all … from anon`
> global, et Postgres bloque au niveau GRANT avant même d'évaluer la RLS. Sans
> la seconde ligne, la suite reste verte et la « preuve » ne prouve rien.
> C'est une bonne nouvelle pour la sécurité (anon est arrêté deux fois) et un
> piège pour qui écrit la preuve. Les tâches 2 à 4 ne sont pas concernées :
> elles balaient sous l'identité `free`, de rôle `authenticated`, qui détient
> bien ses GRANT.

Attendu : l'échec nomme **l'assertion « anon ne voit aucune ligne… »** et la sortie `is()` liste `{voyages}`. Vérifier que c'est bien CETTE assertion qui tombe, et pas une antérieure — relever son numéro et le comparer au fichier. Une preuve qui tombe ailleurs ne prouve rien de ce qu'elle annonce.

- [ ] **Step 5 : Prouver que le garde-fou mord — casser le balayage**

Remplacer temporairement `where schemaname = 'public'` par `where schemaname = 'pg_catalog_inexistant'` dans `tests.balayage`, puis :

```bash
npx supabase db reset && npx supabase test db 2>&1 | grep -E "^not ok|# +Failed|^Result:"
```

Attendu : l'assertion « le balayage anon a bien visité tout le schéma » **échoue** (`0 >= 48` est faux), pendant que la première redevient verte à tort. C'est précisément ce que le garde-fou existe pour attraper. Restaurer le `where`.

- [ ] **Step 6 : Restaurer et revérifier le vert**

```bash
npx supabase db reset && npx supabase test db
```

Attendu : `Result: PASS`, 109 tests.

- [ ] **Step 7 : Commit**

```bash
git add supabase/tests/rls_test.sql
git commit -m "test(rls): un balayage qui répond pour toutes les tables, même celles à venir

Le filet ne couvrait que 26 des 48 tables : ouvrir voyages à tous laissait
supabase test db au vert. Le balayage interroge pg_tables plutôt qu'une liste
écrite à la main, donc une table ajoutée demain est couverte sans que personne
y pense.

Le garde-fou sur le nombre de tables visitées n'est pas décoratif : sans lui, un
filtre trop zélé rendrait l'assertion verte en ne balayant rien."
```

---

### Task 2 : Le balayage de l'étranger, et ses exceptions déclarées

**Files:**
- Modify: `supabase/tests/rls_test.sql`

**Interfaces:**
- Consumes: `tests.balayage(uuid, text[])` de la tâche 1.
- Produces: `socle_exceptions` — table temporaire listant les tables où l'étranger voit légitimement quelque chose, avec la raison. Les tâches 3 et 4 la lisent.

- [ ] **Step 1 : Écrire les exceptions et l'assertion**

À la suite du bloc de la tâche 1 :

```sql
-- L'étranger : free@vito.test ne partage RIEN avec personne (c'est déjà ce que
-- dit le seed). L'invariant est donc uniforme et n'exige de connaître la colonne
-- propriétaire d'aucune table : un compte sans lien ne voit aucune ligne.
--
-- Les exceptions sont déclarées ICI, chacune avec sa raison. C'est le point de
-- friction délibéré : une table qui voudrait rejoindre cette liste devra
-- s'expliquer en revue.
create temp table socle_exceptions(nom text primary key, raison text);
insert into socle_exceptions values
  ('etablissements',     'catalogue partagé, SELECT USING (true) assumé'),
  ('vacances_scolaires', 'calendrier public pour tout compte connecté'),
  ('tags',               'les tags système (user_id is null) sont un vocabulaire commun'),
  ('profiles',           'chacun voit sa propre ligne (id = auth.uid())');

create temp table socle_etranger as
  select * from tests.balayage(
    '44444444-4444-4444-8444-444444444444'::uuid,
    (select array_agg(nom) from socle_exceptions));

select is(
  (select coalesce(array_agg(nom order by nom), '{}') from socle_etranger where lignes > 0),
  '{}'::text[],
  'un compte sans aucun lien ne voit aucune ligne d''autrui');
```

- [ ] **Step 2 : Passer `plan(109)` à `plan(110)`**

- [ ] **Step 3 : Lancer**

```bash
npx supabase db reset && npx supabase test db 2>&1 | tail -20
```

Attendu, honnêtement : **on ne sait pas**. C'est la première fois que cette question est posée à 44 tables. Deux issues possibles :
- `Result: PASS` → le socle est en place, passer à l'étape 4 ;
- `Result: FAIL` avec une liste de tables → **ne rien corriger**. Relever la liste, vérifier pour chacune la policy fautive (`select policyname, qual from pg_policies where tablename = '…'`), et **porter la question au PO** : « ces tables sont lisibles par n'importe quel compte connecté, est-ce voulu ? ». C'est la réserve §7 de la spec. Une policy ne se change pas sans décision.

- [ ] **Step 4 : Prouver que l'assertion mord**

```bash
docker exec -i supabase_db_Vito psql -U postgres -d postgres -Atc \
  "alter policy voyages_select on public.voyages using (true);"
npx supabase test db 2>&1 | grep -E "^not ok|# +Failed|^Result:"
```

Attendu : l'assertion « un compte sans aucun lien ne voit aucune ligne d'autrui » échoue et liste `{voyages}`. C'est **la mutation exacte** que l'audit avait laissée passer en silence. Vérifier le numéro d'assertion.

- [ ] **Step 5 : Restaurer, revérifier**

```bash
npx supabase db reset && npx supabase test db
```

- [ ] **Step 6 : Commit**

```bash
git add supabase/tests/rls_test.sql
git commit -m "test(rls): un compte sans lien ne voit rien, et les exceptions s'expliquent

free@vito.test ne partage rien avec personne : l'invariant « il ne voit aucune
ligne d'autrui » vaut donc pour toutes les tables sans qu'on ait à connaître la
colonne propriétaire de chacune.

Les quatre exceptions (catalogue d'établissements, calendrier scolaire, tags
système, sa propre ligne de profil) portent leur raison dans le code. Une table
qui voudra les rejoindre devra s'expliquer en revue."
```

---

### Task 3 : Le garde-fou de vacuité — aucune table ne passe parce qu'elle est vide

**Files:**
- Modify: `supabase/tests/rls_test.sql`

**Interfaces:**
- Consumes: `socle_exceptions` de la tâche 2.
- Produces: `tests.tables_sans_donnees(p_exceptions text[]) returns text[]` — les tables réellement vides au moment du balayage, comptées hors RLS.

- [ ] **Step 1 : Écrire le helper et l'assertion**

```sql
-- Le piège que ce garde-fou existe pour attraper : « l'étranger voit 0 ligne »
-- est VRAI d'une table vide, même avec une policy grande ouverte. Sur une base
-- fraîchement seedée, 19 des 48 tables sont vides — le balayage se prononcerait
-- sur du néant pour 40 % du schéma.
--
-- On compte donc hors RLS (le rôle courant est le propriétaire, il la contourne)
-- et on exige que toute table vide soit DÉCLARÉE. `<@` (inclusion) plutôt que
-- l'égalité : ajouter des données ne doit pas casser le test, mais une NOUVELLE
-- table vide doit le faire.
create function tests.tables_sans_donnees(p_exceptions text[])
returns text[] language plpgsql as $$
declare t text; n bigint; vides text[] := '{}';
begin
  for t in select tablename from pg_tables
           where schemaname = 'public' and tablename <> all(p_exceptions)
           order by tablename
  loop
    execute format('select count(*) from public.%I', t) into n;
    if n = 0 then vides := vides || t; end if;
  end loop;
  return vides;
end $$;

select ok(
  tests.tables_sans_donnees((select array_agg(nom) from socle_exceptions))
    <@ array[
      'activite_creneau_exceptions',
      'activite_paiements',
      'agence_clients',
      'avis',
      'famille_membres',
      'famille_restos',
      'familles',
      'remboursements',
      'voyage_remboursements'
    ]::text[],
  'toute table que le balayage ne peut pas éprouver est déclarée vide ici');
```

- [ ] **Step 2 : Passer `plan(110)` à `plan(111)`**

- [ ] **Step 3 : Lancer et vérifier le vert**

```bash
npx supabase db reset && npx supabase test db
```

Attendu : `Result: PASS`, 111 tests. La liste ci-dessus a été relevée le 2026-09-12 sur base fraîche, socle placé en fin de fichier.

- [ ] **Step 4 : Prouver que le garde-fou mord — vider une table éprouvée**

```bash
npx supabase db reset
docker exec -i supabase_db_Vito psql -U postgres -d postgres -Atc \
  "delete from public.subscriptions;"
npx supabase test db 2>&1 | grep -E "^not ok|# +Failed|^Result:"
```

Attendu : l'assertion « toute table que le balayage ne peut pas éprouver est déclarée vide ici » **échoue**, parce que `subscriptions` est devenue vide sans figurer dans la liste. Vérifier le numéro d'assertion.

- [ ] **Step 5 : Restaurer, revérifier**

```bash
npx supabase db reset && npx supabase test db
```

- [ ] **Step 6 : Commit**

```bash
git add supabase/tests/rls_test.sql
git commit -m "test(rls): une table vide ne vaut pas une table sûre

« L'étranger voit 0 ligne » est vrai d'une table vide, policy grande ouverte
comprise. Sur base fraîchement seedée, 19 des 48 tables sont vides : sans ce
garde-fou, le balayage se prononçait sur du néant pour 40 % du schéma.

Les neuf tables encore non éprouvées sont déclarées nommément. L'inclusion
plutôt que l'égalité : leur donner des données ne casse rien, mais une nouvelle
table vide fait échouer la suite."
```

---

### Task 4 : Alimenter les neuf tables, pour qu'il ne reste rien de vide

**Files:**
- Modify: `supabase/tests/rls_test.sql`

**Interfaces:**
- Consumes: rien de nouveau. Les fixtures s'appuient sur le seed et sur celles déjà créées plus haut dans le fichier.
- Produces: les neuf tables portent au moins une ligne appartenant à `demo` ou `client`, donc le balayage de l'étranger devient effectif partout.

- [ ] **Step 1 : Écrire les fixtures, AVANT le bloc SOCLE**

À insérer juste avant le commentaire `-- SOCLE — balayages pilotés par le catalogue` :

```sql
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
```

- [ ] **Step 2 : Vider la liste des tables déclarées vides (tâche 3)**

Le tableau du `ok(... <@ array[...])` devient vide — plus aucune table n'échappe au balayage :

```sql
select ok(
  tests.tables_sans_donnees((select array_agg(nom) from socle_exceptions))
    <@ '{}'::text[],
  'toute table que le balayage ne peut pas éprouver est déclarée vide ici');
```

- [ ] **Step 3 : Lancer**

```bash
npx supabase db reset && npx supabase test db 2>&1 | tail -20
```

> **État de vérification de ces fixtures (2026-09-12).** Huit des neuf ont été
> exécutées telles quelles contre la base locale seedée et rendent `INSERT 0 1` :
> `familles` (le trigger `add_famille_owner_membre` alimente bien
> `famille_membres` dans la foulée — vérifié), `famille_restos`, `avis`,
> `agence_clients`, `remboursements`, `activite_paiements`,
> `activite_creneau_exceptions`. La neuvième, `voyage_remboursements`, ne peut
> pas être validée hors test : elle s'appuie sur `voyage_participants`, que seul
> le fichier pgTAP alimente, dans sa propre transaction. C'est donc la seule
> insertion à surveiller à la première exécution.

Attendu : `Result: PASS`, 111 tests. Si une insertion échoue (colonne manquante, FK), l'erreur SQL le dit précisément — corriger l'insertion, pas l'assertion.

Attendu aussi, possible : le balayage de l'étranger **rougit maintenant** sur une des neuf tables fraîchement peuplées, parce que sa policy est trop ouverte et que personne ne l'avait jamais mesurée. C'est le but du lot. Ne pas corriger la policy : relever, et porter la question au PO.

- [ ] **Step 4 : Prouver que ces fixtures rendent le balayage probant**

```bash
docker exec -i supabase_db_Vito psql -U postgres -d postgres -Atc \
  "alter policy avis_all_owner on public.avis using (true);"
npx supabase test db 2>&1 | grep -E "^not ok|# +Failed|^Result:"
```

Attendu : l'assertion de l'étranger échoue et liste `{avis}`. **Avant la tâche 4, cette même mutation passait inaperçue** — `avis` était vide. C'est la démonstration que les fixtures ne sont pas décoratives ; la recopier dans la PR.

- [ ] **Step 5 : Restaurer, revérifier**

```bash
npx supabase db reset && npx supabase test db
```

- [ ] **Step 6 : Commit**

```bash
git add supabase/tests/rls_test.sql
git commit -m "test(rls): neuf tables cessent de passer le balayage par forfait

Elles étaient vides après seed, donc « l'étranger n'y voit rien » y était vrai
sans rien prouver. Chacune reçoit une ligne appartenant à demo ou client —
jamais à free, c'est ce qui rend le balayage probant.

Mesuré : avec avis vide, ouvrir sa policy en grand ne faisait rougir personne.
Avec la fixture, la même mutation est attrapée."
```

---

### Task 5 : Rejouer les deux mutations de l'audit, et clore le lot

**Files:**
- Modify: aucun (tâche de vérification)

- [ ] **Step 1 : Rejouer la mutation `voyages` de l'audit**

```bash
npx supabase db reset
docker exec -i supabase_db_Vito psql -U postgres -d postgres -Atc \
  "alter policy voyages_select on public.voyages using (true);"
npx supabase test db 2>&1 | grep -E "^not ok|# +Failed|^Result:"
```

Attendu : `Result: FAIL`. Au moment de l'audit, cette mutation **passait**. Recopier la sortie dans la PR, à côté de celle de l'audit.

- [ ] **Step 2 : Rejouer la mutation `voyage_documents` de l'audit**

```bash
npx supabase db reset
docker exec -i supabase_db_Vito psql -U postgres -d postgres -Atc \
  "alter policy voyage_documents_all on public.voyage_documents using (true);"
npx supabase test db 2>&1 | grep -E "^not ok|# +Failed|^Result:"
```

Attendu : `Result: FAIL`. Même remarque.

- [ ] **Step 3 : Vérifier le témoin — le filet n'est pas devenu collant**

```bash
npx supabase db reset && npx supabase test db
```

Attendu : `Result: PASS`, 111 tests. Un filet qui rougit sur une base saine ne vaut pas mieux qu'un filet qui ne rougit jamais.

- [ ] **Step 4 : Ouvrir la PR**

Le corps doit contenir, recopiées : la sortie verte de base, et les deux sorties rouges des étapes 1 et 2 en regard du tableau de l'audit (où elles étaient vertes). Si la tâche 2 ou 4 a révélé une policy trop ouverte, la PR **pose la question** et ne la corrige pas.

---

## Lots 2 à 4 : plans séparés, et pourquoi

La spec décrit quatre lots. Ce plan ne couvre que le premier, pour une raison
qui n'est pas de commodité : **le lot 1 va probablement changer ce que les
suivants doivent affirmer.**

Le balayage de l'étranger pose à 44 tables une question que personne ne leur a
jamais posée. S'il révèle qu'une table est lisible par tout compte connecté,
c'est une décision produit (« qui doit voir quoi »), et la réponse du PO
détermine l'invariant que le lot 2 devra écrire pour cette table. Rédiger
aujourd'hui les assertions du lot 2 reviendrait à écrire leur valeur attendue
avant d'avoir mesuré — exactement ce que cet audit reproche au reste du dépôt.

Le lot 1 est autonome et mergeable seul. Les lots 2 à 4 seront planifiés une
fois ses résultats connus.
