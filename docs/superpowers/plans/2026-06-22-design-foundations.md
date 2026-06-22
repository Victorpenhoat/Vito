# Refonte visuelle — Slice 1 : Fondations + navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Donner à Vito une identité visuelle moderne épurée (accent indigo) et une barre de navigation présente sur tous les écrans de l'app, et restyler l'accueil + les formulaires d'auth.

**Architecture:** Tokens de design dans `globals.css` (Tailwind v4 `@theme`) → utilitaires `bg-accent`, `text-muted`, etc. Une barre `AppNav` (client) rendue dans le layout du groupe `(app)` apparaît sur tous les écrans authentifiés. Accueil/auth restylés avec les tokens. Aucune migration, aucun changement DB.

**Tech Stack:** Next.js 16 (App Router, Server/Client Components), Tailwind v4 (config CSS), next-intl, Playwright.

## Global Constraints

- Next.js 16 non-standard : consulter `node_modules/next/dist/docs/` avant une API inconnue.
- Tailwind **v4** : configuration via `@theme` dans `globals.css` (PAS de `tailwind.config.js`). Les tokens `--color-<nom>` génèrent les utilitaires (`bg-<nom>`, `text-<nom>`) ; `--radius-card` → `rounded-card`.
- Accent **indigo** `#4f46e5`. Mode **clair** uniquement (mode sombre retiré → différé).
- **Aucune chaîne UI en dur** — next-intl (`app.name`, namespace `nav`, namespace `auth`).
- **Réutiliser** `signOut` (`@/features/auth/data/actions`), `Link`/`usePathname`/`redirect` (`@/lib/i18n/routing`), `requireRole`/`getSessionRole` (`@/lib/rbac/guards`). Le « . » décoratif après « Vito » n'est pas une chaîne traduisible.
- `data-testid` : `app-nav`, `nav-<clé>` (ex. `nav-restos`), et (préservés) `landing`, `auth-panel`, `tab-login`, `tab-signup`.
- `usePathname()` de next-intl renvoie le chemin **sans** préfixe de locale (ex. `/restos`).
- Pas de migration, pas de changement DB/RLS. La garde d'accès `(app)` (`requireRole`) est conservée.

---

### Task 1: Tokens de design (`globals.css`)

**Files:**
- Modify: `src/app/globals.css` (remplacement complet)

**Interfaces:**
- Produces : utilitaires Tailwind `bg-accent`/`text-accent`/`bg-accent-50`/`text-accent-600`/`text-ink`/
  `text-muted`/`border-line`/`bg-surface`/`bg-canvas` et `rounded-card` ; police système sur `body`.

- [ ] **Step 1: Remplacer `globals.css`**

Replace the entire contents of `src/app/globals.css` with:
```css
@import "tailwindcss";

@theme {
  --color-accent: #4f46e5;
  --color-accent-600: #4338ca;
  --color-accent-50: #eef2ff;
  --color-ink: #0f172a;
  --color-muted: #64748b;
  --color-line: #e2e8f0;
  --color-surface: #ffffff;
  --color-canvas: #f8fafc;
  --radius-card: 16px;
  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

body {
  background-color: var(--color-canvas);
  color: var(--color-ink);
  font-family: var(--font-sans);
}
```
(Retire les anciens `--background`/`--foreground`, le bloc `@theme inline` et le
`@media (prefers-color-scheme: dark)` — mode sombre différé.)

- [ ] **Step 2: Vérifier que Tailwind compile les tokens**

Run: `npm run build`
Expected: build réussi (Tailwind v4 traite le bloc `@theme` sans erreur ; les classes `bg-accent` etc.
deviennent disponibles). Si le build échoue sur la syntaxe `@theme`, vérifier la version Tailwind dans
`package.json` et la doc `@theme`.

- [ ] **Step 3: Vérifier lint**

