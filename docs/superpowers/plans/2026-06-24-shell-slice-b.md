# Refonte Core.Badakan — Slice B : Shell responsive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer la coquille d'app responsive (sidebar desktop ↔ bottom-nav + drawer mobile, nav RBAC, footer user/langue/thème), passer l'app en sombre par défaut, et ajouter les locales en/it/es.

**Architecture:** Le layout `(app)` (serveur) garde `requireRole`, récupère rôle + nom, filtre la nav par rôle, et rend `AppShell` (client) qui orchestre sidebar (desktop) / bottom-nav + drawer (mobile) via classes responsive + état drawer. Réutilise le kit Slice A. Locales en/it/es = copie FR + namespaces shell traduits.

**Tech Stack:** Next.js 16, Tailwind v4, next-intl (4 locales), lucide-react, Vitest, Playwright.

## Global Constraints

- Next.js 16 ; Tailwind v4 ; TS strict (`noUncheckedIndexedAccess`).
- **Aucune chaîne UI en dur** — next-intl. Réutiliser le kit Slice A (`NavItem`, `Avatar`, `ThemeToggle`).
- `Link`/`usePathname`/`useRouter` viennent de `@/lib/i18n/routing`. `usePathname()` est sans locale.
- **Sombre par défaut** : `data-theme` défaut `dark` (clair seulement si cookie `theme=light`).
- **RBAC** : la garde `(app)` (`requireRole`) est conservée (autorité réelle) ; la nav conditionnelle est UI.
- Locales : `fr, en, it, es` (défaut `fr`). en/it/es = copie de fr.json + `nav`/`shell`/`app`/`auth`/`accueil` traduits ; modules restent FR.
- `data-testid` : `app-shell`, `sidebar`, `bottom-nav`, `drawer`, `drawer-open`, `nav-<key>`, `locale-switcher`, `theme-toggle` (kit).
- Pas de migration, pas de RLS.

---

### Task 1: Sombre par défaut + locales en/it/es + clés i18n

**Files:**
- Modify: `src/app/[locale]/layout.tsx` (défaut dark)
- Modify: `src/lib/i18n/routing.ts` (4 locales)
- Modify: `messages/fr.json` (clés `nav.accueil/recherche/plus`, `shell.language/settings/menu`, `accueil.*`)
- Create: `messages/en.json`, `messages/it.json`, `messages/es.json`

**Interfaces:**
- Produces : routing 4 locales ; toutes les clés i18n du shell présentes dans les 4 langues.

- [ ] **Step 1: Défaut sombre**

In `src/app/[locale]/layout.tsx`, change the theme line to:
```tsx
  const theme = cookieStore.get("theme")?.value === "light" ? "light" : "dark";
```

- [ ] **Step 2: 4 locales**

In `src/lib/i18n/routing.ts`, change the routing definition:
```ts
export const routing = defineRouting({
  locales: ["fr", "en", "it", "es"],
  defaultLocale: "fr",
});
```

- [ ] **Step 3: Nouvelles clés FR**

In `messages/fr.json`, add to the `"nav"` object: `"accueil": "Accueil", "recherche": "Recherche", "plus": "Plus"`.
Add to the `"shell"` object: `"language": "Langue", "settings": "Paramétrage", "menu": "Menu"`.
Add a new root `"accueil"` object:
```json
  "accueil": { "title": "Accueil", "welcome": "Bienvenue sur Vito 👋", "cta": "Voir mes restos" },
```
(Mind JSON commas; the file must stay valid.)

- [ ] **Step 4: Créer en/it/es (copie + traduction)**

Run:
```bash
cp messages/fr.json messages/en.json
cp messages/fr.json messages/it.json
cp messages/fr.json messages/es.json
```
Then in **each** of `en.json`/`it.json`/`es.json`, replace the `"nav"`, `"shell"`, `"app"`, `"auth"`, and `"accueil"` objects with the translated versions below (leave every other namespace as the copied FR — modules are translated later).

**en.json:**
```json
  "app": { "name": "Vito", "tagline": "Your personal journal of outings and travels" },
  "auth": { "login": "Sign in", "signup": "Create account", "signupTab": "Sign up", "email": "Email", "password": "Password", "submit": "Submit", "errors": { "invalidCredentials": "Invalid credentials", "signInFailed": "Sign-in failed", "signUpFailed": "Sign-up failed" } },
  "nav": { "restos": "Restaurants", "voyages": "Trips", "depenses": "Shared accounts", "famille": "Family", "conciergerie": "Concierge", "vins": "Wines", "abonnement": "Subscription", "agence": "Agency", "admin": "Back-office", "deconnexion": "Sign out", "accueil": "Home", "recherche": "Search", "plus": "More" },
  "shell": { "theme": "Toggle theme (light / dark)", "close": "Close", "language": "Language", "settings": "Settings", "menu": "Menu" },
  "accueil": { "title": "Home", "welcome": "Welcome to Vito 👋", "cta": "See my restaurants" },
```

