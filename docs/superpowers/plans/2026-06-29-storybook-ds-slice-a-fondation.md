# Storybook DS · Slice A — Fondation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Installer + configurer Storybook sur la stack du repo (Next 16 / React 19 / Tailwind v4) avec décorateurs tokens/fonts/thème/next-intl, prouvé par une story Button rendue stylée.

**Architecture:** `@storybook/nextjs`, `.storybook/main.ts` + `.storybook/preview.tsx` (globals.css + décorateurs intl/thème/fonts), une story-preuve `Button.stories.tsx`. Exploratoire : trouver la config qui marche sur la stack bleeding-edge.

**Tech Stack:** Storybook (≥9.x à valider), Next 16.2.9, React 19.2.4, Tailwind v4, npm (package-lock.json).

Spec : `docs/superpowers/specs/2026-06-29-storybook-ds-slice-a-fondation-design.md`.

## Global Constraints

- npm (lockfile = `package-lock.json`). Storybook en `devDependencies`. Aucune dep runtime de l'app touchée.
- Composant cible = `Button` uniquement (les 12 autres primitives = Slice B). Aucun token nouveau (Storybook **consomme** `globals.css`).
- App **dark-first** : thème par défaut des stories = dark, toggle light via toolbar.
- Décorateurs requis : `globals.css`, `NextIntlClientProvider` (locale `fr` + messages mock incluant `shell`), thème (`data-theme`), fonts.
- **Vérif** : `npm run build-storybook` réussit (gate objectif, subagent) ; **rendu stylé** vérifié côté contrôleur (screenshot / skill `verify`) — un subagent headless ne peut pas juger le visuel. `npm run lint && npx tsc --noEmit && npm test` restent verts.
- Exploratoire : itérer pour résoudre les conflits de version/peer-deps (React 19 / Next 16). Escape hatch documenté si `@storybook/nextjs` ne supporte pas Next 16.

---

### Task 1: Installer + configurer Storybook (infra)

Installer Storybook et le configurer pour la stack ; gate = `build-storybook` réussit.

**Files:**
- Modify: `package.json` (devDeps + scripts), `package-lock.json`
- Create: `.storybook/main.ts`, `.storybook/preview.tsx`, `.storybook/messages.ts` (messages mock)
- Possibly: `.gitignore` (ajouter `storybook-static/`)

**Interfaces:**
- Consumes: `src/app/globals.css`, `@/lib/i18n/routing`, `messages/fr.json` (namespaces).
- Produces: une fondation Storybook qui build ; décorateurs intl + thème + fonts appliqués à toute story.

- [ ] **Step 1: Installer Storybook (framework nextjs)**

