# Refonte Core.Badakan — Slice A : Design system (tokens + thème + kit UI) — Design

**Date :** 2026-06-23
**Statut :** Validé (direction + tokens + inventaire). Plan d'implémentation à suivre.
**Branche :** `design-system`

---

## 0. Contexte

Première des trois slices de la refonte « identité Core.Badakan » (cf.
`docs/design/core-badakan-shell-directive.md`) : **A — design system**, puis B — shell responsive,
puis C — accueil de référence. Cette slice pose les fondations visuelles : **tokens (thème sombre
Core.Badakan + bascule clair)**, police **Inter**, et un **kit UI partagé** réutilisable. Aucune logique
métier dans les composants.

**Séquencement du thème (important) :** passer l'app entière en sombre *par défaut* immédiatement
rendrait illisibles les écrans métier actuels (cartes claires + texte clair hérité). La Slice A
**définit** le sombre et le mécanisme de bascule, mais le **sombre devient le `data-theme` par défaut à
la Slice B** (quand le shell dark-aware arrive et que les écrans commencent à migrer). On évite ainsi un
état à moitié cassé. Une **page de preview** (`/<locale>/ui-kit`) rend le kit sur fond sombre pour
validation visuelle dès la Slice A.

## 1. Décisions de cadrage (validées)

| Sujet | Décision |
|-------|----------|
| Thème | **Sombre Core.Badakan** défini comme palette par défaut (`:root`), **clair** (réutilise le thème de la Slice 1) en `[data-theme="light"]`. Bascule via cookie (no-flash SSR). Le défaut *actif* reste clair jusqu'à la Slice B. |
| Police | **Inter** via `next/font/google` (self-host, pas de CDN runtime), fallback `system-ui`. |
| Kit UI | `src/features/shared/ui/` — présentational pur, aucune dépendance métier. |
| Icônes | **`lucide-react`** (nouvelle dépendance). |
| i18n | Hors Slice A (les locales + `LocaleSwitcher` arrivent en Slice B avec le footer du shell). |
| Preview | Route publique `/<locale>/ui-kit` rendant le kit en sombre (validation visuelle ; pourra être retirée après la refonte). |

## 2. Tokens (`src/app/globals.css`, Tailwind v4)

Palette en variables CSS commutables par `data-theme`, mappées en tokens `@theme` → utilitaires
(`bg-app`, `bg-surface`, `text-muted`, `rounded-card`, etc.).

```css
@import "tailwindcss";

:root {
  /* Sombre — Core.Badakan (palette par défaut) */
  --app: #0A0E17;        --sidebar: #090C14;
  --surface: #141925;    --surface-hover: #1A2030;
  --line: rgba(255,255,255,0.06);
  --accent: #2563EB;     --accent-hover: #3B82F6;
  --accent-50: #1e2a52;  --accent-600: #3B82F6;   /* compat Slice 1 (états actifs nav/onglets) sur sombre */
  --ink: #F5F7FA;        --muted: #8A93A6;        --faint: #5B6373;
  --badge: #1E2435;
  --kpi-green: #4ADE80;  --kpi-green-bg: rgba(34,197,94,0.08);
  --kpi-blue: #60A5FA;   --kpi-blue-bg: rgba(59,130,246,0.08);
  --kpi-amber: #FBBF24;  --kpi-amber-bg: rgba(245,158,11,0.08);
  --kpi-violet: #C084FC; --kpi-violet-bg: rgba(168,85,247,0.08);
  --hero-from: #1B2138;  --hero-to: #2A2140;
}

[data-theme="light"] {
  /* Clair — réutilise la Slice 1 */
  --app: #f8fafc;        --sidebar: #ffffff;
  --surface: #ffffff;    --surface-hover: #f1f5f9;
  --line: #e2e8f0;
  --accent: #2563EB;     --accent-hover: #3B82F6;
  --accent-50: #eef2ff;  --accent-600: #4338ca;   /* compat Slice 1 (accueil/auth/AppNav clair) */
  --ink: #0f172a;        --muted: #64748b;        --faint: #94a3b8;
  --badge: #eef2ff;
  /* KPI : mêmes teintes, lisibles sur clair */
  --kpi-green: #16a34a;  --kpi-green-bg: rgba(34,197,94,0.10);
  --kpi-blue: #2563eb;   --kpi-blue-bg: rgba(59,130,246,0.10);
  --kpi-amber: #d97706;  --kpi-amber-bg: rgba(245,158,11,0.12);
  --kpi-violet: #9333ea; --kpi-violet-bg: rgba(168,85,247,0.10);
  --hero-from: #e0e7ff;  --hero-to: #ede9fe;
}

@theme {
  --color-app: var(--app);
  --color-canvas: var(--app);   /* alias compat Slice 1 (bg-canvas) */
  --color-sidebar: var(--sidebar);
  --color-surface: var(--surface);
  --color-surface-hover: var(--surface-hover);
  --color-line: var(--line);
  --color-accent: var(--accent);
  --color-accent-hover: var(--accent-hover);
  --color-accent-50: var(--accent-50);     /* compat Slice 1 */
  --color-accent-600: var(--accent-600);   /* compat Slice 1 */
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

body { background-color: var(--color-app); color: var(--color-ink); }
```
- Les anciens tokens de la Slice 1 (`--color-canvas`/`--color-surface`/`--color-ink`/`--color-muted`/
  `--color-line`/`rounded-card`) restent disponibles : `canvas` est remplacé par `app` ; les écrans
  actuels qui utilisaient `bg-canvas`/`bg-surface`/`text-muted`/`border-line` continuent de fonctionner
  via les nouveaux mappings (ajouter un alias `--color-canvas: var(--app)` pour ne rien casser).