**it.json:**
```json
  "app": { "name": "Vito", "tagline": "Il tuo diario personale di uscite e viaggi" },
  "auth": { "login": "Accedi", "signup": "Crea un account", "signupTab": "Registrati", "email": "E-mail", "password": "Password", "submit": "Conferma", "errors": { "invalidCredentials": "Credenziali non valide", "signInFailed": "Accesso non riuscito", "signUpFailed": "Registrazione non riuscita" } },
  "nav": { "restos": "Ristoranti", "voyages": "Viaggi", "depenses": "Conti condivisi", "famille": "Famiglia", "conciergerie": "Concierge", "vins": "Vini", "abonnement": "Abbonamento", "agence": "Agenzia", "admin": "Back-office", "deconnexion": "Esci", "accueil": "Home", "recherche": "Cerca", "plus": "Altro" },
  "shell": { "theme": "Cambia tema (chiaro / scuro)", "close": "Chiudi", "language": "Lingua", "settings": "Impostazioni", "menu": "Menu" },
  "accueil": { "title": "Home", "welcome": "Benvenuto su Vito 👋", "cta": "Vedi i miei ristoranti" },
```

**es.json:**
```json
  "app": { "name": "Vito", "tagline": "Tu cuaderno personal de salidas y viajes" },
  "auth": { "login": "Iniciar sesión", "signup": "Crear una cuenta", "signupTab": "Registrarse", "email": "Correo electrónico", "password": "Contraseña", "submit": "Enviar", "errors": { "invalidCredentials": "Credenciales no válidas", "signInFailed": "Error al iniciar sesión", "signUpFailed": "Error al registrarse" } },
  "nav": { "restos": "Restaurantes", "voyages": "Viajes", "depenses": "Cuentas compartidas", "famille": "Familia", "conciergerie": "Conserjería", "vins": "Vinos", "abonnement": "Suscripción", "agence": "Agencia", "admin": "Back-office", "deconnexion": "Cerrar sesión", "accueil": "Inicio", "recherche": "Buscar", "plus": "Más" },
  "shell": { "theme": "Cambiar tema (claro / oscuro)", "close": "Cerrar", "language": "Idioma", "settings": "Ajustes", "menu": "Menú" },
  "accueil": { "title": "Inicio", "welcome": "Bienvenido a Vito 👋", "cta": "Ver mis restaurantes" },
```

- [ ] **Step 5: Vérifier**

Run: `npm run build && npm run lint`
Expected: build OK (4 locales générées ; JSON valides) ; lint 0. Si un JSON est invalide, `node -e "require('./messages/en.json')"` (et it/es) pour localiser.

- [ ] **Step 6: Commit**

```bash
git add "src/app/[locale]/layout.tsx" src/lib/i18n/routing.ts messages/
git commit -m "feat(shell): sombre par défaut + locales en/it/es + clés i18n shell"
```

---

### Task 2: Config de nav + `filterNav` (TDD) + map d'icônes

**Files:**
- Create: `src/features/shell/nav-config.ts` + `nav-config.test.ts`

**Interfaces:**
- Produces : `type Role = "client"|"agence"|"admin"` ; `type NavKey` ; `NAV_ITEMS: { key: NavKey; href: string; roles?: Role[] }[]` ; `BOTTOM_KEYS: NavKey[]` ; `filterNav(items, role): typeof items`.

- [ ] **Step 1: Test (échec)**

Create `src/features/shell/nav-config.test.ts` :
```ts
import { describe, it, expect } from "vitest";
import { NAV_ITEMS, filterNav } from "./nav-config";

describe("filterNav", () => {
  it("client ne voit ni agence ni admin", () => {
    const keys = filterNav(NAV_ITEMS, "client").map((i) => i.key);
    expect(keys).toContain("restos");
    expect(keys).not.toContain("agence");
    expect(keys).not.toContain("admin");
  });
  it("agence voit agence mais pas admin", () => {
    const keys = filterNav(NAV_ITEMS, "agence").map((i) => i.key);
    expect(keys).toContain("agence");
    expect(keys).not.toContain("admin");
  });
  it("admin voit agence et admin", () => {
    const keys = filterNav(NAV_ITEMS, "admin").map((i) => i.key);
    expect(keys).toContain("agence");
    expect(keys).toContain("admin");
  });
});
```

