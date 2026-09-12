# Filet RLS — Lot 2 : la profondeur

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vérifier ce que le socle du lot 1 ne peut pas deviner : que le co-membre légitime ACCÈDE, que le non-membre est REFUSÉ, et que voir une ligne ne donne pas le droit de l'écrire.

**Architecture :** Les 16 tables porteuses de la spec ne sont pas 16 cas. Relevé au catalogue, elles se rangent en **trois familles régies chacune par un prédicat unique** — `can_access_voyage`, `can_access_groupe`, `can_access_famille` — plus quatre cas particuliers. Les trois prédicats sont structurellement identiques (`owner OR membre`), donc le lot est un motif écrit trois fois, pas seize. Chaque famille reçoit ses propres fixtures, et **chaque assertion est bornée aux identifiants de ces fixtures** : les décomptes sont alors exacts sans être fragiles au seed ni à la contamination e2e.

**Tech Stack :** PostgreSQL 15, pgTAP, Supabase CLI (`supabase test db`), Docker.

**Spec :** `docs/superpowers/specs/2026-09-12-filet-rls-design.md` (§4)

## Global Constraints

- **Tout va dans `supabase/tests/rls_test.sql`.** Aucune migration, aucun seed, **aucune policy** modifiée : un accès trop ouvert est une décision produit à remonter au PO, jamais à corriger au passage.
- **Le bloc `-- SOCLE` doit rester le DERNIER contenu avant `select finish();`.** Tout ce que ce lot ajoute se place AVANT lui, sinon le balayage du lot 1 tourne avant les nouvelles fixtures et son garde-fou de vacuité échouera en nommant des tables que personne n'a touchées.
- **`select plan(n)` ligne 8 doit être exact.** Le nombre de départ DÉPEND de ce qui est dans main : 113 aujourd'hui, 126 si la PR #201 a été fusionnée entre-temps. Chaque tâche donne son **delta** ; l'implémenteur lit la valeur courante en ligne 8 et ajoute. Ne jamais recopier un nombre absolu depuis ce plan.
- **Les identités de référence**, toutes vérifiées au catalogue :
  - propriétaire des fixtures : `demo` = `de110000-0000-4000-8000-000000000000` (premium, donc `enforce_voyage_limit` ne le bloque pas)
  - co-membre : `client` = `11111111-1111-1111-1111-111111111111`
  - non-membre : `deadbeef-0000-4000-8000-000000000000`, l'uuid synthétique du lot 1 — aucun compte derrière, donc immunisé aux mutations de l'e2e
- **Toujours `npx supabase db reset` avant `npx supabase test db`** — mais seulement après un run e2e ou quand la base a dérivé, jamais par principe : la base Docker est partagée avec d'autres sessions, et un reset y efface les migrations absentes de ce worktree. Le pgTAP tourne dans sa propre transaction et n'exige pas une base fraîche.
- **Les mutations de preuve** s'appliquent à la base locale (`docker exec -i supabase_db_Vito psql -U postgres -d postgres -Atc "…"`) et sont annulées explicitement, `alter policy` par `alter policy` — pas par un reset.
- **Les constructions shell complexes** (fonctions, heredocs vers docker) sont refusées par un garde-fou dans ce worktree : commandes simples et séparées.

---

## File Structure

| Fichier | Responsabilité | Action |
|---|---|---|
| `supabase/tests/rls_test.sql` | L'intégralité du filet RLS | Modifier : `plan()` en tête, nouvelles sections avant le bloc `-- SOCLE` |

Aucun autre fichier n'est touché.

---

## Le motif, écrit une fois pour les trois familles

Les trois prédicats, relevés au catalogue, ne diffèrent que par le nom des tables :

```sql
-- can_access_voyage(v_id) / can_access_groupe(g_id) / can_access_famille(f_id)
select exists (select 1 from <porteuse> where id = $1 and owner_id = auth.uid())
    or exists (select 1 from <membres>  where <fk> = $1 and profile_id = auth.uid());
```

D'où trois invariants par famille, et un seul geste pour les écrire :

1. **le co-membre accède** — `tests.count_as(client, '… where <fk> = <id fixture>')` rend le compte attendu ;
2. **le non-membre est refusé** — la même requête sous l'uuid synthétique rend `0` ;
3. **voir ≠ écrire** — le co-membre VOIT la porteuse mais ne peut pas la SUPPRIMER (`*_delete` exige `is_*_owner`). Le motif est `with u as (delete … returning 1) select count(*) from u`, qui rend `0` quand la RLS filtre au lieu de lever.

