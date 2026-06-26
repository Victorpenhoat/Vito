# Page d'accueil Vito (connexion + inscription) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer la page d'accueil par défaut (« logo Next ») par une vraie page Vito : marque + slogan + panneau d'authentification à 2 onglets (Connexion / Inscription), avec redirection auto des utilisateurs déjà connectés.

**Architecture:** Un composant client `AuthPanel` gère l'onglet actif et rebranche le `AuthForm` existant sur l'action `signIn` ou `signUp` (passées en props depuis la page). La page d'accueil devient un server component qui redirige les connectés vers `/restos`, sinon rend la marque + le slogan + `AuthPanel`. Aucune nouvelle logique d'auth, aucune migration.

**Tech Stack:** Next.js 16 (App Router, Server/Client Components, Server Actions), next-intl, Tailwind, Playwright.

## Global Constraints

- Next.js 16 non-standard : consulter `node_modules/next/dist/docs/` avant une API Next inconnue.
- TypeScript strict (`noUncheckedIndexedAccess`).
- **Aucune chaîne UI en dur** — tout via next-intl (namespaces `app` et `auth`).
- **Réutiliser** `AuthForm` (`src/features/auth/ui/AuthForm.tsx`) et les actions `signIn`/`signUp`
  (`src/features/auth/data/actions.ts`) — pas de duplication. Les pages `/fr/login` et `/fr/signup`
  restent **inchangées**.
- Slogan exact : **« Votre carnet personnel de sorties et de voyages »**.
- Utilisateur déjà connecté sur l'accueil → **redirection vers `/restos`**.
- Type des actions (identique à `AuthForm`) : `(prev: unknown, fd: FormData) => Promise<{ error: string } | undefined>`.
- `data-testid` : `landing`, `auth-panel`, `tab-login`, `tab-signup`.
- Pas de migration, pas de changement RLS.

---

### Task 1: i18n + composant `AuthPanel` + page d'accueil

**Files:**
- Modify: `messages/fr.json` (clés `app.tagline`, `auth.signupTab`)
- Create: `src/features/auth/ui/AuthPanel.tsx`
- Modify: `src/app/[locale]/page.tsx` (remplacement complet du gabarit par défaut)

**Interfaces:**
- Consumes :
  - `AuthForm` (`src/features/auth/ui/AuthForm.tsx`) — props `{ action: Action; submitLabelKey: string }`,
    où `Action = (prev: unknown, fd: FormData) => Promise<{ error: string } | undefined>` ; le bouton
    affiche `t(submitLabelKey)` dans le namespace `auth`.
  - `signIn`, `signUp` (`src/features/auth/data/actions.ts`) — server actions du type `Action` ;
    redirigent déjà vers `/restos` en cas de succès.
  - `createServerSupabase` (`@/lib/supabase/server`), `redirect` (`@/lib/i18n/routing`),
    `getLocale`/`getTranslations` (`next-intl/server`).
- Produces : la page `/fr` (server component) ; le composant client `AuthPanel`.

- [ ] **Step 1: Ajouter les clés i18n**

Modify `messages/fr.json` :
- Dans le bloc `"app"` (actuellement `"app": { "name": "Vito" }`), ajouter la clé `tagline` :
```json
  "app": {
    "name": "Vito",
    "tagline": "Votre carnet personnel de sorties et de voyages"
  },
```
- Dans le bloc `"auth"`, ajouter `signupTab` (libellé court de l'onglet, à côté de `login` et `signup`
  existants ; respecter les virgules JSON) :
```json
    "signupTab": "Inscription",
```

- [ ] **Step 2: Créer `AuthPanel`**

