# Slice 0 — Fondations « Le Carnet » Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer les fondations du design system (tokens, font serif, kit `shared/ui`, shell) par « Le Carnet », sans changer le contenu des écrans métier ni casser l'e2e.

**Architecture:** Le système est piloté par variables CSS dans `globals.css` mappées via `@theme` ; on change les **valeurs** (palettes clair+sombre Le Carnet), on ajoute la serif Newsreader (`next/font`), on arrondit moins, on adapte les composants du kit (visuel + `PageHeader` enrichi rétrocompatible) et on groupe la nav du shell (Carnet/Voyages/Cercle) via un composant `NavGroups` partagé par Sidebar et Drawer.

**Tech Stack:** Next.js 16 (App Router), Tailwind v4 (`@theme` dans globals.css), `next/font/google`, next-intl (fr/en/it/es), Playwright, Vitest.

## Global Constraints

- **Refonte visuelle pure** : tous les `data-testid` et le **texte des écrans** restent inchangés ; la suite **e2e reste verte sans modifier les specs**.
- **Conserver les NOMS** des variables CSS existantes (`--app/--sidebar/--surface/--surface-hover/--line/--accent/--accent-hover/--accent-50/--accent-600/--ink/--muted/--faint/--badge/--hero-from/--hero-to`) et leurs mappings `@theme` — on ne change que les valeurs (+ ajouts `--line-soft`, `--gold`, `--radius-control`, `--font-serif`).
- **Défaut sombre conservé** (sombre = Le Carnet nuit).
- **Arrondis** : `--radius-control: 3px` (contrôles), `--radius-card`/`--radius-tile: 4px` (cartes/conteneurs). Pastilles `rounded-full`.
- **Aucune migration**, aucune action serveur ni requête modifiée. RLS/grants intacts.
- **Fonts auto-hébergées** via `next/font` — aucun appel CDN externe.
- **Parité i18n** sur les 4 locales (fr/en/it/es), garantie par `src/lib/i18n/messages-parity.test.ts`. Pas de chaîne en dur.
- **API & testids du kit/shell inchangés**, sauf l'ajout **rétrocompatible** de props optionnelles à `PageHeader` (`eyebrow`, `subtitle`).
- Réf. spec : `docs/superpowers/specs/2026-06-25-carnet-slice-0-design.md`.

---

### Task 1: Tokens Le Carnet + font serif

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/[locale]/layout.tsx`

**Interfaces:**
- Produces : tokens CSS (valeurs Le Carnet) ; nouvelles variables `--color-line-soft`, `--color-gold`, `--radius-control`, `--font-serif` ; variable de police `--font-newsreader` posée sur `<html>`. La classe Tailwind `font-serif` devient disponible (depuis `--font-serif`).

- [ ] **Step 1: Remplacer les blocs de tokens dans `globals.css`**

Replace the `:root,[data-theme="dark"]` block and the `[data-theme="light"]` block with the Le Carnet values (keep variable names). New file content for those two blocks:

```css
/* Sombre = défaut (:root) ET ré-applicable en imbriqué via [data-theme="dark"] (ex. preview) */
:root,
[data-theme="dark"] {
  --app: #161310; --sidebar: #110E0A;
  --surface: #1E1A14; --surface-hover: #26211A;
  --line: rgba(255,255,255,0.08); --line-soft: rgba(255,255,255,0.06);
  --accent: #4F8BF0; --accent-hover: #6BA0F5;
  --accent-50: rgba(79,139,240,0.14); --accent-600: #6BA0F5;
  --ink: #F2EDE3; --muted: #A39A8A; --faint: #6E665A;
  --badge: #26211A; --gold: #E9B949;
  --kpi-green: #7BE0A0; --kpi-green-bg: rgba(34,197,94,0.14);
  --kpi-blue: #4F8BF0; --kpi-blue-bg: rgba(79,139,240,0.14);
  --kpi-amber: #E9B949; --kpi-amber-bg: rgba(233,185,73,0.14);
  --kpi-violet: #C9A0F5; --kpi-violet-bg: rgba(168,85,247,0.14);
  --hero-from: #26211A; --hero-to: #161310;
}

