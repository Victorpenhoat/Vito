# Spec — Slice 5 : Recherche « Découverte »

> Épic « Refonte Resto + Hôtels » (directive `docs/design/restos-hotels-refonte-epic-directive.md`).
> Slice 5 de la roadmap. Suit la Slice 4 (carte combinée, PR #49, mergée). Maquettes : écrans
> « Recherche · Découverte » et « Recherche · Résultats » de `docs/design/Onglet_Resto.dc.html`.

## Objectif

Transformer l'onglet **Recherche** (qui héberge aujourd'hui le `PlaceSearch` minimal) en écran de
**découverte** : champ de recherche, **recherches récentes**, **« Explorer par envie »** (chips
cuisine), et **résultats** avec bouton **Ajouter** / badge **Ajouté**. S'appuie sur la recherche
Google existante. Brique générique (resto **et** hôtel).

## Décisions PO (validées le 2026-06-28)

1. **Recherches récentes = localStorage client** (MVP, aucune migration ; non synchronisé
   multi-appareils).
2. **Résultats légers** : nom + adresse + Ajouter/Ajouté. Pas de rating/vignette dans la liste
   (`searchPlaces` ne renvoie que `{placeId, nom, adresse}` ; rating/photo exigeraient un appel
   `details()` par résultat — coûteux/lent). L'enrichissement rating/photo reste fait **à l'ajout**.
3. **« Explorer par envie » = resto maintenant, hôtel en Slice 7** : config par catégorie (resto =
   cuisines ; hôtel = `[]` pour l'instant).
4. **Déclenchement par submit** (Entrée/bouton « Rechercher ») ; c'est ce moment qui enregistre la
   recherche récente. (Plus de recherche « au fil de la frappe ».)
5. **Résultats déjà possédés = badge « Ajouté »** (visibles, non masqués), conforme maquette.

## État de départ (après Slice 4 — vérifié)

- `PlacesTabs` (`src/features/places/ui/PlacesTabs.tsx`) : onglet Recherche rend
  `<PlaceSearch places={places} category={category} />`.
- `PlaceSearch` (`src/features/places/ui/PlaceSearch.tsx`) : champ debounce-on-type ; sections
  Favoris / À tester (via `splitSearch`) + Externes (Ajouter). **Seul `PlacesTabs` l'importe.**
- `splitSearch` (`src/features/restos/domain/splitSearch.ts` + test) : **utilisé uniquement par
  `PlaceSearch`** → deviendra mort.
- Actions (`src/features/restos/data/actions.ts`) : `searchPlaces(query): Promise<PlaceSummary[]>`
  (auth-gated, mock en test) ; `addResto`/`addHotel(_, FormData{placeId})` → upsert + enrichit
  rating/photo via `details()`.
- Types (`src/lib/services/places/types.ts`) : `PlaceSummary = { placeId; nom; adresse }` (search) ;
  `PlaceResult` (details) porte rating/photoRefs/etc.
- i18n namespace `places` : `add` (réutilisé pour « Ajouter »), et `search`, `resFavoris`,
  `resATester`, `resExternes` (utilisés **uniquement** par `PlaceSearch` → à retirer).
- e2e : `restos.spec.ts` et `hotels.spec.ts` utilisent `add-{resto,hotel}-search` (input),
  `search-result` (ligne), et le bouton Ajouter — dans un flux **on-type** (pas de submit).

## Architecture / composants

### 1. Domaine pur — `discovery.ts`

Nouveau **`src/features/places/domain/discovery.ts`** (importe les types `Place`, `PlaceSummary`) :

- `type Envie = { emoji: string; labelKey: string; query: string }`
- `function searchEnvies(category: "resto" | "hotel"): Envie[]` :
  - resto → `[ {🍷, envieCaveAManger, "cave à manger"}, {🐟, envieFruitsDeMer, "fruits de mer"},
    {🍝, envieItalien, "italien"}, {☕, envieBrunch, "brunch"} ]`
  - hotel → `[]` (Slice 7).
- `function markOwned(results: PlaceSummary[], places: Place[]): { result: PlaceSummary; owned: boolean }[]` :
  `owned = true` si `result.placeId` figure parmi les `place_id` des `places`. Préserve l'ordre.
- `function addRecent(list: string[], query: string, max = 5): string[]` : ajoute `query.trim()` en
  tête, dédupliqué (insensible casse via comparaison normalisée mais on conserve la casse saisie),
  plafonné à `max`. `query` vide → liste inchangée.
- `function removeRecent(list: string[], query: string): string[]` : retire l'entrée exacte.
- 100 % pur (aucun accès localStorage/React). TDD.

### 2. UI — `PlaceDiscovery` (nouveau, client)

Nouveau **`src/features/places/ui/PlaceDiscovery.tsx`** — remplace `PlaceSearch` dans l'onglet Recherche.

- Props : `{ places: Place[]; category: "resto" | "hotel" }`.
- État : `q` (champ), `results: PlaceSummary[]`, `recents: string[]` (init depuis localStorage),
  `addedIds: Set<string>` (ajouts optimistes), `addError`, `pending`.
- **localStorage** : clé scopée `vito.recents.{category}`. Lecture au montage (`useEffect`), écriture à
  chaque mutation via `addRecent`/`removeRecent`.
- **Recherche** : un `<form>` (input `data-testid="add-{resto|hotel}-search"` + bouton
  `data-testid="search-submit"` libellé `t("rechercher")`). `onSubmit` → `searchPlaces(q)` →
  `setResults`, et `recents = addRecent(recents, q)`.
- **État initial** (résultats vides et pas de recherche en cours) :
  - **Recherches récentes** (`data-testid="recents"`) si `recents.length>0` : chaque entrée
    (`data-testid="recent-item"`) cliquable (relance la recherche) + croix (`removeRecent`).
  - **Explorer par envie** (`data-testid="envies"`) : chips de `searchEnvies(category)`
    (`data-testid="envie-{…}"`, emoji + `t(labelKey)`), clic → `setQ(query)` puis lance la recherche.
- **Résultats** (`data-testid="search-result"` par ligne) : nom + adresse ; à droite, soit
  `<Button>Ajouter</Button>` (action `addResto`/`addHotel`), soit badge `t("ajoute")`
  (`data-testid="result-added"`) si `owned` (via `markOwned`) **ou** `addedIds.has(placeId)`. À
  l'ajout réussi : `addedIds.add(placeId)` (bascule optimiste ; la revalidation serveur met `places`
  à jour au prochain chargement).
