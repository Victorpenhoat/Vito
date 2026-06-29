# Slice 8 — Desktop (versions Web) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre les écrans Resto/Hôtels confortables sur desktop (lg+) : grilles élargies, carte combinée en deux panneaux (liste 340px + carte), contenu plafonné ~1200px.

**Architecture:** Responsive Tailwind pur (aucune logique métier/donnée/migration/i18n nouvelle). Generic → couvre resto **et** hôtel. Le shell est déjà responsive.

**Tech Stack:** Next 16 (App Router), React, TypeScript, Tailwind v4 (breakpoints stock), Playwright.

Spec : `docs/superpowers/specs/2026-06-29-resto-hotels-slice-8-desktop-design.md`.

## Global Constraints

- Breakpoints Tailwind v4 stock (sm 640 / md 768 / lg 1024 / xl 1280). Mobile-first : ne jamais dégrader < lg.
- Carte desktop = deux panneaux `lg:grid-cols-[340px_1fr]` (liste `hidden lg:block` + carte). Mobile inchangé.
- Contenu plafonné `lg:max-w-[1200px]` centré.
- Grilles : vignettes `lg:grid-cols-3` ; envies `sm:grid-cols-3 lg:grid-cols-4` ; résultats Recherche `lg:grid-cols-2`. Vue liste détaillée reste `sm:grid-cols-2`.
- **Aucun nouveau token, aucune chaîne en dur, aucune migration.** `Link` locale-aware. Dark-first (maquette claire = preview).
- **Vérif pré-push** : `npm run lint && npx tsc --noEmit && npm test`. Re-checker `gh pr checks` avant merge (flakes famille → re-run).

---

### Task 1: Grilles responsive + largeur plafonnée

Classes Tailwind uniquement, aucun changement de comportement (vérifié par tsc + suite verte).

**Files:**
- Modify: `src/features/places/ui/PlaceListPanel.tsx` (grille vignettes)
- Modify: `src/features/places/ui/PlaceDiscovery.tsx` (envies + résultats)
- Modify: `src/app/[locale]/(app)/restos/page.tsx`, `src/app/[locale]/(app)/hotels/page.tsx` (max-width)

**Interfaces:**
- Consumes/Produces: rien (présentation).

- [ ] **Step 1: `PlaceListPanel` — vignettes 3 colonnes à lg**

Dans `src/features/places/ui/PlaceListPanel.tsx`, juste avant le `return`, ajouter une classe calculée selon la vue (après `const shown = …`) :
```tsx
  const gridCls =
    view === "vignettes"
      ? "grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
      : "grid grid-cols-1 gap-5 sm:grid-cols-2";
```
Et remplacer la ligne du `<ul>` (actuellement `<ul className="grid grid-cols-1 gap-5 sm:grid-cols-2">`) par :
```tsx
        <ul className={gridCls}>
```

- [ ] **Step 2: `PlaceDiscovery` — envies + résultats**

Dans `src/features/places/ui/PlaceDiscovery.tsx` :
- Envies : remplacer `<div className="grid grid-cols-2 gap-2.5">` par :
```tsx
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
```
- Résultats : remplacer le `<ul className="flex flex-col">` (celui qui précède `data-testid="search-result"`) par :
```tsx
        <ul className="flex flex-col lg:grid lg:grid-cols-2 lg:gap-x-6">
```
(Ne PAS toucher le `<ul className="flex flex-col">` des recherches récentes.)

- [ ] **Step 3: Pages — largeur plafonnée**

Dans `src/app/[locale]/(app)/restos/page.tsx` et `src/app/[locale]/(app)/hotels/page.tsx`, remplacer
`<main className="flex flex-col gap-6 p-4 md:p-8">` par :
```tsx
    <main className="flex flex-col gap-6 p-4 md:p-8 lg:mx-auto lg:w-full lg:max-w-[1200px]">
```

- [ ] **Step 4: Lint + typecheck + suite**

Run: `npm run lint && npx tsc --noEmit && npm test`
Expected: PASS (aucune régression ; changements purement responsive).

- [ ] **Step 5: Commit**

```bash
git add src/features/places/ui/PlaceListPanel.tsx src/features/places/ui/PlaceDiscovery.tsx "src/app/[locale]/(app)/restos/page.tsx" "src/app/[locale]/(app)/hotels/page.tsx"
git commit -m "feat(places): grilles desktop (vignettes 3col, envies, résultats) + largeur plafonnée"
```

---

### Task 2: `PlacesMapCombined` — deux panneaux desktop (liste + carte)

Ajouter un panneau liste à gauche (340px) à `lg+`, la carte à droite. Mobile inchangé.

**Files:**
- Modify: `src/features/places/ui/PlacesMapCombined.tsx`

**Interfaces:**
- Consumes: `filtered` (déjà calculé via `filterByTag`).
- Produces: testids `map-list` (panneau, `hidden lg:block`) + `map-list-item` (lignes).

- [ ] **Step 1: Ajouter l'import `Link`**

