# Épic places — Slice Hôtels (onglet /hotels) — Design

**Date :** 2026-06-26
**Statut :** Validé (décisions épic + PO : périmètre complet). Plan à suivre.
**Branche :** `places-hotels`
**Directive :** `docs/design/places-epic-directive.md` · **Style :** Le Carnet
**Dernière slice de l'épic places.**

---

## 0. Contexte

Ajoute l'**onglet Hôtels** (`/hotels`) en réutilisant l'infra générique places (`getPlaces("hotel")`,
`PlacesTabs`, `getTagsForCategory("hotel")`, carte). **Front-only, aucune migration** (`categorie`/
colonnes déjà là ; le seed hôtel est local/e2e — en prod les hôtels s'ajoutent via le flux d'ajout).
Lève la **dette de vérification** notée depuis places-Slice-1 (un hôtel ne doit PAS apparaître côté
Restos).

## 1. Architecture (zéro duplication)

- **`PlaceSearch`** (nouveau, `src/features/places/ui/PlaceSearch.tsx`) — généralisation de
  `RestoSearch` : props `{ places: Place[]; category: "resto" | "hotel" }`. Recherche priorisée
  (`splitSearch`), sections Favoris/À tester (`owned-result`, liens vers
  `/${base}/${id}` où `base = category==="hotel" ? "hotels" : "restos"`) + Externes (`search-result`
  + bouton, appelle `addResto` ou `addHotel` selon `category`). Input testid =
  `add-${category==="hotel"?"hotel":"resto"}-search` (donc `add-resto-search` conservé pour Restos).
  Namespace i18n `places`. **`RestoSearch` est supprimé** (remplacé partout par `PlaceSearch`).
- **`PlaceCard`** (`src/features/places/ui/PlaceCard.tsx`) : lien **dépendant de la catégorie** —
  `/${etablissement.categorie === "hotel" ? "hotels" : "restos"}/${id}` (au lieu de `/restos/` en
  dur). `data-testid="place-card"` conservé.
- **`FicheResto`** : prop optionnelle `category: "restaurant" | "hotel"` (défaut `"restaurant"`) →
  `getTagsForCategory(category)`. Le reste inchangé (i18n `restos` générique suffit). Route
  `/hotels/[id]/page.tsx` rend `<FicheResto etablissementId category="hotel" />`.
- **`addHotel`** (`src/features/restos/data/actions.ts`, à côté d'`addResto`) : identique à `addResto`
  mais `mapPlaceToEtablissement(place, "hotel")` + `revalidatePath("/hotels")`.
- **`/hotels/page.tsx`** : `PageHeader` `hotels.title` + `PlaceSearch category="hotel"` +
  `PlacesTabs category="hotel" places={await getPlaces("hotel")}`. (Onglets + Carte génériques.)
- **nav-config** : entrée `{ key: "hotels", href: "/hotels", group: "carnet" }` après `restos` ;
  `NavKey` += `"hotels"` ; icône lucide `Hotel` dans `NAV_ICONS`. `BOTTOM_KEYS` **inchangé**
  (hotels en sidebar, pas en bottom-nav). RBAC : pas de `roles` (visible par tous).

## 2. Données

- **Aucune migration.** `getPlaces`/`addResto`/`mapPlaceToEtablissement` inchangés (mapPlace prend
  déjà `categorie`). `addHotel` réutilise le RPC `upsert_etablissement` (categorie hotel via le
  mapping).
- **Seed** (`supabase/seed.sql`, local/e2e) : un établissement `categorie='hotel'` + un `liste_items`
  pour le client (statut `a_faire`), pour peupler /hotels et le test d'exclusion.

## 3. i18n (4 locales, parité garantie)

- **Déplacement** vers `places` (pour `PlaceSearch` générique) : ajouter `places.search`,
  `places.add`, `places.resFavoris`, `places.resATester`, `places.resExternes` (valeurs reprises de
  `restos.*`) ; **retirer** `restos.resFavoris/resATester/resExternes` (orphelins après suppression de
  RestoSearch ; `restos.search`/`restos.add` peuvent rester si encore référencés — sinon retirés).
- **Ajouts** : `nav.hotels` (« Hôtels »/« Hotels »/« Hotel »/« Hoteles ») ; `hotels.title`
  (« Mes hôtels »/« My hotels »/« I miei hotel »/« Mis hoteles »).
- Pas de chaîne en dur ; parité 4 locales.

## 4. Sécurité

- Lecture seule + actions existantes (RLS owner sur `liste_items`, RPC security-definer pour
  l'upsert). `addHotel` = même surface qu'`addResto`. RBAC nav inchangé. Aucune migration, aucun
  secret. Le seed ne touche pas la prod.

## 5. Tests

- **Unit** : `splitSearch`/`mapPlaceToEtablissement` inchangés (mapPlace « hotel » déjà couvert) ;
  typecheck+lint+test verts ; parité i18n verte (clés déplacées/ajoutées).
- **e2e (nouveau `e2e/hotels.spec.ts`)** :
  - `/hotels` : l'hôtel seedé apparaît en `place-card` ; `/restos` : il **n'apparaît PAS** (dette de
    vérification levée — `getPlaces("resto")` exclut les hôtels).
  - Ajout d'un hôtel via `add-hotel-search` → `search-result` → bouton → l'hôtel apparaît dans
    l'onglet À tester de /hotels.
- **e2e existants** : `restos.spec` **vert sans modification** — `PlaceSearch category="resto"` garde
  `add-resto-search`/`search-result`/le flux `addResto` ; `place-card` resto lie toujours `/restos/`.
  Suite complète verte. Un `db reset` avant.
- **Build** : OK.

## 6. Arbitrages / dette

- **Fiche hôtel** = `FicheResto` (générique) avec tags scope hotel ; pas d'écran hôtel distinct
  (avis/vins/conciergerie/voyage sections restent, pertinentes ou neutres). Affinage spécifique hôtel
  différable.
- **Prod** : l'onglet /hotels est vide jusqu'au 1er ajout (le seed est local) — attendu.
- i18n : `restos.search/add` conservés s'ils servent encore ; sinon retirés (le plan vérifie les
  références).
- **Fin de l'épic places** après cette slice (Carte + Recherche externe + Hôtels livrés).