[data-theme="light"] {
  --app: #FBF9F3; --sidebar: #F4F1E9;
  --surface: #FFFFFF; --surface-hover: #F4F1E9;
  --line: #E4DDD0; --line-soft: #F0EBE0;
  --accent: #2563EB; --accent-hover: #1D4ED8;
  --accent-50: #E6EDFC; --accent-600: #1D4ED8;
  --ink: #211E1A; --muted: #7A736A; --faint: #9A9081;
  --badge: #F0EBE0; --gold: #E9B949;
  --kpi-green: #15803D; --kpi-green-bg: #E7F2EB;
  --kpi-blue: #2563EB; --kpi-blue-bg: #E6EDFC;
  --kpi-amber: #B45309; --kpi-amber-bg: #FBF0DF;
  --kpi-violet: #9333EA; --kpi-violet-bg: #F3E8FF;
  --hero-from: #E4DDD0; --hero-to: #FBF9F3;
}
```

- [ ] **Step 2: Étendre le bloc `@theme` dans `globals.css`**

In the `@theme { … }` block: add the new color mappings, add the control radius, change the card/tile radii to 4px, and add the serif font. Add these lines (and change the two `--radius-*` lines):

```css
  --color-line-soft: var(--line-soft);
  --color-gold: var(--gold);
  --radius-card: 4px;
  --radius-tile: 4px;
  --radius-control: 3px;
  --font-serif: var(--font-newsreader), Georgia, serif;
```
(Keep every existing `--color-*` mapping and the `--font-sans` line as-is. Only `--radius-card` and `--radius-tile` change value; the rest are additions.)

- [ ] **Step 3: Ajouter la police Newsreader dans `layout.tsx`**

In `src/app/[locale]/layout.tsx`, change the font import and the `<html>` className:

```ts
import { Inter, Newsreader } from "next/font/google";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const newsreader = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-newsreader",
});
```
And the opening tag:
```tsx
<html lang={locale} data-theme={theme} className={`${inter.variable} ${newsreader.variable}`}>
```
Nothing else in this file changes (body stays Inter via `--font-sans`).

- [ ] **Step 4: Vérifier typecheck + lint + build**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: PASS (build compile la nouvelle police et le CSS sans erreur).

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css "src/app/[locale]/layout.tsx"
git commit -m "feat(carnet): tokens Le Carnet (clair+sombre) + police serif Newsreader"
```

---

### Task 2: Re-skin du kit `shared/ui`

**Files:**
- Modify: `src/features/shared/ui/Card.tsx`
- Modify: `src/features/shared/ui/Button.tsx`
- Modify: `src/features/shared/ui/NavItem.tsx`
- Modify: `src/features/shared/ui/SectionLabel.tsx`
- Modify: `src/features/shared/ui/PageHeader.tsx`

**Interfaces:**
- Consumes : tokens & utilitaires de Task 1 (`rounded-card`, `rounded-control`, `font-serif`, `text-faint`, `border-accent`).
- Produces : `PageHeader({ title, eyebrow?, subtitle?, action? })` (props `eyebrow`/`subtitle` **optionnelles**, ajout rétrocompatible) ; `NavItem` au style actif Le Carnet (consommé par le shell en Task 4). Toutes les autres signatures et tous les `data-testid` inchangés.

- [ ] **Step 1: `Card` — arrondi éditorial**

`src/features/shared/ui/Card.tsx` — only the radius class changes (token now = 4px, so `rounded-card` already gives it). No code change needed if it already uses `rounded-card`. Confirm the className is:
```tsx
className={`rounded-card border border-line bg-surface p-5 ${className}`}
```
(If already the case, leave Card.tsx untouched.)

- [ ] **Step 2: `Button` — coins contrôle 3px**

