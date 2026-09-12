# Filet RLS — combler les trous mesurés par l'audit

**Date :** 2026-09-12
**Origine :** audit du filet de tests du 2026-09-11 (voir `memory/vito-audit-tests-2026-09`)

## 1. Le problème, mesuré

La RLS est la frontière de sécurité de Vito : les routes d'API et les actions
serveur lui délèguent explicitement le contrôle d'accès (« RLS owner-only : un
non-owner n'obtient aucune ligne → 404 »). Ce que ces commentaires affirment
n'est vérifié qu'à moitié.

`supabase/tests/rls_test.sql` couvre **26 des 48 tables**. Les 22 absentes :

```
activite_creneau_exceptions  activite_paiements   activite_tags
agence_clients               avis                 conciergerie_demandes
depense_groupe_membres       depense_groupes      depense_parts
depenses                     etablissements       famille_membres
famille_restos               familles             liste_item_tags
remboursements               reservations         subscriptions
voyage_documents             voyage_membres       voyage_remboursements
voyages
```

**Preuve par mutation, avec témoin** (base locale, restaurée ensuite) :

| Mutation | Résultat pgTAP |
|---|---|
| Témoin — `liste_items` ouvert à tous (table couverte) | **ÉCHOUE** (4 tests) |
| `voyages` ouvert à tous | **PASSE** |
| `voyage_documents` ouvert à tous | **PASSE** |

Le filet fonctionne là où il regarde. Il ne regarde simplement pas.

**Côté fonctions :** 52 fonctions `SECURITY DEFINER` existent, **37 ne sont
citées par aucun test** (28 appelables + 9 fonctions de déclencheur). Elles
contournent la RLS par construction : si elles ne vérifient pas elles-mêmes,
plus rien ne le fait.

> Correction d'un chiffre annoncé en séance : « 21 sur 48 » venait d'un
> échantillon de 27 noms. Le compte exact, tiré du catalogue, est 37 sur 52.

**Pourquoi l'e2e ne rattrape pas.** Il attrape parfois, mais **par accident** :
l'ouverture de `voyages` a fait rougir la suite via une *strict mode violation*
(le voyage « Rome » d'un autre compte a fait matcher deux éléments), pas via une
assertion d'isolation. Or la suite emploie `.first()` 148 fois — l'idiome exact
qui éteint cette collision, et que la ligne 16 du même fichier utilise déjà. Une
détection accidentelle ne se compte pas comme une couverture.

## 2. Objectif

Qu'une policy ouverte par erreur — sur n'importe quelle table, **y compris une
table qui n'existe pas encore** — fasse échouer `supabase test db`.

### Non-objectifs

- Réécrire ou optimiser les policies existantes. Ce chantier **mesure** ; il ne
  refactorise pas. (Voir la réserve §7 : il produira sans doute des correctifs,
  mais chacun sera une décision explicite.)
- Couvrir la logique métier des fonctions. On teste **qui a le droit**, pas ce
  qu'elles calculent.
- Toucher aux tests unitaires ou e2e.

## 3. Conception — le socle

### 3.1 Deux balayages agrégés

Plutôt qu'une assertion par table (plan dynamique, échec illisible), **une
assertion par balayage**. Une fonction parcourt `pg_tables`, collecte les tables
fautives, et le test compare cette liste au tableau vide :

```sql
select is( tests.tables_vues_par_anon(),     '{}'::text[],
           'anon ne voit aucune ligne, nulle part' );
select is( tests.tables_vues_par_etranger(), '{}'::text[],
           'un compte sans lien ne voit aucune ligne d''autrui' );
select cmp_ok( tests.nb_tables_balayees(), '>=', 48,
           'le balayage couvre bien tout le schéma' );
```

Le plan reste fixe, et un échec **nomme les tables coupables** — pas besoin de
décoder un numéro d'assertion.

### 3.2 Le garde-fou est non négociable

La troisième assertion existe parce que sans elle, un filtre trop zélé (un
`where` mal écrit, un schéma renommé) rendrait les deux premières vertes **en ne
balayant rien**. C'est le motif exact des « tests vides » : le test reproduit la
garde qu'il prétend éprouver. 48 est le compte actuel, vérifié au catalogue.

### 3.3 Le « compte étranger »

`free@vito.test` (`44444444…`) ne partage rien avec personne — c'est déjà ce que
dit le seed. L'invariant est donc uniforme et n'exige aucune connaissance de la
colonne propriétaire de chaque table : **un compte sans aucun lien voit zéro
ligne**, partout.

### 3.4 Exceptions déclarées

Une liste explicite, chaque entrée justifiée en commentaire dans le code :

| Table | Ce que l'étranger voit | Pourquoi |
|---|---|---|
| `etablissements` | tout | `SELECT USING (true)` — catalogue partagé, assumé |
| `vacances_scolaires` | tout | calendrier public pour qui est connecté |
| `tags` | les tags système (`user_id is null`) | vocabulaire commun |
| `profiles` | sa propre ligne | `id = auth.uid()` |

Toute table qui voudra rejoindre cette liste devra s'expliquer en revue. C'est
le point de friction délibéré du dispositif.

## 4. Conception — la profondeur

16 tables porteuses, celles dont la règle est trop subtile pour le socle. Pour
chacune, **ceux de ces trois invariants qui ont un sens** — une table owner-only
comme `subscriptions` n'a pas de co-membre, et on n'inventera pas d'assertion
pour faire nombre :

1. le co-membre légitime **accède** ;
2. le non-membre est **refusé** ;
3. voir une ligne ne donne pas le droit de l'**écrire** (la frontière de lecture
   et celle d'écriture sont distinctes, et rien ne les tient aujourd'hui).

