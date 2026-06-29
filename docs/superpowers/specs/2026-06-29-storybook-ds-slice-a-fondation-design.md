# Spec — Storybook DS · Slice A : Fondation

> Chantier « Storybook du design-system » (préalable au `/design-sync`, choisi par le PO : créer un
> Storybook propre plutôt qu'un import off-script). Première slice : **fondation** — installer et
> configurer Storybook sur la stack du repo, validée par une story-preuve, **avant** d'écrire les
> stories de tout le kit (Slice B).

## Objectif

Mettre en place une fondation Storybook qui rend **fidèlement** les composants du design-system Vito
(tokens Tailwind v4, fonts, thème, contexte next-intl), prouvée par **une story (Button)** rendue
stylée. Dé-risque la stack bleeding-edge (Next 16 + React 19 + Tailwind v4) avant d'investir dans les
13 stories.

## Décisions PO (validées le 2026-06-29)

1. **Fondation d'abord** : Slice A = infra Storybook + 1 story-preuve. Les 12 autres primitives →
   Slice B. (Découpage validé vu le risque de la stack.)
2. **Périmètre composants = primitives du kit seulement** (`src/features/shared/ui/*`). Les feature
   components (PlaceCard, brique places, Leaflet, server actions) restent **hors scope**.
3. Exploratoire : le job de la slice est de **trouver la config qui marche** ; itération attendue.

## État de départ (vérifié)

- **Storybook non installé** (aucun `@storybook/*`). Stack : Next `16.2.9`, React `19.2.4`,
  Tailwind v4 (`@tailwindcss/postcss`), `@vitejs/plugin-react`, Vitest.
- Tokens : `src/app/globals.css` — bloc `@theme` (couleurs/radii/fonts) + vars `:root`/`[data-theme="dark"]`/
  `[data-theme="light"]`. App **dark-first** (mockups clairs = preview seulement).
- Fonts : `next/font/google` (Inter `--font-inter`, Newsreader `--font-newsreader`) appliquées sur
  `<html className>` dans `src/app/[locale]/layout.tsx`.
- Contexte intl : `NextIntlClientProvider` (root layout) ; `Link` locale-aware via
  `@/lib/i18n/routing` (`createNavigation(routing)`, locales fr/en/it/es). Pattern de wrap prouvé :
  `PlaceCard.test.tsx` (`<NextIntlClientProvider locale="fr" messages={…}>`).
- Alias : `@` → `src` ; vitest aliase aussi `next/navigation` → `node_modules/next/navigation.js`.
- 13 primitives `features/shared/ui/*` ; **Button** = la plus simple (variants + `pending`), idéale pour
  la preuve. Certaines primitives (Modal, ThemeToggle, NavItem, Fab) dépendent de next-intl/`Link`.

## Architecture / composants

### 1. Dépendances Storybook

- Installer Storybook via son initialiseur (`npx storybook@latest init --type nextjs --skip-install`
  puis install avec le **package manager du repo** — détecter le lockfile), OU ajouter manuellement
  les paquets `@storybook/nextjs` + addons + `storybook` (CLI) à une version **compatible Next 16 /
  React 19** (Storybook ≥ 9.x ; valider la compat — c'est le point de risque principal).
- Scripts `package.json` : `"storybook": "storybook dev -p 6006"`, `"build-storybook": "storybook build"`.
- Aucune dépendance runtime de l'app modifiée ; Storybook en `devDependencies`.

### 2. `.storybook/main.ts`

- `framework: { name: "@storybook/nextjs", options: {} }` (gère `next/font`, `next/navigation`,
  next/image, le PostCSS Tailwind v4).
- `stories: ["../src/**/*.stories.@(ts|tsx)"]`.
- `addons` : essentiels (controls/actions/docs) + a11y si dispo (`@storybook/addon-a11y`).
- Alias `@` → `../src` (via `viteFinal`/`webpackFinal` selon le bundler du framework) si le framework
  ne le résout pas seul.

### 3. `.storybook/preview.tsx` (décorateurs)

- **Styles** : `import "../src/app/globals.css";` (charge Tailwind v4 + tokens).
- **Décorateur intl** : envelopper chaque story dans `NextIntlClientProvider` (`locale="fr"`, objet
  `messages` minimal couvrant les namespaces utilisés par les primitives — au moins `shell` pour
  Modal/ThemeToggle). Messages mock locaux à `.storybook` (pas les vrais `messages/*.json`, pour rester
  léger et stable).
- **Décorateur thème** : appliquer `data-theme` sur le conteneur racine de la story ; `globalTypes` +
  toolbar pour basculer **dark (défaut)** / light ; fond de canvas accordé au thème.
- **Fonts** : s'appuyer sur le support `next/font` du framework `@storybook/nextjs` ; si les vars
  `--font-inter`/`--font-newsreader` ne sont pas injectées, fallback explicite (déclarer les vars sur
  le conteneur racine du décorateur, comme dans le pattern de test).

### 4. Story-preuve — `Button.stories.tsx`

- `src/features/shared/ui/Button.stories.tsx` : meta `title: "Kit/Button"`, component `Button`.
- Stories : `Primary`, `Ghost`, `Subtle`, `Pending` (chacune une variante/état), avec un `children`
  texte. Args/controls sur `variant`/`pending`.
- Doit **rendre stylé** : fond `bg-accent` (token) pour primary, bordure/teintes correctes, font Inter.

## Tests / vérification

- **Build** : `npm run build-storybook` réussit (sortie statique générée) — c'est le gate de la stack.
- **Rendu** (render-verified, manuel ou via la skill `verify`) : `storybook dev` ouvre, la story
  Button rend **stylée** (token accent appliqué, font chargée) en thème dark **et** light.
- **Non-régression** : `npm run lint && npx tsc --noEmit && npm test` restent verts (l'ajout de
  Storybook + 1 `.stories.tsx` ne casse rien ; le glob de tests Vitest n'inclut pas `.stories`).
- Pas d'e2e (scaffolding). Storybook n'est pas dans le job CI `quality` pour cette slice (build local
  suffit ; intégration CI éventuelle = décision ultérieure).

## Conventions Vito (rappel)

- App Router Next 16, Tailwind v4, next-intl 4. Aucun token nouveau (Storybook **consomme** les tokens
  existants). Stories en TypeScript. `Link`/intl via le contexte fourni par les décorateurs.
- **Vérif pré-push** : `npm run lint && npx tsc --noEmit && npm test` (+ `build-storybook` pour cette
  slice). Branche dédiée → PR → CI verte → merge.
- **Aucune migration / pas de go-prod DB.**

## Risques

- **Compat Storybook × Next 16 × React 19 × Tailwind v4** : combinaison très récente ; la version de
  Storybook et la résolution PostCSS/alias peuvent demander des ajustements (escape hatch : `viteFinal`/
  `webpackFinal`). Si une incompatibilité bloquante apparaît, on l'apprend **ici** (objet de la slice),
  pas après avoir écrit 13 stories.
- Si `@storybook/nextjs` ne supporte pas encore Next 16 proprement → fallback `@storybook/react-vite`
  + reproduction manuelle des alias/fonts (à décider si le cas se présente, hors périmètre par défaut).

## Hors périmètre

- Les 12 autres primitives (→ Slice B). Les feature components (places brique, Leaflet, server actions).
- `/design-sync` lui-même (vient après que le Storybook couvre le kit). Intégration de Storybook au job
  CI. Thème/branding au-delà des tokens existants.