Lancer l'initialiseur Storybook avec npm :
```bash
npx storybook@latest init --builder webpack5 --yes
```
(Il détecte Next.js et installe `@storybook/nextjs` + addons.) Si l'init échoue sur des peer-deps React 19 / Next 16, installer manuellement la **dernière** ligne Storybook compatible :
```bash
npm install -D storybook@latest @storybook/nextjs@latest @storybook/addon-essentials@latest
```
puis, en cas de conflit de peer-deps bloquant, `npm install` avec la résolution adéquate (ne PAS forcer `--legacy-peer-deps` sans le noter dans le rapport). **Si `@storybook/nextjs` refuse Next 16** → s'arrêter et reporter BLOCKED avec l'erreur exacte (l'escape hatch `@storybook/react-vite` est hors périmètre par défaut, décision contrôleur).

L'init crée souvent des stories d'exemple (`src/stories/`) : **les supprimer** (on ne garde que notre Button story en Task 2).

- [ ] **Step 2: Scripts package.json**

S'assurer que `package.json` a :
```json
"storybook": "storybook dev -p 6006",
"build-storybook": "storybook build"
```

- [ ] **Step 3: `.storybook/messages.ts` (messages mock)**

Créer `.storybook/messages.ts` :
```ts
// Messages mock pour les décorateurs Storybook (pas les vrais messages/*.json, gardés légers/stables).
export const storyMessages = {
  shell: { theme: "Basculer le thème", close: "Fermer", language: "Langue", settings: "Paramétrage", menu: "Menu" },
  places: { noteSur10: "/10", conseilléPar: "Conseillé par {name}" },
  restos: { favorite: "Favori", archiver: "Archiver", desarchiver: "Désarchiver" },
};
```

- [ ] **Step 4: `.storybook/main.ts`**

Créer/écraser `.storybook/main.ts` :
```ts
import type { StorybookConfig } from "@storybook/nextjs";
import path from "node:path";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-essentials"],
  framework: { name: "@storybook/nextjs", options: {} },
  webpackFinal: async (cfg) => {
    cfg.resolve = cfg.resolve ?? {};
    cfg.resolve.alias = { ...(cfg.resolve.alias ?? {}), "@": path.resolve(__dirname, "../src") };
    return cfg;
  },
};
export default config;
```
(Si l'init a généré un `main.ts` qui résout déjà `@`, conserver sa structure et n'ajouter que ce qui manque. Adapter `addons` à ce que l'init a posé.)

- [ ] **Step 5: `.storybook/preview.tsx` (décorateurs)**

Créer `.storybook/preview.tsx` :
```tsx
import type { Preview } from "@storybook/react";
import { NextIntlClientProvider } from "next-intl";
import "../src/app/globals.css";
import { storyMessages } from "./messages";

const preview: Preview = {
  parameters: {
    backgrounds: { disable: true }, // le fond vient du thème (data-theme)
  },
  globalTypes: {
    theme: {
      description: "Thème",
      defaultValue: "dark",
      toolbar: { icon: "circlehollow", items: ["dark", "light"], dynamicTitle: true },
    },
  },
  decorators: [
    (Story, ctx) => {
      const theme = ctx.globals.theme ?? "dark";
      return (
        <NextIntlClientProvider locale="fr" messages={storyMessages}>
          <div
            data-theme={theme}
            style={{
              background: "var(--app)",
              color: "var(--ink)",
              minHeight: "100vh",
              padding: 24,
            }}
          >
            <Story />
          </div>
        </NextIntlClientProvider>
      );
    },
  ],
};
export default preview;
```
**Fonts** : le framework `@storybook/nextjs` gère `next/font`. Si, à la vérif, les vars `--font-inter`/
`--font-newsreader` ne sont pas définies (font système au lieu d'Inter), ajouter au `<div>` du décorateur
`["--font-inter" as any]: "Inter, system-ui, sans-serif", ["--font-newsreader" as any]: "Newsreader, Georgia, serif"`.

- [ ] **Step 6: `.gitignore`**

Ajouter `storybook-static/` (sortie de build) à `.gitignore` s'il n'y est pas.

- [ ] **Step 7: Build (gate) + non-régression**

Run: `npm run build-storybook`
Expected: build réussit, génère `storybook-static/` (peut afficher « 0 stories » à ce stade — acceptable ; la story arrive en Task 2). Si erreur de compat → itérer (versions/addons) ou BLOCKED si la stack refuse Next 16.
Puis : `npm run lint && npx tsc --noEmit && npm test` → verts (l'ajout Storybook ne casse rien ; le glob Vitest n'inclut pas `.storybook`/`.stories`).

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json .storybook .gitignore
git commit -m "build(storybook): fondation Storybook (@storybook/nextjs) + décorateurs tokens/fonts/intl/thème"
```

---

### Task 2: Story-preuve Button + vérification du rendu

**Files:**
- Create: `src/features/shared/ui/Button.stories.tsx`

**Interfaces:**
- Consumes: la fondation (Task 1) ; `Button` de `./Button`.
- Produces: stories Button (variants + pending).

- [ ] **Step 1: Écrire `Button.stories.tsx`**

Créer `src/features/shared/ui/Button.stories.tsx` :
```tsx
import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./Button";

const meta: Meta<typeof Button> = {
  title: "Kit/Button",
  component: Button,
  args: { children: "Réserver" },
  argTypes: { variant: { control: "select", options: ["primary", "ghost", "subtle"] } },
};
export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = { args: { variant: "primary" } };
export const Ghost: Story = { args: { variant: "ghost" } };
export const Subtle: Story = { args: { variant: "subtle" } };
export const Pending: Story = { args: { variant: "primary", pending: true } };
```

- [ ] **Step 2: Build avec la story (gate)**

Run: `npm run build-storybook`
Expected: build réussit, inclut la story `Kit/Button` (4 stories). Si erreur → corriger.

- [ ] **Step 3: Non-régression**

Run: `npm run lint && npx tsc --noEmit && npm test`
Expected: verts.

- [ ] **Step 4: Commit**

```bash
git add src/features/shared/ui/Button.stories.tsx
git commit -m "docs(storybook): story-preuve Button (variants + pending)"
```

- [ ] **Step 5: Vérification visuelle (contrôleur — hors subagent)**

> Un subagent headless ne peut pas juger le rendu. Le contrôleur lance `npm run storybook` (ou sert
> `storybook-static/`) et vérifie via screenshot / skill `verify` : la story Button rend **stylée** —
> `Primary` a un fond accent (`bg-accent`), font Inter, coins `rounded-control` ; le toggle de thème
> dark↔light change fond/texte (tokens appliqués). C'est le critère de réussite réel de la fondation.

---

## Self-Review

**Spec coverage :**
- §1 Install Storybook + scripts → Task 1. ✅
- §2 main.ts (framework, glob, alias) → Task 1. ✅
- §3 preview.tsx (globals.css + intl + thème + fonts) → Task 1. ✅
- §4 Button.stories → Task 2. ✅
- §Tests (build-storybook + lint/tsc/test + rendu render-verified contrôleur) → Tasks 1, 2 + Step 2.5. ✅
- §Risques (compat, escape hatch BLOCKED) → Task 1 Step 1. ✅

**Placeholder scan :** pas de TBD ; les commandes/fichiers sont concrets. La partie « exploratoire » (version Storybook exacte) est explicitement déléguée à l'itération de l'implémenteur avec critère objectif (`build-storybook` réussit) et condition d'arrêt (BLOCKED si Next 16 refusé).

**Type consistency :** `storyMessages` (Task 1) consommé par le décorateur preview. `Button` props (variant/pending) cohérents entre la story et le composant. Scripts `storybook`/`build-storybook` référencés dans les deux tâches.

**Gap connu (assumé) :** la réussite « rendu stylé » est **visuelle**, non vérifiable par un subagent headless → vérification côté contrôleur (Step 2.5). Storybook n'est pas branché au job CI `quality` dans cette slice (build local = gate). Les 12 autres primitives et `/design-sync` sont hors périmètre (Slice B / suite).
