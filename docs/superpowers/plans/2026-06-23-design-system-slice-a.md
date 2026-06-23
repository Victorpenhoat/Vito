# Refonte Core.Badakan — Slice A : Design system Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Poser les fondations visuelles Core.Badakan : tokens (thème sombre + bascule clair), police Inter, mécanisme de thème, et un kit UI partagé réutilisable, validables sur une page de preview.

**Architecture:** Palette en variables CSS commutables par `data-theme` (mappées en tokens Tailwind v4 `@theme`). Police Inter via `next/font`. Thème lu d'un cookie côté serveur (no-flash), basculé par un `ThemeToggle` client. Kit UI présentational pur dans `src/features/shared/ui/` (aucune logique métier). Page `/ui-kit` pour figer l'esthétique.

**Tech Stack:** Next.js 16, Tailwind v4 (`@theme`), `next/font/google` (Inter), `lucide-react`, next-intl, Vitest, Playwright.

## Global Constraints

- Next.js 16 non-standard : consulter `node_modules/next/dist/docs/` avant une API inconnue.
- Tailwind **v4** (config CSS, pas de `tailwind.config.js`). Tokens `--color-*` → utilitaires.
- TypeScript strict (`noUncheckedIndexedAccess`).
- **Aucune chaîne UI en dur** — next-intl. Le kit est **présentational pur** (aucune query/action/métier).
- Thème **sombre = palette par défaut** (`:root`) ; **clair** = `[data-theme="light"]`. Le `data-theme`
  *actif* par défaut reste **`light`** en Slice A (le sombre par défaut arrive en Slice B). Bascule par
  cookie `theme` (1 an), no-flash via lecture serveur dans le layout.
- **Compat Slice 1** : conserver les utilitaires `bg-canvas`/`bg-accent-50`/`text-accent-600` (alias) —
  l'accueil/auth et l'`AppNav` actuels en dépendent ; ne rien casser.
- Icônes : `lucide-react` (nouvelle dépendance). Police : Inter + fallback `system-ui`.
- `data-testid` : `ui-kit`, `theme-toggle`, `modal`.
- Pas de migration, pas de RLS.

---

### Task 1: Tokens + Inter + mécanisme de thème

**Files:**
- Modify: `src/app/globals.css` (remplacement complet)
- Modify: `src/app/[locale]/layout.tsx` (Inter + `data-theme` depuis cookie)

**Interfaces:**
- Produces : utilitaires `bg-app`/`bg-sidebar`/`bg-surface`/`bg-surface-hover`/`text-ink`/`text-muted`/
  `text-faint`/`border-line`/`bg-accent`/`bg-badge`/`bg-kpi-*`/`text-kpi-*`/`rounded-card`/`rounded-tile`
  + alias compat (`bg-canvas`, `bg-accent-50`, `text-accent-600`) ; `<html data-theme>` + police Inter.

- [ ] **Step 1: Remplacer `globals.css`**

