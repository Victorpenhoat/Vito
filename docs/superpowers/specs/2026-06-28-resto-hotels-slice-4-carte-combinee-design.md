# Spec — Slice 4 : Carte combinée

> Épic « Refonte Resto + Hôtels » (directive `docs/design/restos-hotels-refonte-epic-directive.md`).
> Slice 4 de la roadmap. Suit la Slice 3 (restructure IA, PR #48, mergée). Maquette de référence :
> écran « Carte combinée » de `docs/design/Onglet_Resto.dc.html`.

## Objectif

Doter l'onglet **Carte** d'une carte combinée dédiée : favoris + recommandés sur une même carte,
avec **pins distincts par statut** (favori vs recommandé), une **légende**, un **filtre par tag**
(chips, single-select), et un **comptage** d'adresses. Brique générique, appliquée resto **et** hôtel.

## Décisions PO (validées le 2026-06-28)

1. **Axe des pins = Favoris vs Recommandés** : pin **plein** = favori ; pin **contour** = recommandé
   (`statut='a_faire'` non-favori). La catégorie est constante dans un onglet (page resto → carte
   resto) donc non distinguée. Conforme à la légende de la maquette.
2. **Filtre par tag = single-select** : un seul tag actif à la fois, ou « Tous ». Conforme maquette.
3. **Filtres + légende + comptage sur l'onglet Carte combinée uniquement** : un composant enrichi
   dédié. La vue « Carte » de l'onglet Favoris reste des pins simples (`PlacesMap` de base).

## État de départ (après Slice 3 — vérifié)

- `Place` (`src/features/places/domain/filterPlaces.ts`) : `id, statut, is_favorite, reco_source,
  etablissement{…, categorie, lat, lng, …}, tags: { slug; label; color }[]`.
- `PlacesTabs` (`src/features/places/ui/PlacesTabs.tsx`) : onglet **Carte** rend
  `<PlacesMapLazy places={cartePlaces} locale=… />` où `cartePlaces` = union favoris+recommandés
  dédupliquée par `id`.
- `PlacesMap` (`src/features/places/ui/PlacesMap.tsx`) : `{ places: Place[]; locale: string }`.
  - `pin(favorite)` : **or** (`var(--gold)`) si favori, **accent** (`var(--accent)`) sinon — pin plein
    dans les deux cas.
  - **Bug** : le popup lie en dur `href={\`/${locale}/restos/${id}\`}` → cassé pour les hôtels.
  - Filtre `withCoords` (lat/lng non nuls) ; message `sansLocalisation` pour les exclus.
- `PlacesMapLazy` (`src/features/places/ui/PlacesMapLazy.tsx`) : wrapper `dynamic(..., {ssr:false})`.
- `mapCenter` (`src/features/places/domain/mapCenter.ts`) : centre moyen, Paris par défaut.
- i18n namespace `places` (4 locales) : contient `favoris`, `recommandes`, `vueCarte`,
  `sansLocalisation` ({n}). **Ne contient plus** `tous` (retiré en Slice 3).
- e2e `e2e/places.spec.ts` : la bascule vue Carte (Favoris) assure `places-map` visible.

## Architecture / composants

### 1. Domaine pur — `mapFilters`

Nouveau fichier **`src/features/places/domain/mapFilters.ts`** (pur, importe le type `Place`) :

- `function tagsForMap(places: Place[]): { slug: string; label: string }[]` :
  tags uniques (dédupliqués par `slug`) présents sur l'ensemble, triés par `label` (ordre stable,
  comparaison locale-insensible simple via `localeCompare`). Sert à construire les chips.
- `function filterByTag(places: Place[], slug: string | null): Place[]` :
  `slug === null` → renvoie `places` tel quel ; sinon les places dont `tags` contient un tag de ce `slug`.
- 100 % pur. TDD.

### 2. `PlacesMap` étendu

**`src/features/places/ui/PlacesMap.tsx`** :

- **Bug fix popup** : remplacer le `href` codé en dur par une base catégorie-aware —
  `const base = p.etablissement.categorie === "hotel" ? "hotels" : "restos";` puis
  `href={\`/${locale}/${base}/${p.etablissement.id}\`}`.
- **Pins distincts** : `pin(favorite)` rend désormais deux styles —
  - favori → disque **plein or** (`var(--gold)`, style actuel) ;
  - non-favori (recommandé) → disque **contour accent** (fond blanc/transparent, bordure
    `var(--accent)`), pour matérialiser « recommandé ».
