# Épic places (reprise) — Slice Carte : vue carte react-leaflet — Design

**Date :** 2026-06-26
**Statut :** Validé (décisions épic + PO). Plan à suivre.
**Branche :** `places-carte`
**Directive :** `docs/design/places-epic-directive.md` · **Style :** Le Carnet (Slices 0-7 mergées)

---

## 0. Contexte

Reprise de l'épic places (en pause depuis la refonte Le Carnet). Cette slice ajoute une **vue Carte**
à l'écran Restos : bascule **Liste / Carte** dans `PlacesTabs`, marqueurs OSM via **react-leaflet**
(gratuit, sans clé, décision épic). Composant carte **générique** (réutilisé par l'onglet Hôtels
ultérieur). **Sans migration** (colonnes `lat`/`lng` déjà sur `etablissements`).

## 1. Décisions

| Sujet | Décision |
|-------|----------|
| Lib carte | `react-leaflet` (compatible React 19 / Next 16, soit v5+) + `leaflet` + `@types/leaflet`. Tuiles **OpenStreetMap** (`https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`), attribution affichée. Aucune clé d'API. |
| SSR | Leaflet utilise `window` → `PlacesMap` est **client-only**, monté via `next/dynamic(..., { ssr: false })` depuis `PlacesTabs` (déjà client). CSS `leaflet/dist/leaflet.css` importé dans `PlacesMap`. |
| Marqueur | **`L.divIcon`** (pastille CSS, pas d'icône image → évite les chemins d'assets cassés par le bundler). Teinte favori (or) sinon accent. Popup = nom + lien fiche. |
| Intégration | Bascule **Liste/Carte** ; la Carte affiche la **sous-liste filtrée de l'onglet actif** (`shown` = `filterPlaces(subset(tab), q)`). Défaut = **Liste**. |
| Offline | Tuiles non mises en cache par le SW (network-first) → pas de fond hors-ligne (marqueurs/UI OK). Acceptable. |
| CSP | Aucune CSP configurée → tuiles OSM non bloquées. Rien à changer. |

## 2. Données (`src/features/places/data/queries.ts` + `filterPlaces.ts`)

- `Place.etablissement` gagne `lat: number | null; lng: number | null`.
- `getPlaces` : ajouter `lat, lng` à l'embed `etablissements` du `select`. Pas de migration.

## 3. Domaine (`src/features/places/domain/mapCenter.ts`)

Helper pur **`mapCenter(places: Place[]): { lat: number; lng: number }`** — moyenne des coords valides
(lat/lng non nuls) ; **défaut Paris** `{ lat: 48.8566, lng: 2.3522 }` si aucune. Testable.

## 4. UI

### `PlacesMap` (nouveau, client, `src/features/places/ui/PlacesMap.tsx`)
- `"use client"` ; importe `leaflet/dist/leaflet.css` + `react-leaflet` (`MapContainer`/`TileLayer`/
  `Marker`/`Popup`). Props `{ places: Place[] }`.
- `MapContainer` centré sur `mapCenter(places)`, zoom ~12, hauteur fixe (`h-[60vh]`), `rounded-card`
  `border border-line overflow-hidden`. `TileLayer` OSM + attribution.
- Pour chaque place **avec lat/lng** : `Marker` (icône `L.divIcon` pastille — classe teintée favori/
  accent) + `Popup` (nom + `<a href="/{locale}/restos/{id}">` ou lien interne — voir §6). `data-testid
  ="places-map"` sur un conteneur autour. Les places **sans coords** : comptées (« N sans
  localisation ») sous la carte.

### `PlacesTabs` (modifié, `src/features/places/ui/PlacesTabs.tsx`)
- Nouvel état `view: "liste" | "carte"` (défaut `"liste"`). Bascule (2 boutons, testids `view-liste`/
  `view-carte`, `aria-pressed`) placée près de la recherche.
- `view === "liste"` → grille de `PlaceCard` actuelle (inchangée). `view === "carte"` → `<PlacesMap
  places={shown} />` (import dynamique `ssr:false`). Onglets + recherche **inchangés** (filtrent
  `shown` dans les deux vues). Tous les testids existants conservés.

## 5. i18n (`places.*`, 4 locales)

Ajouts : `places.vueListe` (« Liste »), `places.vueCarte` (« Carte »), `places.sansLocalisation`
(« {n} sans localisation »). EN « List »/« Map »/« {n} without location » ; IT « Elenco »/« Mappa »/
« {n} senza posizione » ; ES « Lista »/« Mapa »/« {n} sin ubicación ». Pas de chaîne en dur.

## 6. Liens internes depuis la popup

La popup Leaflet est rendue hors de l'arbre React-Router de next-intl ; utiliser une **ancre simple**
`href={`/${locale}/restos/${id}`}` (locale passée en prop à `PlacesMap`) plutôt que le `<Link>`
i18n, pour éviter les soucis de contexte. Navigation plein-page acceptable depuis une popup carte.

## 7. Sécurité

- Lecture seule (RLS owner sur `liste_items` déjà en place). Aucune action, migration ou requête de
  scoring modifiée. Tuiles OSM publiques ; aucune donnée utilisateur envoyée à un tiers (les coords
  sont rendues côté client, les tuiles sont demandées par z/x/y standard).

## 8. Tests

- **Unit** : `mapCenter` (moyenne ; défaut Paris si aucune coord ; ignore les nuls). `filterPlaces`
  inchangé. typecheck+lint+test verts ; parité i18n verte (3 clés × 4).
- **e2e** : défaut **Liste** → `places.spec`/`restos.spec`/`vins.spec` **verts sans modification**.
  Ajout léger dans `places.spec` : cliquer `view-carte` → `places-map` visible (n'asserte PAS les
  tuiles réseau, seulement le conteneur/markers rendus). Suite complète verte. Un `db reset` avant.
- **Build** : `npm run build` OK (le `dynamic(ssr:false)` ne casse pas le SSR ; le composant carte
  n'est jamais rendu côté serveur).

## 9. Arbitrages / dette

- **Carte combinée multi-statuts** dédiée (marqueurs distincts favoris/à tester + filtres avancés) :
  la bascule par onglet couvre l'essentiel ; une carte combinée plus riche est différable.
- **Tuiles offline** non cachées (PWA) : différé (cache tuiles = stockage + ToS OSM à cadrer).
- **Marqueurs sans coords** : seedés/ajoutés sans lat/lng → comptés, non affichés. Les ajouts via
  Google ont des coords (`mapPlaceToEtablissement` mappe lat/lng).
- Carte sur l'onglet **Hôtels** : viendra avec la slice Hôtels (composant déjà générique).