Replace the entire contents of `src/app/globals.css` with:
```css
@import "tailwindcss";

/* Sombre = défaut (:root) ET ré-applicable en imbriqué via [data-theme="dark"] (ex. preview) */
:root,
[data-theme="dark"] {
  --app: #0A0E17; --sidebar: #090C14;
  --surface: #141925; --surface-hover: #1A2030;
  --line: rgba(255,255,255,0.06);
  --accent: #2563EB; --accent-hover: #3B82F6;
  --accent-50: #1e2a52; --accent-600: #3B82F6;
  --ink: #F5F7FA; --muted: #8A93A6; --faint: #5B6373;
  --badge: #1E2435;
  --kpi-green: #4ADE80; --kpi-green-bg: rgba(34,197,94,0.08);
  --kpi-blue: #60A5FA; --kpi-blue-bg: rgba(59,130,246,0.08);
  --kpi-amber: #FBBF24; --kpi-amber-bg: rgba(245,158,11,0.08);
  --kpi-violet: #C084FC; --kpi-violet-bg: rgba(168,85,247,0.08);
  --hero-from: #1B2138; --hero-to: #2A2140;
}

[data-theme="light"] {
  --app: #f8fafc; --sidebar: #ffffff;
  --surface: #ffffff; --surface-hover: #f1f5f9;
  --line: #e2e8f0;
  --accent: #2563EB; --accent-hover: #3B82F6;
  --accent-50: #eef2ff; --accent-600: #4338ca;
  --ink: #0f172a; --muted: #64748b; --faint: #94a3b8;
  --badge: #eef2ff;
  --kpi-green: #16a34a; --kpi-green-bg: rgba(34,197,94,0.10);
  --kpi-blue: #2563eb; --kpi-blue-bg: rgba(59,130,246,0.10);
  --kpi-amber: #d97706; --kpi-amber-bg: rgba(245,158,11,0.12);
  --kpi-violet: #9333ea; --kpi-violet-bg: rgba(168,85,247,0.10);
  --hero-from: #e0e7ff; --hero-to: #ede9fe;
}

@theme {
  --color-app: var(--app);
  --color-canvas: var(--app);
  --color-sidebar: var(--sidebar);
  --color-surface: var(--surface);
  --color-surface-hover: var(--surface-hover);
  --color-line: var(--line);
  --color-accent: var(--accent);
  --color-accent-hover: var(--accent-hover);
  --color-accent-50: var(--accent-50);
  --color-accent-600: var(--accent-600);
  --color-ink: var(--ink);
  --color-muted: var(--muted);
  --color-faint: var(--faint);
  --color-badge: var(--badge);
  --color-kpi-green: var(--kpi-green);
  --color-kpi-green-bg: var(--kpi-green-bg);
  --color-kpi-blue: var(--kpi-blue);
  --color-kpi-blue-bg: var(--kpi-blue-bg);
  --color-kpi-amber: var(--kpi-amber);
  --color-kpi-amber-bg: var(--kpi-amber-bg);
  --color-kpi-violet: var(--kpi-violet);
  --color-kpi-violet-bg: var(--kpi-violet-bg);
  --radius-card: 18px;
  --radius-tile: 14px;
  --font-sans: var(--font-inter), system-ui, sans-serif;
}

body {
  background-color: var(--color-app);
  color: var(--color-ink);
  font-family: var(--font-sans);
}
```

- [ ] **Step 2: Inter + `data-theme` dans le layout**

In `src/app/[locale]/layout.tsx`, add the imports at top:
```tsx
import { Inter } from "next/font/google";
import { cookies } from "next/headers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
```
Then in the component body, before the `return`, after `const { locale } = await params;`:
```tsx
  const cookieStore = await cookies();
  const theme = cookieStore.get("theme")?.value === "dark" ? "dark" : "light";
```
And change the `<html>` opening tag to:
```tsx
    <html lang={locale} data-theme={theme} className={inter.variable}>
```
(Leave the rest — `notFound()` guard, `<body>`, providers — unchanged.)

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build réussi (Tailwind compile `@theme` ; `next/font` Inter self-host ; aucune régression de
type). Si échec sur next/font, vérifier la doc `node_modules/next/dist/docs/` (App Router fonts).

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: PASS (0 erreur).

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css "src/app/[locale]/layout.tsx"
git commit -m "feat(design): tokens Core.Badakan (sombre+clair) + Inter + thème par cookie"
```

---

### Task 2: Helpers testés + composants présentational du kit

**Files:**
- Create: `src/features/shared/ui/helpers.ts` + `helpers.test.ts`
- Create: `src/features/shared/ui/Button.tsx`, `Badge.tsx`, `Card.tsx`, `SectionLabel.tsx`, `Tile.tsx`, `NavItem.tsx`, `Avatar.tsx`, `Fab.tsx`
- Modify: `package.json` (ajout `lucide-react`)

**Interfaces:**
- Consumes : tokens de Task 1 ; `Link` (`@/lib/i18n/routing`) ; `lucide-react`.
- Produces : helpers `initials(name): string`, `toneClasses(tone): { bg: string; text: string }`,
  `type Tone = "green"|"blue"|"amber"|"violet"` ; composants `Button`/`Badge`/`Card`/`SectionLabel`/
  `Tile`/`NavItem`/`Avatar`/`Fab`.

- [ ] **Step 1: Ajouter lucide-react**

Run: `npm install lucide-react`
Expected: ajouté aux dependencies, install OK.

- [ ] **Step 2: Écrire les tests des helpers (échec attendu)**

Create `src/features/shared/ui/helpers.test.ts` :
```ts
import { describe, it, expect } from "vitest";
import { initials, toneClasses } from "./helpers";

describe("initials", () => {
  it("prénom + nom → 2 initiales majuscules", () => expect(initials("Victor Penhoat")).toBe("VP"));
  it("nom simple → 1 initiale", () => expect(initials("Victor")).toBe("V"));
  it("espaces multiples gérés", () => expect(initials("  jean   dupont ")).toBe("JD"));
  it("vide → fallback", () => expect(initials("")).toBe("?"));
});

