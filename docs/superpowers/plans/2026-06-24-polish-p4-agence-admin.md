# Polish P4 — Pro / back-office (Agence, Admin) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Faire forwarder `...rest` par `Card`/`Badge` (dette kit), puis appliquer le kit Core.Badakan aux écrans Agence et Admin — polish **visuel uniquement**.

**Architecture:** Card/Badge acceptent désormais les attributs HTML (additif). Agence/Admin : kit + tokens + `Tile` pour les KPI admin, en conservant strictement testids/actions/queries/comportement. e2e existants verts sans modification.

**Tech Stack:** Next.js 16, Tailwind v4, kit `@/features/shared/ui`, next-intl, Playwright.

## Global Constraints

- **Polish visuel UNIQUEMENT** (sauf Task 1 = enrichissement additif du kit). Interdits : modifier/retirer/
  renommer un `data-testid` ; changer une action/query/prop/import data/i18n/href ; changer un
  comportement (liaison client, création voyage agence, lecture admin/RBAC). Pas de doublon de valeur,
  pas de contenu perdu. Si un e2e casse → corriger le composant, pas le test.
- **Règles de mapping** : `<button bg-black>`→`<Button>` ; `border p-*`→`<Card>`/classes carte ;
  `text-2xl font-bold`→`<PageHeader>` ; `text-gray-*`→`text-muted`/`text-faint` ; inputs→token classes ;
  KPI→`<Tile tone>` ; statut/compteur→`<Badge>` ; liens→`text-accent` ; page `p-6`→`p-4 md:p-6`.
- Tableaux admin : garder la structure `<table>` + les `data-testid` ; envelopper dans `<Card>`,
  en-têtes `text-muted text-xs uppercase`, lignes `border-line`.
- Imports kit `@/features/shared/ui/*` ; `Link` depuis `@/lib/i18n/routing`.
- Gate par task : `npm run typecheck && npm run lint && npm run test` + l'e2e de l'écran (retry une fois si le webServer échoue à DÉMARRER).

---

### Task 1: Kit — `Card`/`Badge` forwardent `...rest`

**Files:**
- Modify: `src/features/shared/ui/Card.tsx`, `src/features/shared/ui/Badge.tsx`

- [ ] **Step 1: Card**

Replace `src/features/shared/ui/Card.tsx` with:
```tsx
import type { HTMLAttributes } from "react";

export function Card({ className = "", children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`rounded-card border border-line bg-surface p-5 ${className}`} {...rest}>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Badge**

Replace `src/features/shared/ui/Badge.tsx` with:
```tsx
import type { HTMLAttributes } from "react";

export function Badge({ className = "", children, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={`inline-flex min-w-6 items-center justify-center rounded-full bg-badge px-2 py-0.5 text-xs font-semibold text-ink ${className}`}
      {...rest}
    >
      {children}
    </span>
  );
}
```
(Additif : les appelants actuels passent `className`/`children` — comportement inchangé ; désormais
`data-testid`/`onClick`/… sont forwardés.)

- [ ] **Step 3: Vérifier**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS (changement additif ; aucun appelant cassé ; suite unitaire verte).

- [ ] **Step 4: Commit**

```bash
git add src/features/shared/ui/Card.tsx src/features/shared/ui/Badge.tsx
git commit -m "feat(kit): Card/Badge forwardent les attributs HTML (data-testid, etc.)"
```

---

### Task 2: Polish écran Agence

**Files:**
- Modify: `src/features/agence/ui/{ClientsList,LierClientForm,VoyagePourClientForm}.tsx`
- Modify: `src/app/[locale]/(app)/agence/page.tsx`

- [ ] **Step 1: Appliquer les règles**

**Read each file first**, then apply the mapping: page title → `<PageHeader>` ; form submit buttons
(LierClientForm, VoyagePourClientForm) → `<Button>` ; client rows (ClientsList, `client-row`) → `<Card>`
(maintenant que Card forwarde le testid) ou classes carte ; inputs/selects → token classes ;
`text-gray-*` → `text-muted`. Préserver chaque `data-testid` (`lier-client-form`, `client-row`,
`voyage-client-form`), les actions (lier/délier client, créer voyage pour client), queries, i18n.

- [ ] **Step 2: Vérifier** — `npm run typecheck && npm run lint && npm run test` → PASS.
- [ ] **Step 3: e2e** — `supabase db reset && npx playwright test e2e/agence.spec.ts --retries=0` → PASS sans modifier le spec.
- [ ] **Step 4: Commit**

```bash
git add src/features/agence/ "src/app/[locale]/(app)/agence/"
git commit -m "polish(agence): kit Core.Badakan, visuel only"
```

---

### Task 3: Polish écran Admin

**Files:**
- Modify: `src/features/admin/ui/{StatsCards,UsersTable,SubscriptionsTable,DemandesTable}.tsx`
- Modify: `src/app/[locale]/(app)/admin/page.tsx`

- [ ] **Step 1: Appliquer les règles**

**Read each file first**, then apply the mapping: page title → `<PageHeader>` ; **StatsCards** KPI
(total users, premium actifs, demandes par statut) → `<Tile tone=…>` (label + valeur), en gardant
`data-testid="admin-stats"` sur le conteneur ; **tableaux** (UsersTable/SubscriptionsTable/DemandesTable)
→ envelopper dans `<Card>` (testid `users-table`/`subscriptions-table`/`demandes-table` conservé), garder
la structure `<table>`, en-têtes `text-muted text-xs uppercase tracking-wide`, lignes `border-b
border-line`, texte secondaire `text-muted` ; `text-gray-*` → `text-muted`. **Ne changer aucune donnée
affichée** (colonnes, valeurs, statuts), aucune query, aucun i18n.

- [ ] **Step 2: Vérifier** — `npm run typecheck && npm run lint && npm run test` → PASS.
- [ ] **Step 3: e2e** — `supabase db reset && npx playwright test e2e/admin.spec.ts --retries=0` → PASS sans modifier le spec.
- [ ] **Step 4: Commit**

```bash
git add src/features/admin/ "src/app/[locale]/(app)/admin/"
git commit -m "polish(admin): kit Core.Badakan (KPI Tiles, tableaux en Card), visuel only"
```

---

### Task 4: Non-régression — suite complète

- [ ] **Step 1: Suite e2e complète**

Run: `supabase db reset && npx playwright test --retries=0`
Expected: PASS (toute la suite — confirme aussi que le changement Card/Badge ne régresse aucun écran).
**Si** un spec échoue, corriger le **composant** fautif, jamais le test. Un seul `db reset` avant.
(Retry une fois si le webServer échoue à démarrer.)

- [ ] **Step 2: Build** — `npm run build` → OK.
- [ ] **Step 3: Commit (si correctifs)**

```bash
git add -A && git commit -m "polish(p4): correctifs non-régression e2e" # seulement si nécessaire
```

---

## Notes d'exécution

- **Ordre** : T1 (kit Card/Badge `...rest`) → T2 (agence) → T3 (admin) → T4 (suite complète).
- **T1 est le seul changement non purement visuel** (additif au kit) ; il touche des composants partagés
  → la suite complète (T4) est le filet qui confirme l'absence de régression app-wide.
- **Visuel only** (T2/T3) : lire le fichier, transformer le rendu, vérifier testids/actions/données.
- **Pas de migration.** Déploiement = merge → Vercel.
