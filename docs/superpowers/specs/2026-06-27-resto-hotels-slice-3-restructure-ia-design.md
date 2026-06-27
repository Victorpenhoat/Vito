# Spec — Slice 3 : Restructure IA (4 onglets + toggle de vue)

> Épic « Refonte Resto + Hôtels » (directive `docs/design/restos-hotels-refonte-epic-directive.md`).
> Slice 3 de la roadmap. Suit la Slice 2 (brique notation + `categoryConfig` + variant vignette,
> PR #47, mergée). Maquettes : `docs/design/Onglet_Resto.dc.html`, `Onglet_Hotels.dc.html`.

## Objectif

Restructurer l'information architecture des onglets lieux : passer des onglets actuels
(Tous · Favoris · À tester · Visités) à l'IA cible **Favoris · Recommandés · Carte · Recherche**,
avec un **toggle de vue Liste / Vignettes / Carte** sur Favoris. Recommandés affiche
« Conseillé par X » (`reco_source`). Brique générique, appliquée resto **et** hôtel.

## Décisions PO (validées le 2026-06-27)

1. **Onglets Carte & Recherche = réutilisation intérimaire** : l'onglet Carte rend le `PlacesMap`
   existant sur les favoris + recommandés combinés (sans filtres/pins distincts — c'est la Slice 4) ;
   l'onglet Recherche héberge le `PlaceSearch` existant (découverte enrichie = Slice 5). Les 4 onglets
   sont fonctionnels, aucun onglet mort.
2. **Toggle de vue sur Favoris seul** : Favoris a les 3 vues (Liste / Vignettes / Carte) ; Recommandés
   est en **Liste seule** (conforme maquette).
3. **Retrait de « Tous » et « Visités »** : IA = Favoris · Recommandés · Carte · Recherche.
   `statut='visite'` reste en base et continue d'alimenter le KPI dashboard « Sorties ce mois »
   (`features/accueil`) — aucune perte de donnée. La gestion « visité »/archivage est traitée en Slice 6.
4. **Filtre de recherche local conservé** : chaque onglet de liste (Favoris, Recommandés) garde un
   champ qui filtre ses propres items (via `filterPlaces`), distinct de l'onglet Recherche (découverte
   Google externe).

## État de départ (après Slice 2 — vérifié)

- `Place` (`src/features/places/domain/filterPlaces.ts`) : porte `etablissement.rating`/`rating_count`
  (Slice 1), **ne porte pas** `reco_source`.
- `getPlaces()` (`src/features/places/data/queries.ts`) : sélectionne `id, statut, is_favorite,
  etablissement(...), tags(...)`. **Ne sélectionne pas** `reco_source` ; **ne filtre pas** `is_archived`.
- DB : `liste_items.reco_source text`, `is_archived boolean not null default false`, `archived_at`
  (migration 00020, déjà en prod). `reco_source` est déjà typé dans `src/types/database.types.ts`.
- `PlacesTabs` (`src/features/places/ui/PlacesTabs.tsx`) : composant client unique gérant onglets
  (Tous/Favoris/À tester/Visités) + toggle (Liste/Carte) + recherche inline + rendu. ~98 lignes.
- `PlaceCard` (Slice 2) : `variant?: "liste" | "vignette"`, note par catégorie, chips limités.
- `PlacesMap` (`src/features/places/ui/PlacesMap.tsx`) : prend `{ places: Place[]; locale }`.
- `PlaceSearch` (`src/features/places/ui/PlaceSearch.tsx`) : découverte/ajout Google externe ; **rendu
  séparément** au-dessus de `PlacesTabs` dans les pages.
- Pages : `src/app/[locale]/(app)/restos/page.tsx` et `.../hotels/page.tsx` rendent
  `PageHeader` + `GoutsBanner` + `<PlaceSearch …/>` + `<PlacesTabs …/>`.
- Helpers réutilisables : `src/features/shared/ui/Avatar.tsx` (`<Avatar name size color/>`),
  `src/features/shared/ui/helpers.ts` (`initials`), `src/features/famille/domain/avatarColor.ts`
  (`avatarColor(seed)` + `AVATAR_PALETTE`).
- i18n namespace `places` (4 locales) : `tous, favoris, aTester, visites, searchPlaceholder, empty,
  vueListe, vueCarte, noteSur10, sansLocalisation, search, add, resFavoris, resATester, resExternes`.
- e2e `e2e/places.spec.ts` : 8 tests référençant `tab-tous`, `tab-a-tester`, `places-search`,
  `view-carte`, `place-card`, `places-map`, `place-note`.

## Architecture / composants

### 1. Data

- **`src/features/places/data/queries.ts`** : ajouter `reco_source` au `select` (au niveau
  `liste_items`, à côté de `statut`), et ajouter `.eq("is_archived", false)` au filtre. Mapper
  `reco_source` dans l'objet retourné.
- **`src/features/places/domain/filterPlaces.ts`** : ajouter `reco_source: string | null` au type
  `Place` (niveau racine, à côté de `statut`/`is_favorite`).
- Pas de migration. RLS inchangée (`liste_items` owner-only).

### 2. Domaine pur — disponibilité des vues

Nouveau fichier **`src/features/places/domain/placesTabsConfig.ts`** (pur, testable) :

- `type PlacesTab = "favoris" | "recommandes" | "carte" | "recherche"`
- `type PlaceView = "liste" | "vignettes" | "carte"`
- `const TAB_VIEWS: Record<"favoris" | "recommandes", PlaceView[]>` =
  `{ favoris: ["liste", "vignettes", "carte"], recommandes: ["liste"] }`
- `function subsetForTab(places: Place[], tab: "favoris" | "recommandes"): Place[]` :
  - `favoris` → `places.filter((p) => p.is_favorite)`
  - `recommandes` → `places.filter((p) => p.statut === "a_faire")`
- 100 % pur (importe seulement le type `Place`). TDD.

### 3. UI — `PlaceListPanel` (extraction)

Nouveau **`src/features/places/ui/PlaceListPanel.tsx`** (client) — panneau de liste réutilisable pour
Favoris et Recommandés :

- Props : `{ places: Place[]; category: "resto" | "hotel"; views: PlaceView[]; locale: string }`.
- État interne : `q` (filtre local), `view` (initialisé à `views[0]`).
- Champ de filtre local (`data-testid="places-search"`), placeholder i18n.
- Toggle de vue rendu **uniquement si `views.length > 1`** : un bouton par vue
  (`data-testid="view-liste"|"view-vignettes"|"view-carte"`, `aria-pressed`).
- `shown = filterPlaces(places, q)`.
- Rendu : `view === "carte"` → `<PlacesMap places={shown} locale={locale} />` ;
  sinon liste/grille de `<PlaceCard variant={view === "vignettes" ? "vignette" : "liste"} />` ;
  `shown.length === 0` → message vide i18n.

### 4. UI — `PlacesTabs` réécrit (orchestrateur d'onglets)

**`src/features/places/ui/PlacesTabs.tsx`** :

- Props inchangées : `{ category: "resto" | "hotel"; places: Place[] }` (le `category` est désormais
  **utilisé**, transmis aux enfants).
- 4 onglets (`role="tablist"`) : `tab-favoris`, `tab-recommandes`, `tab-carte`, `tab-recherche`,
  libellés i18n. Compteur par onglet pour Favoris/Recommandés (`subsetForTab(...).length`).
- Panneaux :
  - **Favoris** → `<PlaceListPanel places={subsetForTab(places,"favoris")} views={TAB_VIEWS.favoris} … />`.
  - **Recommandés** → `<PlaceListPanel places={subsetForTab(places,"recommandes")} views={TAB_VIEWS.recommandes} … />`.
  - **Carte** → `<PlacesMap places={[…favoris, …recommandes] dédupliqués par id] } locale … />`
    (union favoris + recommandés ; dédup par `p.id`).
  - **Recherche** → `<PlaceSearch places={places} category={category} />`.

### 5. UI — `PlaceCard` : ligne « Conseillé par X »

**`src/features/places/ui/PlaceCard.tsx`**, variant **liste** uniquement :

- Quand `place.reco_source` est non vide, afficher une ligne `data-testid="place-reco"` :
  `<Avatar name={reco_source} size="sm" color={avatarColor(reco_source)} />` + texte
  `t("conseilléPar", { name: reco_source })` (« Conseillé par {name} »).
- Variant **vignette** : pas de reco_source (conforme maquette).
- `PlaceCard` accepte déjà `place: Place` ; `reco_source` y est désormais présent. Aucune nouvelle prop.

### 6. Pages

- **`src/app/[locale]/(app)/restos/page.tsx`** et **`.../hotels/page.tsx`** : retirer le
  `<PlaceSearch … />` autonome (déplacé dans l'onglet Recherche). Conserver `PageHeader` +
  `GoutsBanner` + `<PlacesTabs … />`. `getPlaces` inchangé côté appel.

### 7. i18n (4 locales, parité)

Ajouts au namespace `places` (fr ; en/it/es en parité) :

- `recommandes` : « Recommandés »
- `carte` : « Carte » (onglet — distinct de `vueCarte` qui reste le libellé de la vue)
- `recherche` : « Recherche » (onglet)
- `vueVignettes` : « Vignettes »
- `filtrerPlaceholder` : « Rechercher dans cette liste… » (filtre local des onglets)
- `conseilléPar` : « Conseillé par {name} »

Clés conservées (encore utilisées) : `favoris, vueListe, vueCarte, empty, search/add/resFavoris/
resATester/resExternes` (PlaceSearch), `sansLocalisation`, `noteSur10`. Clés devenues inutilisées
(`tous, aTester, visites, searchPlaceholder`) : **supprimées des 4 locales** pour éviter le code mort.

## Tests

- **TDD domaine — `src/features/places/domain/placesTabsConfig.test.ts`** :
  - `subsetForTab(list, "favoris")` ne renvoie que les `is_favorite`.
  - `subsetForTab(list, "recommandes")` ne renvoie que les `statut==="a_faire"`.
  - `TAB_VIEWS.favoris` = `["liste","vignettes","carte"]` ; `TAB_VIEWS.recommandes` = `["liste"]`.
- **Composant — `PlaceCard`** : ligne « Conseillé par X » rendue (avec avatar) quand `reco_source`
  présent en variant liste ; absente quand `reco_source` null ; absente en variant vignette.
- **e2e — `e2e/places.spec.ts`** (réécrit pour la nouvelle IA) :
  - les 4 onglets sont visibles (`tab-favoris`/`tab-recommandes`/`tab-carte`/`tab-recherche`) ;
    Favoris actif par défaut.
  - Favoris : toggle 3 vues présent ; bascule Vignettes (`view-vignettes`) puis Carte
    (`view-carte` → `places-map`).
  - Recommandés : pas de toggle (Liste seule) ; « Conseillé par {X} » visible (`place-reco`).
  - filtre local d'un onglet filtre ses `place-card`.
  - onglet Recherche affiche le `PlaceSearch` (`add-resto-search`).
  - Seed : doter un item `statut='a_faire'` d'un `reco_source` (ex. « Camille ») pour l'assertion
    Recommandés. Google Places mocké, aucune donnée prod touchée.

## Conventions Vito (rappel)

- Mobile-first PWA, App Router Next 16, RLS partout, `Link`/`redirect` locale-aware
  (`@/lib/i18n/routing`), i18n 4 locales (parité), aucune chaîne en dur, aucun nouveau token.
- Google Places mocké en test. Secrets server-only. Tests RLS jamais contre la prod.
- TDD pour le domaine, e2e pour l'écran, review par task + review finale Opus, PR → CI verte →
  merge. **Aucune migration / pas de go-prod DB** dans cette slice.

## Sécurité

- Lecture seule côté nouveau code (affichage + réorganisation). `getPlaces()` reste filtré par owner
  via RLS `liste_items` ; le nouveau `is_archived=false` restreint davantage (jamais d'élargissement).
  `reco_source` provient de `liste_items` (owner-only). Aucun nouveau verbe d'écriture.

## Hors périmètre

- Carte combinée : pins distincts par catégorie/statut + filtres par tags (→ Slice 4).
- Écran Recherche « Découverte » (recherches récentes + Explorer par envie) (→ Slice 5).
- Archivage `is_archived` + vue « Archivés » + gestion transition `a_faire`→`visite` (→ Slice 6).
- Redesign de la carte Recommandés horizontale (thumbnail + bouton cœur) (→ polish Slice 9).