**Pourquoi borner chaque décompte aux identifiants des fixtures.** Un décompte
absolu (« le co-membre voit 5 lignes ») encode l'état du seed et casse au premier
run e2e — c'est ce qui a rendu 85 des 120 assertions rouges dans une autre
branche le même jour. Un décompte borné à `where voyage_id = '<id fixture>'` dit
la même chose et survit à tout. On garde donc la précision du décompte sans sa
fragilité.

---

### Task 1 : Les fixtures des trois familles

**Files:**
- Modify: `supabase/tests/rls_test.sql` (insertion AVANT le commentaire `-- SOCLE`)

**Interfaces:**
- Produces: trois identifiants stables que les tâches 2 à 4 réutilisent verbatim —
  voyage `bb000000-0000-4000-8000-000000000001`,
  groupe `bb000000-0000-4000-8000-000000000002`,
  foyer : **celui que le lot 1 a déjà créé**, `fa000000-0000-4000-8000-000000000001`.

- [ ] **Step 1 : Écrire les fixtures**

À insérer juste avant le commentaire `-- SOCLE — balayages pilotés par le catalogue`, et APRÈS les fixtures du lot 1 (qui créent déjà le foyer) :

```sql
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

-- `role` est contraint à 'owner' ou 'membre' (CHECK) — pas 'voyageur'. Vérifié
-- au schéma le 2026-09-12, après qu'un premier jet s'y soit cassé.
insert into public.voyage_membres (voyage_id, profile_id, role)
values ('bb000000-0000-4000-8000-000000000001',
        '11111111-1111-1111-1111-111111111111', 'membre');

insert into public.reservations (voyage_id, created_by)
values ('bb000000-0000-4000-8000-000000000001',
        'de110000-0000-4000-8000-000000000000');

-- `voyage_documents` porte `uploaded_by` (et non `created_by`) et exige
-- `taille`, integer NOT NULL. Deux pièges qu'une requête sur les colonnes
-- obligatoires ne montre pas : elle ne dit ni les CHECK, ni les noms exacts.
insert into public.voyage_documents (voyage_id, nom, mime_type, contenu_chiffre, taille, uploaded_by)
values ('bb000000-0000-4000-8000-000000000001', 'pgtap.pdf', 'application/pdf', 'AAAA', 4,
        'de110000-0000-4000-8000-000000000000');

-- Deux voyageurs SANS COMPTE, rattachés à CE voyage. Ils ne servent aucune
-- assertion de lecture : ils sont la SOURCE de l'insert de preuve sur
-- `voyage_remboursements` (Task 2), dont la table est vide pour ce voyage et
-- qui doit donc être éprouvée en écriture. Sans eux, cet insert porte sur 0
-- ligne quelle que soit la policy — vert pour la mauvaise raison. Ajoutés en
-- cours de route (ronde de correction 1), cf. l'encadré ci-dessous.
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
```

> **Ce bloc a été corrigé APRÈS avoir été exécuté** (2026-09-12). Le premier jet
> portait `'voyageur'` comme rôle et `created_by` sur `voyage_documents` : les
> deux ont été rejetés par le schéma. La cause est une vérification sautée — pour
> le lot 1, les fixtures avaient été EXÉCUTÉES contre la base avant d'être
> écrites ici ; pour celui-ci, on s'était contenté d'une requête sur les colonnes
> `NOT NULL` sans défaut, qui ne montre **ni les contraintes CHECK, ni les noms
> de colonnes facultatives**. Le défaut est apparu exactement là où la
> vérification manquait.
>
> **Troisième correction, et la plus instructive : les deux
> `voyage_participants`.** Les deux premières n'étaient que des erreurs de
> schéma — bruyantes, rejetées à l'insert, corrigées en une minute. Celle-ci
> était silencieuse. Le plan d'origine n'avait AUCUNE ligne de
> `voyage_participants` rattachée au voyage de profondeur ; l'insert de preuve
> de Task 2 (`insert into voyage_remboursements … from voyage_participants p1,
> p2 where p1.id <> p2.id limit 1`) portait donc sur **zéro ligne source**, et
> rendait 0 quelle que soit la policy. Le `throws_ok` attendu ne levait pas, et
> l'assertion aurait pu être « ajustée » jusqu'au vert sans jamais éprouver la
> RLS. C'est la cinquième assertion creuse du chantier, et la seule qu'aucun
> message d'erreur n'aurait dénoncée : **un test d'écriture n'éprouve une
> policy que si la ligne à écrire est réellement constructible.** D'où les deux
> voyageurs ci-dessus, aux identifiants fixes (`…-00000000000b` / `…-0000000c`)
> que l'assertion nomme explicitement, plutôt qu'un `limit 1` sur une table qui
> peut être vide.