describe("toneClasses", () => {
  it("mappe chaque tone", () => {
    expect(toneClasses("green")).toEqual({ bg: "bg-kpi-green-bg", text: "text-kpi-green" });
    expect(toneClasses("violet")).toEqual({ bg: "bg-kpi-violet-bg", text: "text-kpi-violet" });
  });
});
```

- [ ] **Step 3: Lancer (échec)**

Run: `npx vitest run src/features/shared/ui/helpers.test.ts`
Expected: FAIL (module introuvable).

- [ ] **Step 4: Implémenter `helpers.ts`**

Create `src/features/shared/ui/helpers.ts` :
```ts
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  return (parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)).toUpperCase();
}

export type Tone = "green" | "blue" | "amber" | "violet";

export function toneClasses(tone: Tone): { bg: string; text: string } {
  const map: Record<Tone, { bg: string; text: string }> = {
    green: { bg: "bg-kpi-green-bg", text: "text-kpi-green" },
    blue: { bg: "bg-kpi-blue-bg", text: "text-kpi-blue" },
    amber: { bg: "bg-kpi-amber-bg", text: "text-kpi-amber" },
    violet: { bg: "bg-kpi-violet-bg", text: "text-kpi-violet" },
  };
  return map[tone];
}
```

- [ ] **Step 5: Lancer (succès)**

Run: `npx vitest run src/features/shared/ui/helpers.test.ts`
Expected: PASS (6 assertions).

- [ ] **Step 6: Implémenter les composants présentational**

Create `src/features/shared/ui/Button.tsx` :
```tsx
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost" | "subtle";

const VARIANT: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-hover",
  ghost: "bg-transparent text-ink border border-line hover:bg-surface-hover",
  subtle: "bg-surface text-muted hover:bg-surface-hover",
};

export function Button({
  variant = "primary",
  pending,
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; pending?: boolean }) {
  return (
    <button
      className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-60 ${VARIANT[variant]} ${className}`}
      disabled={pending || props.disabled}
      {...props}
    >
      {children}
    </button>
  );
}
```

Create `src/features/shared/ui/Badge.tsx` :
```tsx
import type { ReactNode } from "react";

export function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-badge px-2 py-0.5 text-xs font-semibold text-ink">
      {children}
    </span>
  );
}
```

Create `src/features/shared/ui/Card.tsx` :
```tsx
import type { ReactNode } from "react";

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`rounded-card border border-line bg-surface p-5 ${className}`}>{children}</div>
  );
}
```

Create `src/features/shared/ui/SectionLabel.tsx` :
```tsx
import type { ReactNode } from "react";

export function SectionLabel({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
      {icon}
      {children}
    </p>
  );
}
```

Create `src/features/shared/ui/Tile.tsx` :
```tsx
import { toneClasses, type Tone } from "./helpers";

export function Tile({ tone, label, value }: { tone: Tone; label: string; value: string | number }) {
  const c = toneClasses(tone);
  return (
    <div className={`rounded-tile p-4 ${c.bg}`}>
      <div className={`text-2xl font-bold ${c.text}`}>{value}</div>
      <div className="mt-1 text-xs text-muted">{label}</div>
    </div>
  );
}
```

Create `src/features/shared/ui/NavItem.tsx` :
```tsx
import type { ReactNode } from "react";
import { Link } from "@/lib/i18n/routing";

export function NavItem({
  icon,
  label,
  href,
  active,
}: {
  icon: ReactNode;
  label: string;
  href: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
        active ? "bg-accent-50 text-ink" : "text-muted hover:bg-surface-hover"
      }`}
    >
      {icon}
      {label}
    </Link>
  );
}
```

Create `src/features/shared/ui/Avatar.tsx` :
```tsx
import { initials } from "./helpers";

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const dim = size === "sm" ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm";
  return (
    <span
      className={`inline-grid place-items-center rounded-full bg-accent font-semibold text-white ${dim}`}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}
```

Create `src/features/shared/ui/Fab.tsx` :
```tsx
import type { ReactNode } from "react";

export function Fab({ icon, label, onClick }: { icon: ReactNode; label: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="fixed bottom-6 right-6 grid h-14 w-14 place-items-center rounded-full bg-accent text-white shadow-lg shadow-black/30 transition-colors hover:bg-accent-hover"
    >
      {icon}
    </button>
  );
}
```

- [ ] **Step 7: Vérifier (typecheck + lint + unit)**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS (types/lint OK ; helpers verts ; reste de la suite vert).

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json src/features/shared/ui/
git commit -m "feat(design): kit UI présentational (Button/Badge/Card/Tile/NavItem/Avatar/Fab) + helpers testés + lucide-react"
```

