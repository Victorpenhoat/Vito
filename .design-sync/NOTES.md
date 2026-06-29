# Vito Kit — design-sync notes

Vito est une **app Next.js**, pas un package de design system. Il n'y a ni
`dist/`, ni barrel exportant les composants, ni `.d.ts` publiés. Tout le travail
ci-dessous fait « ressembler » le kit à un package juste assez pour le converter
(shape = storybook). Les 13 primitives vivent dans `src/features/shared/ui/`.

## Fixes app-shape (tous [GENERAL])

- **Barrel d'entrée** `.design-sync/entry.tsx` : réexporte les 13 composants pour
  que le converter les bundle dans `window.VitoKit.*`. Imports **relatifs**
  (`../src/...`), PAS l'alias `@/` — `projectFor`/ts-morph (détection d'exports +
  props) ne charge pas les paths tsconfig, donc `@/` ne s'y résoudrait pas. Passé
  via `--entry` ET référencé par `pkgJson.types` (ci-dessous).
- **`pkgJson.types = ".design-sync/entry.tsx"`** (ajouté à `package.json`) : seul
  levier que `findTypesRoot`/`projectFor` lisent pour trouver le « types root ».
  Sans lui, `exportedNames` ne voit que `next-env.d.ts` → 0 export → `[TITLE_UNMAPPED]`
  sur les 13 et `components: 0`. Champ inerte pour Next/Vercel/CI (non lu au build).
- **`cfg.tsconfig = "tsconfig.json"`** : le plugin esbuild résout l'alias `@/`
  (utilisé EN INTERNE par Fab/NavItem/Modal/ThemeToggle) lors du bundle IIFE.
- **`cfg.provider = { component: "VitoPreviewProvider" }`** (+ `extraEntries:
  ["./.design-sync/provider.tsx"]`) : le bundle des décorateurs `.storybook`
  échoue (`Could not resolve "tailwindcss"` — globals.css `@import "tailwindcss"`).
  On fournit donc le contexte via un provider auto-suffisant qui MIROIR le
  décorateur : `NextIntlClientProvider` (locale `fr` + `storyMessages` de
  `.storybook/messages.ts`) + wrapper `[data-theme="dark"]` (fond/texte/typo).
- **`.design-sync/process-shim.ts`** : next-intl + next/navigation (tirés par
  `@/lib/i18n/routing` et le provider) référencent `process.env` au scope module.
  Le bundle browser n'a pas de `process` → `ReferenceError: process is not defined`
  au chargement, qui VIDE TOUTES les previews (IIFE unique). esbuild ne remplace
  que `process.env.NODE_ENV`. Le shim définit un `process` minimal ; importé en
  **première ligne** de `provider.tsx` ET `entry.tsx` (les points d'entrée du
  bundle), donc exécuté avant tout code next-intl. NE PAS retirer / NE PAS déplacer.
- **CSS** : `[CSS_FROM_STORYBOOK]` — Vito n'a pas de CSS dist (Tailwind v4 généré
  au build) ; le converter scrape la CSS compilée du storybook de référence. OK.

## Vérification

- Reference storybook : `npx storybook build -c .storybook -o .design-sync/sb-reference`
  (PAS `npm run build-storybook` — mauvais dossier de sortie).
- Compare : 13/13 composants, toutes stories **match** (premier sync, jugées sur
  images). Fond sombre, accent, tokens kpi (Tile), serif Newsreader (PageHeader),
  intl (Modal/ThemeToggle), Link→`<a>` (Fab/NavItem) : tous fidèles.

## Re-sync risks (à surveiller au prochain sync)

- **Stories ⇄ messages** : si une nouvelle story d'un composant utilise une clé
  next-intl absente de `storyMessages` (`.storybook/messages.ts`), son preview
  cassera. Étendre `storyMessages` (et donc le provider) en conséquence.
- **process-shim** : si une dep ajoute une lecture `process.env.X` plus exotique
  (ex. accès à une clé au scope module utilisée dans un calcul), élargir le shim.
- **pkgJson.types** : ne pas le supprimer en « nettoyant » package.json — il est
  porteur pour le converter. Si un jour Vito publie de vrais `.d.ts`, repointer.
- **Fonts** : Inter/Newsreader viennent de la CSS scrapée du storybook (next/font
  injecté au build SB). Si la fondation `.storybook` change la gestion des fonts,
  rebuild `.design-sync/sb-reference` avant de re-grader.
- **Nouvelles primitives** : ajouter l'export au barrel `entry.tsx` (sinon non
  bundlé) ET une story `Kit/<Name>` (sinon non découvert).