Create `src/features/auth/ui/AuthPanel.tsx` :
```tsx
"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { AuthForm } from "./AuthForm";

type Action = (prev: unknown, fd: FormData) => Promise<{ error: string } | undefined>;

export function AuthPanel({ signIn, signUp }: { signIn: Action; signUp: Action }) {
  const t = useTranslations("auth");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const tabClass = (active: boolean) =>
    `flex-1 p-2 border-b-2 ${active ? "border-black font-semibold" : "border-transparent text-zinc-500"}`;
  return (
    <div data-testid="auth-panel" className="w-full">
      <div className="mb-4 flex gap-2" role="tablist">
        <button
          type="button"
          data-testid="tab-login"
          aria-selected={mode === "login"}
          onClick={() => setMode("login")}
          className={tabClass(mode === "login")}
        >
          {t("login")}
        </button>
        <button
          type="button"
          data-testid="tab-signup"
          aria-selected={mode === "signup"}
          onClick={() => setMode("signup")}
          className={tabClass(mode === "signup")}
        >
          {t("signupTab")}
        </button>
      </div>
      <AuthForm
        key={mode}
        action={mode === "login" ? signIn : signUp}
        submitLabelKey={mode === "login" ? "login" : "signup"}
      />
    </div>
  );
}
```
(Note : `key={mode}` remonte le `AuthForm` au changement d'onglet → réinitialise son `useActionState`.
Les onglets sont en dehors du `<form>` du `AuthForm`, ce qui permet de cibler le bouton de soumission
sans ambiguïté via `form button[type="submit"]` dans l'e2e.)

- [ ] **Step 3: Remplacer la page d'accueil**

Replace the entire contents of `src/app/[locale]/page.tsx` with:
```tsx
import { getLocale, getTranslations } from "next-intl/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { redirect } from "@/lib/i18n/routing";
import { signIn, signUp } from "@/features/auth/data/actions";
import { AuthPanel } from "@/features/auth/ui/AuthPanel";

export default async function Home() {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  if (data.user) {
    const locale = await getLocale();
    redirect({ href: "/restos", locale });
  }
  const t = await getTranslations("app");
  return (
    <main
      data-testid="landing"
      className="flex flex-1 flex-col items-center justify-center gap-8 bg-zinc-50 px-6 py-16 dark:bg-black"
    >
      <div className="text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-black dark:text-zinc-50">
          {t("name")}
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">{t("tagline")}</p>
      </div>
      <div className="w-full max-w-sm rounded-lg border bg-white p-6 shadow-sm dark:bg-zinc-900">
        <AuthPanel signIn={signIn} signUp={signUp} />
      </div>
    </main>
  );
}
```
(`next.svg` / l'`Image` et le gabarit par défaut disparaissent. Les server actions `signIn`/`signUp`
sont passées en props au composant client — pattern déjà utilisé par `/fr/login`.)

- [ ] **Step 4: Vérifier (typecheck + lint + unit)**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS (aucune erreur de type/lint ; suite unitaire verte).

- [ ] **Step 5: Vérifier visuellement (build dev rapide, optionnel mais recommandé)**

Run: `npm run build`
Expected: build réussi, la route `/[locale]` compile (devient dynamique à cause de `getUser()` — c'est
attendu).

- [ ] **Step 6: Commit**

```bash
git add messages/fr.json src/features/auth/ui/AuthPanel.tsx "src/app/[locale]/page.tsx"
git commit -m "feat(landing): page d'accueil Vito (connexion + inscription, redirection connectés)"
```

---

### Task 2: e2e de la page d'accueil

**Files:**
- Create: `e2e/landing.spec.ts`

**Interfaces:**
- Consumes : la route `/fr`, les `data-testid` `landing`/`tab-login`/`tab-signup` (Task 1), le compte
  seed `client@vito.test` / `password123`. Le bouton de soumission du `AuthForm` est `form
  button[type="submit"]` (ciblage non ambigu, car l'onglet « Connexion » porte le même texte que le
  bouton de soumission en mode login).

- [ ] **Step 1: Écrire l'e2e**

Create `e2e/landing.spec.ts` :
```ts
import { test, expect } from "@playwright/test";

test("l'accueil présente la marque, le slogan et les onglets", async ({ page }) => {
  await page.goto("/fr");
  const landing = page.getByTestId("landing");
  await expect(landing).toBeVisible();
  await expect(landing).toContainText("Vito");
  await expect(landing).toContainText("Votre carnet personnel de sorties et de voyages");
  await expect(page.getByTestId("tab-login")).toBeVisible();
  await expect(page.getByTestId("tab-signup")).toBeVisible();
});

test("basculer sur l'onglet Inscription change le bouton de soumission", async ({ page }) => {
  await page.goto("/fr");
  const submit = page.locator('form button[type="submit"]');
  await expect(submit).toHaveText("Connexion");
  await page.getByTestId("tab-signup").click();
  await expect(submit).toHaveText("Créer un compte");
});

test("connexion depuis l'accueil redirige vers /restos", async ({ page }) => {
  await page.goto("/fr");
  await page.getByLabel("E-mail").fill("client@vito.test");
  await page.getByLabel("Mot de passe").fill("password123");
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/fr\/restos/);
});
```
(Chaque test Playwright a un contexte frais — pas de session persistée — donc `/fr` affiche bien la
landing, jamais la redirection connecté. Le test 3 se connecte dans son propre contexte.)

- [ ] **Step 2: Lancer l'e2e landing**

Run: `supabase db reset && npx playwright test e2e/landing.spec.ts --retries=0`
Expected: PASS (3 tests).

- [ ] **Step 3: Suite complète (non-régression)**

Run: `supabase db reset && npx playwright test --retries=0`
Expected: PASS (toute la suite + landing). Un seul `db reset` immédiatement avant la suite complète.

- [ ] **Step 4: Commit**

```bash
git add e2e/landing.spec.ts
git commit -m "test(landing): e2e accueil (marque/onglets/connexion → /restos)"
```

---

## Notes d'exécution

- **Ordre** : Task 1 (UI) → Task 2 (e2e).
- **Pas de migration, pas de changement prod côté DB.** Déploiement = simple merge → Vercel redéploie.
- **Ne pas modifier** `AuthForm`, `/fr/login`, `/fr/signup`, ni les actions auth — on réutilise tel quel.
- **Collision de libellé** : en mode login, l'onglet et le bouton de soumission affichent tous deux
  « Connexion ». Les assertions e2e ciblent le bouton via `form button[type="submit"]` (l'onglet est
  hors du `<form>`). Ne pas utiliser `getByRole("button", { name: "Connexion" })` (matcherait les deux).
- **Signaux e2e déterministes** : visibilité des testids, `toHaveText`, `toHaveURL` ; jamais
  `networkidle`.
