# Storybook DS — Slice B : stories des primitives du kit

**Statut :** approuvé (brainstorming 2026-06-29)
**Prérequis :** Slice A (fondation Storybook) — mergée via PR #55.

## Objectif

Écrire une story Storybook par primitive du design kit (les 12 composants de
`src/features/shared/ui/` au-delà de `Button`, déjà fait en Slice A), en
réutilisant la fondation `.storybook/` sans la modifier. Couverture **une story
par variante visuelle distincte**, pour que le futur `/design-sync` expose au
design agent toutes les variantes réelles du kit.

## Contexte / contraintes (Global Constraints)

- **Fondation réutilisée telle quelle.** Aucun changement à `.storybook/main.ts`,
  `.storybook/preview.tsx`, `.storybook/messages.ts`. Le décorateur fournit déjà :
  `NextIntlClientProvider` (locale `fr`, `storyMessages` avec namespace `shell`),
  wrapper `[data-theme]` (toggle toolbar dark/light, dark par défaut), font Inter,
  `globals.css`.
- **Pattern de story = `Button.stories.tsx`.** `import type { Meta, StoryObj } from "@storybook/nextjs-vite"`,
  `meta.title = "Kit/<Name>"`, `meta.component`, `export default meta`,
  `type Story = StoryObj<typeof X>`, stories nommées en `export const`.
- **Colocalisation.** Chaque fichier : `src/features/shared/ui/<Name>.stories.tsx`.
- **Exports nommés.** Tous les composants sont des exports nommés (pas default) ;
  importer en `{ Name }`.
- **Intl déjà couvert.** Seuls `Modal` (`t("shell.close")`) et `ThemeToggle`
  (`t("shell.theme")`) utilisent next-intl ; les deux clés sont déjà dans
  `storyMessages.shell`. **Ne pas** ajouter de messages.
- **Icônes lucide-react** passées en `args` quand le composant prend une prop
  `icon: ReactNode` (Fab, NavItem, SectionLabel) ; internes pour Modal (`X`) et
  ThemeToggle (`Sun`/`Moon`).
- **Non-régression.** `npm run lint`, `npx tsc --noEmit`, `npm test` (204 tests)
  restent verts. `npm run build-storybook` réussit.
- **Pas de story `Modal Closed`** (rend `null`, rien à montrer — YAGNI).

## Cartographie des composants (référence)

| Composant | Props | Variantes → stories | Dépendances Storybook |
|---|---|---|---|
| Avatar | `{ name: string; size?: "sm"\|"md"\|"lg"\|"xl"; color?: string }` | Sm, Md, Lg, Xl, CustomColor | aucune |
| Badge | `{ className?; children } & HTMLAttributes<HTMLSpanElement>` | Default | aucune |
| Card | `{ className?; children } & HTMLAttributes<HTMLDivElement>` | Default | aucune |
| Tile | `{ tone: "green"\|"blue"\|"amber"\|"violet"; label: string; value: string\|number }` | Green, Blue, Amber, Violet | helper `toneClasses` |
| Toast | `{ type?: "info"\|"success"\|"error"; children }` | Info, Success, Error | aucune |
| PageHeader | `{ title: string; eyebrow?; subtitle?; action?: ReactNode }` | Full, TitleOnly | aucune |
| SectionLabel | `{ icon?: ReactNode; children }` | WithIcon, TextOnly | icône lucide (arg) |
| Skeleton | `{ className?: string }` | Line, Block | aucune |
| Fab | `{ icon: ReactNode; label: string; href?: string; onClick?: () => void }` | AsLink, AsButton | `Link` locale-aware + icône |
| NavItem | `{ icon: ReactNode; label: string; href: string; active?: boolean }` | Active, Inactive | `Link` locale-aware + icône |
| Modal | `{ open: boolean; onClose: () => void; title?: string; children }` | Open | `"use client"`, `useTranslations("shell")`, icône `X` |
| ThemeToggle | `{}` | Default | `"use client"`, `useTranslations("shell")`, DOM `data-theme`, icônes `Sun`/`Moon` |

## Cas particuliers

1. **Fab / NavItem (`Link` locale-aware de `@/lib/i18n/routing`).** On s'appuie
   sur le mock de router fourni par `@storybook/nextjs-vite` + le provider intl du
   décorateur. Attendu : le `Link` rend un `<a>` sans crash. **À vérifier en
   build/headless** ; si le mock ne suffit pas, documenter le contournement dans
   la story (le composant reste rendu). Pour `Fab AsButton`, passer `onClick`
   (pas de `href`) → rendu `<button>`, pas de routing.

2. **ThemeToggle.** Lit `document.documentElement.getAttribute("data-theme")` au
   montage (≠ le wrapper `[data-theme]` du décorateur, qui est plus bas dans le
   DOM). La story rend le bouton (icône Sun/Moon selon l'état de `<html>`). C'est
   acceptable : on montre le composant ; son état visuel suit `<html>`, pas le
   toggle toolbar. Pas de mock supplémentaire.

3. **Modal Open.** `open: true`, `title` renseigné, contenu démo, `onClose` =
   no-op (`() => {}`). L'overlay `fixed` se rend dans le DOM standard (pas de
   portail explicite). Le bouton close affiche `t("shell.close")` = "Fermer".

## Vérification du rendu

Réutiliser le harnais headless de Slice A (servir `storybook-static` via
`python3 -m http.server`, sonder `#storybook-root` avec `@playwright/test`).
Échantillonner **3 stories à risque** :
- `Kit/Tile` Green → couleur de texte = token `--kpi-green` (≠ ink par défaut).
- `Kit/Modal` Open → overlay présent (un élément `fixed` couvrant + dialog visible).
- `Kit/Fab` AsLink → un `<a>` est rendu (le `Link` locale-aware ne crash pas).

Les 9 stories triviales sont validées par le build Storybook vert (compilation +
rendu sans erreur) ; pas de sondage individuel nécessaire.

## Hors scope

- Composants non-primitifs (features `places`, `reco`, `voyages`, `shell`, etc.).
- Modification de la fondation `.storybook/`.
- Lancement du `/design-sync` (slice suivante).
- Tests Vitest pour les composants (déjà couverts par la suite existante).