`etablissements` est le cas particulier à ne pas confondre : il figure en
exception du socle **en lecture** (catalogue partagé, §3.4) et en profondeur
**en écriture** — n'importe qui le lit, personne ne doit le modifier hors
`upsert_etablissement`.

```
voyages        voyage_membres     voyage_documents   voyage_remboursements
depenses       depense_groupes    depense_parts      remboursements
familles       famille_membres    famille_restos     agence_clients
subscriptions  avis               reservations       etablissements
```

Les tables satellites restantes (`liste_item_tags`, `activite_tags`,
`activite_paiements`, `activite_creneau_exceptions`, `depense_groupe_membres`,
`conciergerie_demandes`) s'en tiennent au socle : leur accès dérive d'un parent
déjà testé.

## 5. Conception — les 37 fonctions

Trois familles, trois invariants différents. Les traiter pareil serait du
remplissage.

**Prédicats (10)** — `can_access_famille`, `can_access_groupe`,
`est_mon_activite`, `is_agence`, `is_concierge`, `is_famille_owner`,
`is_groupe_membre`, `is_groupe_owner`, `is_premium`, `is_voyage_owner`.
Ils ne « refusent » pas, ils répondent. Invariant : **rendent `false` pour un
étranger**, `true` pour l'ayant droit. Le lot 2 les exerce déjà indirectement
via les policies ; ce test les tient directement.

**À effet (18)** — `cache_etablissement_photo`, `cancel_subscription`,
`creer_voyage_pour_client`, `delier_client`, `find_or_create_vin`,
`inviter_famille`, `lier_client`, `mes_connexions_recentes`, `mock_subscribe`,
`purger_comptes_supprimes`, `quitter_famille`, `retirer_membre_famille`,
`revoquer_autres_sessions`, `share_groupe`, `share_voyage`, `unshare_groupe`,
`unshare_voyage`, `upsert_etablissement`.
Invariant de socle : **appelée par qui n'y a pas droit, elle refuse** — elle
lève, ou n'affecte aucune ligne.