Run: `npm run lint`
Expected: PASS (0 erreur).

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(design): tokens indigo + police système (Tailwind v4 @theme)"
```

---

### Task 2: Barre de navigation `AppNav` + i18n + intégration layout

**Files:**
- Modify: `messages/fr.json` (namespace `nav`)
- Create: `src/features/shell/ui/AppNav.tsx`
- Modify: `src/app/[locale]/(app)/layout.tsx`

**Interfaces:**
- Consumes : `Link`, `usePathname` (`@/lib/i18n/routing`) ; `signOut` (`@/features/auth/data/actions`,
  server action sans argument) ; `requireRole`, `getSessionRole` (`@/lib/rbac/guards`, `getSessionRole`
  renvoie `"client" | "agence" | "admin" | null`) ; tokens de Task 1.
- Produces : `AppNav` (props `{ role: "client" | "agence" | "admin" }`) rendu dans le layout `(app)`.

- [ ] **Step 1: Ajouter le namespace `nav` à `messages/fr.json`**

Modify `messages/fr.json` — ajouter au niveau racine (respecter les virgules JSON) :
```json
  "nav": {
    "restos": "Restos",
    "voyages": "Voyages",
    "depenses": "Dépenses",
    "famille": "Famille",
    "conciergerie": "Conciergerie",
    "vins": "Vins",
    "abonnement": "Abonnement",
    "agence": "Agence",
    "admin": "Admin",
    "deconnexion": "Déconnexion"
  },
```

- [ ] **Step 2: Créer `AppNav`**

Create `src/features/shell/ui/AppNav.tsx` :
```tsx
"use client";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/lib/i18n/routing";
import { signOut } from "@/features/auth/data/actions";

type Role = "client" | "agence" | "admin";

const CORE = ["restos", "voyages", "depenses", "famille", "conciergerie", "vins", "abonnement"] as const;

