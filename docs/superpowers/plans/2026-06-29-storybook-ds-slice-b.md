# Storybook DS Slice B — Stories des primitives Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Écrire une story Storybook par variante visuelle pour les 12 primitives du kit (`src/features/shared/ui/`, hors `Button` déjà fait), en réutilisant la fondation `.storybook/` sans la modifier.

**Architecture:** Un fichier `<Name>.stories.tsx` colocalisé par primitive, titre `Kit/<Name>`, sur le modèle exact de `Button.stories.tsx`. Le décorateur de `.storybook/preview.tsx` fournit déjà l'intl (`NextIntlClientProvider` + `storyMessages.shell`), le thème (`[data-theme]`) et la font Inter. Aucune logique testable n'est ajoutée : la « boucle de test » d'une story est *le build Storybook compile et rend la story sans erreur*, complété par un sondage headless Playwright pour les stories à risque (Link, portail).

**Tech Stack:** Storybook 10.4.6 (`@storybook/nextjs-vite`), React 19, Next.js 16, Tailwind v4, next-intl 4, lucide-react, `@playwright/test` (sondage headless).

## Global Constraints

- **Fondation réutilisée telle quelle** — ne modifier AUCUN fichier de `.storybook/` (`main.ts`, `preview.tsx`, `messages.ts`). Pas de nouvelle dépendance npm.
- **Pattern de story = `Button.stories.tsx`** : `import type { Meta, StoryObj } from "@storybook/nextjs-vite"`, `meta.title = "Kit/<Name>"`, `meta.component`, `export default meta`, `type Story = StoryObj<typeof X>`, stories en `export const`.
- **Colocalisation** : `src/features/shared/ui/<Name>.stories.tsx`.
- **Imports nommés** : tous les composants sont des exports nommés (`import { Name } from "./Name"`).
- **Intl déjà couvert** : seuls `Modal` (`t("close")`) et `ThemeToggle` (`t("theme")`) utilisent `useTranslations("shell")` ; les deux clés sont dans `storyMessages.shell`. NE PAS ajouter de messages.
- **Non-régression** : `npm run lint`, `npx tsc --noEmit`, `npm test` (204 tests) restent verts ; `npm run build-storybook` réussit.
- **Pas de story `Modal Closed`** (`open:false` rend `null` — YAGNI).
- `npm run build-storybook` ne nécessite PAS de workaround de cache npm (aucune install).

---

### Task 1 : Stories des 8 primitives triviales

Composants pure-présentationnels, sans dépendance runtime : Avatar, Badge, Card, Tile, Toast, PageHeader, SectionLabel, Skeleton.

**Files:**
- Create: `src/features/shared/ui/Avatar.stories.tsx`
- Create: `src/features/shared/ui/Badge.stories.tsx`
- Create: `src/features/shared/ui/Card.stories.tsx`
- Create: `src/features/shared/ui/Tile.stories.tsx`
- Create: `src/features/shared/ui/Toast.stories.tsx`
- Create: `src/features/shared/ui/PageHeader.stories.tsx`
- Create: `src/features/shared/ui/SectionLabel.stories.tsx`
- Create: `src/features/shared/ui/Skeleton.stories.tsx`

**Interfaces:**
- Consomme : la fondation `.storybook/` (Slice A) — décorateur intl/thème/font, addons a11y+docs. `PageHeader.stories` importe `Button` de `./Button` (existant).
- Produit : 8 fichiers de stories sous le préfixe de titre `Kit/`. Aucune API consommée par d'autres tasks.

- [ ] **Step 1 : Écrire `Avatar.stories.tsx`**

Props réelles : `{ name: string; size?: "sm"|"md"|"lg"|"xl"; color?: string }`.

```tsx
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Avatar } from "./Avatar";

const meta: Meta<typeof Avatar> = {
  title: "Kit/Avatar",
  component: Avatar,
  args: { name: "Victor Penhoat" },
  argTypes: { size: { control: "select", options: ["sm", "md", "lg", "xl"] } },
};
export default meta;
type Story = StoryObj<typeof Avatar>;

export const Sm: Story = { args: { size: "sm" } };
export const Md: Story = { args: { size: "md" } };
export const Lg: Story = { args: { size: "lg" } };
export const Xl: Story = { args: { size: "xl" } };
export const CustomColor: Story = { args: { size: "lg", color: "#C2410C" } };
```