**Déclencheurs (9)** — `add_famille_owner_membre`, `add_groupe_owner_membre`,
`add_voyage_owner_membre`, `conciergerie_lock_insert`,
`depense_groupes_lock_owner`, `enforce_voyage_limit`, `familles_lock_owner`,
`handle_new_user`, `voyages_lock_owner`.
Ils ne s'appellent pas : on teste leur **effet**. Le verrou d'`owner` empêche-t-il
de se réattribuer un voyage ? `enforce_voyage_limit` arrête-t-il le compte
gratuit à sa limite ?

**Profondeur sur les 8 qui élargissent l'accès** — `share_voyage`,
`unshare_voyage`, `share_groupe`, `unshare_groupe`, `lier_client`,
`delier_client`, `inviter_famille`, `retirer_membre_famille`. Pour chacune :
l'autorisé réussit, le non-autorisé échoue, **et l'effet en base est celui
annoncé**. Sans ce troisième point, une fonction cassée qui refuse tout le monde
resterait verte.

## 6. Organisation — un seul fichier

`supabase test db` exécute chaque fichier `.sql` dans **sa propre transaction** :
les helpers `tests.count_as` / `tests.count_as_anon` créés dans l'un n'existent
pas dans l'autre. Découper en quatre fichiers imposerait de les dupliquer quatre
fois, avec dérive garantie — deux copies d'un helper de sécurité qui divergent,
c'est précisément le défaut que ce chantier corrige ailleurs (le masque du
Cercle avait dérivé de celui des Activités pour cette raison).

**Décision : `rls_test.sql` grossit** (721 → ~1100 lignes), en sections
nettement délimitées, avec le `plan(n)` tenu à jour en tête. C'est un gros
fichier, et c'est le moindre mal.

## 7. Réserve à porter au PO

Le lot 1 va probablement **rougir dès sa première exécution**, sur des tables
dont personne n'a relu les policies depuis leur écriture. C'est le but. Mais
cela signifie que ce chantier peut accoucher de correctifs de policies — donc de
décisions produit (« qui doit voir quoi ») qui reviendront au PO, et non de
simples corrections techniques. Chaque écart trouvé sera présenté comme une
question, pas corrigé d'office.

## 8. Les lots

| Lot | Contenu | Pourquoi cet ordre |
|---|---|---|
| **1** | Socle : 2 balayages, garde-fou, exceptions déclarées | Attrape à lui seul la classe de défaut prouvée |
| **2** | Profondeur sur les 16 tables porteuses | Là où la règle est subtile et le socle muet |
| **3** | Socle des fonctions : prédicats, refus, déclencheurs | `SECURITY DEFINER` contourne la RLS |
| **4** | Profondeur sur les 8 fonctions de partage | Celles qui élargissent l'accès en silence |

Chaque lot est une PR autonome et mergeable seule.

## 9. Méthode de preuve

Pour chaque lot, et pour chaque invariant qui compte :

1. affaiblir la policy ou la fonction visée (sur la base locale, jamais dans une
   migration) ;
2. lancer `supabase test db` et vérifier que l'échec tombe **sur l'assertion
   visée**, pas sur une antérieure — en relevant le nom et le numéro du test
   échoué, comparés au fichier réel ;
3. restaurer (`supabase db reset`) et remontrer le vert.

Une preuve qui tombe sur une assertion antérieure ne prouve rien de ce qu'elle
annonce. Recopier les deux sorties dans la PR.

**Piège d'ordonnancement connu :** lancer `test:e2e` avant `test:rls` fausse le
pgTAP (base locale partagée, données mutées par l'e2e). Toujours
`supabase db reset` avant. La CI le fait déjà dans le bon ordre.

## 10. Critères d'acceptation

- `supabase test db` vert, `plan(n)` exact.
- Chacune des 48 tables est couverte par le socle, ou figure dans la liste
  d'exceptions avec sa justification écrite.
- Le garde-fou échoue si le balayage voit moins de 48 tables — vérifié en le
  cassant délibérément.
- Les mutations `voyages` et `voyage_documents` de l'audit font désormais
  **échouer** le pgTAP.
- Aucune modification de policy livrée sans décision explicite du PO.