export function AppNav({ role }: { role: Role }) {
  const t = useTranslations("nav");
  const tApp = useTranslations("app");
  const pathname = usePathname();
  const items: string[] = [...CORE];
  if (role === "agence" || role === "admin") items.push("agence");
  if (role === "admin") items.push("admin");
  const isActive = (key: string) => pathname.startsWith(`/${key}`);
  return (
    <header
      data-testid="app-nav"
      className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-line bg-surface px-4"
    >
      <Link href="/restos" className="text-lg font-extrabold tracking-tight">
        {tApp("name")}
        <span className="text-accent">.</span>
      </Link>
      <nav className="flex flex-1 gap-1 overflow-x-auto">
        {items.map((key) => (
          <Link
            key={key}
            href={`/${key}`}
            data-testid={`nav-${key}`}
            aria-current={isActive(key) ? "page" : undefined}
            className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${
              isActive(key) ? "bg-accent-50 text-accent-600" : "text-muted hover:bg-canvas"
            }`}
          >
            {t(key)}
          </Link>
        ))}
      </nav>
      <form action={signOut}>
        <button
          type="submit"
          className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-canvas"
        >
          {t("deconnexion")}
        </button>
      </form>
    </header>
  );
}
```

- [ ] **Step 3: Intégrer dans le layout `(app)`**

Replace the contents of `src/app/[locale]/(app)/layout.tsx` with:
```tsx
import { requireRole, getSessionRole } from "@/lib/rbac/guards";
import { AppNav } from "@/features/shell/ui/AppNav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireRole(["client", "agence", "admin"]);
  const role = (await getSessionRole()) ?? "client";
  return (
    <div className="min-h-dvh">
      <AppNav role={role} />
      <div className="mx-auto max-w-5xl">{children}</div>
    </div>
  );
}
```

- [ ] **Step 4: Vérifier (typecheck + lint + unit)**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS (types OK — `getSessionRole` renvoie bien `AppRole | null` ; lint 0/0 ; unit verts).

- [ ] **Step 5: Commit**

```bash
git add messages/fr.json src/features/shell/ui/AppNav.tsx "src/app/[locale]/(app)/layout.tsx"
git commit -m "feat(design): barre de navigation AppNav sur tous les écrans + i18n nav"
```

---

### Task 3: Restylage accueil + formulaires d'auth

**Files:**
- Modify: `src/features/auth/ui/AuthForm.tsx`
- Modify: `src/features/auth/ui/AuthPanel.tsx`
- Modify: `src/app/[locale]/page.tsx`
- Modify: `src/app/[locale]/(auth)/login/page.tsx`
- Modify: `src/app/[locale]/(auth)/signup/page.tsx`

**Interfaces:**
- Consumes : tokens de Task 1 ; actions `signIn`/`signUp` ; `AuthPanel`/`AuthForm`.
- Produces : accueil + pages auth restylés. `data-testid` `landing`/`auth-panel`/`tab-login`/`tab-signup`
  **préservés**. Labels i18n et logique (`useActionState`, `role="alert"`, `key={mode}`, redirection)
  **inchangés**.

- [ ] **Step 1: Restyler `AuthForm`**

Replace the contents of `src/features/auth/ui/AuthForm.tsx` with:
```tsx
"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";

type Action = (prev: unknown, fd: FormData) => Promise<{ error: string } | undefined>;

export function AuthForm({ action, submitLabelKey }: { action: Action; submitLabelKey: string }) {
  const t = useTranslations("auth");
  const [state, formAction, pending] = useActionState(action, undefined);
  const inputClass =
    "rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:border-transparent focus:outline-2 focus:outline-accent";
  return (
    <form action={formAction} className="flex flex-col gap-3 text-left">
      <label className="flex flex-col gap-1 text-sm font-medium">
        {t("email")}
        <input name="email" type="email" required className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        {t("password")}
        <input name="password" type="password" required className={inputClass} />
      </label>
      {state?.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="mt-1 rounded-xl bg-accent px-4 py-2.5 font-semibold text-white disabled:opacity-60"
      >
        {t(submitLabelKey)}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Restyler `AuthPanel` (onglets en pilule)**

Replace the contents of `src/features/auth/ui/AuthPanel.tsx` with:
```tsx
"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { AuthForm } from "./AuthForm";

type Action = (prev: unknown, fd: FormData) => Promise<{ error: string } | undefined>;

export function AuthPanel({ signIn, signUp }: { signIn: Action; signUp: Action }) {
  const t = useTranslations("auth");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const tab = (active: boolean) =>
    `flex-1 rounded-lg py-2 text-sm font-semibold ${active ? "bg-surface text-ink shadow-sm" : "text-muted"}`;
  return (
    <div data-testid="auth-panel" className="w-full">
      <div className="mb-4 flex gap-1 rounded-xl bg-canvas p-1" role="tablist">
        <button
          type="button"
          role="tab"
          data-testid="tab-login"
          aria-selected={mode === "login"}
          onClick={() => setMode("login")}
          className={tab(mode === "login")}
        >
          {t("login")}
        </button>
        <button
          type="button"
          role="tab"
          data-testid="tab-signup"
          aria-selected={mode === "signup"}
          onClick={() => setMode("signup")}
          className={tab(mode === "signup")}
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

- [ ] **Step 3: Restyler l'accueil**

Replace the contents of `src/app/[locale]/page.tsx` with:
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
      className="flex min-h-dvh flex-col items-center justify-center bg-[radial-gradient(1200px_400px_at_50%_-10%,var(--color-accent-50),var(--color-canvas)_60%)] px-6 py-16"
    >
      <div className="w-full max-w-sm rounded-card border border-line bg-surface p-7 text-center shadow-sm">
        <div className="text-3xl font-extrabold tracking-tight">
          {t("name")}
          <span className="text-accent">.</span>
        </div>
        <p className="mb-6 mt-1.5 text-sm text-muted">{t("tagline")}</p>
        <AuthPanel signIn={signIn} signUp={signUp} />
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Restyler `/login` et `/signup`**

Replace `src/app/[locale]/(auth)/login/page.tsx` with:
```tsx
import { AuthForm } from "@/features/auth/ui/AuthForm";
import { signIn } from "@/features/auth/data/actions";

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm rounded-card border border-line bg-surface p-7 shadow-sm">
        <AuthForm action={signIn} submitLabelKey="login" />
      </div>
    </main>
  );
}
```
Replace `src/app/[locale]/(auth)/signup/page.tsx` with:
```tsx
import { AuthForm } from "@/features/auth/ui/AuthForm";
import { signUp } from "@/features/auth/data/actions";

export default function SignupPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm rounded-card border border-line bg-surface p-7 shadow-sm">
        <AuthForm action={signUp} submitLabelKey="signup" />
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Vérifier (typecheck + lint + unit)**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS (types/lint OK ; unit verts).

- [ ] **Step 6: Commit**

```bash
git add src/features/auth/ui/AuthForm.tsx src/features/auth/ui/AuthPanel.tsx "src/app/[locale]/page.tsx" "src/app/[locale]/(auth)/login/page.tsx" "src/app/[locale]/(auth)/signup/page.tsx"
git commit -m "feat(design): restylage accueil + formulaires d'auth (carte, onglets pilule, champs/boutons indigo)"
```

---

### Task 4: e2e navigation + non-régression

**Files:**
- Create: `e2e/navigation.spec.ts`
- Modify (si nécessaire) : specs e2e existants dont un sélecteur entre en collision avec les nouveaux liens de nav.

**Interfaces:**
- Consumes : `app-nav`/`nav-<clé>` (Task 2), comptes seed `client@vito.test`/`admin@vito.test` /
  `password123`. Bouton de soumission auth = `form button[type="submit"]`.

- [ ] **Step 1: Écrire l'e2e**

Create `e2e/navigation.spec.ts` :
```ts
import { test, expect, type Page } from "@playwright/test";

async function login(page: Page, email: string) {
  await page.goto("/fr/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill("password123");
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/fr\/restos/);
}

test("la barre de navigation est visible, l'onglet courant actif, Admin masqué (client)", async ({ page }) => {
  await login(page, "client@vito.test");
  await expect(page.getByTestId("app-nav")).toBeVisible();
  await expect(page.getByTestId("nav-restos")).toBeVisible();
  await expect(page.getByTestId("nav-voyages")).toBeVisible();
  await expect(page.getByTestId("nav-restos")).toHaveAttribute("aria-current", "page");
  await expect(page.getByTestId("nav-admin")).toHaveCount(0);
});

test("naviguer via la barre change d'écran", async ({ page }) => {
  await login(page, "client@vito.test");
  await page.getByTestId("nav-voyages").click();
  await expect(page).toHaveURL(/\/fr\/voyages/);
  await expect(page.getByTestId("app-nav")).toBeVisible();
});

test("la déconnexion depuis la barre renvoie au login", async ({ page }) => {
  await login(page, "client@vito.test");
  await page.getByRole("button", { name: "Déconnexion" }).click();
  await expect(page).toHaveURL(/\/fr\/login/);
});

test("le lien Admin apparaît pour un admin", async ({ page }) => {
  await login(page, "admin@vito.test");
  await expect(page.getByTestId("nav-admin")).toBeVisible();
});
```

- [ ] **Step 2: Lancer l'e2e navigation**

Run: `supabase db reset && npx playwright test e2e/navigation.spec.ts --retries=0`
Expected: PASS (4 tests).

- [ ] **Step 3: Suite complète (non-régression)**

Run: `supabase db reset && npx playwright test --retries=0`
Expected: PASS (toute la suite). **Risque connu** : la nouvelle nav ajoute des liens nommés « Restos »,
« Voyages », etc. Si un spec existant cible un libellé identique de façon ambiguë (ex.
`getByRole("link", { name: "Voyages" })` qui matcherait désormais le lien de nav **et** un élément de la
page → violation strict-mode), **resserrer le sélecteur du test existant** (le scoper à `main`, à un
`data-testid`, ou au conteneur de la page). C'est une **désambiguïsation**, pas un affaiblissement.
Diagnostiquer chaque échec ; ne jamais relâcher une assertion.

- [ ] **Step 4: Commit**

```bash
git add e2e/
git commit -m "test(design): e2e navigation (barre visible/active/navigation/déconnexion/gating admin)"
```

---

## Notes d'exécution

- **Ordre** : Task 1 (tokens) → Task 2 (nav) → Task 3 (accueil/auth) → Task 4 (e2e). Task 3 dépend des
  tokens (Task 1) ; Task 4 dépend de la nav (Task 2).
- **Pas de migration, pas de changement prod DB.** Déploiement = simple merge → Vercel redéploie.
- **Signaux e2e déterministes** : testids, `toHaveAttribute`, `toHaveURL` ; jamais `networkidle`.
- **Périmètre** : on ne touche PAS la mise en page interne des écrans métier (restos/voyages/dépenses/…)
  — ils héritent police + couleurs + nav ; leur polish dédié est pour des slices ultérieurs.
- Conserver tous les `data-testid` existants de l'accueil/auth (l'e2e landing de la slice précédente
  doit rester vert).