- [ ] **Step 2 : Vérifier que chaque insertion a bien créé sa ligne**

Aucune assertion n'est ajoutée par cette tâche (`plan` inchangé) — mais une insertion qui échouerait ferait tomber toute la suite, et une insertion qui n'insérerait rien passerait inaperçue. Lancer et lire :

```bash
npx supabase test db 2>&1 | tail -6
```

Attendu : le même nombre de tests qu'avant la tâche, `Result: PASS`. Si une insertion viole une contrainte, l'erreur SQL la nomme précisément — corriger l'insertion, jamais l'assertion.

Attendu AUSSI, et c'est un signal utile : le garde-fou de vacuité du lot 1 (dernière assertion du fichier) continue de passer. S'il rougissait, c'est qu'une de ces fixtures aurait vidé une table.

- [ ] **Step 3 : Commit**

```bash
git add supabase/tests/rls_test.sql
git commit -m "test(rls): le décor de la profondeur — un porteur, un co-membre, un étranger

Trois familles d'accès régies par trois prédicats structurellement identiques
(owner OR membre) : on monte le même décor trois fois plutôt que d'écrire seize
cas particuliers.

Tout est borné à des identifiants de fixtures. Les assertions qui suivent
compteront des lignes DE CE DÉCOR, jamais des totaux : un décompte absolu
encoderait l'état du seed et tomberait au premier run e2e."
```

---

### Task 2 : La famille « voyage » — 5 tables

**Files:**
- Modify: `supabase/tests/rls_test.sql`

**Interfaces:**
- Consumes: le voyage `bb000000-0000-4000-8000-000000000001` et ses lignes filles (tâche 1).

**Delta de plan : +11.** Lire la valeur en ligne 8 et ajouter 11.

- [ ] **Step 1 : Écrire les onze assertions**

À la suite des fixtures, toujours avant `-- SOCLE` :

```sql
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
-- en ÉCRITURE — un non-membre ne doit pas pouvoir y insérer. Insérer sous une
-- identité qui n'a pas accès rend 0 ligne (la clause WITH CHECK filtre) ou lève.
select is(tests.count_as('deadbeef-0000-4000-8000-000000000000',
          'with u as (insert into public.voyage_remboursements (voyage_id, de_participant_id, vers_participant_id, montant_cents, created_by) select ''bb000000-0000-4000-8000-000000000001'', p1.id, p2.id, 100, ''deadbeef-0000-4000-8000-000000000000'' from public.voyage_participants p1, public.voyage_participants p2 where p1.id <> p2.id limit 1 returning 1) select count(*) from u'),
          0::bigint, 'voyage_remboursements : un non-membre n''y insère rien');

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
```

> **L'ordre des deux dernières compte.** La suppression par le propriétaire
> détruit le voyage et ses lignes filles (cascade) ; elle doit donc venir en
> DERNIER de cette section. C'est aussi le témoin positif de la famille : sans
> elle, « le co-membre ne peut pas supprimer » serait satisfait par un voyage
> que personne ne peut supprimer.

- [ ] **Step 2 : Ajouter 11 au plan ligne 8**

- [ ] **Step 3 : Lancer**

```bash
npx supabase test db 2>&1 | tail -6
```

Attendu : `Result: PASS`. Si une assertion de « non-membre » rougit, **ne corrige aucune policy** : relève la table, lis sa policy (`select policyname, cmd, qual from pg_policies where tablename = '…'`) et remonte la question au PO.

- [ ] **Step 4 : Prouver que la section mord**