- [ ] **Step 2: Lancer (échec)**

Run: `npx vitest run src/features/shell/nav-config.test.ts` → FAIL (module introuvable).

- [ ] **Step 3: Implémenter**

Create `src/features/shell/nav-config.ts` :
```ts
export type Role = "client" | "agence" | "admin";
export type NavKey =
  | "accueil" | "restos" | "vins" | "recherche" | "voyages" | "famille"
  | "depenses" | "conciergerie" | "abonnement" | "agence" | "admin";

export type NavEntry = { key: NavKey; href: string; roles?: Role[] };

export const NAV_ITEMS: NavEntry[] = [
  { key: "accueil", href: "/accueil" },
  { key: "restos", href: "/restos" },
  { key: "vins", href: "/vins" },
  { key: "recherche", href: "/recherche" },
  { key: "voyages", href: "/voyages" },
  { key: "famille", href: "/famille" },
  { key: "depenses", href: "/depenses" },
  { key: "conciergerie", href: "/conciergerie" },
  { key: "abonnement", href: "/abonnement" },
  { key: "agence", href: "/agence", roles: ["agence", "admin"] },
  { key: "admin", href: "/admin", roles: ["admin"] },
];

export const BOTTOM_KEYS: NavKey[] = ["accueil", "restos", "voyages", "recherche"];

export function filterNav(items: NavEntry[], role: Role): NavEntry[] {
  return items.filter((i) => !i.roles || i.roles.includes(role));
}
```

- [ ] **Step 4: Lancer (succès)**

Run: `npx vitest run src/features/shell/nav-config.test.ts` → PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/shell/nav-config.ts src/features/shell/nav-config.test.ts
git commit -m "feat(shell): config de nav + filterNav (RBAC, testé)"
```

---

### Task 3: Composants du shell

**Files:**
- Create: `src/features/shell/ui/LocaleSwitcher.tsx`, `ShellFooter.tsx`, `Sidebar.tsx`, `BottomNav.tsx`, `Drawer.tsx`, `AppShell.tsx`

**Interfaces:**
- Consumes : `NAV_ITEMS`/`BOTTOM_KEYS`/`NavEntry`/`NavKey`/`Role` (Task 2) ; `NavItem`/`Avatar`/`ThemeToggle` (kit) ; `Link`/`usePathname`/`useRouter` (`@/lib/i18n/routing`) ; `routing` (locales) ; `signOut` ; `lucide-react`.
- Produces : `AppShell` (props `{ items: NavEntry[]; role: Role; userName: string }`).

- [ ] **Step 1: `LocaleSwitcher`**

Create `src/features/shell/ui/LocaleSwitcher.tsx` :
```tsx
"use client";
import { usePathname, useRouter } from "@/lib/i18n/routing";
import { useLocale } from "next-intl";
import { routing } from "@/lib/i18n/routing";

