# Spec — Slice 8 : Desktop (versions Web)

> Épic « Refonte Resto + Hôtels » (directive `docs/design/restos-hotels-refonte-epic-directive.md`).
> Slice 8 de la roadmap. Suit la Slice 7 (onglet hôtels, PR #52, mergée). Maquettes Web (1280px) dans
> `docs/design/Onglet_Resto.dc.html` (écrans « Web — Favoris/Carte/Recherche ») et
> `docs/design/Onglet_Hotels.dc.html` (« Web — Favoris »).

## Objectif

Rendre les écrans Resto/Hôtels confortables sur desktop (lg+/1280px) conformément aux maquettes Web :
grilles élargies, carte combinée en **deux panneaux** (liste + carte), contenu plafonné. Travail
**responsive** uniquement (Tailwind) — aucune logique métier, aucune donnée, aucune migration.

## Décisions PO (validées le 2026-06-29)

1. **Carte desktop = deux panneaux** (liste 340px + carte) à `lg+`, conforme maquette Web
   (`grid-template-columns: 340px 1fr`).
2. **Contenu plafonné** ~1200px centré à `lg+` (confort ultrawide).
3. **Grilles** : vignettes `lg:grid-cols-3` ; « Explorer par envie » `sm:grid-cols-3 lg:grid-cols-4` ;
   résultats Recherche `lg:grid-cols-2`. (Vue liste détaillée reste `sm:grid-cols-2`.)

## État de départ (après Slice 7 — vérifié)

- **Shell déjà responsive** (`src/features/shell/ui/AppShell.tsx`) : `Sidebar` `hidden … md:flex` (w-64),
  `BottomNav` `md:hidden`, contenu `pb-16 md:pb-0 md:pl-64`. Aucune action shell requise.
- Breakpoints Tailwind v4 stock (sm 640 / md 768 / lg 1024 / xl 1280) ; aucun override (globals.css `@theme`).
- `PlaceListPanel` (`src/features/places/ui/PlaceListPanel.tsx`) : grille de cartes
  `grid grid-cols-1 gap-5 sm:grid-cols-2` (une seule classe pour liste **et** vignettes).
- `PlaceDiscovery` (`src/features/places/ui/PlaceDiscovery.tsx`) : envies `grid grid-cols-2 gap-2.5` ;
  résultats `<ul className="flex flex-col">`.
- `PlacesMapCombined` (`src/features/places/ui/PlacesMapCombined.tsx`) : `<div className="flex flex-col gap-3">`
  → chips (`map-tag-filter`) + légende (`map-legend`) + comptage (`map-count`) + `PlacesMapLazy(filtered)`.
  `filtered = filterByTag(places, selectedTag)`.
- Pages `restos/page.tsx`, `hotels/page.tsx` : `<main className="flex flex-col gap-6 p-4 md:p-8">` —
  **pas de max-width**, contenu pleine largeur.
- Maquettes Web : Favoris vignettes `repeat(3,1fr)` ; Carte `340px 1fr` ; Recherche `1fr 1fr`.
- e2e desktop existant : `e2e/famille-desktop.spec.ts` utilise `test.use({ viewport: { width: 1280, height: 800 } })`.
- Tokens maison ; l'app est dark-first (le fond clair des maquettes est une preview, non normatif).

## Architecture / composants

### 1. `PlaceListPanel` — grille vignettes à 3 colonnes (lg)

La grille de rendu dépend de la vue : la **vue vignettes** passe à 3 colonnes sur desktop, la **vue
liste** (cartes détaillées) reste à 2. Remplacer la `className` du `<ul>` par une classe calculée :
```tsx
const gridCls =
  view === "vignettes"
    ? "grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
    : "grid grid-cols-1 gap-5 sm:grid-cols-2";
```
(appliquée au `<ul>` du rendu non-carte).

### 2. `PlaceDiscovery` — envies + résultats

- Envies : `grid grid-cols-2 gap-2.5` → `grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4`.
- Résultats : le `<ul className="flex flex-col">` des `search-result` → `lg:grid lg:grid-cols-2 lg:gap-x-6`
  (reste une colonne empilée < lg ; deux colonnes à lg+). Les bordures `border-b` de ligne restent acceptables.

### 3. `PlacesMapCombined` — deux panneaux desktop (liste + carte)

- Conserver en tête : chips de filtre + légende + comptage (les deux tailles).
- Le bloc carte devient une grille responsive :
  ```tsx
  <div className="lg:grid lg:grid-cols-[340px_1fr] lg:gap-4">
    <aside data-testid="map-list" className="hidden lg:block lg:max-h-[60vh] lg:overflow-y-auto">
      <ul className="flex flex-col">
        {filtered.map((p) => {
          const base = p.etablissement.categorie === "hotel" ? "hotels" : "restos";
          return (
            <li key={p.id} data-testid="map-list-item" className="border-b border-line-soft py-2">
              <Link href={`/${base}/${p.etablissement.id}`} className="text-accent hover:underline">
                {p.etablissement.nom}
                {p.etablissement.ville ? <span className="text-muted"> · {p.etablissement.ville}</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </aside>
    <PlacesMapLazy places={filtered} locale={locale} />
  </div>
  ```
- Mobile (< lg) : `lg:grid` ne s'applique pas → le panneau liste `hidden lg:block` reste masqué, la
  carte occupe toute la largeur (comportement actuel inchangé).
- `Link` importé depuis `@/lib/i18n/routing`. Aucun nouveau token (réutilise `border-line-soft`,
  `text-accent`, `text-muted`).

### 4. Pages — largeur plafonnée

`restos/page.tsx` et `hotels/page.tsx` : `<main>` →
`className="flex flex-col gap-6 p-4 md:p-8 lg:mx-auto lg:w-full lg:max-w-[1200px]"`.

### 5. Pas de migration / domaine / i18n

Uniquement des classes Tailwind + un panneau liste réutilisant des données déjà présentes. Aucun
nouveau token, aucune chaîne en dur (les lignes du panneau affichent `nom`/`ville`, données).

## Tests

- **e2e — `e2e/restos-desktop.spec.ts`** (nouveau, pattern `famille-desktop.spec`) :
  - `test.use({ viewport: { width: 1280, height: 800 } })` : login → `/fr/restos` → onglet Carte
    (`tab-carte`) → le panneau liste desktop `map-list` est **visible** ; `map-list-item` présent.
  - Un `test.describe` mobile (`viewport: { width: 390, height: 844 }`) : sur l'onglet Carte,
    `map-list` est **masqué** (`hidden lg:block`) → `await expect(page.getByTestId("map-list")).toBeHidden()`
    (ou `toHaveCount` selon rendu — `hidden` reste dans le DOM, donc `toBeHidden()`).
  - (Les nombres de colonnes des grilles sont du CSS pur, non assertables de façon fiable ; on teste
    le comportement responsive réel = la présence/masquage du panneau liste de la Carte.)
- Vérifier que la **suite existante reste verte** (les changements sont additifs/responsive ; aucun
  testid existant retiré).

## Conventions Vito (rappel)

- Mobile-first PWA, App Router Next 16, Tailwind v4 (breakpoints stock), `Link` locale-aware, aucun
  nouveau token, aucune chaîne en dur. Dark-first (maquette claire = preview).
- **Vérif pré-push** : `npm run lint && npx tsc --noEmit && npm test`. Re-checker `gh pr checks` avant
  merge (flakes famille connus → re-run).
- **Aucune migration / pas de go-prod DB.**

## Sécurité

- Aucun changement de données, d'action, de RLS. Le panneau liste de la Carte affiche des lieux déjà
  chargés et autorisés (mêmes données que les pins). Lecture seule, purement présentation.

## Hors périmètre

- Refonte visuelle au-delà du responsive ; thème clair (l'app reste dark-first).
- Nouvelles features. Polish/skeletons/a11y + consolidation des Minors (→ Slice 9).
