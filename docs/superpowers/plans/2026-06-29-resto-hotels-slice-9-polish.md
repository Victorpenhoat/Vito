# Slice 9 — Polish + kit — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finir l'épic : fix fuite `is_archived` (surfaces actives), error.tsx + loading.tsx restos/hôtels, a11y tablist places, nettoyage des Minors cosmétiques.

**Architecture:** Corrections ciblées (queries, scaffolding de routes, ARIA, classes). Aucune migration/domaine nouveau. Le kit est rafraîchi par le PO via `/design-sync` (hors code).

**Tech Stack:** Next 16 (App Router), React, TypeScript, next-intl 4, Tailwind v4, Supabase, Vitest, Playwright.

Spec : `docs/superpowers/specs/2026-06-29-resto-hotels-slice-9-polish-design.md`.

## Global Constraints

- Fix `is_archived` uniquement sur les surfaces **actives** (reco « ta liste » + KPI « à tester ») ; **ne pas** toucher les compteurs fenêtrés (sorties/nouveaux ce mois).
- error.tsx/loading.tsx calqués sur le pattern `famille`. i18n : `restos.error` existe ; ajouter `hotels.error.{title,retry}` ×4.
- a11y : pattern tablist complet (`id` + `aria-controls` sur les tabs ; `role="tabpanel"` + `aria-labelledby` sur le panneau). Le lien Archivés reste `aria-pressed`.
- Aucun nouveau token, aucune chaîne en dur, aucun testid existant retiré. RLS inchangée.
- **Vérif pré-push** : `npm run lint && npx tsc --noEmit && npm test`. Re-checker `gh pr checks` avant merge (flakes famille → re-run).
- **Aucune migration / pas de go-prod DB.**

---

### Task 1: Fix fuite `is_archived` (reco + accueil)

Exclure les archivés des surfaces actives. Queries Supabase (pas de test unitaire) ; vérifié par tsc + suite.

**Files:**
- Modify: `src/features/reco/data/queries.ts`
- Modify: `src/features/accueil/data/queries.ts`

**Interfaces:** Consumes/Produces: rien (filtre de lecture).

- [ ] **Step 1: reco « ta liste »**

Dans `src/features/reco/data/queries.ts`, sur la requête « ta liste » :
```ts
    .from("liste_items")
    .select("etablissement_id, is_favorite, etablissement:etablissements(id, nom, type, ville, arrondissement, price_level, photo_ref)");
```
ajouter le filtre `.eq("is_archived", false)` avant le `;` final du chaînage (juste après le `.select(...)`).

- [ ] **Step 2: accueil « restos à tester »**

Dans `src/features/accueil/data/queries.ts`, sur le compteur dont le filtre est `.eq("statut", "a_faire")`,
ajouter `.eq("is_archived", false)`. **Ne pas** modifier les compteurs « sorties » (`.eq("statut","visite")` + `added_at`) ni « nouveaux » (`added_at` seul).

- [ ] **Step 3: Lint + typecheck + suite**

