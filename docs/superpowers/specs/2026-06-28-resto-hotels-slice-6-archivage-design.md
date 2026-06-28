# Spec — Slice 6 : Archivage

> Épic « Refonte Resto + Hôtels » (directive `docs/design/restos-hotels-refonte-epic-directive.md`).
> Slice 6 de la roadmap. Suit la Slice 5 (recherche découverte, PR #50, mergée).

## Objectif

Permettre d'**archiver / désarchiver** un établissement (`liste_items.is_archived`) : les archivés
sont **exclus des listes actives** (Favoris/Recommandés/Carte) — déjà le cas via `getPlaces` — et
consultables via une **vue « Archivés »** discrète d'où on peut les désarchiver. Brique générique
(resto **et** hôtel). Orthogonal à `is_favorite` et `statut`.

## Décisions PO (validées le 2026-06-28)

1. **Vue Archivés = lien discret « Archivés (N) »** sous la barre d'onglets (garde les 4 onglets
   primaires Favoris·Recommandés·Carte·Recherche ; pas d'encombrement mobile, fidèle à la maquette).
   Affiché uniquement si `N > 0`.
2. **Archivage depuis la fiche** (toggle, comme le favori) ; **désarchivage inline** depuis la liste
   Archivés (bouton par item, là où on les cherche).
3. **Orthogonal** : archiver ne touche pas `is_favorite` ni `statut` — l'item est seulement masqué des
   listes actives. Désarchiver le restaure tel quel.
4. **Par catégorie** : la vue Archivés est resto sur la page resto, hôtel sur la page hôtel
   (cohérent avec `PlacesTabs`).

## État de départ (après Slice 5 — vérifié)

- DB : `liste_items.is_archived boolean not null default false`, `archived_at timestamptz`
  (migration 00020, déjà en prod). Typé dans `database.types.ts`.
- `places/data/queries.ts` : `getPlaces(category)` sélectionne les `liste_items` avec
  `.eq("etablissement.categorie", category).eq("is_archived", false)` et mappe vers `Place[]`.
- `restos/data/queries.ts` : `getFiche` sélectionne le `liste_items` avec `id, statut, is_favorite`
  (**pas** `is_archived`).
- `restos/data/actions.ts` : `toggleFavorite(_prev, formData{listeItemId, isFavorite})` met à jour
  `is_favorite` par id (owner-only RLS) + `revalidatePath`. Modèle à suivre.
- `restos/domain/schemas.ts` : `toggleFavoriteSchema` (`listeItemId` uuid + `isFavorite` enum
  `"true"/"false"`→bool). Testé dans `schemas.test.ts`.
- `restos/ui/FavoriteToggle.tsx` : client `useActionState` + `<form>` + `Button`. Modèle à suivre.
- `restos/ui/FicheResto.tsx` : rend `<FavoriteToggle listeItemId={item.id} isFavorite={item.is_favorite} />`
  quand `item` existe.
- `places/ui/PlacesTabs.tsx` : 4 onglets (`tab-favoris`/`tab-recommandes`/`tab-carte`/`tab-recherche`),
  prop `{ category, places }`.
- Pages `restos/page.tsx`, `hotels/page.tsx` : `getPlaces(category)` → `<PlacesTabs category places />`.
- RLS : `liste_items` owner-only (les 4 verbes).

## Architecture / composants

### 1. Data

- **`src/features/places/data/queries.ts`** :
  - Factoriser le `select`/mapping partagé dans un helper interne `queryPlaces(category, archived: boolean)`
    (le `select` string et le `.map(...)` sont identiques ; seul `.eq("is_archived", …)` change).
  - `getPlaces(category)` → `queryPlaces(category, false)` (comportement inchangé).
  - **`getArchivedPlaces(category): Promise<Place[]>`** → `queryPlaces(category, true)`.
- **`src/features/restos/data/queries.ts`** `getFiche` : ajouter `is_archived` au select du `liste_items`
  (`"id, statut, is_favorite, is_archived"`). Le `item` retourné porte alors `is_archived`.

### 2. Domaine — schéma

- **`src/features/restos/domain/schemas.ts`** : ajouter
  ```ts
  export const toggleArchiveSchema = z.object({
    listeItemId: z.string().uuid(),
    isArchived: z.enum(["true", "false"]).transform((v) => v === "true"),
  });
  ```
- TDD via `schemas.test.ts`.

### 3. Action

- **`src/features/restos/data/actions.ts`** : ajouter
  `toggleArchive(_prev, formData{ listeItemId, isArchived })` :
  - parse via `toggleArchiveSchema` ; auth-gate (comme les autres).
  - `update({ is_archived: parsed.isArchived, archived_at: parsed.isArchived ? new Date().toISOString() : null }).eq("id", listeItemId)` sur `liste_items`.
  - `revalidatePath("/restos")` **et** `revalidatePath("/hotels")` (l'action ne connaît pas la
    catégorie ; revalider les deux listes actives est sûr et peu coûteux).
  - Retour `{}` / `{ error }` comme `toggleFavorite`.

### 4. UI

- **`src/features/restos/ui/ArchiveToggle.tsx`** (nouveau, client) — calque de `FavoriteToggle` :
  props `{ listeItemId: string; isArchived: boolean }` ; `useActionState(toggleArchive)` ;
  `<form>` + hidden `listeItemId` + hidden `isArchived={String(!isArchived)}` ;
  `<Button variant="ghost" data-testid="archive-toggle">{isArchived ? t("desarchiver") : t("archiver")}</Button>`.
  i18n namespace `restos`.
- **`src/features/restos/ui/FicheResto.tsx`** : sous le `FavoriteToggle`, ajouter
  `{item && <ArchiveToggle listeItemId={item.id} isArchived={item.is_archived} />}`. (Nécessite
  `is_archived` dans le `item` — fourni par §1.)
- **`src/features/places/ui/ArchivedPanel.tsx`** (nouveau, client) — props `{ places: Place[] }` :
  - si vide → message `t("archivesVide")` (`data-testid="archives-empty"`).
  - sinon, `<ul>` de lignes (`data-testid="archived-item"`) : lien `Link` vers `/{base}/{etab.id}`
    (`base` selon `categorie`) avec nom + ville ; à droite un `<form>` (action `toggleArchive`,
    hidden `listeItemId`, hidden `isArchived="false"`) + `<Button variant="ghost"
    data-testid="archive-unarchive">{t("desarchiver")}</Button>`. `ArchivedPanel` utilise deux
    namespaces : `useTranslations("restos")` pour `desarchiver` et `useTranslations("places")` pour
    `archivesVide`. (`archiver`/`desarchiver` vivent dans `restos` — partagés fiche + panel.)
- **`src/features/places/ui/PlacesTabs.tsx`** :
  - prop ajoutée `archived: Place[]`.
  - état d'onglet élargi : `tab: PlacesTab | "archives"`.
  - sous la barre des 4 onglets, si `archived.length > 0`, un lien discret
    `data-testid="tab-archives"` (`aria-selected` quand actif) libellé `t("archives")` + « (N) ».
  - quand `tab === "archives"` → rend `<ArchivedPanel places={archived} />` à la place du contenu
    d'onglet ; sinon comportement inchangé.
- **Pages** `restos/page.tsx`, `hotels/page.tsx` : `const archived = await getArchivedPlaces(category)` ;
  `<PlacesTabs category={…} places={places} archived={archived} />`.

### 5. i18n (4 locales, parité)

- Namespace `restos` : `archiver` (« Archiver »), `desarchiver` (« Désarchiver »).
- Namespace `places` : `archives` (« Archivés »), `archivesVide` (« Aucun établissement archivé »).

## Tests

- **TDD domaine — `src/features/restos/domain/schemas.test.ts`** : ajouter des cas pour
  `toggleArchiveSchema` (uuid valide + `isArchived:"true"`→`true` ; `"false"`→`false` ;
  `listeItemId` non-uuid → échec).
- **e2e — `e2e/places.spec.ts`** (resto) : avec un item seedé **déjà archivé** (« Le Resto Archivé
  Démo », sans coordonnées pour ne pas affecter le comptage Carte) :
  - le lien `tab-archives` est visible (N ≥ 1) ; cliquer → `archived-item` contient « Le Resto
    Archivé Démo ».
  - **round-trip neutre en état** : cliquer `archive-unarchive` inline → l'item quitte les archivés ;
    ouvrir sa fiche → `archive-toggle` (« Archiver ») → re-archivé ; revenir → `tab-archives` le
    remontre. (Restaure l'état initial.)
  - Seed : nouvel établissement resto + `liste_items(is_archived=true, statut='a_faire',
    is_favorite=false)` pour ce client. N'apparaît dans aucune liste active (exclu) → comptages des
    tests existants inchangés. Google Places mocké, aucune donnée prod touchée.

## Conventions Vito (rappel)

- Mobile-first PWA, App Router Next 16, RLS partout, `Link`/actions locale-aware, i18n 4 locales
  (parité), aucune chaîne en dur, aucun nouveau token. TDD pour le domaine, e2e pour l'écran,
  review par task + review finale Opus, PR → CI verte → merge.
- **Vérification pré-push** : `npm run lint && npx tsc --noEmit && npm test` (la CI `quality` lance
  eslint — règles `react-hooks` strictes).
- **Aucune migration / pas de go-prod DB** dans cette slice (colonnes 00020 déjà en prod).

## Sécurité

- `toggleArchive` met à jour `liste_items` par `id` sous RLS **owner-only** (un utilisateur ne peut
  archiver que ses propres lignes). `getArchivedPlaces` est filtré owner par la même RLS. Aucun
  élargissement de surface, aucune nouvelle table. `archived_at` informatif.

## Hors périmètre

- Archivage en masse / depuis les cartes (uniquement depuis la fiche).
- Modification de `is_favorite`/`statut` à l'archivage (strictement orthogonal).
- Onglet Hôtels paramétré → Slice 7. Desktop → Slice 8. Polish/skeletons/a11y → Slice 9.