```bash
docker exec -i supabase_db_Vito psql -U postgres -d postgres -Atc \
  "alter policy voyage_documents_all on public.voyage_documents using (true);"
npx supabase test db 2>&1 | grep -iE "failed test|Result:"
```

Attendu : l'assertion « voyage_documents : un non-membre n'en voit aucune » échoue, nommée. Relever son numéro et le comparer au fichier réel — une preuve qui tombe sur une assertion antérieure ne prouve rien de ce qu'elle annonce. Restaurer :

```bash
docker exec -i supabase_db_Vito psql -U postgres -d postgres -Atc \
  "alter policy voyage_documents_all on public.voyage_documents using (can_access_voyage(voyage_id));"
```

- [ ] **Step 5 : Prouver la frontière lecture/écriture**

```bash
docker exec -i supabase_db_Vito psql -U postgres -d postgres -Atc \
  "alter policy voyages_delete on public.voyages using (can_access_voyage(id));"
npx supabase test db 2>&1 | grep -iE "failed test|Result:"
```

Attendu : « le co-membre VOIT mais ne peut pas SUPPRIMER » échoue — c'est la mutation qui donnerait le droit de suppression à tout co-membre. Restaurer :

```bash
docker exec -i supabase_db_Vito psql -U postgres -d postgres -Atc \
  "alter policy voyages_delete on public.voyages using (is_voyage_owner(id));"
```

- [ ] **Step 6 : Revérifier le vert, puis commit**

```bash
npx supabase test db 2>&1 | tail -4
git add supabase/tests/rls_test.sql
git commit -m "test(rls): famille voyage — voir un voyage n'est pas pouvoir le supprimer

Cinq tables suspendues à can_access_voyage. Le co-membre accède, le non-membre
est refusé, et la frontière que rien ne tenait jusqu'ici : voyages_delete exige
is_voyage_owner, donc un co-membre qui VOIT le voyage ne doit pas pouvoir
l'effacer.

L'assertion « le propriétaire, lui, peut supprimer » est le témoin positif de la
section : sans elle, « le co-membre ne peut pas » serait satisfait par un voyage
que personne ne peut supprimer."
```

---

### Task 3 : La famille « dépenses » — 4 tables

**Files:**
- Modify: `supabase/tests/rls_test.sql`

**Interfaces:**
- Consumes: le groupe `bb000000-0000-4000-8000-000000000002` et la dépense `bb000000-0000-4000-8000-00000000000a` (tâche 1).

**Delta de plan : +9.**

- [ ] **Step 1 : Écrire les neuf assertions**

```sql
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

-- remboursements : vide pour ce groupe, donc éprouvée en ÉCRITURE.
select is(tests.count_as('deadbeef-0000-4000-8000-000000000000',
          'with u as (insert into public.remboursements (groupe_id, de_profile_id, vers_profile_id, montant_cents, created_by) values (''bb000000-0000-4000-8000-000000000002'', ''11111111-1111-1111-1111-111111111111'', ''de110000-0000-4000-8000-000000000000'', 100, ''deadbeef-0000-4000-8000-000000000000'') returning 1) select count(*) from u'),
          0::bigint, 'remboursements : un non-membre n''y insère rien');
select is(tests.count_as('11111111-1111-1111-1111-111111111111',
          'with u as (insert into public.remboursements (groupe_id, de_profile_id, vers_profile_id, montant_cents, created_by) values (''bb000000-0000-4000-8000-000000000002'', ''11111111-1111-1111-1111-111111111111'', ''de110000-0000-4000-8000-000000000000'', 100, ''11111111-1111-1111-1111-111111111111'') returning 1) select count(*) from u'),
          1::bigint, 'remboursements : le co-membre, lui, peut en créer un');

-- VOIR N'EST PAS SUPPRIMER : depense_groupes_delete exige is_groupe_owner,
-- alors que l'UPDATE se contente de can_access_groupe. Un co-membre modifie
-- donc le groupe mais ne l'efface pas — asymétrie voulue, jamais testée.
select is(tests.count_as('11111111-1111-1111-1111-111111111111',
          'with u as (delete from public.depense_groupes where id = ''bb000000-0000-4000-8000-000000000002'' returning 1) select count(*) from u'),
          0::bigint, 'depense_groupes : le co-membre VOIT et MODIFIE, mais ne SUPPRIME pas');
```