---

### Task 3: Composants interactifs (ThemeToggle, Modal, Toast)

**Files:**
- Create: `src/features/shared/ui/ThemeToggle.tsx`, `Modal.tsx`, `Toast.tsx`
- Modify: `messages/fr.json` (clés `shell.theme`, `shell.close`)

**Interfaces:**
- Consumes : tokens ; `lucide-react` ; `useTranslations` (next-intl).
- Produces : `ThemeToggle` (bascule `data-theme` + cookie) ; `Modal` (`open`, `onClose`, `title?`) ;
  `Toast` (`type`, `children`).

- [ ] **Step 1: Ajouter les clés i18n**

Modify `messages/fr.json` — ajouter au niveau racine (virgules JSON correctes) :
```json
  "shell": {
    "theme": "Basculer le thème (clair / sombre)",
    "close": "Fermer"
  },
```

- [ ] **Step 2: `ThemeToggle`**

Create `src/features/shared/ui/ThemeToggle.tsx` :
```tsx
"use client";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";

export function ThemeToggle() {
  const t = useTranslations("shell");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    setTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light");
  }, []);
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    document.cookie = `theme=${next};path=/;max-age=31536000`;
    setTheme(next);
  };
  return (
    <button
      type="button"
      data-testid="theme-toggle"
      onClick={toggle}
      aria-label={t("theme")}
      className="grid h-9 w-9 place-items-center rounded-xl text-muted hover:bg-surface-hover"
    >
      {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
```

- [ ] **Step 3: `Modal`**

Create `src/features/shared/ui/Modal.tsx` :
```tsx
"use client";
import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  const t = useTranslations("shell");
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        data-testid="modal"
        className="w-full max-w-md rounded-card border border-line bg-surface p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          {title ? <h2 className="font-semibold text-ink">{title}</h2> : <span />}
          <button type="button" aria-label={t("close")} onClick={onClose} className="text-muted hover:text-ink">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: `Toast`**

Create `src/features/shared/ui/Toast.tsx` :
```tsx
import type { ReactNode } from "react";

const TONE: Record<"info" | "success" | "error", string> = {
  info: "border-line text-ink",
  success: "border-kpi-green text-kpi-green",
  error: "border-red-500 text-red-400",
};

export function Toast({ type = "info", children }: { type?: "info" | "success" | "error"; children: ReactNode }) {
  return (
    <div className={`rounded-xl border bg-surface px-4 py-3 text-sm ${TONE[type]}`}>{children}</div>
  );
}
```

- [ ] **Step 5: Vérifier (typecheck + lint + unit)**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add messages/fr.json src/features/shared/ui/ThemeToggle.tsx src/features/shared/ui/Modal.tsx src/features/shared/ui/Toast.tsx
git commit -m "feat(design): composants interactifs ThemeToggle/Modal/Toast + i18n shell"
```

---

### Task 4: Page de preview `/ui-kit` + e2e

**Files:**
- Create: `src/app/[locale]/ui-kit/page.tsx`
- Create: `src/app/[locale]/ui-kit/UiKitDemo.tsx` (client — états Modal)
- Create: `e2e/ui-kit.spec.ts`

**Interfaces:**
- Consumes : tout le kit (Tasks 2-3) ; tokens (Task 1).
- Produces : route publique `/<locale>/ui-kit` (`data-testid="ui-kit"`), forcée en thème sombre pour la
  preview.

- [ ] **Step 1: Composant client de démo**

Create `src/app/[locale]/ui-kit/UiKitDemo.tsx` :
```tsx
"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/features/shared/ui/Button";
import { Modal } from "@/features/shared/ui/Modal";
import { Fab } from "@/features/shared/ui/Fab";

export function UiKitDemo() {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <Button onClick={() => setOpen(true)}>Ouvrir la modale</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Exemple de modale">
        <p className="text-sm text-muted">Contenu de démonstration.</p>
      </Modal>
      <Fab icon={<Plus size={22} />} label="Action rapide" onClick={() => setOpen(true)} />
    </div>
  );
}
```

- [ ] **Step 2: Page de preview**