`src/features/shared/ui/Button.tsx` — change `rounded-xl` to `rounded-control` in the className:
```tsx
className={`rounded-control px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-60 ${VARIANT[variant]} ${className}`}
```
Variants and the rest unchanged.

- [ ] **Step 3: `NavItem` — style actif Le Carnet**

`src/features/shared/ui/NavItem.tsx` — replace the className expression:
```tsx
className={`flex items-center gap-3 rounded-control px-3 py-2.5 text-sm transition-colors ${
  active
    ? "border-l-2 border-accent bg-surface font-semibold text-ink"
    : "border-l-2 border-transparent font-medium text-muted hover:bg-surface-hover"
}`}
```
`icon`, `label`, `href`, `aria-current`, and `data-testid` unchanged.

- [ ] **Step 4: `SectionLabel` — couleur faint + tracking large**

`src/features/shared/ui/SectionLabel.tsx` — change the paragraph className:
```tsx
className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-faint"
```
API unchanged.

- [ ] **Step 5: `PageHeader` — eyebrow + titre serif + sous-titre (rétrocompatible)**

Replace `src/features/shared/ui/PageHeader.tsx` with:
```tsx
import type { ReactNode } from "react";

export function PageHeader({
  title,
  eyebrow,
  subtitle,
  action,
}: {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-2 flex items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">{eyebrow}</p>
        )}
        <h1 className="font-serif text-3xl font-medium text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}
```
(Existing calls passing only `title`/`action` keep working; the only visible change is the serif H1.)

> **Hors-scope assumé (spec §3) :** `Badge` est déjà conforme (`rounded-full` + fallback couleur `style` intact) → **ne pas le modifier**. `Avatar`/`Fab`/`Modal`/`Toast`/`Tile`/`ThemeToggle` héritent automatiquement des tokens (couleurs/rayons via `bg-surface`, `border-line`, `rounded-card`…) ; on **ne touche pas** leur code en Slice 0 — toute harmonisation fine d'arrondis codés en dur (`rounded-xl`/`rounded-lg`) sera faite dans la slice qui consomme le composant, pour garder la Slice 0 bornée. Ne change ni API ni `data-testid`.

- [ ] **Step 6: Vérifier typecheck + lint + unit**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS (121 tests). Aucun test ne référence les classes CSS ; `helpers.test.ts` du kit reste vert.

- [ ] **Step 7: Commit**

```bash
git add src/features/shared/ui/Card.tsx src/features/shared/ui/Button.tsx src/features/shared/ui/NavItem.tsx src/features/shared/ui/SectionLabel.tsx src/features/shared/ui/PageHeader.tsx
git commit -m "feat(carnet): re-skin kit (cartes/boutons arrondis 3-4px, PageHeader serif + eyebrow)"
```

---

### Task 3: i18n — libellés de groupes + sous-titre wordmark

**Files:**
- Modify: `messages/fr.json`
- Modify: `messages/en.json`
- Modify: `messages/it.json`
- Modify: `messages/es.json`

**Interfaces:**
- Produces : clés `app.subtitle` (string) et `nav.group` = `{ carnet, voyages, cercle }` (objet) dans les 4 locales. Consommées par le shell en Task 4.

- [ ] **Step 1: Ajouter `app.subtitle` (NE PAS toucher `app.tagline` existant)**

Dans chaque fichier, sous l'objet `app`, ajouter une clé `subtitle` (le wordmark serif « le carnet ») :
- `messages/fr.json` → `"subtitle": "le carnet"`
- `messages/en.json` → `"subtitle": "the journal"`
- `messages/it.json` → `"subtitle": "il taccuino"`
- `messages/es.json` → `"subtitle": "el cuaderno"`

- [ ] **Step 2: Ajouter `nav.group` (objet) dans chaque locale**

Sous l'objet `nav`, ajouter :
- `messages/fr.json` :
```json
"group": { "carnet": "Carnet", "voyages": "Voyages", "cercle": "Cercle" }
```
- `messages/en.json` :
```json
"group": { "carnet": "Journal", "voyages": "Trips", "cercle": "Circle" }
```
- `messages/it.json` :
```json
"group": { "carnet": "Taccuino", "voyages": "Viaggi", "cercle": "Cerchia" }
```
- `messages/es.json` :
```json
"group": { "carnet": "Cuaderno", "voyages": "Viajes", "cercle": "Círculo" }
```