> Les deux assertions `remboursements` forment une paire délibérée : le refus
> seul serait satisfait par une table où PERSONNE ne peut écrire. La seconde est
> son témoin positif.

- [ ] **Step 2 : Ajouter 9 au plan ligne 8**

- [ ] **Step 3 : Lancer**

```bash
npx supabase test db 2>&1 | tail -6
```

Attendu : `Result: PASS`. Même consigne qu'en tâche 2 sur une policy trop ouverte : relever, ne pas corriger.

- [ ] **Step 4 : Prouver que la section mord (le chemin le plus long)**

```bash
docker exec -i supabase_db_Vito psql -U postgres -d postgres -Atc \
  "alter policy depense_parts_all on public.depense_parts using (true);"
npx supabase test db 2>&1 | grep -iE "failed test|Result:"
```

Attendu : « depense_parts : un non-membre n'en voit aucune » échoue, nommée. Restaurer :

```bash
docker exec -i supabase_db_Vito psql -U postgres -d postgres -Atc \
  "alter policy depense_parts_all on public.depense_parts using (can_access_groupe((select depenses.groupe_id from depenses where depenses.id = depense_parts.depense_id)));"
```

Vérifier après restauration que la clause est bien revenue :

```bash
docker exec -i supabase_db_Vito psql -U postgres -d postgres -Atc \
  "select qual from pg_policies where tablename='depense_parts';"
```

- [ ] **Step 5 : Revérifier le vert, puis commit**

```bash
npx supabase test db 2>&1 | tail -4
git add supabase/tests/rls_test.sql
git commit -m "test(rls): famille dépenses — modifier n'est pas supprimer

Quatre tables suspendues à can_access_groupe, dont depense_parts qui ne porte
pas le groupe et le rejoint par la dépense : le chemin le plus long du schéma,
donc celui qui se casse le plus discrètement.

L'asymétrie voulue et jamais testée : depense_groupes_delete exige
is_groupe_owner là où l'UPDATE se contente de can_access_groupe. Un co-membre
modifie le groupe, il ne l'efface pas.

Les deux assertions remboursements forment une paire : le refus seul serait
satisfait par une table où personne ne peut écrire."
```

---

### Task 4 : La famille « cercle » — 3 tables

**Files:**
- Modify: `supabase/tests/rls_test.sql`

**Interfaces:**
- Consumes: le foyer `fa000000-0000-4000-8000-000000000001` (créé au lot 1, co-membre ajouté en tâche 1).

**Delta de plan : +7.**

- [ ] **Step 1 : Écrire les sept assertions**

```sql
-- ── Lot 2 / famille CERCLE (can_access_famille) ────────────────────────────
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

-- VOIR N'EST PAS SUPPRIMER : familles_delete exige is_famille_owner.
select is(tests.count_as('11111111-1111-1111-1111-111111111111',
          'with u as (delete from public.familles where id = ''fa000000-0000-4000-8000-000000000001'' returning 1) select count(*) from u'),
          0::bigint, 'familles : le co-membre VOIT mais ne peut pas SUPPRIMER le foyer');
```

- [ ] **Step 2 : Ajouter 7 au plan ligne 8**

- [ ] **Step 3 : Lancer**

```bash
npx supabase test db 2>&1 | tail -6
```

Attendu : `Result: PASS`.

> **Si `famille_restos` rend 0 au lieu de 1**, ce n'est pas la RLS : c'est que
> la fixture du lot 1 y a mis sa ligne avec un `insert … select … limit 1` sur
> `etablissements`. Vérifier que la ligne existe (`select count(*) from
> famille_restos where famille_id = 'fa000000-…-0001'` hors RLS) avant de
> soupçonner une policy.

- [ ] **Step 4 : Prouver que la section mord**

```bash
docker exec -i supabase_db_Vito psql -U postgres -d postgres -Atc \
  "alter policy famille_restos_all on public.famille_restos using (true);"
npx supabase test db 2>&1 | grep -iE "failed test|Result:"
```

Attendu : « famille_restos : un non-membre n'en voit aucune » échoue, nommée. Restaurer :

```bash
docker exec -i supabase_db_Vito psql -U postgres -d postgres -Atc \
  "alter policy famille_restos_all on public.famille_restos using (can_access_famille(famille_id));"
```

- [ ] **Step 5 : Revérifier le vert, puis commit**

