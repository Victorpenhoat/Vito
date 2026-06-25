# Garde-fou de déploiement (A+B+C+D) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Garantir qu'aucun déploiement prod ne passe sur des tests rouges : commande unique `test:ci`, test PWA e2e, README documenté, et protection de `main` exigeant la CI.

**Architecture:** B/C/D = changements de code/doc (scripts npm, e2e PWA, README) livrés par PR ; A = protection de branche (config repo via `gh api`) effectuée par le contrôleur après merge.

**Tech Stack:** Next.js 16, Playwright, GitHub (branch protection), Vercel (intégration Git).

## Global Constraints

- Pas de secret en clair, pas de nouvelle variable d'env. Pas de migration.
- Le check CI s'appelle **`quality`** (job de `.github/workflows/ci.yml`).
- e2e PWA : signaux déterministes (présence manifest, fetch 200, registration SW avec attente) ; jamais `networkidle`.
- Gate par task : indiqué par task.

---

### Task 1: Scripts `test:ci`/`test:unit` + README

**Files:**
- Modify: `package.json` (scripts)
- Modify: `README.md`

- [ ] **Step 1: Scripts**

In `package.json` `scripts`, add:
```jsonc
"test:unit": "vitest run",
"test:ci": "npm run typecheck && npm run lint && npm run test && npm run test:e2e"
```
(Garder `test`/`test:e2e` existants. `test:ci` enchaîne typecheck→lint→unit→e2e, comme la CI.)

- [ ] **Step 2: README — Utilisateurs de test + garde-fou**

Lire `supabase/seed.sql` pour lister exactement les comptes seedés et leur rôle/état. Ajouter au
`README.md` deux sections :
- **« Utilisateurs de test »** : tableau (email | rôle/état | données pré-remplies). Comptes :
  `client@vito.test` (client), `agence@vito.test` (agence), `admin@vito.test` (admin),
  `free@vito.test` (client, abonnement gratuit), `premium@vito.test` (client, premium),
  `famille1@vito.test`/`famille2@vito.test` (foyer), `client7b@vito.test` (client agence). Mot de passe
  commun **`password123`**. (Vérifier/ajuster d'après `seed.sql`.) Commande de (re)génération :
  `supabase db reset` (réapplique migrations + seed).
- **« Tests & garde-fou de déploiement »** : `npm run test:ci` reproduit la CI en local
  (typecheck → lint → unit → e2e) ; `main` est protégée et exige le check `quality` → aucun déploiement
  prod possible tant que la CI n'est pas verte.

- [ ] **Step 3: Vérifier que `test:ci` reproduit la CI (le livrable)**

Run: `supabase start >/dev/null 2>&1; supabase db reset >/dev/null 2>&1; npm run test:ci`
Expected: enchaîne typecheck → lint → unit (110) → e2e (38) et finit **vert**. (C'est la commande
livrable.) Si l'e2e exige un `db reset` préalable, l'effectuer juste avant comme ci-dessus.

- [ ] **Step 4: Commit**

```bash
git add package.json README.md
git commit -m "feat(ci): script test:ci (reproduit la CI) + doc utilisateurs de test & garde-fou"
```

---

### Task 2: Test PWA e2e

**Files:**
- Create: `e2e/pwa.spec.ts`

- [ ] **Step 1: Écrire l'e2e**

Create `e2e/pwa.spec.ts` :
```ts
import { test, expect } from "@playwright/test";

test("manifest PWA lié et valide", async ({ page }) => {
  await page.goto("/fr");
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(href).toBeTruthy();
  const res = await page.request.get(href!);
  expect(res.status()).toBe(200);
  const manifest = await res.json();
  expect(manifest.name).toBeTruthy();
  expect(manifest.start_url).toBeTruthy();
  expect(manifest.display).toBe("standalone");
  expect(Array.isArray(manifest.icons) && manifest.icons.length).toBeTruthy();
});

test("service worker enregistré + /sw.js servi", async ({ page }) => {
  await page.goto("/fr");
  const sw = await page.request.get("/sw.js");
  expect(sw.status()).toBe(200);
  // le PwaRegister enregistre /sw.js après montage — attendre la registration
  await expect
    .poll(async () => page.evaluate(async () => !!(await navigator.serviceWorker?.getRegistration())), {
      timeout: 10000,
    })
    .toBe(true);
});
```
(Si la registration SW s'avère trop sensible à l'environnement de test, replier sur l'assertion `/sw.js`
200 + présence de `navigator.serviceWorker` — sans affaiblir le test du manifest. Diagnostiquer avant de
réduire.)

- [ ] **Step 2: e2e PWA + suite complète**

Run:
```bash
supabase db reset && npx playwright test e2e/pwa.spec.ts --retries=0
supabase db reset && npx playwright test --retries=0
```
Expected: PWA vert ; suite complète verte (≈40 tests). Retry une fois si le webServer échoue à démarrer.

- [ ] **Step 3: Commit**

```bash
git add e2e/pwa.spec.ts
git commit -m "test(pwa): manifest + service worker (installabilité de base)"
```

---

## A — Protection de branche (étape contrôleur, APRÈS merge de la PR)

Hors task subagent : une fois la PR mergée sur `main`, le contrôleur active la protection via `gh api` :
```bash
gh api -X PUT repos/Victorpenhoat/Vito/branches/main/protection \
  -F required_status_checks[strict]=true -f required_status_checks[contexts][]=quality \
  -F enforce_admins=false -F restrictions= \
  -F required_pull_request_reviews= -F allow_force_pushes=false 2>&1
```
(Ajuster la syntaxe `gh api` au besoin ; le but : `contexts:["quality"]`, pas de push direct/force.)
Puis vérifier `gh api repos/Victorpenhoat/Vito/branches/main/protection` → contexts contient `quality`.
Confirmer au PO (config repo, droits admin).

---

## Notes d'exécution

- **Ordre** : T1 (scripts+README) → T2 (PWA e2e) → PR → CI verte → merge → **A (branch protection)**.
- A en dernier pour ne pas bloquer circulairement la propre PR du garde-fou.
- Pas de migration ; déploiement = merge → Vercel (et désormais bloqué si CI rouge, une fois A en place).
