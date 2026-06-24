# Polish P2 — Voyages & Comptes partagés Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Appliquer le kit Core.Badakan (+`PageHeader`) aux écrans Voyages et Dépenses — polish **visuel uniquement**, sans toucher logique/requêtes/`data-testid`.

**Architecture:** Pour chaque composant, remplacer le Tailwind ad-hoc par les composants du kit et les tokens, en conservant strictement testids/actions/queries/props/i18n/comportement. Les e2e existants restent verts sans modification.

**Tech Stack:** Next.js 16, Tailwind v4, kit `@/features/shared/ui`, next-intl, Playwright.

## Global Constraints

- **Polish visuel UNIQUEMENT.** Interdits : modifier/retirer/renommer un `data-testid` ; changer une
  action/query/prop/import data/i18n/href ; changer un comportement (calculs de soldes, partage,
  réservations, upload de documents). Si un e2e casse → régression à corriger dans le composant, pas dans
  le test.
- **Règles de mapping (bricolage → kit)** :
  | Avant | Après |
  |---|---|
  | `<button className="bg-black text-white …">` | `<Button>` (`@/features/shared/ui/Button`, variant primary/ghost/subtle), `disabled`/`pending`/`type` conservés |
  | `border p-2`/`border p-3` (carte) | `<Card>` ou `rounded-card border border-line bg-surface p-4` (classe carte sur `<li>`) |
  | `text-2xl font-bold` (titre page) | `<PageHeader title=… action=… />` (`@/features/shared/ui/PageHeader`) |
  | `text-gray-*` | `text-muted` / `text-faint` |
  | `<input/select/textarea className="border p-2">` | `rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:outline-2 focus:outline-accent` |
  | pastille/solde highlight | `<Badge>` ; montants → `text-accent`/`text-ink` |
  | liens | `text-accent hover:underline` |
- Réutiliser le kit ; pas de logique nouvelle dans l'UI. Imports kit `@/features/shared/ui/*` ; `Link`
  depuis `@/lib/i18n/routing`.
- Gate par task : `npm run typecheck && npm run lint && npm run test` + l'e2e de l'écran concerné.

---

### Task 1: Polish écran Voyages

**Files:**
- Modify: `src/features/voyages/ui/{VoyagesList,VoyageForm,VoyageDetail,ReservationForm,MembersList,ShareForm,DocumentsList,DocumentUploadForm}.tsx`
- Modify: `src/app/[locale]/(app)/voyages/page.tsx`, `src/app/[locale]/(app)/voyages/[id]/page.tsx`

- [ ] **Step 1: Appliquer les règles de mapping**

**Read each file first**, then apply the Global-Constraints mapping: page titles → `<PageHeader>` ;
`<button bg-black>` → `<Button>` (forms ReservationForm/VoyageForm/ShareForm/DocumentUploadForm submit,
delete buttons) ; list items (`VoyagesList`, `MembersList`, `DocumentsList`) → cartes
(`rounded-card border-line bg-surface`) ; inputs/selects/textarea → classes input token ; `text-gray-*`
→ `text-muted`/`text-faint` ; `VoyageDetail` conteneurs/sections → `Card`, statut/compteurs → `Badge`.
**Préserver** chaque `data-testid` (ex. `voyage-card`, `reservation-row`, `membre-row`, `share-form`,
`documents-section`, `document-row`, `document-upload-form`, …), chaque action/query, l'upload de
documents (logique inchangée), l'i18n.

- [ ] **Step 2: Vérifier (typecheck + lint + unit)**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS.

- [ ] **Step 3: e2e voyages + documents (non-régression)**

Run: `supabase db reset && npx playwright test e2e/voyages.spec.ts e2e/documents.spec.ts --retries=0`
Expected: PASS sans modifier les specs (testids/flux inchangés ; les documents chiffrés fonctionnent
toujours).

- [ ] **Step 4: Commit**

```bash
git add src/features/voyages/ "src/app/[locale]/(app)/voyages/"
git commit -m "polish(voyages): kit Core.Badakan (cartes/boutons/PageHeader), visuel only"
```

---

### Task 2: Polish écran Comptes partagés (Dépenses)

**Files:**
- Modify: `src/features/depenses/ui/{GroupesList,GroupeForm,GroupeDetail,DepensesList,DepenseForm,RemboursementForm,SoldesPanel,MembersList,ShareForm}.tsx`
- Modify: `src/app/[locale]/(app)/depenses/page.tsx`, `src/app/[locale]/(app)/depenses/[id]/page.tsx`

- [ ] **Step 1: Appliquer les règles de mapping**

**Read each file first**, then apply the mapping: page titles → `<PageHeader>` ; submit/action buttons
(GroupeForm/DepenseForm/RemboursementForm/ShareForm) → `<Button>` ; list items (`GroupesList`,
`DepensesList`, `MembersList`) → cartes ; inputs/selects/textarea → classes input token ; `SoldesPanel`
soldes → `text-accent`/`text-ink` (ou `<Tile>` si présentation KPI), conteneurs → `Card` ; `text-gray-*`
→ `text-muted`. **Préserver** chaque `data-testid` (ex. `groupe-card`, `depense-row`, `solde-row`,
`remboursement-form`, `share-form`, `membre-row`, …), tous les **calculs financiers** (aucune logique
touchée), actions/queries, i18n.

- [ ] **Step 2: Vérifier (typecheck + lint + unit)**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS.

- [ ] **Step 3: e2e depenses (non-régression)**

Run: `supabase db reset && npx playwright test e2e/depenses.spec.ts --retries=0`
Expected: PASS sans modifier le spec.

- [ ] **Step 4: Commit**

```bash
git add src/features/depenses/ "src/app/[locale]/(app)/depenses/"
git commit -m "polish(depenses): kit Core.Badakan (cartes/soldes/boutons/PageHeader), visuel only"
```

---

### Task 3: Non-régression — suite complète

- [ ] **Step 1: Suite e2e complète**

Run: `supabase db reset && npx playwright test --retries=0`
Expected: PASS (toute la suite). Le polish étant visuel, rien ne doit casser. **Si** un spec échoue,
diagnostiquer : un `data-testid`/flux a-t-il bougé dans un composant P2 ? Corriger le **composant**,
jamais affaiblir le test. Un seul `db reset` immédiatement avant.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: build OK.

- [ ] **Step 3: Commit (si correctifs)**

```bash
git add -A && git commit -m "polish(p2): correctifs non-régression e2e" # seulement si nécessaire
```

---

## Notes d'exécution

- **Ordre** : T1 (voyages) → T2 (dépenses) → T3 (suite complète).
- **Visuel only** : règle d'or — lire le fichier, transformer le rendu, vérifier qu'aucun
  testid/action/query/calcul n'a bougé.
- **Attention financier & documents** : les calculs de soldes (dépenses) et l'upload de documents
  chiffrés (voyages) ne doivent subir AUCUNE modification de logique — rendu seulement.
- **Pas de migration.** Déploiement = merge → Vercel. e2e existants = filet de non-régression.
