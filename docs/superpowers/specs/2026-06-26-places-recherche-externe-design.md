# Épic places — Slice Recherche externe priorisée — Design

**Date :** 2026-06-26
**Statut :** Validé (décisions épic + PO). Plan à suivre.
**Branche :** `places-recherche-externe`
**Directive :** `docs/design/places-epic-directive.md` · **Style :** Le Carnet

---

## 0. Contexte

`RestoSearch` (recherche d'ajout sur l'écran Restos) appelle aujourd'hui `searchPlaces` (Google/mock)
et liste des résultats externes addables en 1 clic. Cette slice la transforme en **recherche
priorisée** : d'abord **tes favoris** qui matchent, puis tes **« à tester »**, puis les **résultats
Google** (dédoublonnés). **Sans migration** (`place_id` déjà sur `etablissements`).

## 1. Contraintes e2e (`restos.spec.ts` — vert sans modification)

Préserver `add-resto-search`, `search-result` (sur les **résultats externes** addables, avec bouton
d'ajout), `add-resto-error`. Le parcours (taper « bistrot » → 1er `search-result` → clic bouton →
« Le Bistrot du Coin » ajouté → onglet À tester) reste vert : les externes conservent `search-result`
+ bouton. `addResto` inchangé.

## 2. Données (`getPlaces` + `Place`)

- `Place.etablissement` gagne `place_id: string | null` (pour le dédoublonnage des externes).
- `getPlaces` : ajouter `place_id` à l'embed `etablissements`. Pas de migration.

## 3. Domaine (`src/features/restos/domain/splitSearch.ts`)

Helper pur **`splitSearch(query, places, externals)`** → `{ favoris: Place[]; aTester: Place[];
externes: PlaceSummary[] }` (testable) :
- `matched = filterPlaces(places, query)` (réutilise le helper places : nom/ville/tag, insensible
  casse/accents).
- `favoris = matched.filter(is_favorite)` ; `aTester = matched.filter(!is_favorite && statut===
  'a_faire')` (un favori a_faire reste en favoris, pas de doublon ; visités exclus, conforme
  directive favoris→à tester→Google).
- `ownedPlaceIds = Set(places.map(p => p.etablissement.place_id).filter(Boolean))` ;
  `externes = externals.filter(e => !ownedPlaceIds.has(e.placeId))`.
- `query` vide → `{ favoris: [], aTester: [], externes: [] }` (rien tant qu'on n'a pas tapé).

(`PlaceSummary = { placeId, nom, adresse }` — type existant du provider.)

## 4. UI (`RestoSearch` + page Restos)

- **Page Restos** : passe `places` (déjà chargées via `getPlaces("resto")`) à `RestoSearch`.
- **`RestoSearch`** (`{ places }`) : à la frappe, `setExternals(await searchPlaces(q))` ; calcule
  `splitSearch(q, places, externals)`. Rend trois sections (si non vides) :
  - **Favoris** (`SectionLabel` `restos.resFavoris`) : lignes `owned-result` = lien `/restos/{id}`
    (nom + ville/type) — déjà dans la liste.
  - **À tester** (`restos.resATester`) : idem `owned-result`.
  - **Externes** (`restos.resExternes`) : lignes **`search-result`** (conservé) = nom + adresse +
    **bouton ajout** (`addResto`, flux inchangé : reset résultats + `add-resto-error` en cas d'échec).
- `add-resto-search` conservé. Re-skin Le Carnet (inputs `rounded-control`, sections `SectionLabel`).

## 5. i18n (`restos.*`, 4 locales)

Ajouts : `restos.resFavoris` (« Tes favoris »), `restos.resATester` (« À tester »), `restos.resExternes`
(« Ajouter depuis Google »). EN « Your favorites »/« To try »/« Add from Google » ; IT « I tuoi
preferiti »/« Da provare »/« Aggiungi da Google » ; ES « Tus favoritos »/« Por probar »/« Añadir
desde Google ». Pas de chaîne en dur.

## 6. Sécurité

- `searchPlaces` garde déjà l'auth (API payante). Lecture seule sur `places`. `addResto` (RPC
  security-definer) inchangé. Aucune migration, aucune nouvelle exposition (le dédoublonnage est
  client à partir des `place_id` déjà rendus à l'utilisateur propriétaire).

## 7. Tests

- **Unit** : `splitSearch` (favoris/à tester priorisés sans doublon ; dédoublonnage externes par
  place_id ; query vide → vide ; visités exclus). `filterPlaces` inchangé. typecheck+lint+test verts ;
  parité i18n verte (3 clés × 4).
- **e2e** : `restos.spec.ts` **vert sans modification** (`add-resto-search` → 1er `search-result`
  externe → bouton → ajout). Suite complète verte. Un `db reset` avant.
- **Build** : OK.

## 8. Arbitrages / dette

- **Visités** non inclus dans les sections priorisées (directive favoris→à tester→Google) ;
  ajustable plus tard.
- Le matching des places perso réutilise `filterPlaces` (nom/ville/tag) ; pas de recherche serveur
  full-text (liste perso bornée).
- Dédoublonnage par `place_id` : un resto perso sans `place_id` (rare) ne dédoublonne pas un externe
  homonyme — acceptable.
