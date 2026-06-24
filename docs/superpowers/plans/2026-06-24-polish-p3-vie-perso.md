# Polish P3 — Vie perso (Famille, Conciergerie, Abonnement, Goûts) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Appliquer le kit Core.Badakan (+`PageHeader`) aux écrans Famille, Conciergerie, Abonnement, Goûts — polish **visuel uniquement**, sans toucher logique/requêtes/`data-testid`.

**Architecture:** Pour chaque composant, remplacer le Tailwind ad-hoc par le kit + tokens, en conservant strictement testids/actions/queries/props/i18n/comportement. e2e existants verts sans modification.

**Tech Stack:** Next.js 16, Tailwind v4, kit `@/features/shared/ui`, next-intl, Playwright.

## Global Constraints

- **Polish visuel UNIQUEMENT.** Interdits : modifier/retirer/renommer un `data-testid` ; changer une
  action/query/prop/import data/i18n/href ; changer un comportement (statuts conciergerie, premium,
  invitations famille, sélection de goûts). Ne pas afficher deux fois la même donnée (texte + Badge). Si
  un e2e casse → régression à corriger dans le composant, pas dans le test.
- **Règles de mapping** :
  | Avant | Après |
  |---|---|
  | `<button className="bg-black text-white …">` | `<Button>` (`@/features/shared/ui/Button`, variant primary/ghost/subtle), `disabled`/`pending`/`type` conservés |
  | `border p-2`/`border p-3` (carte) | `<Card>` ou `rounded-card border border-line bg-surface p-4` (classe carte sur `<li>`) |
  | `text-2xl font-bold` (titre page) | `<PageHeader title=… />` (`@/features/shared/ui/PageHeader`) |
  | `text-gray-*` | `text-muted` / `text-faint` |
  | `<input/select/textarea className="border p-2">` | `rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:outline-2 focus:outline-accent` |
  | pastille/statut | `<Badge>` ; liens → `text-accent hover:underline` ; page wrapper `p-6` → `p-4 md:p-6` |
- Réutiliser le kit ; pas de logique nouvelle dans l'UI. Imports kit `@/features/shared/ui/*` ; `Link` depuis `@/lib/i18n/routing`.
- Gate par task : `npm run typecheck && npm run lint && npm run test` + l'e2e de l'écran concerné. Si le webServer Playwright échoue à DÉMARRER (build/port, pas un échec de test), réessayer la commande une fois.

---

### Task 1: Polish écran Famille

**Files:**
- Modify: `src/features/famille/ui/{AjouterFamilleButton,FamilleForm,FamilleRestos,InviteForm,MembresList}.tsx`
- Modify: `src/app/[locale]/(app)/famille/page.tsx`

- [ ] **Step 1: Appliquer les règles**

**Read each file first**, then apply the mapping: page title → `<PageHeader>` ; buttons
(AjouterFamilleButton, FamilleForm/InviteForm submit) → `<Button>` ; list items (MembresList,
FamilleRestos) → cartes ; inputs → token classes ; `text-gray-*` → `text-muted` ; rôles/compteurs →
`<Badge>`. Préserver chaque `data-testid`, action (créer/inviter famille), query, i18n.

- [ ] **Step 2: Vérifier** — `npm run typecheck && npm run lint && npm run test` → PASS.
- [ ] **Step 3: e2e** — `supabase db reset && npx playwright test e2e/famille.spec.ts --retries=0` → PASS sans modifier le spec.
- [ ] **Step 4: Commit**

```bash
git add src/features/famille/ "src/app/[locale]/(app)/famille/"
git commit -m "polish(famille): kit Core.Badakan, visuel only"
```

---

### Task 2: Polish écran Conciergerie

**Files:**
- Modify: `src/features/conciergerie/ui/{ConciergeInbox,DemandeHotelForm,DemandeRestoForm,DemandesList,ReponseForm}.tsx`
- Modify: `src/app/[locale]/(app)/conciergerie/page.tsx`