Create `src/app/[locale]/ui-kit/page.tsx` :
```tsx
import { Home, Wine } from "lucide-react";
import { Button } from "@/features/shared/ui/Button";
import { Badge } from "@/features/shared/ui/Badge";
import { Card } from "@/features/shared/ui/Card";
import { SectionLabel } from "@/features/shared/ui/SectionLabel";
import { Tile } from "@/features/shared/ui/Tile";
import { NavItem } from "@/features/shared/ui/NavItem";
import { Avatar } from "@/features/shared/ui/Avatar";
import { Toast } from "@/features/shared/ui/Toast";
import { ThemeToggle } from "@/features/shared/ui/ThemeToggle";
import { UiKitDemo } from "./UiKitDemo";

export default function UiKitPage() {
  return (
    <main data-theme="dark" data-testid="ui-kit" className="min-h-dvh bg-app p-6 text-ink">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Kit UI — Vito</h1>
          <ThemeToggle />
        </div>

        <Card>
          <SectionLabel icon="🎛️">Boutons</SectionLabel>
          <div className="flex flex-wrap gap-3">
            <Button variant="primary">Primaire</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="subtle">Subtle</Button>
            <Badge>3</Badge>
          </div>
        </Card>

        <Card>
          <SectionLabel icon="📊">Tuiles KPI</SectionLabel>
          <div className="grid grid-cols-2 gap-3">
            <Tile tone="green" label="Sorties" value={12} />
            <Tile tone="blue" label="Nouveaux restos" value={4} />
            <Tile tone="amber" label="Vins goûtés" value={7} />
            <Tile tone="violet" label="Dépenses voyage" value="320 €" />
          </div>
        </Card>

        <Card>
          <SectionLabel icon="🧭">Navigation</SectionLabel>
          <NavItem icon={<Home size={18} />} label="Accueil" href="/restos" active />
          <NavItem icon={<Wine size={18} />} label="Mes vins" href="/vins" />
        </Card>

        <Card>
          <SectionLabel icon="👤">Avatar & Toasts</SectionLabel>
          <div className="flex items-center gap-3">
            <Avatar name="Victor Penhoat" />
            <Toast type="success">Enregistré avec succès</Toast>
          </div>
        </Card>

        <Card>
          <SectionLabel icon="🪟">Modale & FAB</SectionLabel>
          <UiKitDemo />
        </Card>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: e2e**

Create `e2e/ui-kit.spec.ts` :
```ts
import { test, expect } from "@playwright/test";

test("la page kit UI s'affiche", async ({ page }) => {
  await page.goto("/fr/ui-kit");
  await expect(page.getByTestId("ui-kit")).toBeVisible();
  await expect(page.getByText("Kit UI — Vito")).toBeVisible();
});

test("le toggle de thème bascule data-theme sur <html>", async ({ page }) => {
  await page.goto("/fr/ui-kit");
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-theme", "light");
  await page.getByTestId("theme-toggle").click();
  await expect(html).toHaveAttribute("data-theme", "dark");
  await page.getByTestId("theme-toggle").click();
  await expect(html).toHaveAttribute("data-theme", "light");
});

test("la modale s'ouvre et se ferme", async ({ page }) => {
  await page.goto("/fr/ui-kit");
  await expect(page.getByTestId("modal")).toHaveCount(0);
  await page.getByRole("button", { name: "Ouvrir la modale" }).click();
  await expect(page.getByTestId("modal")).toBeVisible();
  await page.getByRole("button", { name: "Fermer" }).click();
  await expect(page.getByTestId("modal")).toHaveCount(0);
});
```

- [ ] **Step 4: Lancer l'e2e ui-kit**

Run: `supabase db reset && npx playwright test e2e/ui-kit.spec.ts --retries=0`
Expected: PASS (3 tests). (Route publique — pas de login requis.)

- [ ] **Step 5: Suite complète (non-régression)**

Run: `supabase db reset && npx playwright test --retries=0`
Expected: PASS (toute la suite). Un seul `db reset` immédiatement avant.

- [ ] **Step 6: Commit**

```bash
git add "src/app/[locale]/ui-kit/" e2e/ui-kit.spec.ts
git commit -m "feat(design): page de preview /ui-kit + e2e (rendu, toggle thème, modale)"
```

---

## Notes d'exécution

- **Ordre** : Task 1 (tokens) → Task 2 (helpers + présentational) → Task 3 (interactifs) → Task 4 (preview + e2e).
- **Pas de migration, pas de changement DB.** Le sombre n'est PAS encore le défaut actif (Slice B) — la
  preview force `data-theme="dark"` localement pour montrer le rendu sombre.
- **Compat** : ne pas retirer les alias `--color-canvas`/`--color-accent-50`/`--color-accent-600` (accueil/
  auth/AppNav actuels en dépendent).
- **Signaux e2e déterministes** : `toHaveAttribute("data-theme", …)`, `toBeVisible`, `toHaveCount` ; jamais `networkidle`.
- **`workers: 1`** déjà en place dans `playwright.config.ts` (suite sérialisée).