export function LocaleSwitcher() {
  const pathname = usePathname();
  const router = useRouter();
  const current = useLocale();
  return (
    <div data-testid="locale-switcher" className="flex gap-1 text-xs">
      {routing.locales.map((loc) => (
        <button
          key={loc}
          type="button"
          onClick={() => router.replace(pathname, { locale: loc })}
          aria-current={loc === current ? "true" : undefined}
          className={`rounded px-1.5 py-1 uppercase ${loc === current ? "text-ink font-semibold" : "text-faint hover:text-muted"}`}
        >
          {loc}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: `ShellFooter`**

Create `src/features/shell/ui/ShellFooter.tsx` :
```tsx
"use client";
import { Settings } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/routing";
import { Avatar } from "@/features/shared/ui/Avatar";
import { ThemeToggle } from "@/features/shared/ui/ThemeToggle";
import { signOut } from "@/features/auth/data/actions";
import { LocaleSwitcher } from "./LocaleSwitcher";

export function ShellFooter({ userName, role }: { userName: string; role: string }) {
  const t = useTranslations("nav");
  const ts = useTranslations("shell");
  return (
    <div className="flex flex-col gap-3 border-t border-line pt-3 text-sm">
      <Link href="/gouts" className="flex items-center gap-2 text-muted hover:text-ink">
        <Settings size={18} /> {ts("settings")}
      </Link>
      <div className="flex items-center gap-2">
        <Avatar name={userName} size="sm" />
        <div className="min-w-0">
          <div className="truncate text-ink">{userName}</div>
          <div className="text-xs capitalize text-faint">{role}</div>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <LocaleSwitcher />
        <ThemeToggle />
      </div>
      <form action={signOut}>
        <button type="submit" className="text-left text-muted hover:text-ink">{t("deconnexion")}</button>
      </form>
    </div>
  );
}
```
(`"use client"` car `ShellFooter` utilise `useTranslations` et vit dans la frontière client du shell ;
le `<form action={signOut}>` reste valide — une server action peut être importée dans un composant
client.)

- [ ] **Step 3: map d'icônes + `Sidebar`**

Create `src/features/shell/ui/Sidebar.tsx` :
```tsx
"use client";
import { useTranslations } from "next-intl";
import {
  Home, Utensils, Wine, Search, Plane, Users, Wallet, ConciergeBell, CreditCard, Briefcase, Shield,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { NavItem } from "@/features/shared/ui/NavItem";
import type { NavEntry, NavKey } from "../nav-config";
import { ShellFooter } from "./ShellFooter";

export const NAV_ICONS: Record<NavKey, LucideIcon> = {
  accueil: Home, restos: Utensils, vins: Wine, recherche: Search, voyages: Plane,
  famille: Users, depenses: Wallet, conciergerie: ConciergeBell, abonnement: CreditCard,
  agence: Briefcase, admin: Shield,
};

export function Sidebar({
  items, userName, role, pathname,
}: { items: NavEntry[]; userName: string; role: string; pathname: string }) {
  const t = useTranslations("nav");
  const tApp = useTranslations("app");
  return (
    <aside
      data-testid="sidebar"
      className="fixed inset-y-0 left-0 hidden w-64 flex-col gap-4 border-r border-line bg-sidebar p-4 md:flex"
    >
      <div className="flex items-center gap-2 px-1 py-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent font-bold text-white">V</span>
        <span className="text-lg font-extrabold uppercase tracking-wide">{tApp("name")}</span>
      </div>
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
        {items.map((it) => {
          const Icon = NAV_ICONS[it.key];
          return (
            <NavItem
              key={it.key}
              icon={<Icon size={18} />}
              label={t(it.key)}
              href={it.href}
              active={pathname.startsWith(it.href)}
            />
          );
        })}
      </nav>
      <ShellFooter userName={userName} role={role} />
    </aside>
  );
}
```

- [ ] **Step 4: `BottomNav`**

Create `src/features/shell/ui/BottomNav.tsx` :
```tsx
"use client";
import { useTranslations } from "next-intl";
import { MoreHorizontal } from "lucide-react";
import { Link } from "@/lib/i18n/routing";
import { NAV_ICONS } from "./Sidebar";
import { BOTTOM_KEYS, type NavEntry } from "../nav-config";

export function BottomNav({
  items, pathname, onMore,
}: { items: NavEntry[]; pathname: string; onMore: () => void }) {
  const t = useTranslations("nav");
  const bottom = BOTTOM_KEYS.map((k) => items.find((i) => i.key === k)).filter(Boolean) as NavEntry[];
  return (
    <nav
      data-testid="bottom-nav"
      className="fixed inset-x-0 bottom-0 z-20 flex border-t border-line bg-sidebar md:hidden"
    >
      {bottom.map((it) => {
        const Icon = NAV_ICONS[it.key];
        const active = pathname.startsWith(it.href);
        return (
          <Link
            key={it.key}
            href={it.href}
            data-testid={`nav-${it.key}`}
            aria-current={active ? "page" : undefined}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs ${active ? "text-accent" : "text-muted"}`}
          >
            <Icon size={20} />
            {t(it.key)}
          </Link>
        );
      })}
      <button
        type="button"
        data-testid="drawer-open"
        onClick={onMore}
        className="flex flex-1 flex-col items-center gap-0.5 py-2 text-xs text-muted"
      >
        <MoreHorizontal size={20} />
        {t("plus")}
      </button>
    </nav>
  );
}
```

- [ ] **Step 5: `Drawer`**

Create `src/features/shell/ui/Drawer.tsx` :
```tsx
"use client";
import { useTranslations } from "next-intl";
import { NavItem } from "@/features/shared/ui/NavItem";
import { NAV_ICONS } from "./Sidebar";
import { ShellFooter } from "./ShellFooter";
import type { NavEntry } from "../nav-config";

