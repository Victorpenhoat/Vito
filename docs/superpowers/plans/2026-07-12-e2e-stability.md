# Stabilité e2e — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Réduire les re-runs CI en durcissant les assertions e2e post-action nues contre la race RSC, via un helper partagé — sans dégrader les mitigations déjà réglées.

**Architecture:** Un helper `e2e/helpers.ts` (`expectVisibleWithReload`/`expectTextWithReload`) qui tente l'assertion puis, sur échec seulement, recharge la page (rendu frais, re-commit du slot) et ré-assert. On migre uniquement les assertions post-action NUES (`toBeVisible`/`toContainText` directes) ; on LAISSE intactes les mitigations supérieures existantes. Test-only, zéro changement applicatif.

**Tech Stack:** Playwright (`@playwright/test`), TypeScript. Suite : `workers:1`, `retries:2` (CI).

## Global Constraints

- **Test-only** : ne toucher QUE les fichiers `e2e/*`. Aucun changement applicatif/archi.
- **`retries:2` et `workers:1` CONSERVÉS** (filet ; le helper les complète, ne les remplace pas).
- **Le reload ne se déclenche QUE sur échec** de la 1ʳᵉ assertion → le helper ne masque JAMAIS un vrai échec (élément réellement absent → échoue quand même).
- **Migrer seulement** les assertions post-action NUES `toBeVisible` / `toContainText` sur **état persistant**.
- **NE PAS TOUCHER** (mitigations supérieures / hors périmètre) : `toBeEnabled` (attente action-done) ; `toHaveText`/`toHaveCount` de statut déjà tunés ; `toHaveURL` (nav pure) ; assertions multi-contexte (`pageA`/`pageB`, sauf nav fraîche défensive explicitement listée) ; toasts/`getByRole("alert")` ; restos **favori** (`waitForResponse`+reload) et **tags** (signal `tags-saved`+reload) ; places **archivage** (reload → assertion plus forte `tab-archives` count 0).
- Timeout par défaut du helper : **10 s** (unifie les `{ timeout: 15000 }` dispersés ; surchargeable).
- Le helper **relocalise** après reload (les `Locator` Playwright sont paresseux → ré-évalués sur le DOM rechargé).
- Vérif : chaque spec migrée reste verte en CI-mode local (`CI=true npx playwright test <spec> --retries=0`). Pré-push : `npm run lint` + `npm run typecheck` (specs typées).
- Branche : `feat/e2e-stability` (spec déjà commité).
- **Supabase local doit tourner** pour les e2e ; les e2e mutent la DB partagée — faire `supabase db reset` avant une passe RLS (non concerné ici, mais ne pas enchaîner e2e→RLS sans reset).

---

### Task 1: Helper `e2e/helpers.ts` + sanity

**Files:**
- Create: `e2e/helpers.ts`
- Create: `e2e/helpers.spec.ts`

**Interfaces:**
- Produces:
  - `expectVisibleWithReload(page: Page, locator: Locator, opts?: { timeout?: number }): Promise<void>`
  - `expectTextWithReload(page: Page, locator: Locator, text: string | RegExp, opts?: { timeout?: number }): Promise<void>`

- [ ] **Step 1: Écrire le sanity spec (contrat, sans dépendre de la race)**

Create `e2e/helpers.spec.ts` :

```ts
import { test, expect } from "@playwright/test";
import { expectVisibleWithReload } from "./helpers";

// Vérifie le CONTRAT du helper sur une page réelle (login, sans auth), pas la race.
test("expectVisibleWithReload : élément présent → passe sans lever", async ({ page }) => {
  await page.goto("/fr/login");
  await expectVisibleWithReload(page, page.getByLabel("E-mail"));
});

test("expectVisibleWithReload : élément absent → lève (ne réussit pas à tort)", async ({ page }) => {
  await page.goto("/fr/login");
  // timeout court : la double tentative (1ʳᵉ + reload) reste ~1 s au lieu de 2×10 s.
  await expect(
    expectVisibleWithReload(page, page.getByTestId("nexiste-pas-xyz"), { timeout: 500 }),
  ).rejects.toThrow();
});
```