- [ ] **Step 3: Vérifier la parité i18n**

Run: `npm run test -- messages-parity`
Expected: PASS (les 4 locales ont les mêmes clés feuilles, dont `app.subtitle` et `nav.group.*`).

- [ ] **Step 4: Commit**

```bash
git add messages/fr.json messages/en.json messages/it.json messages/es.json
git commit -m "feat(carnet,i18n): sous-titre wordmark + libellés de groupes nav (4 locales)"
```

---

### Task 4: Nav groupée + re-skin du shell

**Files:**
- Modify: `src/features/shell/nav-config.ts` (champ `group` + helper `groupNav`)
- Test: `src/features/shell/nav-config.test.ts` (nouveau)
- Create: `src/features/shell/ui/NavGroups.tsx`
- Modify: `src/features/shell/ui/Sidebar.tsx`
- Modify: `src/features/shell/ui/Drawer.tsx`
- Modify: `src/features/shell/ui/BottomNav.tsx` (mise à jour de l'import `NAV_ICONS`)

**Interfaces:**
- Consumes : `NavItem` (Task 2), clés `nav.group.*` + `app.subtitle` (Task 3), `NAV_ICONS`.
- Produces : `type NavGroup = "carnet" | "voyages" | "cercle"` ; `NavEntry` gagne `group: NavGroup` ; `groupNav(items: NavEntry[]): { group: NavGroup; entries: NavEntry[] }[]` (ordre carnet→voyages→cercle, groupes vides exclus) ; composant `NavGroups({ items, pathname })` ; `NAV_ICONS` **déplacé** dans `NavGroups.tsx` et exporté de là (consommé aussi par `Drawer` et `BottomNav`).

- [ ] **Step 1: Écrire le test du helper `groupNav`**

Create `src/features/shell/nav-config.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { NAV_ITEMS, filterNav, groupNav } from "./nav-config";

describe("groupNav", () => {
  it("rend les groupes dans l'ordre carnet → voyages → cercle", () => {
    const groups = groupNav(filterNav(NAV_ITEMS, "client"));
    expect(groups.map((g) => g.group)).toEqual(["carnet", "voyages", "cercle"]);
  });

  it("classe accueil/restos/vins/recherche dans carnet", () => {
    const carnet = groupNav(NAV_ITEMS).find((g) => g.group === "carnet")!;
    expect(carnet.entries.map((e) => e.key)).toEqual(["accueil", "restos", "vins", "recherche"]);
  });

  it("place agence et admin dans cercle (rôle admin)", () => {
    const cercle = groupNav(filterNav(NAV_ITEMS, "admin")).find((g) => g.group === "cercle")!;
    expect(cercle.entries.map((e) => e.key)).toContain("agence");
    expect(cercle.entries.map((e) => e.key)).toContain("admin");
  });

  it("exclut les groupes vides", () => {
    const groups = groupNav([{ key: "accueil", href: "/accueil", group: "carnet" }]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.group).toBe("carnet");
  });
});
```

- [ ] **Step 2: Lancer le test pour le voir échouer**

Run: `npm run test -- nav-config`
Expected: FAIL (`groupNav` n'existe pas encore ; `group` absent de `NavEntry`).

- [ ] **Step 3: Étendre `nav-config.ts` (champ `group` + `groupNav`)**

In `src/features/shell/nav-config.ts`: add the `NavGroup` type, add `group` to `NavEntry`, set `group` on each entry, and add the ordered `groupNav` helper. Updated file:
```ts
export type Role = "client" | "agence" | "admin";
export type NavGroup = "carnet" | "voyages" | "cercle";
export type NavKey =
  | "accueil" | "restos" | "vins" | "recherche" | "voyages" | "famille"
  | "depenses" | "conciergerie" | "abonnement" | "agence" | "admin";

export type NavEntry = { key: NavKey; href: string; group: NavGroup; roles?: Role[] };

export const NAV_ITEMS: NavEntry[] = [
  { key: "accueil", href: "/accueil", group: "carnet" },
  { key: "restos", href: "/restos", group: "carnet" },
  { key: "vins", href: "/vins", group: "carnet" },
  { key: "recherche", href: "/recherche", group: "carnet" },
  { key: "voyages", href: "/voyages", group: "voyages" },
  { key: "depenses", href: "/depenses", group: "voyages" },
  { key: "famille", href: "/famille", group: "cercle" },
  { key: "conciergerie", href: "/conciergerie", group: "cercle" },
  { key: "abonnement", href: "/abonnement", group: "cercle" },
  { key: "agence", href: "/agence", group: "cercle", roles: ["agence", "admin"] },
  { key: "admin", href: "/admin", group: "cercle", roles: ["admin"] },
];

export const BOTTOM_KEYS: NavKey[] = ["accueil", "restos", "voyages", "recherche"];

export const NAV_GROUPS: NavGroup[] = ["carnet", "voyages", "cercle"];

export function filterNav(items: NavEntry[], role: Role): NavEntry[] {
  return items.filter((i) => !i.roles || i.roles.includes(role));
}

export function groupNav(items: NavEntry[]): { group: NavGroup; entries: NavEntry[] }[] {
  return NAV_GROUPS
    .map((group) => ({ group, entries: items.filter((i) => i.group === group) }))
    .filter((g) => g.entries.length > 0);
}
```

- [ ] **Step 4: Lancer le test pour le voir passer**

Run: `npm run test -- nav-config`
Expected: PASS (4 tests).

- [ ] **Step 5: Créer le composant `NavGroups` (et y déplacer `NAV_ICONS`)**

Create `src/features/shell/ui/NavGroups.tsx`:
```tsx
"use client";
import { useTranslations } from "next-intl";
import {
  Home, Utensils, Wine, Search, Plane, Users, Wallet, ConciergeBell, CreditCard, Briefcase, Shield,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { NavItem } from "@/features/shared/ui/NavItem";
import { groupNav, type NavEntry, type NavKey } from "../nav-config";

export const NAV_ICONS: Record<NavKey, LucideIcon> = {
  accueil: Home, restos: Utensils, vins: Wine, recherche: Search, voyages: Plane,
  famille: Users, depenses: Wallet, conciergerie: ConciergeBell, abonnement: CreditCard,
  agence: Briefcase, admin: Shield,
};

export function NavGroups({ items, pathname }: { items: NavEntry[]; pathname: string }) {
  const t = useTranslations("nav");
  return (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
      {groupNav(items).map(({ group, entries }) => (
        <div key={group} className="flex flex-col gap-1">
          <div className="mb-1 mt-4 px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-faint first:mt-0">
            {t(`group.${group}`)}
          </div>
          {entries.map((it) => {
            const Icon = NAV_ICONS[it.key];
            return (
              <NavItem
                key={it.key}
                data-testid={`nav-${it.key}`}
                icon={<Icon size={18} />}
                label={t(it.key)}
                href={it.href}
                active={pathname.startsWith(it.href)}
              />
            );
          })}
        </div>
      ))}
    </nav>
  );
}
```

- [ ] **Step 6: `Sidebar` — wordmark + nav groupée**

Replace `src/features/shell/ui/Sidebar.tsx` with (entête wordmark serif + `<NavGroups>` ; `NAV_ICONS` n'est plus défini ici) :
```tsx
"use client";
import { useTranslations } from "next-intl";
import { NavGroups } from "./NavGroups";
import type { NavEntry } from "../nav-config";
import { ShellFooter } from "./ShellFooter";

export function Sidebar({
  items, userName, role, pathname,
}: { items: NavEntry[]; userName: string; role: string; pathname: string }) {
  const tApp = useTranslations("app");
  return (
    <aside
      data-testid="sidebar"
      className="fixed inset-y-0 left-0 hidden w-64 flex-col gap-4 border-r border-line bg-sidebar p-4 md:flex"
    >
      <div className="flex flex-col gap-0.5 px-1 py-2">
        <span className="text-lg font-extrabold uppercase tracking-[0.28em] text-ink">{tApp("name")}</span>
        <span className="font-serif text-sm italic text-faint">{tApp("subtitle")}</span>
      </div>
      <NavGroups items={items} pathname={pathname} />
      <ShellFooter userName={userName} role={role} />
    </aside>
  );
}
```

- [ ] **Step 7: `Drawer` — nav groupée (réutilise `NavGroups`)**

In `src/features/shell/ui/Drawer.tsx`, replace the inline `<nav>` mapping and the `NAV_ICONS` import. New file:
```tsx
"use client";
import { NavGroups } from "./NavGroups";
import { ShellFooter } from "./ShellFooter";
import type { NavEntry } from "../nav-config";

export function Drawer({
  open, onClose, items, userName, role, pathname,
}: {
  open: boolean; onClose: () => void; items: NavEntry[]; userName: string; role: string; pathname: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-30 bg-black/60 md:hidden" onClick={onClose}>
      <div
        data-testid="drawer"
        className="absolute inset-y-0 left-0 flex w-72 flex-col gap-4 bg-sidebar p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <NavGroups items={items} pathname={pathname} />
        <ShellFooter userName={userName} role={role} />
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Mettre à jour l'import `NAV_ICONS` dans `BottomNav`**

In `src/features/shell/ui/BottomNav.tsx`, change only the import source (the `NAV_ICONS` map now lives in `NavGroups.tsx`):
```tsx
import { NAV_ICONS } from "./NavGroups";
```
Everything else in `BottomNav` (testid `bottom-nav`, `BOTTOM_KEYS`, rendering) stays unchanged.

- [ ] **Step 9: Vérifier typecheck + lint + unit**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS (125 tests : 121 + 4 de `groupNav`). Aucune erreur d'import : `NAV_ICONS` est désormais dans `NavGroups.tsx`, et `Sidebar`/`Drawer`/`BottomNav` l'importent de là (plus aucune référence depuis `Sidebar`).

- [ ] **Step 10: Commit**

```bash
git add src/features/shell/nav-config.ts src/features/shell/nav-config.test.ts src/features/shell/ui/NavGroups.tsx src/features/shell/ui/Sidebar.tsx src/features/shell/ui/Drawer.tsx src/features/shell/ui/BottomNav.tsx
git commit -m "feat(carnet): shell Le Carnet — wordmark serif + nav groupée (Carnet/Voyages/Cercle)"
```

---

### Task 5: Non-régression — suite complète + build

- [ ] **Step 1: Suite e2e complète + build**

Run: `supabase db reset && npx playwright test --retries=0 && npm run build`
Expected: suite e2e complète **verte sans modifier les specs** (testids/texte inchangés : `sidebar`, `nav-*`, `app-shell`, `drawer`, headers de page, `tags-saved`, `place-card`…) + build OK. Un seul `db reset` avant. Si un spec échoue, corriger le composant (testid/flux), **pas** le test. Retry une fois si le webServer échoue à démarrer.

- [ ] **Step 2: Commit (si correctifs)**

```bash
git add -A && git commit -m "fix(carnet): correctifs non-régression Slice 0" # seulement si nécessaire
```

---

## Notes d'exécution

- **Ordre** : T1 (tokens+font) → T2 (kit) → T3 (i18n) → T4 (shell, consomme T2+T3) → T5 (non-régression).
- **Prod** : aucune migration. Au « go prod » : merge → Vercel redéploie `main` automatiquement.
- **Filet** : si l'e2e casse, c'est un testid/flux modifié par inadvertance → réparer le composant, jamais le test. Le contenu des écrans ne doit pas bouger (seul le H1 `PageHeader` passe en serif, attendu).