export function Drawer({
  open, onClose, items, userName, role, pathname,
}: {
  open: boolean; onClose: () => void; items: NavEntry[]; userName: string; role: string; pathname: string;
}) {
  const t = useTranslations("nav");
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-30 bg-black/60 md:hidden" onClick={onClose}>
      <div
        data-testid="drawer"
        className="absolute inset-y-0 left-0 flex w-72 flex-col gap-4 bg-sidebar p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
          {items.map((it) => {
            const Icon = NAV_ICONS[it.key];
            return (
              <NavItem
                key={it.key}
                icon={<Icon size={18} />}
                label={t(it.key)}
                href={it.href}
                active={pathname.startsWith(it.href)}
              />
            );
          })}
        </nav>
        <ShellFooter userName={userName} role={role} />
      </div>
    </div>
  );
}
```

- [ ] **Step 6: `AppShell`**

Create `src/features/shell/ui/AppShell.tsx` :
```tsx
"use client";
import { useState, type ReactNode } from "react";
import { usePathname } from "@/lib/i18n/routing";
import type { NavEntry, Role } from "../nav-config";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { Drawer } from "./Drawer";

export function AppShell({
  items, role, userName, children,
}: { items: NavEntry[]; role: Role; userName: string; children: ReactNode }) {
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);
  return (
    <div data-testid="app-shell" className="min-h-dvh">
      <Sidebar items={items} userName={userName} role={role} pathname={pathname} />
      <BottomNav items={items} pathname={pathname} onMore={() => setDrawer(true)} />
      <Drawer
        open={drawer}
        onClose={() => setDrawer(false)}
        items={items}
        userName={userName}
        role={role}
        pathname={pathname}
      />
      <div className="pb-16 md:pb-0 md:pl-64">{children}</div>
    </div>
  );
}
```

- [ ] **Step 7: Vérifier (typecheck + lint + unit)**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS (types/lint OK ; suite unitaire verte).

- [ ] **Step 8: Commit**

```bash
git add src/features/shell/ui/
git commit -m "feat(shell): composants AppShell/Sidebar/BottomNav/Drawer/ShellFooter/LocaleSwitcher"
```

---

### Task 4: Câblage layout + stub /accueil + suppression AppNav

**Files:**
- Modify: `src/app/[locale]/(app)/layout.tsx`
- Create: `src/app/[locale]/(app)/accueil/page.tsx`
- Delete: `src/features/shell/ui/AppNav.tsx`
- Delete: `e2e/navigation.spec.ts` (réécrit en Task 5)

**Interfaces:**
- Consumes : `AppShell` (Task 3) ; `NAV_ITEMS`/`filterNav` (Task 2) ; `requireRole`/`getSessionRole` ; `createServerSupabase`.

- [ ] **Step 1: Câbler le layout `(app)`**

Replace the contents of `src/app/[locale]/(app)/layout.tsx` with:
```tsx
import { requireRole, getSessionRole } from "@/lib/rbac/guards";
import { createServerSupabase } from "@/lib/supabase/server";
import { AppShell } from "@/features/shell/ui/AppShell";
import { NAV_ITEMS, filterNav, type Role } from "@/features/shell/nav-config";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireRole(["client", "agence", "admin"]);
  const role = ((await getSessionRole()) ?? "client") as Role;

  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  let userName = auth.user?.email ?? "";
  if (auth.user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", auth.user.id)
      .maybeSingle();
    if (profile?.display_name) userName = profile.display_name;
  }

  return (
    <AppShell items={filterNav(NAV_ITEMS, role)} role={role} userName={userName}>
      {children}
    </AppShell>
  );
}
```

- [ ] **Step 2: Stub `/accueil`**

Create `src/app/[locale]/(app)/accueil/page.tsx` :
```tsx
import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";