- [ ] **Step 2 : Écrire `Badge.stories.tsx`**

Props réelles : `HTMLAttributes<HTMLSpanElement>` (`children` requis à l'usage).

```tsx
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Badge } from "./Badge";

const meta: Meta<typeof Badge> = {
  title: "Kit/Badge",
  component: Badge,
  args: { children: "Nouveau" },
};
export default meta;
type Story = StoryObj<typeof Badge>;

export const Default: Story = {};
```

- [ ] **Step 3 : Écrire `Card.stories.tsx`**

Props réelles : `HTMLAttributes<HTMLDivElement>` (`children`).

```tsx
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Card } from "./Card";

const meta: Meta<typeof Card> = {
  title: "Kit/Card",
  component: Card,
  args: { children: "Contenu de la carte — texte de démonstration." },
};
export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {};
```

- [ ] **Step 4 : Écrire `Tile.stories.tsx`**

Props réelles : `{ tone: "green"|"blue"|"amber"|"violet"; label: string; value: string|number }`.

```tsx
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Tile } from "./Tile";

const meta: Meta<typeof Tile> = {
  title: "Kit/Tile",
  component: Tile,
  args: { label: "Réservations", value: 128 },
  argTypes: { tone: { control: "select", options: ["green", "blue", "amber", "violet"] } },
};
export default meta;
type Story = StoryObj<typeof Tile>;

export const Green: Story = { args: { tone: "green" } };
export const Blue: Story = { args: { tone: "blue" } };
export const Amber: Story = { args: { tone: "amber" } };
export const Violet: Story = { args: { tone: "violet" } };
```

- [ ] **Step 5 : Écrire `Toast.stories.tsx`**

Props réelles : `{ type?: "info"|"success"|"error"; children: ReactNode }`.

```tsx
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Toast } from "./Toast";

const meta: Meta<typeof Toast> = {
  title: "Kit/Toast",
  component: Toast,
  args: { children: "Votre message a été enregistré." },
  argTypes: { type: { control: "select", options: ["info", "success", "error"] } },
};
export default meta;
type Story = StoryObj<typeof Toast>;

export const Info: Story = { args: { type: "info" } };
export const Success: Story = { args: { type: "success" } };
export const Error: Story = { args: { type: "error" } };
```

- [ ] **Step 6 : Écrire `PageHeader.stories.tsx`**

Props réelles : `{ title: string; eyebrow?: string; subtitle?: string; action?: ReactNode }`. La story `Full` utilise `Button` (export nommé de `./Button`, props `{ variant?: "primary"|"ghost"|"subtle" }`).

```tsx
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PageHeader } from "./PageHeader";
import { Button } from "./Button";

const meta: Meta<typeof PageHeader> = {
  title: "Kit/PageHeader",
  component: PageHeader,
  args: { title: "Mes restos" },
};
export default meta;
type Story = StoryObj<typeof PageHeader>;

export const Full: Story = {
  args: {
    eyebrow: "Découvrir",
    title: "Mes restos",
    subtitle: "Vos adresses favorites, au même endroit.",
    action: <Button variant="primary">Ajouter</Button>,
  },
};
export const TitleOnly: Story = { args: { title: "Mes restos" } };
```

- [ ] **Step 7 : Écrire `SectionLabel.stories.tsx`**

Props réelles : `{ icon?: ReactNode; children: ReactNode }`. Icône lucide passée en arg.

```tsx
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Sparkles } from "lucide-react";
import { SectionLabel } from "./SectionLabel";

const meta: Meta<typeof SectionLabel> = {
  title: "Kit/SectionLabel",
  component: SectionLabel,
  args: { children: "À proximité" },
};
export default meta;
type Story = StoryObj<typeof SectionLabel>;

export const WithIcon: Story = { args: { icon: <Sparkles size={14} /> } };
export const TextOnly: Story = {};
```

- [ ] **Step 8 : Écrire `Skeleton.stories.tsx`**

Props réelles : `{ className?: string }`. Les dimensions viennent de `className`.

```tsx
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Skeleton } from "./Skeleton";

const meta: Meta<typeof Skeleton> = {
  title: "Kit/Skeleton",
  component: Skeleton,
};
export default meta;
type Story = StoryObj<typeof Skeleton>;

export const Line: Story = { args: { className: "h-4 w-48" } };
export const Block: Story = { args: { className: "h-24 w-full" } };
```

- [ ] **Step 9 : Build Storybook (compile + rend les 8 stories)**

Run : `npm run build-storybook`
Attendu : `Storybook build completed successfully`, exit 0, aucune erreur de compilation des nouvelles stories.

- [ ] **Step 10 : Non-régression lint/tsc/test**

Run : `npm run lint && npx tsc --noEmit && npm test`
Attendu : lint exit 0 ; tsc exit 0 ; `Tests  204 passed (204)`.

- [ ] **Step 11 : Commit**

```bash
git add src/features/shared/ui/Avatar.stories.tsx src/features/shared/ui/Badge.stories.tsx \
  src/features/shared/ui/Card.stories.tsx src/features/shared/ui/Tile.stories.tsx \
  src/features/shared/ui/Toast.stories.tsx src/features/shared/ui/PageHeader.stories.tsx \
  src/features/shared/ui/SectionLabel.stories.tsx src/features/shared/ui/Skeleton.stories.tsx
git commit -m "docs(storybook): stories des 8 primitives triviales (Kit/*)"
```

---

### Task 2 : Stories Fab + NavItem (Link locale-aware)

Ces deux composants rendent le `Link` locale-aware de `@/lib/i18n/routing`. On s'appuie sur le mock de router de `@storybook/nextjs-vite` + le provider intl du décorateur. Risque : le `Link` doit rendre un `<a>` sans crash → vérifié par sondage headless.

**Files:**
- Create: `src/features/shared/ui/Fab.stories.tsx`
- Create: `src/features/shared/ui/NavItem.stories.tsx`

**Interfaces:**
- Consomme : la fondation `.storybook/`, le mock de router de `@storybook/nextjs-vite`, lucide-react.
- Produit : 2 fichiers de stories `Kit/Fab`, `Kit/NavItem`.

- [ ] **Step 1 : Écrire `Fab.stories.tsx`**

Props réelles : `{ icon: ReactNode; label: string; href?: string; onClick?: () => void }`. `href` → rend `<Link>` (`<a>`) ; sinon `onClick` → rend `<button>`. `Fab` est `fixed` → `layout: "fullscreen"`.

```tsx
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Plus } from "lucide-react";
import { Fab } from "./Fab";

const meta: Meta<typeof Fab> = {
  title: "Kit/Fab",
  component: Fab,
  args: { icon: <Plus size={24} />, label: "Ajouter" },
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof Fab>;

export const AsLink: Story = { args: { href: "/restos/nouveau" } };
export const AsButton: Story = { args: { onClick: () => {} } };
```

- [ ] **Step 2 : Écrire `NavItem.stories.tsx`**

Props réelles : `{ icon: ReactNode; label: string; href: string; active?: boolean; "data-testid"?: string }`. Rend toujours un `<Link>` (`<a>`).

```tsx
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Compass } from "lucide-react";
import { NavItem } from "./NavItem";

const meta: Meta<typeof NavItem> = {
  title: "Kit/NavItem",
  component: NavItem,
  args: { icon: <Compass size={18} />, label: "Découvrir", href: "/decouvrir" },
};
export default meta;
type Story = StoryObj<typeof NavItem>;

export const Active: Story = { args: { active: true } };
export const Inactive: Story = { args: { active: false } };
```

- [ ] **Step 3 : Build Storybook**

Run : `npm run build-storybook`
Attendu : exit 0, build réussi (les stories Fab/NavItem compilent).

- [ ] **Step 4 : Sondage headless — le `Link` rend un `<a>` sans crash**

Écrire le script de sondage (jeté après) à la racine du repo, puis l'exécuter :

```bash
cat > sb-probe.mjs <<'EOF'
import { chromium } from "@playwright/test";
const ids = ["kit-fab--as-link", "kit-navitem--active", "kit-navitem--inactive"];
const b = await chromium.launch();
const p = await b.newPage();
let failed = false;
for (const id of ids) {
  await p.goto(`http://localhost:6099/iframe.html?id=${id}&viewMode=story`, { waitUntil: "networkidle" });
  await p.waitForTimeout(500);
  const hasAnchor = await p.evaluate(() => !!document.querySelector("#storybook-root a"));
  console.log(id, "→ <a> présent:", hasAnchor);
  if (!hasAnchor) failed = true;
}
await b.close();
process.exit(failed ? 1 : 0);
EOF
python3 -m http.server 6099 --directory storybook-static >/dev/null 2>&1 &
SRV=$!; sleep 2
node sb-probe.mjs; PROBE=$?
kill $SRV 2>/dev/null; rm -f sb-probe.mjs
exit $PROBE
```

Attendu : chaque ligne affiche `<a> présent: true`, exit 0.
Si exit 1 (le mock de router ne rend pas d'`<a>`) : c'est un blocage à remonter au contrôleur — NE PAS bricoler la fondation ; documenter le constat dans le rapport.

- [ ] **Step 5 : Non-régression lint/tsc/test**

Run : `npm run lint && npx tsc --noEmit && npm test`
Attendu : lint 0 ; tsc 0 ; `Tests  204 passed (204)`.

- [ ] **Step 6 : Commit**

```bash
git add src/features/shared/ui/Fab.stories.tsx src/features/shared/ui/NavItem.stories.tsx
git commit -m "docs(storybook): stories Fab + NavItem (Link locale-aware)"
```

---

### Task 3 : Stories Modal + ThemeToggle (client + intl)

Composants `"use client"` utilisant `useTranslations("shell")`. L'intl est fourni par le décorateur (`storyMessages.shell` contient `close` et `theme`). `Modal` rend un overlay `fixed` (portail-like) → sondage headless de l'overlay.

**Files:**
- Create: `src/features/shared/ui/Modal.stories.tsx`
- Create: `src/features/shared/ui/ThemeToggle.stories.tsx`

**Interfaces:**
- Consomme : la fondation `.storybook/` (provider intl `shell`), lucide-react (icônes internes aux composants).
- Produit : 2 fichiers de stories `Kit/Modal`, `Kit/ThemeToggle`.

- [ ] **Step 1 : Écrire `Modal.stories.tsx`**

Props réelles : `{ open: boolean; onClose: () => void; title?: string; children: ReactNode }`. `onClose` = no-op. Overlay `fixed inset-0` → `layout: "fullscreen"`. Le bouton close affiche `t("close")` = "Fermer" (déjà dans `storyMessages.shell`).

```tsx
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Modal } from "./Modal";