- [ ] **Step 2: Lancer → échec**

Run: `CI=true npx playwright test e2e/helpers.spec.ts --retries=0`
Expected: FAIL (`./helpers` introuvable / pas d'export `expectVisibleWithReload`).

- [ ] **Step 3: Écrire le helper**

Create `e2e/helpers.ts` :

```ts
import { expect, type Page, type Locator } from "@playwright/test";

// Assertion post-server-action robuste à la race RSC (slot non commité) : tente la visibilité,
// et sur échec SEULEMENT recharge la page (rendu frais depuis la base → re-commit du slot) puis
// ré-assert. Un élément réellement absent échoue quand même après le reload → les vrais bugs ne
// sont pas masqués. À réserver aux assertions sur état PERSISTANT (pas toast/focus/UI éphémère).
export async function expectVisibleWithReload(
  page: Page,
  locator: Locator,
  opts: { timeout?: number } = {},
): Promise<void> {
  const timeout = opts.timeout ?? 10_000;
  try {
    await expect(locator).toBeVisible({ timeout });
  } catch {
    await page.reload();
    await expect(locator).toBeVisible({ timeout });
  }
}

// Variante texte (soldes, statuts persistants) : même stratégie sur toContainText.
export async function expectTextWithReload(
  page: Page,
  locator: Locator,
  text: string | RegExp,
  opts: { timeout?: number } = {},
): Promise<void> {
  const timeout = opts.timeout ?? 10_000;
  try {
    await expect(locator).toContainText(text, { timeout });
  } catch {
    await page.reload();
    await expect(locator).toContainText(text, { timeout });
  }
}
```

- [ ] **Step 4: Lancer → succès**

Run: `CI=true npx playwright test e2e/helpers.spec.ts --retries=0`
Expected: PASS (2 tests). Puis `npm run lint && npm run typecheck` → clean.

- [ ] **Step 5: Commit**

```bash
git add e2e/helpers.ts e2e/helpers.spec.ts
git commit -m "test(e2e): helper post-action robuste à la race RSC (expectVisibleWithReload)"
```

---

### Task 2: Migrer `depenses.spec.ts` (pilote)

**Files:**
- Modify: `e2e/depenses.spec.ts`

**Interfaces:**
- Consumes: `expectVisibleWithReload`, `expectTextWithReload` (Task 1).

- [ ] **Step 1: Importer le helper**

En tête de `e2e/depenses.spec.ts`, après l'import Playwright existant, ajouter :

```ts
import { expectVisibleWithReload, expectTextWithReload } from "./helpers";
```

- [ ] **Step 2: Unifier le try/reload du partage (test 1)**

Remplacer (l.42-47 actuelles) :

```ts
  try {
    await expect(deuxMembres).toBeVisible();
  } catch {
    await page.reload();
    await expect(deuxMembres).toBeVisible();
  }
```

par :

```ts
  await expectVisibleWithReload(page, deuxMembres);
```

- [ ] **Step 3: Protéger dépense-row + soldes (test 1)**

Remplacer :

```ts
  await expect(page.getByTestId("depense-row").filter({ hasText: "Taxi" })).toBeVisible();
  await expect(page.getByTestId("soldes-panel")).toContainText("15,00");
```

par :

```ts
  await expectVisibleWithReload(page, page.getByTestId("depense-row").filter({ hasText: "Taxi" }));
  await expectTextWithReload(page, page.getByTestId("soldes-panel"), "15,00");
```

- [ ] **Step 4: Unifier le try/reload de solde-regle (test 2)**

Remplacer le bloc actuel (introduit en #106) :

```ts
  const soldeRegle = page.getByTestId("solde-regle");
  try {
    await expect(soldeRegle).toBeVisible();
  } catch {
    await page.reload();
    await expect(soldeRegle).toBeVisible();
  }
```

par :

```ts
  await expectVisibleWithReload(page, page.getByTestId("solde-regle"));
```

Et le solde du seed « 50,00 » (l.70) :

```ts
  await expect(page.getByTestId("soldes-panel")).toContainText("50,00");
```

par :

```ts
  await expectTextWithReload(page, page.getByTestId("soldes-panel"), "50,00");
```

- [ ] **Step 5: Vérifier**

Run: `CI=true npx playwright test e2e/depenses.spec.ts --retries=0`
Expected: PASS (2 tests). `npm run lint && npm run typecheck` → clean.

- [ ] **Step 6: Commit**

```bash
git add e2e/depenses.spec.ts
git commit -m "test(e2e): depenses — assertions post-action via helper (unifie try/reload)"
```

---

### Task 3: Migrer `voyages.spec.ts` + `abonnement.spec.ts`

**Files:**
- Modify: `e2e/voyages.spec.ts`
- Modify: `e2e/abonnement.spec.ts`

**Interfaces:**
- Consumes: `expectVisibleWithReload` (Task 1).

- [ ] **Step 1: voyages — importer + migrer les assertions nues**

Ajouter l'import en tête : `import { expectVisibleWithReload } from "./helpers";`

Remplacer `voyage-card` (l.21) :
```ts
  await expect(page.getByTestId("voyage-card").filter({ hasText: "Lisbonne" }).first()).toBeVisible();
```
par :
```ts
  await expectVisibleWithReload(page, page.getByTestId("voyage-card").filter({ hasText: "Lisbonne" }).first());
```

Remplacer `reservation-row` (l.31) :
```ts
  await expect(page.getByTestId("reservation-row").filter({ hasText: "Hotel Lisboa" })).toBeVisible();
```
par :
```ts
  await expectVisibleWithReload(page, page.getByTestId("reservation-row").filter({ hasText: "Hotel Lisboa" }));
```

(NE PAS toucher les `toHaveURL` ni l'assertion finale de partage si c'est un toast/alert. Si l'assertion finale du partage est un `toBeVisible` sur une ligne membre persistante, la migrer aussi ; si c'est un `alert`, la laisser.)

- [ ] **Step 2: abonnement — importer + migrer**

Ajouter l'import. Migrer chaque `voyage-card` `toBeVisible` (l.23, 25, 40) et `premium-badge` post-action (l.35, l.50) vers `expectVisibleWithReload`. Exemple l.23 :
```ts
  await expect(page.getByTestId("voyage-card").filter({ hasText: `V1 ${tag}` })).toBeVisible();
```
→
```ts
  await expectVisibleWithReload(page, page.getByTestId("voyage-card").filter({ hasText: `V1 ${tag}` }));
```
Faire de même pour `V2` (l.25), `premium-badge` après `subscribe-monthly` (l.35), `V3` après upgrade (l.40), `premium-badge` après `cancel-sub` (l.50).

`plan-actuel` « jusqu'au » (l.51) : `await expectTextWithReload(page, page.getByTestId("plan-actuel"), "jusqu'au");` (ajouter `expectTextWithReload` à l'import).

**NE PAS toucher** : `voyage-limit-cta` (l.29) et `V3` `toHaveCount(0)` (l.30) — ce sont des assertions de blocage déterministe, et `premium-badge` l.46 (sur chargement de page, pas post-action).

- [ ] **Step 3: Vérifier**

Run: `CI=true npx playwright test e2e/voyages.spec.ts e2e/abonnement.spec.ts --retries=0`
Expected: PASS. `npm run lint && npm run typecheck` → clean.

- [ ] **Step 4: Commit**

```bash
git add e2e/voyages.spec.ts e2e/abonnement.spec.ts
git commit -m "test(e2e): voyages + abonnement — assertions post-action via helper"
```

---

### Task 4: Migrer `restos.spec.ts` (ciblé) + `agence.spec.ts`

**Files:**
- Modify: `e2e/restos.spec.ts`
- Modify: `e2e/agence.spec.ts`

**Interfaces:**
- Consumes: `expectVisibleWithReload` (Task 1).

- [ ] **Step 1: restos — importer + migrer SEULEMENT place-card + avis**

Ajouter l'import. Migrer UNIQUEMENT ces deux assertions :

`place-card` Recommandés (l.35) :
```ts
  await expect(page.getByTestId("place-card").filter({ hasText: "Le Bistrot du Coin" }).first()).toBeVisible({ timeout: 15_000 });
```
→
```ts
  await expectVisibleWithReload(page, page.getByTestId("place-card").filter({ hasText: "Le Bistrot du Coin" }).first());
```

`avis` (l.46) :
```ts
  await expect(page.getByText(avis)).toBeVisible({ timeout: 15_000 });
```
→
```ts
  await expectVisibleWithReload(page, page.getByText(avis));
```

**NE PAS TOUCHER** (mitigations supérieures — vérifier qu'elles restent inchangées) :
- `result-added` (l.30) — attente de signal de commit dans un bloc idempotent ; laisser.
- favori (l.62-65) — `waitForResponse` + reload ; laisser.
- tags (l.100-118) — signal `tags-saved` + reload ; laisser.

- [ ] **Step 2: agence — importer + migrer client-row + voyage-card pageB**

Ajouter l'import. Migrer :

`client-row` post-lier (l.26) :
```ts
  await expect(row).toBeVisible();
```
→
```ts
  await expectVisibleWithReload(pageA, row);
```
(note : la page est `pageA` ici, pas `page`.)

`voyage-card` de `pageB` (l.40, nav fraîche défensive) :
```ts
  await expect(pageB.getByTestId("voyage-card").filter({ hasText: titre })).toBeVisible();
```
→
```ts
  await expectVisibleWithReload(pageB, pageB.getByTestId("voyage-card").filter({ hasText: titre }));
```

**NE PAS TOUCHER** : `toBeEnabled` (l.33, action-done), `not.toHaveURL` / `toHaveCount(0)` (l.51-52, redirection).

- [ ] **Step 3: Vérifier**

Run: `CI=true npx playwright test e2e/restos.spec.ts e2e/agence.spec.ts --retries=0`
Expected: PASS. `npm run lint && npm run typecheck` → clean. Vérifier par `git diff` que favori/tags/`toBeEnabled` sont **inchangés**.

- [ ] **Step 4: Commit**

```bash
git add e2e/restos.spec.ts e2e/agence.spec.ts
git commit -m "test(e2e): restos (place-card/avis) + agence — helper ; mitigations tunées intactes"
```

---

### Task 5: Migrer `vins.spec.ts` + `conciergerie.spec.ts` + `famille.spec.ts`

**Files:**
- Modify: `e2e/vins.spec.ts`
- Modify: `e2e/conciergerie.spec.ts`
- Modify: `e2e/famille.spec.ts`

**Interfaces:**
- Consumes: `expectVisibleWithReload` (Task 1).

- [ ] **Step 1: vins — migrer vin-row + buy-button (nav fraîche défensive)**

Ajouter l'import. Migrer `vin-row` après `goto("/fr/vins")` (l.41-43) et `buy-button` (l.56) vers `expectVisibleWithReload`. Exemple :
```ts
  await expect(page.getByTestId("vin-row").filter({ hasText: vinNom })).toBeVisible();
```
→
```ts
  await expectVisibleWithReload(page, page.getByTestId("vin-row").filter({ hasText: vinNom }));
```
**NE PAS TOUCHER** : `toBeEnabled` (l.35), l'assertion `vin-row` après le filtre client `vin-tab-blanc` (l.48 — filtre local, pas une race), `toHaveURL`.

- [ ] **Step 2: conciergerie — migrer demande-row (nav fraîche défensive)**

Ajouter l'import. Migrer `demande-row` après `goto("/fr/conciergerie")` (l.33) vers `expectVisibleWithReload`. **NE PAS TOUCHER** : `submitBtn toBeEnabled` (l.28), les `demande-statut` `toHaveText` (l.34, 49-51 — hors périmètre : on ne migre pas les `toHaveText` de statut).

- [ ] **Step 3: famille — migrer le heading post-création proche**

Ouvrir `e2e/famille.spec.ts`. Migrer l'assertion `heading "${PRENOM} Martin"` **juste après la création** (redirect vers la fiche, ~l.112-113) et celle post-modif `"${PRENOM} Bernard"` vers `expectVisibleWithReload` (le reload re-rend la fiche). **NE PAS TOUCHER** : les assertions multi-contexte `pageA`/`membre-row` `toHaveCount` (déjà timeout-tuné, l.42), `getByRole("alert")` (toast « déjà », l.58), `toHaveURL`.

Exemple :
```ts
  await expect(page.getByRole("heading", { name: `${PRENOM} Martin` })).toBeVisible();
```
→
```ts
  await expectVisibleWithReload(page, page.getByRole("heading", { name: `${PRENOM} Martin` }));
```
(Attention : il y a DEUX occurrences du heading `Martin` — celle post-création/redirect ET celle post-clic dans la liste ; migrer les deux occurrences post-nav, laisser les `toHaveURL`.)

- [ ] **Step 4: Vérifier**

Run: `CI=true npx playwright test e2e/vins.spec.ts e2e/conciergerie.spec.ts e2e/famille.spec.ts --retries=0`
Expected: PASS. `npm run lint && npm run typecheck` → clean.

- [ ] **Step 5: Commit**

```bash
git add e2e/vins.spec.ts e2e/conciergerie.spec.ts e2e/famille.spec.ts
git commit -m "test(e2e): vins + conciergerie + famille — assertions post-action via helper"
```

---

### Task 6: Vérification complète + PR

**Files:** (aucun — vérification)

- [ ] **Step 1: Suite e2e complète (CI-mode, retries actifs comme en CI)**

Run: `supabase db reset >/dev/null 2>&1; CI=true npm run test:e2e`
Expected: 68 tests PASS (le helper + retries). Idéalement relancer 1-2× pour constater la stabilité (mesure, pas preuve — la race est non déterministe).

- [ ] **Step 2: Lint + typecheck + suite unitaire (non-régression)**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: tsc 0, lint clean, unit suite verte (le chantier est e2e-only mais on confirme l'absence d'impact).

- [ ] **Step 3: Confirmer les mitigations tunées intactes**

Run: `git diff main -- e2e/restos.spec.ts | grep -E 'waitForResponse|tags-saved'`
Expected: ces lignes n'apparaissent PAS dans le diff (favori/tags inchangés). De même `git diff main -- e2e/places.spec.ts` ne doit montrer aucun changement (archivage laissé intact).

- [ ] **Step 4: Ouvrir la PR**

```bash
git push -u origin feat/e2e-stability
gh pr create --base main --title "test(e2e): helper post-action robuste à la race RSC + migration ciblée" --body "Implémente docs/superpowers/specs/2026-07-10-e2e-stability-design.md. Helper expectVisibleWithReload/expectTextWithReload appliqué aux assertions post-action NUES ; mitigations tunées (restos favori/tags, places archivage, toBeEnabled) laissées intactes. Test-only, retries:2 conservés."
```

---

## Note de périmètre (raffinement post-spec)

L'audit du 2026-07-12 (préparation du plan) a montré que plusieurs mitigations existantes sont **supérieures** au helper générique (`waitForResponse` pour un signal de commit fiable, signaux serveur `tags-saved`, reload suivi d'une assertion **plus forte**). Le spec §4 a été corrigé en conséquence : on migre **uniquement** les assertions post-action nues, on **préserve** les réglages fins. Le helper réduit le recours aux retries sans jamais masquer un vrai échec (reload sur échec seulement).