export default async function AccueilPage() {
  const t = await getTranslations("accueil");
  return (
    <main data-testid="accueil" className="flex flex-col gap-4 p-6">
      <h1 className="text-2xl font-bold">{t("welcome")}</h1>
      <Link href="/restos" className="text-accent hover:underline">{t("cta")}</Link>
    </main>
  );
}
```

- [ ] **Step 3: Supprimer l'ancienne nav + son e2e**

Run:
```bash
git rm src/features/shell/ui/AppNav.tsx e2e/navigation.spec.ts
```
(`AppNav` n'est plus importé nulle part — le layout rend désormais `AppShell`. `navigation.spec.ts` sera
réécrit en Task 5.)

- [ ] **Step 4: Vérifier (typecheck + lint + build)**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: PASS (aucune référence résiduelle à `AppNav` ; le profil `display_name` typé via
`database.types`). Si `display_name` n'existe pas sur `profiles`, utiliser `auth.user.email` seul.

- [ ] **Step 5: Commit**

```bash
git add "src/app/[locale]/(app)/layout.tsx" "src/app/[locale]/(app)/accueil/page.tsx"
git commit -m "feat(shell): câblage AppShell dans le layout (app) + stub /accueil + suppression AppNav"
```

---

### Task 5: e2e responsive (desktop + mobile) + non-régression

**Files:**
- Create: `e2e/navigation.spec.ts` (nouveau, remplace l'ancien)

**Interfaces:**
- Consumes : `app-shell`/`sidebar`/`bottom-nav`/`drawer`/`drawer-open`/`nav-<key>`/`locale-switcher`/
  `theme-toggle` ; comptes seed `client@vito.test`/`admin@vito.test` / `password123`.

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

test.describe("desktop", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("sidebar visible, bottom-nav masquée, actif + gating admin (client)", async ({ page }) => {
    await login(page, "client@vito.test");
    await expect(page.getByTestId("sidebar")).toBeVisible();
    await expect(page.getByTestId("bottom-nav")).toBeHidden();
    await expect(page.getByTestId("nav-restos")).toHaveAttribute("aria-current", "page");
    await expect(page.getByTestId("nav-admin")).toHaveCount(0);
  });

  test("navigation via la sidebar", async ({ page }) => {
    await login(page, "client@vito.test");
    await page.getByTestId("nav-voyages").click();
    await expect(page).toHaveURL(/\/fr\/voyages/);
  });

  test("le thème est sombre par défaut + déconnexion", async ({ page }) => {
    await login(page, "client@vito.test");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.getByRole("button", { name: "Déconnexion" }).click();
    await expect(page).toHaveURL(/\/fr\/login/);
  });

  test("admin voit le lien Admin", async ({ page }) => {
    await login(page, "admin@vito.test");
    await expect(page.getByTestId("nav-admin")).toBeVisible();
  });
});

test.describe("mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("bottom-nav visible, sidebar masquée, drawer ouvrable", async ({ page }) => {
    await login(page, "client@vito.test");
    await expect(page.getByTestId("bottom-nav")).toBeVisible();
    await expect(page.getByTestId("sidebar")).toBeHidden();
    await expect(page.getByTestId("drawer")).toHaveCount(0);
    await page.getByTestId("drawer-open").click();
    await expect(page.getByTestId("drawer")).toBeVisible();
  });
});
```

- [ ] **Step 2: Lancer l'e2e navigation**

Run: `supabase db reset && npx playwright test e2e/navigation.spec.ts --retries=0`
Expected: PASS (5 tests).

- [ ] **Step 3: Suite complète (non-régression)**

Run: `supabase db reset && npx playwright test --retries=0`
Expected: PASS. **Risque** : un spec existant qui s'attendait au thème clair, à l'ancien `AppNav`, ou à un
libellé désormais ambigu (liens de nav présents partout). Diagnostiquer ; resserrer les sélecteurs des
specs existants si collision (désambiguïsation, pas affaiblissement). L'e2e `ui-kit` reste vert. Un seul
`db reset` immédiatement avant la suite.

- [ ] **Step 4: Commit**

```bash
git add e2e/navigation.spec.ts
git commit -m "test(shell): e2e navigation responsive (sidebar desktop / bottom-nav + drawer mobile, rbac, thème, déconnexion)"
```

---

## Notes d'exécution

- **Ordre** : T1 (sombre+i18n) → T2 (nav-config) → T3 (composants) → T4 (câblage+accueil+suppr AppNav) → T5 (e2e).
- **Pas de migration.** Déploiement = merge → Vercel.
- **Régression attendue & gérée en T5** : suppression de l'`AppNav` + thème sombre par défaut → adapter
  les specs e2e existants qui présumaient le clair ou l'ancienne nav (désambiguïsation des sélecteurs,
  jamais d'affaiblissement d'assertion).
- **Signaux e2e déterministes** : `toBeVisible`/`toBeHidden`/`toHaveAttribute`/`toHaveURL`/`toHaveCount` ;
  viewports explicites par bloc `describe` ; jamais `networkidle`.
- **Périmètre** : on ne refond PAS l'intérieur des écrans métier (ils héritent shell + sombre).