- Dégradé hero : utilitaire arbitraire `bg-[linear-gradient(135deg,var(--hero-from),var(--hero-to))]`.

## 3. Police Inter + mécanisme de thème

- **Inter** : dans `src/app/[locale]/layout.tsx`, `import { Inter } from "next/font/google"`, instancié
  avec `variable: "--font-inter"`, classe appliquée à `<html>`/`<body>`.
- **Thème (no-flash SSR)** : le layout lit un cookie `theme` (`next/headers` `cookies()`) et pose
  `data-theme={theme}` sur `<html>` (défaut **`light`** en Slice A ; passera à `dark` en Slice B).
- `ThemeToggle` (client, dans le kit) : bascule `data-theme` sur `document.documentElement` + écrit le
  cookie `theme` (1 an). Icônes lune/soleil (`lucide-react`).

## 4. Kit UI partagé (`src/features/shared/ui/`)

Composants présentational purs (props typées, aucune query/action). Chacun son fichier.

| Composant | Rôle | Props clés |
|---|---|---|
| `Button` | actions | `variant: "primary" \| "ghost" \| "subtle"`, `pending?`, `type`, standard button props |
| `Badge` | pastille compteur | `children` (nombre/texte), fond `bg-badge` |
| `Card` | conteneur `rounded-card` + `border-line` + `bg-surface` | `as?`, `className?`, `children` |
| `SectionLabel` | label MAJUSCULES `text-xs tracking-wide text-muted` | `icon?` (emoji/lucide), `children` |
| `Tile` | tuile KPI (label + grand chiffre) | `tone: "green"\|"blue"\|"amber"\|"violet"`, `label`, `value` |
| `NavItem` | item de nav (icône + libellé, actif/hover) | `icon` (lucide), `label`, `active?`, `href` (Link i18n) |
| `Avatar` | initiales sur fond accent | `name`, `size?` (`sm`/`md`) — initiales dérivées du nom |
| `Modal` | dialog accessible (focus-trap, échap, overlay) | `open`, `onClose`, `title?`, `children` |
| `Toast` | notification | `type: "info"\|"success"\|"error"`, `children` |
| `Fab` | bouton flottant accent + ombre | `icon` (lucide), `label` (aria), `onClick?`/`href?` |
| `ThemeToggle` | bascule thème (cf. §3) | — |

- Helpers purs testables : `initials(name)` (Avatar), `toneClasses(tone)` (Tile) → extraits dans un
  petit module testé.
- `data-testid` utiles pour la preview/e2e : `ui-kit` (page), et des testids ponctuels sur les
  composants interactifs (`theme-toggle`, `modal`, `toast`).

## 5. Page de preview (`src/app/[locale]/ui-kit/page.tsx`)

Route **publique** (hors `(app)`, pas de garde) listant chaque composant dans ses variantes sur fond
sombre forcé (un wrapper `data-theme` local ou la page entière), pour figer l'esthétique. Sert de
validation visuelle de la Slice A. `data-testid="ui-kit"`. Pourra être retirée à la fin de la refonte.

## 6. Sécurité

- Aucune surface auth/DB. Le cookie `theme` est non sensible (préférence UI). Pas de migration, pas de
  RLS. Le kit ne contient aucune logique métier ni accès données.

## 7. Tests

- **Unit (Vitest)** : `initials(name)` (« Victor Penhoat » → « VP », nom simple → 1 lettre, vide → garde
  un fallback) ; `toneClasses(tone)` (mappe chaque tone vers les bonnes classes KPI).
- **Build** : `npm run build` (Tailwind compile `@theme` + `next/font` Inter ; route `ui-kit` rend).
- **e2e (Playwright)** : `/<locale>/ui-kit` affiche `ui-kit` ; `theme-toggle` bascule `data-theme` sur
  `<html>` (de `light` à `dark` et inverse) ; ouverture/fermeture `modal`. Signaux déterministes.
- Pas de régression : les écrans existants restent en thème clair (défaut `light` en Slice A) ; alias
  `--color-canvas` conservé.

## 8. Arbitrages / dette signalés

- **Bascule du défaut en sombre** : effectuée en Slice B (avec le shell dark-aware), pas en A.
- **`LocaleSwitcher` + locales EN/IT/ES** : Slice B (footer du shell).
- **Migration visuelle des écrans métier** vers les nouveaux composants/tokens : slices ultérieures,
  écran par écran (ils restent fonctionnels en clair d'ici là).
- **Page `ui-kit`** : utilitaire de validation, à retirer une fois la refonte stabilisée.
- Mode sombre auto via `prefers-color-scheme` : non — on pilote par cookie + toggle explicite.
