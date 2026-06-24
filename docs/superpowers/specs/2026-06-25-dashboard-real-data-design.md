# Dashboard — branchement des vraies données — Design

**Date :** 2026-06-25
**Statut :** Validé (direction + décisions). Plan à suivre.
**Branche :** `dashboard-data`

---

## 0. Contexte

Le dashboard d'accueil (`/accueil`, Slice C) affiche des **données mockées** (`src/features/accueil/mock.ts`).
On les remplace par de **vraies requêtes** RLS-scopées. La salutation est déjà réelle. Aucune migration
(toutes les colonnes existent).

## 1. Décisions de cadrage (validées)

| Widget | Source réelle |
|--------|---------------|
| KPI **nouveaux restos** ce mois | `liste_items` `added_at` ∈ mois courant (count) |
| KPI **vins goûtés** ce mois | `degustations` `deguste_le` ∈ mois courant (count) |
| KPI **dépenses voyage** ce mois | somme `depenses.montant_cents` où `date` ∈ mois courant |
| KPI **sorties** ce mois | `liste_items` `statut='visite'` ∧ `added_at` ∈ mois courant (count) — **approximation** : pas de timestamp de visite, on utilise `added_at` (dette notée) |
| À FAIRE **restos à tester** | `liste_items` `statut='a_faire'` (count) |
| À FAIRE **voyages à venir** | `voyages` `statut ∈ (planifie, confirme)` ∧ `date_debut ≥ aujourd'hui` (count) |
| À FAIRE **demandes conciergerie en attente** | `conciergerie_demandes` `statut ∈ (nouvelle, en_cours)` (count) — remplace « vins à racheter » (sans source) |
| **Découvertes** | `rechercheRestos(criteria)` (reco resto existante) — restos uniquement, top 3 |
| **Activité récente** | **union « éléments récents »** : derniers items de `liste_items`/`voyages`/`degustations`/`depenses`, triés par date, top ~6 (« ajouté », pas « modifié ») |
| Hero « X sorties ce mois » | = KPI sorties (même nombre) |

Tout est **RLS-scopé** (client de session) ; aucune donnée d'autrui. Pas de migration, pas de nouvel
écran.

## 2. Couche données (`src/features/accueil/data/queries.ts`)

- `monthRange(now: Date): { start: string; end: string }` — pur, testé : `start` = 1er du mois (ISO
  `YYYY-MM-DD`), `end` = 1er du mois suivant ; utilisé en `.gte(col, start).lt(col, end)`.
- `getDashboardData()` (server) — exécute toutes les requêtes en parallèle (`Promise.all`) et renvoie :
  ```ts
  {
    kpis: { sorties: number; nouveauxRestos: number; vinsGoutes: number; depensesVoyageCents: number },
    todo: { restosATester: number; voyagesAVenir: number; conciergerieEnAttente: number },
    discoveries: { title: string; source: string }[],   // top 3 via rechercheRestos
    activity: { type: "resto"|"voyage"|"vin"|"depense"; label: string; at: string }[], // top 6, triés desc
  }
  ```
  - Counts via `.select("id", { count: "exact", head: true })` + filtres ci-dessus ; RLS scope au user.
  - Dépenses : somme côté serveur (récupérer `montant_cents` du mois visible puis additionner, ou somme
    SQL) ; RLS via `can_access_groupe`.
  - Découvertes : `rechercheRestos` avec les goûts du user (`getGouts`) ou critères par défaut ; mapper
    `recos[0..3]` → `{ title: nom, source: ville ?? type }`.
  - Activité : 4 petites requêtes (dernier ~5 de chaque table avec le nom joint — établissement pour
    `liste_items`, `titre` pour `voyages`, vin pour `degustations`, `libelle` pour `depenses`) →
    `{ type, label, at }` ; fusion + tri `at` desc + top 6. Le **temps relatif** est formaté **dans le
    composant** via next-intl `format.relativeTime(new Date(at), now)` (la requête renvoie l'horodatage
    brut).

## 3. UI (`accueil/page.tsx` + `HeroCard` + sous-composants)

- La page appelle `getDashboardData()` (et garde la récupération du prénom). Passe `sorties` à `HeroCard`.
- KPI 2×2 : `Tile` avec les vraies valeurs ; `depensesVoyage` formaté en euros (`montant_cents`/100 +
  « € »).
- À FAIRE : 3 lignes (restos à tester, voyages à venir, conciergerie en attente) avec `Badge` = count.
- Découvertes : la vraie liste (titre + source) ; **état vide** → ligne `accueil.discoveries.vide`.
- Activité récente : la vraie liste (label + temps relatif) ; **état vide** → `accueil.activity.vide`.
- `mock.ts` est **supprimé**.

## 4. i18n (`accueil.*`, 4 locales)

- Renommer la 3ᵉ clé À FAIRE : retirer `todo.vinsARacheter`, ajouter `todo.conciergerieEnAttente`
  (« Demandes en attente » / EN « Pending requests » / IT « Richieste in sospeso » / ES « Solicitudes
  pendientes »).
- Ajouter `accueil.activity.vide` et `accueil.discoveries.vide` (« Rien pour l'instant » + trad).
- Labels d'activité par type si besoin (préfixe), sinon le `label` joint suffit.

## 5. Sécurité

- Toutes les requêtes via le client de session (RLS) : `liste_items`/`degustations` owner ;
  `voyages`/`depenses` via `can_access_voyage`/`can_access_groupe` ; `conciergerie_demandes` scope client.
  Aucune lecture transverse. Pas de migration, pas de RLS modifiée.

## 6. Tests

- **Unit (Vitest)** : `monthRange` (un jour donné → 1er du mois et 1er du mois suivant ; bornes
  fin/début de mois). (Le temps relatif vient de next-intl, non testé.)
- **e2e (Playwright)** : sur seed (db reset pose les `added_at`/dates à « maintenant » = mois courant) —
  `/accueil` affiche `kpi-tiles` (4 tuiles), les 3 lignes À FAIRE, la section Découvertes et
  `recent-activity` (peuplée ou état vide), `hero` avec « … sorties ce mois ». Les `data-testid`
  existants sont conservés ; l'e2e accueil existant reste vert (structure stable). Suite complète verte.
- Vérification visuelle prod/preview.

## 7. Arbitrages / dette signalés

- **« Sorties ce mois »** approximé via `added_at` (pas de timestamp de visite) → un vrai `visite_le`
  serait plus précis (futur).
- **Activité = « éléments récents »** (création/ajout), pas un journal de modifications (table d'audit +
  triggers = futur).
- **Découvertes vins** non branchées (pas de reco vin) — découvertes = restos seulement.
- Perf : ~10 requêtes en parallèle au chargement du dashboard (counts `head:true` peu coûteux) ;
  optimisation (RPC unique / vue) différée si besoin.