- Reste inchangé (withCoords, mapCenter, sansLocalisation). Bénéficie aux deux usages (Favoris carte
  view + Carte combinée).

### 3. `PlacesMapCombined` (nouveau)

Nouveau **`src/features/places/ui/PlacesMapCombined.tsx`** (client) — utilisé par l'onglet Carte :

- Props : `{ places: Place[]; locale: string }`.
- État : `selectedTag: string | null` (défaut `null`).
- **Chips de filtre** (`data-testid="map-tag-filter"`) : un chip `Tous` (`data-testid="map-tag-tous"`,
  actif quand `selectedTag === null`) suivi d'un chip par tag de `tagsForMap(places)`
  (`data-testid="map-tag-{slug}"`, `aria-pressed`). Single-select : cliquer un tag le sélectionne ;
  re-cliquer « Tous » réinitialise.
- **Légende** (`data-testid="map-legend"`) : Favoris (pastille pleine or) + Recommandés (pastille
  contour accent), libellés `t("favoris")` / `t("recommandes")`.
- **Comptage** (`data-testid="map-count"`) : `t("adressesCount", { n: filtered.length })` où
  `filtered = filterByTag(places, selectedTag)`.
- Rend `<PlacesMapLazy places={filtered} locale={locale} />`.
- Tokens maison uniquement (chips actifs `bg-accent text-white` / inactifs `border-line text-muted`,
  `rounded-control`/`rounded-card`).

### 4. `PlacesTabs`

**`src/features/places/ui/PlacesTabs.tsx`** : l'onglet Carte rend
`<PlacesMapCombined places={cartePlaces} locale={locale} />` au lieu de `<PlacesMapLazy .../>`.
(Pas besoin de wrapper lazy : `PlacesMapCombined` n'importe pas Leaflet directement — il rend
`PlacesMapLazy` en interne.) Le reste de `PlacesTabs` inchangé.

### 5. i18n (4 locales, parité)

Ajouts au namespace `places` :
- `tagTous` : « Tous » (chip filtre tous tags).
- `adressesCount` : « {n} adresses ».

Réutilisés (existants) : `favoris`, `recommandes` (légende), `sansLocalisation`, `vueCarte`.

## Tests

- **TDD domaine — `src/features/places/domain/mapFilters.test.ts`** :
  - `tagsForMap` : dédup par slug (deux places partageant un tag → une seule entrée), tri par label,
    liste vide si aucun tag.
  - `filterByTag(places, null)` → toutes les places.
  - `filterByTag(places, "bistrot")` → uniquement celles portant ce slug.
- **e2e — `e2e/places.spec.ts`** (ajout, onglet Carte) :
  - cliquer `tab-carte` → `places-map` + `map-legend` + `map-tag-filter` visibles ; `map-count`
    affiche le nombre d'adresses.
  - cliquer un chip de tag puis « Tous » : `map-count` change en conséquence (filtre actif).
  - Seed : doter le resto seedé (« Le Bistrot Démo ») de **coordonnées** (lat/lng) et d'un **tag**
    (via `liste_item_tags`) pour un test de filtre/pin significatif (détails dans le plan).
    Google Places mocké, aucune donnée prod touchée.

## Conventions Vito (rappel)

- Mobile-first PWA, App Router Next 16, RLS partout, `Link`/`redirect` locale-aware. Carte Leaflet
  rendue `ssr:false` (via `PlacesMapLazy`). i18n 4 locales (parité), aucune chaîne en dur, aucun
  nouveau token. Google Places mocké en test.
- TDD pour le domaine, e2e pour l'écran, review par task + review finale Opus, PR → CI verte →
  merge. **Aucune migration / pas de go-prod DB** dans cette slice.

## Sécurité

- Lecture seule (affichage + filtrage côté client). `getPlaces()` inchangé (déjà owner-only via RLS,
  `is_archived=false`). Le filtre par tag est purement client sur des données déjà autorisées. Le popup
  catégorie-aware corrige un lien erroné, sans nouvelle surface. Aucun nouveau verbe d'écriture.

## Hors périmètre

- Géolocalisation « autour de toi » (le comptage reste le nombre d'adresses filtrées).
- Clustering de pins, multi-sélection de tags.
- Écran Recherche « Découverte » (→ Slice 5), archivage (→ Slice 6), onglet Hôtels paramétré
  (→ Slice 7), desktop (→ Slice 8), polish/skeletons (→ Slice 9).