- [ ] **Step 1: Appliquer les règles**

**Read each file first**, then apply the mapping: page title → `<PageHeader>` ; form submit buttons
(DemandeHotelForm/DemandeRestoForm/ReponseForm) → `<Button>` ; demandes (DemandesList, ConciergeInbox)
→ cartes ; statut de demande → `<Badge>` (une seule fois — pas de doublon) ; inputs/selects/textarea/
checkbox-groups → token classes ; `text-gray-*` → `text-muted`. Préserver chaque `data-testid`, le
**statut des demandes** et toute la logique (choix resto/hôtel, réponse), actions/queries, i18n.

- [ ] **Step 2: Vérifier** — `npm run typecheck && npm run lint && npm run test` → PASS.
- [ ] **Step 3: e2e** — `supabase db reset && npx playwright test e2e/conciergerie.spec.ts --retries=0` → PASS sans modifier le spec.
- [ ] **Step 4: Commit**

```bash
git add src/features/conciergerie/ "src/app/[locale]/(app)/conciergerie/"
git commit -m "polish(conciergerie): kit Core.Badakan, visuel only"
```

---

### Task 3: Polish Abonnement + Goûts

**Files:**
- Modify: `src/features/abonnement/ui/{CancelButton,SubscribeButtons}.tsx`, `src/app/[locale]/(app)/abonnement/page.tsx`
- Modify: `src/features/reco/ui/GoutsForm.tsx`, `src/app/[locale]/(app)/gouts/page.tsx`

- [ ] **Step 1: Appliquer les règles**

**Read each file first**, then apply the mapping: page titles → `<PageHeader>` ; boutons
(CancelButton, SubscribeButtons, GoutsForm submit) → `<Button>` (variants adaptés : `subscribe` =
primary, `cancel` = ghost/subtle) ; conteneurs/plans d'abonnement → `Card` ; GoutsForm inputs/
checkbox/tags → token classes/`Badge` pour les tags sélectionnés ; `text-gray-*` → `text-muted`.
Préserver chaque `data-testid` (ex. boutons d'abonnement, état premium), l'état premium/Stripe, la
sélection de goûts, actions/queries, i18n.

- [ ] **Step 2: Vérifier** — `npm run typecheck && npm run lint && npm run test` → PASS.
- [ ] **Step 3: e2e** — `supabase db reset && npx playwright test e2e/abonnement.spec.ts --retries=0` → PASS sans modifier le spec. (Goûts couvert par la suite complète en Task 4.)
- [ ] **Step 4: Commit**

```bash
git add src/features/abonnement/ "src/app/[locale]/(app)/abonnement/" src/features/reco/ui/GoutsForm.tsx "src/app/[locale]/(app)/gouts/"
git commit -m "polish(abonnement+gouts): kit Core.Badakan, visuel only"
```

---

### Task 4: Non-régression — suite complète

- [ ] **Step 1: Suite e2e complète**

Run: `supabase db reset && npx playwright test --retries=0`
Expected: PASS (toute la suite). **Si** un spec échoue, diagnostiquer le composant P3 fautif (testid/flux
bougé) et corriger le **composant**, jamais le test. Un seul `db reset` immédiatement avant. (Retry une
fois si le webServer échoue à démarrer.)

- [ ] **Step 2: Build** — `npm run build` → OK.
- [ ] **Step 3: Commit (si correctifs)**

```bash
git add -A && git commit -m "polish(p3): correctifs non-régression e2e" # seulement si nécessaire
```

---

## Notes d'exécution

- **Ordre** : T1 (famille) → T2 (conciergerie) → T3 (abonnement+goûts) → T4 (suite complète).
- **Visuel only** : règle d'or — lire le fichier, transformer le rendu, vérifier qu'aucun
  testid/action/query/statut n'a bougé, et ne jamais dupliquer une donnée (texte + Badge).
- **Pas de migration.** Déploiement = merge → Vercel. e2e existants = filet de non-régression.