```bash
npx supabase test db 2>&1 | tail -4
git add supabase/tests/rls_test.sql
git commit -m "test(rls): famille cercle — le troisième et dernier visage du même prédicat

familles, famille_membres, famille_restos suspendues à can_access_famille. Le
foyer est celui du lot 1 : famille_membres porte un UNIQUE(profile_id), donc
demo ne peut pas en posséder deux — on réutilise plutôt que de dupliquer.

Avec les lots voyage et dépenses, les trois prédicats owner-OR-membre du schéma
sont désormais tenus par des assertions, et non par la lecture de leur code."
```

---

### Task 5 : Les quatre cas particuliers

**Files:**
- Modify: `supabase/tests/rls_test.sql`

**Delta de plan : +9.**

Ces quatre tables ne suivent aucun des trois prédicats. Chacune a sa propre règle, et `etablissements` réserve une surprise relevée au catalogue : **elle n'a aucune policy d'écriture**.

- [ ] **Step 1 : Écrire les neuf assertions**

```sql
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
```

- [ ] **Step 2 : Ajouter 9 au plan ligne 8**

- [ ] **Step 3 : Lancer**

```bash
npx supabase test db 2>&1 | tail -6
```

Attendu : `Result: PASS`.

- [ ] **Step 4 : Prouver l'invariant d'`etablissements`**

C'est la preuve la plus importante de la tâche, parce que l'invariant repose sur une absence :

```bash
docker exec -i supabase_db_Vito psql -U postgres -d postgres -Atc \
  "create policy pgtap_etab_write on public.etablissements for update to authenticated using (true) with check (true);"
npx supabase test db 2>&1 | grep -iE "failed test|Result:"
```

Attendu : « etablissements : un compte connecté ne modifie pas le catalogue » échoue, nommée. C'est exactement le geste de distraction que l'assertion existe pour attraper. Restaurer :

```bash
docker exec -i supabase_db_Vito psql -U postgres -d postgres -Atc \
  "drop policy pgtap_etab_write on public.etablissements;"
```

- [ ] **Step 5 : Prouver l'isolation de `subscriptions`**

```bash
docker exec -i supabase_db_Vito psql -U postgres -d postgres -Atc \
  "alter policy subscriptions_select_own on public.subscriptions using (true);"
npx supabase test db 2>&1 | grep -iE "failed test|Result:"
```

Attendu : « subscriptions : personne ne voit l'abonnement d'un autre » échoue. Restaurer :

```bash
docker exec -i supabase_db_Vito psql -U postgres -d postgres -Atc \
  "alter policy subscriptions_select_own on public.subscriptions using (user_id = (select auth.uid()));"
```

- [ ] **Step 6 : Revérifier le vert et l'état des policies, puis commit**

```bash
docker exec -i supabase_db_Vito psql -U postgres -d postgres -Atc \
  "select tablename, policyname, cmd, qual from pg_policies where tablename in ('etablissements','subscriptions') order by 1,3;"
npx supabase test db 2>&1 | tail -4
git add supabase/tests/rls_test.sql
git commit -m "test(rls): les quatre exceptions au motif, dont une inversée

agence_clients est symétrique (les deux parties voient), subscriptions et avis
sont strictement personnels — l'argent et le jugement ne se partagent pas.

etablissements est le cas inversé, et le plus fragile : lisible par tout compte
connecté, il n'a AUCUNE policy d'écriture. Son invariant ne tient donc qu'à une
ABSENCE, et une absence s'ajoute par distraction. Deux assertions la gravent, et
la preuve consiste justement à créer la policy d'écriture manquante pour
vérifier qu'elles la voient."
```

---

## Ce que ce lot ne fait pas

- **Les 37 fonctions `SECURITY DEFINER`** restent hors filet : c'est l'objet des lots 3 et 4, qui seront planifiés après celui-ci.
- **Les six tables satellites** (`liste_item_tags`, `activite_tags`, `activite_paiements`, `activite_creneau_exceptions`, `depense_groupe_membres`, `conciergerie_demandes`) s'en tiennent au socle du lot 1 : leur accès dérive d'un parent déjà testé ici, et leur donner des assertions propres serait du remplissage.
- **Aucune policy n'est corrigée.** Si une assertion de « non-membre » rougit, c'est une décision produit : relever, documenter, remonter au PO.
