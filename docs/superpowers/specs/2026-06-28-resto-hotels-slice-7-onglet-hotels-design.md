# Spec — Slice 7 : Onglet Hôtels paramétré

> Épic « Refonte Resto + Hôtels » (directive `docs/design/restos-hotels-refonte-epic-directive.md`).
> Slice 7 de la roadmap. Suit la Slice 6 (archivage, PR #51, mergée). Maquette : `docs/design/Onglet_Hotels.dc.html`.

## Objectif

Achever la paramétrisation hôtel de la brique générique : ajouter le **filtre par ambiance** (chips
Tous/tag) sur la liste hôtel et l'**« Explorer par envie » hôtel** (onglet Recherche). Le reste de
l'onglet Hôtels est déjà générique (score /10, IA 4 onglets, vignettes, carte, recherche, archivage).

## Décisions PO (validées le 2026-06-28)

1. **Classe étoiles = coupée** : Google Places ne fournit pas la classe officielle et aucune colonne
   ne la porte. Pas de saisie manuelle ni de proxy au MVP. Retirée du périmètre (réouvrable si une
   source fiable apparaît). `categoryConfig.hotel.showStarClass` reste `false`.
2. **Chips ambiance = barre de filtre par tag** sur la liste hôtel (single-select : `Tous` + tags
   présents), conforme maquette. Pilotée par catégorie via un drapeau de config.
3. **« Explorer par envie » hôtel défini** : `searchEnvies("hotel")` n'est plus vide.
4. **Tags existants seulement** : on réutilise les tags hôtel/communs déjà seedés (00004/00017) —
   **aucune migration**, pas de nouveaux tags.

## État de départ (après Slice 6 — vérifié)

- `categoryConfig` (`src/features/places/domain/categoryConfig.ts`) :
  `resto { notationKind:"stars", maxChipsListe:2, maxChipsVignette:1, descriptor:"cuisine", showStarClass:false }` ;
  `hotel { notationKind:"score", …, descriptor:"ambiance", showStarClass:false }`. `computeNotation("hotel", r)`
  → score /10 (= r×2). **Déjà rendu** par `PlaceCard` (kind "score" → valeur + `t("noteSur10")`).
- `discovery.ts` : `searchEnvies("hotel")` renvoie `[]` (différé Slice 5) ; resto a 4 envies.
- `mapFilters.ts` (Slice 4) : `tagsForMap(places)` (tags uniques triés) + `filterByTag(places, slug|null)` —
  **purs, testés**, déjà utilisés par la carte combinée.
- `PlaceListPanel` (`src/features/places/ui/PlaceListPanel.tsx`) : props `{ places: Place[]; views:
  PlaceView[]; locale: string }`. Champ filtre texte (`places-search`) + toggle de vue conditionnel +
  rendu liste/vignettes/carte. **Ne reçoit pas `category`.**
- `PlacesTabs` : rend `<PlaceListPanel places={favoris|recommandes} views={…} locale={…} />` ; connaît
  `category`.
- i18n namespace `places` : contient `tagTous` (« Tous », Slice 4), `noteSur10`. Pas de clés d'envie hôtel.
- Tags système (00004/00017) : scope `hotel` → `spa`, `piscine`, `petit_dej_inclus` ; communs ambiance →
  `vue_mer`, `avec_vue`, `en_amoureux`, `entre_amis`, `en_famille`, `business`, `terrasse`.
- Seed : « Hôtel Démo » (`11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa`, hotel, a_faire, non-favori, **sans tag**).
- `e2e/hotels.spec.ts` : 3 tests (montre l'hôtel via `tab-recommandes` ; absent des restos ; ajout via Recherche).

## Architecture / composants

### 1. Domaine pur

- **`src/features/places/domain/discovery.ts`** : `searchEnvies("hotel")` renvoie 4 envies :
  - `{ emoji: "🏖️", labelKey: "envieBordDeMer", query: "bord de mer" }`
  - `{ emoji: "💆", labelKey: "envieSpa", query: "spa" }`
  - `{ emoji: "🏨", labelKey: "envieBoutique", query: "hôtel boutique" }`
  - `{ emoji: "🏊", labelKey: "enviePiscine", query: "piscine" }`
- **`src/features/places/domain/categoryConfig.ts`** : ajouter `listTagFilter: boolean` au type
  `CategoryConfig` et aux deux entrées — `resto: false`, `hotel: true`. (Active la barre de filtre
  ambiance sur la liste hôtel.)
- Réutilise `tagsForMap`/`filterByTag` (Slice 4) — pas de nouveau domaine de filtrage. TDD pour les deux ajouts.

### 2. UI — `PlaceListPanel` (barre de filtre par tag)

- Ajouter la prop **`category: "resto" | "hotel"`** (passée par `PlacesTabs`).
- `const showTagFilter = categoryConfig[category].listTagFilter;`
- Si `showTagFilter` et `tagsForMap(places).length > 0` : rendre une **barre de chips**
  (`data-testid="list-tag-filter"`) — `Tous` (`list-tag-tous`, actif si `selectedTag === null`) +
  un chip par tag (`list-tag-{slug}`, `aria-pressed`), single-select. Même style que les chips de la
  carte combinée (tokens maison, `t("tagTous")`).
- `shown = filterByTag(filterPlaces(places, q), selectedTag)` (le filtre tag s'ajoute au filtre texte ;
  `selectedTag` reste `null` quand la barre est masquée → `filterByTag(_, null)` = no-op, resto inchangé).
- État `selectedTag: string | null` (défaut `null`).

### 3. UI — `PlacesTabs`

- Passer `category={category}` aux deux `<PlaceListPanel … />` (Favoris et Recommandés). Reste inchangé.

### 4. i18n (4 locales, parité)

Ajouts au namespace `places` : `envieBordDeMer`, `envieSpa`, `envieBoutique`, `enviePiscine`.
Réutilisés : `tagTous` (filtre), `vueListe`/`vueVignettes`/`vueCarte`, `searchDecouvertePlaceholder`, etc.

- fr : « Bord de mer », « Spa », « Hôtel boutique », « Piscine ».
- en : « Seaside », « Spa », « Boutique hotel », « Pool ».
- it : « Sul mare », « Spa », « Hotel boutique », « Piscina ».
- es : « Junto al mar », « Spa », « Hotel boutique », « Piscina ».

### 5. Pas de migration

`showStarClass` reste `false` (classe étoiles coupée). Tags existants uniquement. Aucune colonne ni
tag ajouté.

## Tests

- **TDD domaine** :
  - `discovery.test.ts` : `searchEnvies("hotel")` a 4 envies (query/labelKey non vides) — remplace
    l'assertion `toEqual([])`.
  - `categoryConfig.test.ts` : `categoryConfig.hotel.listTagFilter === true` ; `…resto.listTagFilter === false`.
- **e2e — `e2e/hotels.spec.ts`** :
  - onglet **Recherche** : les chips « Explorer par envie » hôtel sont rendues (`envies` visible, au
    moins `envie-envieSpa`).
  - **barre de filtre ambiance** sur la liste hôtel : sur `tab-recommandes`, `list-tag-filter` visible ;
    cliquer un tag (ex. `list-tag-spa`) filtre les `place-card`, `list-tag-tous` réinitialise.
  - Seed : doter « Hôtel Démo » d'un tag existant (`spa`, via `liste_item_tags`, **sans migration**) +
    ajouter un 2e hôtel (a_faire, sans ce tag) pour que le filtre fasse varier le nombre. Vérifier que
    `hotels.spec` existant reste vert (les tests filtrent par `hasText:"Hôtel Démo"`, insensibles au 2e hôtel).

## Conventions Vito (rappel)

- Mobile-first PWA, App Router Next 16, RLS partout, i18n 4 locales (parité), aucune chaîne en dur,
  aucun nouveau token. TDD pour le domaine, e2e pour l'écran.
- **Vérification pré-push** : `npm run lint && npx tsc --noEmit && npm test` (la CI `quality` lance
  eslint + e2e ; re-checker `gh pr checks` avant merge — le `--watch` peut sortir 0 à tort ; flakes
  famille connus → re-run).
- **Aucune migration / pas de go-prod DB.**

## Sécurité

- Lecture seule (affichage + filtrage client). `getPlaces`/`getArchivedPlaces` inchangés (owner-only RLS,
  `is_archived=false`). Le filtre ambiance est purement client sur des tags déjà autorisés. Aucune
  nouvelle surface.

## Hors périmètre

- **Classe étoiles** (pas de source — coupée).
- Nouveaux tags ambiance (Boutique/Design/Romantique/Central) — on utilise l'existant (pas de migration).
- Desktop (Slice 8). Polish/skeletons/a11y + consolidation des Minors (Slice 9).