- Tokens maison uniquement, `Link`/actions locale-aware. Aucune chaîne en dur.

### 3. Nettoyage

- Supprimer `src/features/places/ui/PlaceSearch.tsx`.
- Supprimer `src/features/restos/domain/splitSearch.ts` + `splitSearch.test.ts` (devenus morts).
- Retirer les clés i18n `search`, `resFavoris`, `resATester`, `resExternes` des 4 locales
  (`add` est conservé). Aucune autre référence (vérifié).

### 4. `PlacesTabs`

- Onglet Recherche → `<PlaceDiscovery places={places} category={category} />`. Remplacer l'import
  `PlaceSearch` par `PlaceDiscovery`. Reste inchangé.

### 5. i18n (4 locales, parité)

Ajouts au namespace `places` :
- `rechercher` (bouton « Rechercher »)
- `recherchesRecentes` (« Recherches récentes »)
- `explorerEnvie` (« Explorer par envie »)
- `ajoute` (badge « Ajouté »)
- `searchDecouvertePlaceholder` (« Nom, cuisine, ville… »)
- `envieCaveAManger`, `envieFruitsDeMer`, `envieItalien`, `envieBrunch`

Retraits : `search`, `resFavoris`, `resATester`, `resExternes`. Conservé : `add`.

## Tests

- **TDD domaine — `src/features/places/domain/discovery.test.ts`** :
  - `searchEnvies("resto")` non vide (4 envies, query non vide) ; `searchEnvies("hotel")` = `[]`.
  - `markOwned` : un résultat dont le `placeId` est possédé → `owned:true` ; sinon `false` ; ordre
    préservé.
  - `addRecent` : ajoute en tête ; dédup (même requête → pas de doublon, remontée en tête) ;
    plafond `max` ; requête vide → inchangé.
  - `removeRecent` : retire l'entrée ; absente → inchangé.
- **e2e — `e2e/places.spec.ts`** (onglet Recherche) :
  - submit « bistrot » (Entrée ou bouton) → au moins un `search-result` ; cliquer Ajouter →
    bascule en `result-added`.
  - après une recherche, `recents` contient l'entrée ; cliquer dessus relance (résultats).
  - `envies` rendues (au moins un `envie-*`).
- **e2e — `restos.spec.ts` / `hotels.spec.ts`** : adapter le flux d'ajout au **submit** (l'input
  `add-{resto,hotel}-search` existe toujours mais les résultats n'apparaissent qu'après submit) ;
  conserver les assertions de fond. Google Places mocké, aucune donnée prod touchée.

## Conventions Vito (rappel)

- Mobile-first PWA, App Router Next 16, RLS partout, `Link`/actions locale-aware, i18n 4 locales
  (parité), aucune chaîne en dur, aucun nouveau token. Google Places mocké en test ; `searchPlaces`
  auth-gated. localStorage = client only (pas de donnée serveur).
- TDD pour le domaine, e2e pour l'écran, review par task + review finale Opus, PR → CI verte →
  merge. **Aucune migration / pas de go-prod DB** dans cette slice.

## Sécurité

- `searchPlaces` reste auth-gated (évite l'abus anonyme de l'API payante). `addResto`/`addHotel`
  inchangés (RLS owner-only). Les recherches récentes (localStorage) ne contiennent que des chaînes
  saisies par l'utilisateur, côté client, jamais envoyées au serveur autrement que comme requête de
  recherche. Aucun nouveau verbe d'écriture serveur, aucune nouvelle surface RLS.

## Hors périmètre

- Rating/vignette/distance dans les résultats (résultats légers).
- Recherches récentes synchronisées multi-appareils (localStorage seul).
- « Explorer par envie » côté hôtel (ambiances) → Slice 7.
- Filtres prix/similaires (jamais au MVP). Archivage → Slice 6. Desktop → Slice 8. Polish → Slice 9.