Run: `npm run lint && npx tsc --noEmit && npm test`
Expected: PASS (aucune régression — accueil n'assert pas de valeur numérique de KPI).

- [ ] **Step 4: Commit**

```bash
git add src/features/reco/data/queries.ts src/features/accueil/data/queries.ts
git commit -m "fix(places): exclure les archivés de la reco « ta liste » et du KPI « à tester »"
```

---

### Task 2: error.tsx + loading.tsx (restos & hôtels) + i18n

**Files:**
- Create: `src/app/[locale]/(app)/restos/error.tsx`, `src/app/[locale]/(app)/restos/loading.tsx`
- Create: `src/app/[locale]/(app)/hotels/error.tsx`, `src/app/[locale]/(app)/hotels/loading.tsx`
- Modify: `messages/fr.json`, `messages/en.json`, `messages/it.json`, `messages/es.json`

**Interfaces:** Produces: `data-testid="error-boundary"` sur les error pages.

- [ ] **Step 1: i18n — `hotels.error` (4 locales)**

Dans le namespace `hotels` de chaque fichier, ajouter une clé `error` (mêmes valeurs que `restos.error`) :
- fr : `"error": { "title": "Une erreur est survenue", "retry": "Réessayer" }`
- en : `"error": { "title": "Something went wrong", "retry": "Try again" }`
- it : `"error": { "title": "Si è verificato un errore", "retry": "Riprova" }`
- es : `"error": { "title": "Se ha producido un error", "retry": "Reintentar" }`

(Garder le JSON valide ; `hotels` ne contient actuellement que `title`.)

- [ ] **Step 2: error.tsx (restos + hôtels)**

`src/app/[locale]/(app)/restos/error.tsx` :
```tsx
"use client";
import { useTranslations } from "next-intl";

export default function RestosError({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations("restos.error");
  return (
    <main className="p-6">
      <p role="alert" data-testid="error-boundary">{t("title")}</p>
      <button onClick={reset} className="underline">{t("retry")}</button>
    </main>
  );
}
```
`src/app/[locale]/(app)/hotels/error.tsx` : identique, mais `useTranslations("hotels.error")` et nom `HotelsError`.

- [ ] **Step 3: loading.tsx (restos + hôtels)**

Les deux fichiers sont identiques (layout places). `src/app/[locale]/(app)/restos/loading.tsx` :
```tsx
import { Skeleton } from "@/features/shared/ui/Skeleton";

export default function RestosLoading() {
  return (
    <main className="flex flex-col gap-6 p-4 md:p-8 lg:mx-auto lg:w-full lg:max-w-[1200px]">
      <div className="flex flex-col gap-1">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-8 w-40" />
      </div>
      <div className="flex gap-6 border-b border-line pb-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-20" />
        ))}
      </div>
      <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i} className="overflow-hidden rounded-card border border-line bg-surface">
            <Skeleton className="h-40 w-full" />
            <div className="flex flex-col gap-2 p-4">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
```
`src/app/[locale]/(app)/hotels/loading.tsx` : identique (nom `HotelsLoading`).

- [ ] **Step 4: Lint + typecheck + suite**

Run: `npm run lint && npx tsc --noEmit && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "src/app/[locale]/(app)/restos/error.tsx" "src/app/[locale]/(app)/restos/loading.tsx" "src/app/[locale]/(app)/hotels/error.tsx" "src/app/[locale]/(app)/hotels/loading.tsx" messages/fr.json messages/en.json messages/it.json messages/es.json
git commit -m "feat(places): error-boundary + loading skeletons pour restos & hôtels"
```

---

### Task 3: a11y tablist + Minors cosmétiques + e2e a11y

**Files:**
- Modify: `src/features/places/ui/PlacesTabs.tsx` (a11y)
- Modify: `src/features/places/ui/PlacesMapCombined.tsx` (chipCls hoist + map-list truncate)
- Modify: `src/features/places/ui/PlaceListPanel.tsx` (chipCls hoist)
- Modify: `src/features/places/ui/PlaceCard.tsx` (subtitle)
- Modify: `e2e/places.spec.ts` (assertion a11y)

**Interfaces:** Produces: `places-panel` (`role="tabpanel"`).

- [ ] **Step 1: `PlacesTabs` — pattern tablist ARIA**

Dans la `.map` des 4 onglets (`tabs.map`), ajouter sur chaque `<button …>` :
```tsx
              id={`tab-${it.key}`}
              aria-controls={`panel-${it.key}`}
```
(à côté de `role="tab"` / `data-testid` / `aria-selected` existants).

Remplacer les 4 rendus conditionnels des onglets principaux par un panneau enveloppant unique. Remplacer :
```tsx
      {tab === "favoris" && <PlaceListPanel places={favoris} views={TAB_VIEWS.favoris} locale={locale} category={category} />}
      {tab === "recommandes" && <PlaceListPanel places={recommandes} views={TAB_VIEWS.recommandes} locale={locale} category={category} />}
      {tab === "carte" && <PlacesMapCombined places={cartePlaces} locale={locale} />}
      {tab === "recherche" && <PlaceDiscovery places={places} category={category} />}
      {tab === "archives" && <ArchivedPanel places={archived} />}
```
par :
```tsx
      {tab !== "archives" && (
        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} data-testid="places-panel">
          {tab === "favoris" && <PlaceListPanel places={favoris} views={TAB_VIEWS.favoris} locale={locale} category={category} />}
          {tab === "recommandes" && <PlaceListPanel places={recommandes} views={TAB_VIEWS.recommandes} locale={locale} category={category} />}
          {tab === "carte" && <PlacesMapCombined places={cartePlaces} locale={locale} />}
          {tab === "recherche" && <PlaceDiscovery places={places} category={category} />}
        </div>
      )}
      {tab === "archives" && <ArchivedPanel places={archived} />}
```

- [ ] **Step 2: Hoister `chipCls` (PlaceListPanel + PlacesMapCombined)**

Dans **chacun** des deux fichiers, retirer le `const chipCls = (active: boolean) => …` du corps du composant et le déclarer au niveau module (au-dessus du composant) :
```tsx
function chipCls(active: boolean): string {
  return `whitespace-nowrap rounded-control border px-3 py-1 text-xs ${active ? "border-transparent bg-accent text-white" : "border-line text-muted"}`;
}
```
(Les appels `chipCls(...)` dans le JSX restent inchangés.)

- [ ] **Step 3: `PlacesMapCombined` — truncate des noms (map-list)**

Sur le `<Link>` de `map-list-item`, remplacer sa `className` `"text-sm text-accent hover:underline"` par
`"block truncate text-sm text-accent hover:underline"`.

- [ ] **Step 4: `PlaceCard` — sous-titre liste**

Dans le variant **liste**, remplacer :
```tsx
          {subtitle && <span className="text-sm text-muted">{etablissement.ville}</span>}
```
par :
```tsx
          {subtitle && <span className="text-sm text-muted">{subtitle}</span>}
```

- [ ] **Step 5: e2e — assertion a11y**

Dans `e2e/places.spec.ts`, ajouter à la fin :
```ts
test("a11y : le panneau d'onglet expose role=tabpanel lié à l'onglet actif", async ({ page }) => {
  await login(page);
  const panel = page.getByTestId("places-panel");
  await expect(panel).toHaveAttribute("role", "tabpanel");
  await expect(panel).toHaveAttribute("aria-labelledby", "tab-favoris");
});
```

- [ ] **Step 6: Lint + typecheck + suite + e2e places**

Run: `npm run lint && npx tsc --noEmit && npm test && npx playwright test e2e/places.spec.ts`
Expected: PASS (suite unitaire + e2e places, dont le nouveau test a11y).

- [ ] **Step 7: Commit**

```bash
git add src/features/places/ui/PlacesTabs.tsx src/features/places/ui/PlacesMapCombined.tsx src/features/places/ui/PlaceListPanel.tsx src/features/places/ui/PlaceCard.tsx e2e/places.spec.ts
git commit -m "polish(places): a11y tablist (role tabpanel) + truncate map-list + chipCls hoist + subtitle"
```

---

## Self-Review

**Spec coverage :**
- §1 Fix `is_archived` (reco + accueil restosATester ; sorties/nouveaux intacts) → Task 1. ✅
- §2 error.tsx + loading.tsx restos/hôtels + `hotels.error` i18n → Task 2. ✅
- §3 a11y tablist (id/aria-controls/role=tabpanel/aria-labelledby) → Task 3. ✅
- §4 Minors (truncate, chipCls hoist ×2, subtitle) → Task 3. ✅
- §5 Kit (PO via /design-sync) → hors code, rappelé au PO. ✅
- §Tests (e2e a11y + non-régression) → Tasks 1-3. ✅
- §Sécurité (filtre restrictif, présentation, ARIA) → respecté. ✅

**Placeholder scan :** aucun TBD/TODO ; code complet à chaque étape.

**Type consistency :** `places-panel`/`error-boundary` testids cohérents. `id={`tab-${key}`}`/`aria-controls={`panel-${key}`}` ↔ `id={`panel-${tab}`}`/`aria-labelledby={`tab-${tab}`}` (mêmes clés). `Skeleton` accepte `className`. `restos.error`/`hotels.error` namespaces existants/ajoutés.

**Gap connu (assumé) :** error.tsx/loading.tsx = scaffolding sans e2e dédié (transitoire / nécessite une erreur — comme famille). Le fix `is_archived` n'a pas de test unitaire (query Supabase) ; couvert par la non-régression de la suite (le resto archivé seedé `2e` n'affecte pas le pool 17e de recherche ; accueil n'assert pas de valeur numérique). Le kit Claude Design est hors code (PO via `/design-sync`).