const meta: Meta<typeof Modal> = {
  title: "Kit/Modal",
  component: Modal,
  args: { onClose: () => {} },
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof Modal>;

export const Open: Story = {
  args: {
    open: true,
    title: "Confirmer la réservation",
    children: "Voulez-vous confirmer votre réservation pour ce soir ?",
  },
};
```

- [ ] **Step 2 : Écrire `ThemeToggle.stories.tsx`**

Aucune prop. Lit `document.documentElement[data-theme]` au montage → rend le bouton (icône `Sun`/`Moon`). `t("theme")` déjà dans `storyMessages.shell`.

```tsx
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ThemeToggle } from "./ThemeToggle";

const meta: Meta<typeof ThemeToggle> = {
  title: "Kit/ThemeToggle",
  component: ThemeToggle,
};
export default meta;
type Story = StoryObj<typeof ThemeToggle>;

export const Default: Story = {};
```

- [ ] **Step 3 : Build Storybook**

Run : `npm run build-storybook`
Attendu : exit 0, build réussi (Modal/ThemeToggle compilent, pas d'erreur intl).

- [ ] **Step 4 : Sondage headless — overlay Modal + bouton ThemeToggle**

```bash
cat > sb-probe.mjs <<'EOF'
import { chromium } from "@playwright/test";
const b = await chromium.launch();
const p = await b.newPage();
let failed = false;
// Modal Open : dialog visible + overlay fixed
await p.goto("http://localhost:6099/iframe.html?id=kit-modal--open&viewMode=story", { waitUntil: "networkidle" });
await p.waitForTimeout(500);
const modal = await p.evaluate(() => {
  const dlg = document.querySelector('#storybook-root [role="dialog"]');
  const overlay = document.querySelector("#storybook-root .fixed");
  return { dialog: !!dlg, overlayFixed: overlay ? getComputedStyle(overlay).position === "fixed" : false };
});
console.log("Modal:", JSON.stringify(modal));
if (!modal.dialog || !modal.overlayFixed) failed = true;
// ThemeToggle : bouton rendu
await p.goto("http://localhost:6099/iframe.html?id=kit-themetoggle--default&viewMode=story", { waitUntil: "networkidle" });
await p.waitForTimeout(500);
const toggle = await p.evaluate(() => !!document.querySelector('#storybook-root [data-testid="theme-toggle"]'));
console.log("ThemeToggle bouton:", toggle);
if (!toggle) failed = true;
await b.close();
process.exit(failed ? 1 : 0);
EOF
python3 -m http.server 6099 --directory storybook-static >/dev/null 2>&1 &
SRV=$!; sleep 2
node sb-probe.mjs; PROBE=$?
kill $SRV 2>/dev/null; rm -f sb-probe.mjs
exit $PROBE
```

Attendu : `Modal: {"dialog":true,"overlayFixed":true}`, `ThemeToggle bouton: true`, exit 0.

- [ ] **Step 5 : Non-régression lint/tsc/test**

Run : `npm run lint && npx tsc --noEmit && npm test`
Attendu : lint 0 ; tsc 0 ; `Tests  204 passed (204)`.

- [ ] **Step 6 : Commit**

```bash
git add src/features/shared/ui/Modal.stories.tsx src/features/shared/ui/ThemeToggle.stories.tsx
git commit -m "docs(storybook): stories Modal + ThemeToggle (client + intl)"
```

---

## Vérification finale (contrôleur)

Après les 3 tasks, le contrôleur :
1. Confirme `npm run build-storybook` vert et que les **13 titres `Kit/*`** apparaissent (Button + 12).
2. Relance le sondage headless visuel de Slice A sur 1-2 stories pour confirmer le rendu stylé (tokens/font), p. ex. `Kit/Tile` Green (couleur de texte ≠ ink) et `Kit/Modal` Open (overlay sombre + dialog).
3. PR → CI `quality` verte → merge (squash, suppression de branche).

## Récapitulatif des stories (référence)

| Fichier | Titre | Stories |
|---|---|---|
| Avatar.stories.tsx | Kit/Avatar | Sm, Md, Lg, Xl, CustomColor |
| Badge.stories.tsx | Kit/Badge | Default |
| Card.stories.tsx | Kit/Card | Default |
| Tile.stories.tsx | Kit/Tile | Green, Blue, Amber, Violet |
| Toast.stories.tsx | Kit/Toast | Info, Success, Error |
| PageHeader.stories.tsx | Kit/PageHeader | Full, TitleOnly |
| SectionLabel.stories.tsx | Kit/SectionLabel | WithIcon, TextOnly |
| Skeleton.stories.tsx | Kit/Skeleton | Line, Block |
| Fab.stories.tsx | Kit/Fab | AsLink, AsButton |
| NavItem.stories.tsx | Kit/NavItem | Active, Inactive |
| Modal.stories.tsx | Kit/Modal | Open |
| ThemeToggle.stories.tsx | Kit/ThemeToggle | Default |
