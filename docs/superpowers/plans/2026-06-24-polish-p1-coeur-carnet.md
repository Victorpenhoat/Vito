# Polish P1 — Cœur carnet (Restos, Vins, Recherche) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Appliquer le kit Core.Badakan (Button/Card/Badge/Tile/SectionLabel + nouveau PageHeader) aux écrans Restos, Vins et Recherche — polish **visuel uniquement**, sans toucher logique/requêtes/`data-testid`.

**Architecture:** Pour chaque composant, remplacer le Tailwind ad-hoc par les composants du kit et les tokens, en conservant strictement les `data-testid`, les server actions/queries, les props et le comportement. Un nouveau `PageHeader` factorise l'en-tête de page. Les e2e existants restent verts sans modification.

**Tech Stack:** Next.js 16, Tailwind v4, kit `@/features/shared/ui`, next-intl, Playwright.

## Global Constraints

- **Polish visuel UNIQUEMENT.** Interdits : modifier/retirer/renommer un `data-testid` ; changer une
  server action, une query, une prop, un import de data ; changer un comportement. Si un e2e casse, c'est
  une régression à corriger dans le composant, pas dans le test.
- **Règles de mapping (bricolage → kit)** à appliquer dans chaque fichier :
  | Avant | Après |
  |---|---|
  | `<button className="bg-black text-white …">` | `<Button>` (`variant` primary/ghost/subtle), `disabled`/`pending` conservés |
  | ligne/carte `border p-2`/`border p-3` | `<Card>` ou `rounded-card border border-line bg-surface p-4` |
  | `text-2xl font-bold` (titre page) | `<PageHeader title=… action=… />` |
  | `text-gray-500/600/700` | `text-muted` (ou `text-faint` si très discret) |
  | `<input className="border p-2">` / `<select>`/`<textarea>` | `rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:outline-2 focus:outline-accent` |
  | pastille compteur/statut | `<Badge>` |
  | liens | `text-accent hover:underline` |
- Réutiliser le kit existant ; ne PAS introduire de logique métier dans les composants UI.
- Imports kit : `@/features/shared/ui/<Composant>` ; `Link` depuis `@/lib/i18n/routing`.
- Gate par task : `npm run typecheck && npm run lint && npm run test` + l'e2e de l'écran concerné.

---

### Task 1: `PageHeader` (kit) + polish écran Restos

**Files:**
- Create: `src/features/shared/ui/PageHeader.tsx`
- Modify: `src/features/restos/ui/{RestoList,RestoSearch,FavoriteToggle,TagPicker,AvisForm,FicheResto}.tsx`
- Modify: `src/features/reco/ui/GoutsBanner.tsx`
- Modify: `src/app/[locale]/(app)/restos/page.tsx`, `src/app/[locale]/(app)/restos/[id]/page.tsx`

**Interfaces:**
- Produces : `PageHeader` (`{ title: string; action?: ReactNode }`).

- [ ] **Step 1: Créer `PageHeader`**

Create `src/features/shared/ui/PageHeader.tsx` :
```tsx
import type { ReactNode } from "react";

export function PageHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <header className="mb-2 flex items-center justify-between gap-3">
      <h1 className="text-2xl font-bold text-ink">{title}</h1>
      {action}
    </header>
  );
}
```

- [ ] **Step 2: Page restos + exemple type (RestoList)**

In `src/app/[locale]/(app)/restos/page.tsx`, replace the `<h1 className="text-2xl font-bold">{t("title")}</h1>`
with `<PageHeader title={t("title")} />` (import it). Keep `<main className="p-6 flex flex-col gap-6">`
(or use `p-4 md:p-6`), keep `GoutsBanner`/`RestoSearch`/`RestoList` as-is.

Worked example — `src/features/restos/ui/RestoList.tsx`, style the list item as a card and the secondary
text as muted (keep `data-testid="resto-card"`, the `Link`, the favorite `★`, the i18n):
```tsx
          <li
            key={it.id}
            data-testid="resto-card"
            className="flex items-center justify-between rounded-card border border-line bg-surface p-4"
          >
            <Link href={`/restos/${etab.id}`} className="text-ink hover:text-accent">
              {etab.nom} {it.is_favorite ? <span aria-label={t("favorite")}>★</span> : null}{" "}
              <span className="text-muted">({etab.type ?? "—"})</span>
            </Link>
          </li>
```
(Only classes + the wrapping element style change; `data-testid`, `Link` href, favorite logic, i18n keys
are untouched.)

- [ ] **Step 3: Appliquer les règles aux autres composants restos**

Apply the Global-Constraints mapping to `RestoSearch`, `FavoriteToggle`, `TagPicker`, `AvisForm`,
`FicheResto` and `reco/ui/GoutsBanner` and `restos/[id]/page.tsx` : buttons → `<Button>`, inputs/selects/
textarea → the token input classes, `border p-*` containers → `Card`/card classes, `text-gray-*` →
`text-muted`, page title → `PageHeader`. **Read each file first**, change only presentation, preserve
every `data-testid` (e.g. `tags-saved`, `add-resto-search`, …), every action/query, every i18n call.

