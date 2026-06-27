# Spec — Slice 2 : brique notation + `categoryConfig` + variant vignette

> Épic « Refonte Resto + Hôtels » (directive `docs/design/restos-hotels-refonte-epic-directive.md`).
> Slice 2 de la roadmap. Suit la Slice 1 (migration 00020 + enrichissement `rating`, PR #46, déjà
> en prod). Maquettes de référence : `docs/design/Onglet_Resto.dc.html`, `Onglet_Hotels.dc.html`.

## Objectif

Construire la **brique générique de notation** : un domaine pur `categoryConfig` paramétrant
l'affichage par catégorie (resto vs hôtel) et un `PlaceCard` capable de se rendre en **deux
variants** (liste **et** vignette) avec la note remontée depuis la donnée. Appliqué à la liste resto
existante. Pas de duplication Resto/Hôtel.

## Décisions PO (validées le 2026-06-27)

1. **Périmètre** : Slice 2 = `categoryConfig` (pur) + `PlaceCard` variant liste/vignette + remontée &
   affichage du `rating`, appliqué à la liste resto existante. Le **toggle de vue**
   Liste/Vignettes/Carte dans `PlacesTabs` reste pour la **Slice 3**.
2. **Config des deux catégories maintenant** : `categoryConfig` couvre resto **et** hôtel dès cette
   slice (c'est le but de la brique générique). Seul l'écran resto consomme la config pour l'instant ;
   le volet hôtel est testé en pur.
3. **Note hôtel = Google ×2, libellé `/10`** : une seule source (`etablissements.rating`, Google,
   0-5), affichée `9,0 /10` (= `rating × 2`). On **abandonne** « ma note » de la maquette : pas de
   notation personnelle au MVP (conforme décision 2 du directive épic).
4. **Classe étoiles hôtel différée à Slice 7** : aucune colonne ne la porte (00020 n'a ajouté que
   `rating`/`rating_count`). `categoryConfig` réserve l'emplacement du descripteur mais ne rend ni
   n'alimente la classe étoiles en Slice 2.
5. **Chips = tags existants** : les chips des cartes (cuisine resto / ambiance hôtel) sont les `tags`
   déjà portés par `Place` (00017, `tags`/`liste_item_tags`). Aucune nouvelle donnée. Liste : jusqu'à
   **2** chips ; vignette : **1** chip (conforme maquettes).

## État de départ (après Slice 1 — vérifié)

- `Place` (`src/features/places/domain/filterPlaces.ts`) : `etablissement` **ne porte pas** `rating`
  / `rating_count`. `tags: { slug; label; color }[]` présents.
- `getPlaces()` (`src/features/places/data/queries.ts`) : le `select` du join `etablissements` ne
  remonte **pas** `rating`/`rating_count` (colonnes pourtant présentes en DB et alimentées).
- `PlaceCard` (`src/features/places/ui/PlaceCard.tsx`) : rend un seul layout liste, **sans note**.
  Navigation `/{base}/{id}` avec `base = categorie === "hotel" ? "hotels" : "restos"`.
- Aucun `categoryConfig` : branchements catégorie ad-hoc (ternaires) dans les composants.
- Convention features : `domain/` (pur + tests), `ui/` (composants), `data/` (Supabase).
- i18n namespace `places` dans `messages/{fr,en,it,es}.json` (4 locales, parité).
- DB : `etablissements.rating numeric(2,1)` (0-5), `rating_count integer`. Pas de migration dans
  cette slice.

## Architecture / composants

### 1. Data — remontée du rating

- **`src/features/places/data/queries.ts`** : ajouter `rating, rating_count` au `select` du join
  `etablissements` dans `getPlaces()`.
- **`src/features/places/domain/filterPlaces.ts`** : étendre `Place.etablissement` avec
  `rating: number | null` et `rating_count: number | null`.
- Pas de migration, pas de changement RLS (`liste_items` owner-only, `etablissements` lecture
  authentifiée inchangés). Types DB déjà à jour depuis 00020.

### 2. Domaine pur — `categoryConfig`

Nouveau fichier **`src/features/places/domain/categoryConfig.ts`**.

- Type `Notation = { kind: "stars" | "score"; value: number; scale: 5 | 10 }`.
- Fonction pure **`computeNotation(categorie: "resto" | "hotel", rating: number | null): Notation | null`** :
  - `resto` → `{ kind: "stars", value: rating, scale: 5 }` (ex. `rating = 4.6` → valeur `4.6`).
  - `hotel` → `{ kind: "score", value: rating * 2, scale: 10 }` (ex. `rating = 4.5` → valeur `9.0`).
  - `rating == null` → `null` (aucun affichage de note).
- Config par catégorie `categoryConfig: Record<"resto" | "hotel", CategoryConfig>` exposant au
  minimum : `notationKind` (`"stars" | "score"`), `maxChipsListe = 2`, `maxChipsVignette = 1`, et un
  **emplacement réservé** `descriptor` documentant le descripteur (cuisine vs ambiance) et, pour
  l'hôtel, un champ optionnel non rendu pour la classe étoiles (→ Slice 7, ni alimenté ni affiché).
- 100 % pur (aucun import React/next-intl). Formatage du nombre délégué au composant.

### 3. UI — `PlaceCard` étendu

**`src/features/places/ui/PlaceCard.tsx`** :

- Nouvelle prop `variant?: "liste" | "vignette"`, défaut `"liste"` (rétro-compatible : appels
  existants inchangés).
- Note via `computeNotation(etablissement.categorie, etablissement.rating)` :
  - `kind: "stars"` → glyphe `★` (couleur or existante) + valeur formatée (ex. `4,6`).
  - `kind: "score"` → valeur formatée + libellé échelle (ex. `9,0 /10`).
  - Formatage du nombre via next-intl (`useFormatter`/`format.number`, 1 décimale) → virgule
    selon la locale. `null` → bloc note **masqué** (pas de placeholder).
- `variant="liste"` : layout actuel conservé + ligne note + jusqu'à **2** chips (`tags`).
- `variant="vignette"` : carte grille — photo (hauteur ~104px, `object-cover`) + cœur favori en
  overlay si `is_favorite`, nom (serif), sous-titre lieu (`ville`/`arrondissement`), ligne note +
  **1** chip. Navigation `/{base}/{id}` identique.
- Tokens : `--accent` maison, `rounded-card`/`rounded-control`. **Aucun token nouveau**, aucune
  couleur du kit (`#2563EB`) en dur. Chips réutilisent le rendu badge existant (couleur tag).

### 4. i18n

- Namespace `places`, **4 locales en parité**. Ajouts :
  - libellé d'échelle hôtel (ex. clé `noteSur10` → `/10`).
  - `aria`/label accessible de la note si nécessaire (ex. `noteAria`).
- Aucune chaîne en dur dans les composants.

## Tests

- **TDD domaine — `src/features/places/domain/categoryConfig.test.ts`** (`computeNotation`) :
  - resto : `4.6` → `{ kind: "stars", value: 4.6, scale: 5 }`.
  - hôtel : `4.5` → `{ kind: "score", value: 9.0, scale: 10 }` ; vérifier `rating * 2` (ex. `5` → `10`).
  - `rating = null` → `null` (resto et hôtel).
  - bornes : `0` → note rendue (valeur 0), pas `null`.
- **Composant — `PlaceCard`** (rendu) :
  - note resto affichée en étoile, note hôtel en score `/10`.
  - `variant="vignette"` rend la grille + 1 chip ; `variant="liste"` rend ≤ 2 chips.
  - `rating = null` → aucune note rendue.
- **e2e — `e2e/places.spec.ts`** : la note s'affiche sur la liste resto. Doter le seed
  « Le Bistrot Démo » d'un `rating` (ex. 4,6) ; assertion sur la note visible. Google Places mocké
  (déjà en place), aucune donnée prod touchée.

## Conventions Vito (rappel)

- Mobile-first PWA, App Router Next 16, RLS partout, `Link`/`redirect` locale-aware
  (`@/lib/i18n/routing`), i18n 4 locales (parité), aucune chaîne en dur, aucun nouveau token.
- API externe (Google Places) mockée en test. Secrets server-only. Tests RLS jamais contre la prod.
- TDD pour le domaine, e2e pour l'écran, review par task + review finale Opus, PR → CI verte →
  merge. **Aucune migration / pas de go-prod DB** dans cette slice.

## Sécurité

- Lecture seule côté nouveau code (affichage). `getPlaces()` reste filtré par owner via RLS
  `liste_items`. `rating`/`rating_count` proviennent d'`etablissements` (lecture authentifiée),
  donnée Google non sensible. Aucun nouveau verbe d'écriture, aucune nouvelle surface RLS.

## Hors périmètre

- Toggle de vue Liste/Vignettes/Carte dans `PlacesTabs` (→ Slice 3).
- Classe étoiles hôtel + UI hôtel paramétrée + sa source de données (→ Slice 7).
- Recherche découverte, carte combinée, archivage (→ Slices 4/5/6).
- Notation personnelle (« ma note ») : écartée du MVP.