En tête de `src/features/places/ui/PlacesMapCombined.tsx`, après l'import de `PlacesMapLazy`, ajouter :
```tsx
import { Link } from "@/lib/i18n/routing";
```

- [ ] **Step 2: Remplacer le rendu de la carte par la grille deux-panneaux**

Remplacer la ligne `<PlacesMapLazy places={filtered} locale={locale} />` par :
```tsx
      <div className="lg:grid lg:grid-cols-[340px_1fr] lg:gap-4">
        <aside data-testid="map-list" className="hidden lg:block lg:max-h-[60vh] lg:overflow-y-auto">
          <ul className="flex flex-col">
            {filtered.map((p) => {
              const base = p.etablissement.categorie === "hotel" ? "hotels" : "restos";
              return (
                <li key={p.id} data-testid="map-list-item" className="border-b border-line-soft py-2">
                  <Link href={`/${base}/${p.etablissement.id}`} className="text-sm text-accent hover:underline">
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

- [ ] **Step 3: Lint + typecheck + suite**

Run: `npm run lint && npx tsc --noEmit && npm test`
Expected: PASS (le panneau `hidden lg:block` n'affecte pas le rendu mobile ni les tests existants).

- [ ] **Step 4: Commit**

```bash
git add src/features/places/ui/PlacesMapCombined.tsx
git commit -m "feat(places): carte combinée desktop deux-panneaux (liste 340px + carte)"
```

---

### Task 3: e2e desktop

**Files:**
- Create: `e2e/restos-desktop.spec.ts`

**Interfaces:**
- Consumes: Carte deux-panneaux (Task 2).
- Produces: rien (test terminal).

- [ ] **Step 1: Créer `e2e/restos-desktop.spec.ts`**

```ts
import { test, expect, type Page } from "@playwright/test";

async function login(page: Page) {
  await page.goto("/fr/login");
  await page.getByLabel("E-mail").fill("client@vito.test");
  await page.getByLabel("Mot de passe").fill("password123");
  await page.getByRole("button", { name: "Connexion" }).click();
  await expect(page).toHaveURL(/\/fr\/accueil/);
}

test.describe("desktop", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("onglet Carte : panneau liste deux-panneaux visible sur desktop", async ({ page }) => {
    await login(page);
    await page.goto("/fr/restos");
    await page.getByTestId("tab-carte").click();
    await expect(page.getByTestId("places-map")).toBeVisible();
    await expect(page.getByTestId("map-list")).toBeVisible();
    await expect(page.getByTestId("map-list-item").first()).toBeVisible();
  });
});

test.describe("mobile (non-régression)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("onglet Carte : panneau liste masqué sur mobile (carte pleine largeur)", async ({ page }) => {
    await login(page);
    await page.goto("/fr/restos");
    await page.getByTestId("tab-carte").click();
    await expect(page.getByTestId("places-map")).toBeVisible();
    await expect(page.getByTestId("map-list")).toBeHidden();
  });
});
```

- [ ] **Step 2: Lancer l'e2e desktop**

Run: `npx playwright test e2e/restos-desktop.spec.ts`
Expected: PASS (2 tests). Le seed resto fournit ≥1 lieu sur la carte combinée (`map-list-item` présent à 1280px ; `map-list` masqué à 390px via `hidden lg:block`).

- [ ] **Step 3: Commit**

```bash
git add e2e/restos-desktop.spec.ts
git commit -m "test(places): e2e desktop — carte deux-panneaux (liste visible 1280 / masquée 390)"
```

---

## Self-Review

**Spec coverage :**
- §1 `PlaceListPanel` vignettes 3 col → Task 1. ✅
- §2 `PlaceDiscovery` envies + résultats → Task 1. ✅
- §3 `PlacesMapCombined` deux-panneaux → Task 2. ✅
- §4 Pages max-width → Task 1. ✅
- §Tests (e2e desktop + mobile non-régression) → Task 3. ✅
- §Sécurité (lecture seule, présentation) → respecté. ✅
- Hors périmètre (thème clair, nouvelles features) → non implémenté. ✅

**Placeholder scan :** aucun TBD/TODO ; code complet à chaque étape.

**Type consistency :** `map-list`/`map-list-item` (Task 2) testés par l'e2e (Task 3). `Link` importé de `@/lib/i18n/routing`. Aucun nouveau token (`border-line-soft`/`text-accent`/`text-muted` éprouvés). Le panneau liste consomme `filtered` (déjà présent). testids alignés : `tab-carte`, `places-map`, `map-list`, `map-list-item`.

**Gap connu (assumé) :** les nombres de colonnes des grilles (vignettes/envies/résultats) sont du CSS pur, non assertables de façon fiable en e2e — vérifiés visuellement contre la maquette Web ; l'e2e couvre le seul comportement responsive testable (présence/masquage du panneau liste Carte selon le viewport). `PlacesMapCombined`/`PlaceDiscovery`/`PlaceListPanel` n'ont pas de test composant (Leaflet/server bundle) — conforme à la convention du repo (l'e2e couvre l'écran).