- [ ] **Step 4: Vérifier (typecheck + lint + unit)**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS (aucun changement de type/test ; rien de cassé).

- [ ] **Step 5: e2e restos (non-régression)**

Run: `supabase db reset && npx playwright test e2e/restos.spec.ts --retries=0`
Expected: PASS sans modifier le spec (testids/flux inchangés). Si échec → un testid/comportement a bougé,
corriger le composant.

- [ ] **Step 6: Commit**

```bash
git add src/features/shared/ui/PageHeader.tsx src/features/restos/ src/features/reco/ui/GoutsBanner.tsx "src/app/[locale]/(app)/restos/"
git commit -m "polish(restos): kit Core.Badakan (cartes/boutons/PageHeader), visuel only"
```

---

### Task 2: Polish écran Vins

**Files:**
- Modify: `src/features/vins/ui/{VinsList,VinsFilters,VinDetail,DegustationForm,BuyButton}.tsx`
- Modify: `src/app/[locale]/(app)/vins/page.tsx`, `src/app/[locale]/(app)/vins/[id]/page.tsx`

**Interfaces:**
- Consumes : `PageHeader` + kit (Task 1).

- [ ] **Step 1: Appliquer les règles de mapping**

**Read each file**, then apply the Global-Constraints mapping: page title → `<PageHeader>` ; buttons
(incl. `BuyButton`, `DegustationForm` submit) → `<Button>` (garder `pending`/`disabled`) ; list items
(`VinsList`) → cartes (`rounded-card border-line bg-surface`) en conservant `data-testid` (ex.
`resto-card`/`vin-card`/… selon l'existant) ; filtres (`VinsFilters` select/input) → classes input token ;
`VinDetail` conteneurs → `Card`, valeurs (note/prix) → `text-accent`/`text-ink`, secondaire → `text-muted`.
Préserver chaque `data-testid`, action, query, i18n.

- [ ] **Step 2: Vérifier (typecheck + lint + unit)**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS.

- [ ] **Step 3: e2e vins (non-régression)**

Run: `supabase db reset && npx playwright test e2e/vins.spec.ts --retries=0`
Expected: PASS sans modifier le spec.

- [ ] **Step 4: Commit**

```bash
git add src/features/vins/ "src/app/[locale]/(app)/vins/"
git commit -m "polish(vins): kit Core.Badakan (cartes/filtres/boutons/PageHeader), visuel only"
```

---

### Task 3: Polish écran Recherche

**Files:**
- Modify: `src/features/reco/ui/{RechercheForm,RechercheResults}.tsx`
- Modify: `src/app/[locale]/(app)/recherche/page.tsx`

**Interfaces:**
- Consumes : `PageHeader` + kit.

- [ ] **Step 1: Appliquer les règles**

In `recherche/page.tsx`, title → `<PageHeader title={t("title")} />`. **Read** `RechercheForm`
(inputs/select → classes input token ; bouton → `<Button>`) et `RechercheResults` (cartes de résultat →
`Card`/classes carte ; secondaire → `text-muted` ; liens → `text-accent`). Préserver chaque `data-testid`,
les `searchParams`, la query, l'i18n.

- [ ] **Step 2: Vérifier (typecheck + lint + unit)**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS.

- [ ] **Step 3: e2e (non-régression ciblée)**

Run: `supabase db reset && npx playwright test e2e/recherche.spec.ts --retries=0` (si ce spec existe ;
sinon `e2e/restos.spec.ts` qui couvre la recherche resto).
Expected: PASS sans modifier le spec.

- [ ] **Step 4: Commit**

```bash
git add src/features/reco/ui/RechercheForm.tsx src/features/reco/ui/RechercheResults.tsx "src/app/[locale]/(app)/recherche/"
git commit -m "polish(recherche): kit Core.Badakan (formulaire/résultats/PageHeader), visuel only"
```

---

### Task 4: Non-régression — suite complète

**Files:** (aucun changement attendu ; correctifs uniquement si un test casse)

- [ ] **Step 1: Suite e2e complète**

Run: `supabase db reset && npx playwright test --retries=0`
Expected: PASS (toute la suite). Le polish étant visuel, rien ne doit casser. **Si** un spec échoue,
diagnostiquer : un `data-testid`/flux a-t-il bougé dans un composant P1 ? Corriger le **composant**
(restaurer le testid/comportement), jamais affaiblir le test. Un seul `db reset` immédiatement avant.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: build OK.

- [ ] **Step 3: Commit (si correctifs)**

```bash
git add -A && git commit -m "polish(p1): correctifs non-régression e2e" # seulement si des correctifs ont été nécessaires
```
(S'il n'y a aucun correctif, pas de commit — la suite était déjà verte aux tasks 1-3.)

---

## Notes d'exécution

- **Ordre** : T1 (PageHeader + restos) → T2 (vins) → T3 (recherche) → T4 (suite complète).
- **Visuel only** : la règle d'or. Chaque implémenteur **lit le fichier** avant de le transformer et
  vérifie qu'aucun `data-testid`/action/query n'a changé.
- **Pas de migration.** Déploiement = merge → Vercel.
- Pas de nouveau test (présentational) ; les e2e existants sont le filet de non-régression.
