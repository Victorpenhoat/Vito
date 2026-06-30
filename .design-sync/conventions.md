# Vito Kit — conventions

Primitives UI de l'app **Vito** (`window.VitoKit.*`). React 19 + Tailwind v4,
**dark-first**. Toutes les couleurs/rayons/espacements passent par des tokens CSS.

## Contexte requis

- **Thème** : les composants lisent des tokens définis sous `[data-theme="dark"]`
  (ou `"light"`). Monte tes écrans dans un ancêtre `<div data-theme="dark">` —
  sinon les couleurs (`--app`, `--ink`, `--accent`, …) ne résolvent pas.
- **i18n** : `Modal` et `ThemeToggle` utilisent next-intl (namespace `shell` :
  `close`, `theme`). Ils doivent être sous un `NextIntlClientProvider`. `Fab` et
  `NavItem` rendent un lien locale-aware via `href`.
- **Typo** : sans = Inter (`--font-sans`), serif = Newsreader (`--font-serif`,
  utilisé par les titres de `PageHeader`).

## Composants

- **Button** — `variant: "primary" | "ghost" | "subtle"`, `pending?`.
- **Input** — champ texte ; `label?`, `error?` (bordure/texte danger) + attributs `<input>` natifs.
- **Select** — liste de sélection (`<option>` en `children`) ; `label?`, `error?` (bordure/texte danger) + attributs `<select>` natifs ; chevron ▾ custom.
- **Avatar** — `name`, `size: "sm"|"md"|"lg"|"xl"`, `color?` (initiales auto).
- **Badge** — pastille ; `children`.
- **Card** — conteneur `rounded-card` bordé ; `children`.
- **Tile** — KPI ; `tone: "green"|"blue"|"amber"|"violet"`, `label`, `value`.
- **Toast** — `type: "info"|"success"|"error"`, `children`.
- **PageHeader** — `title` (serif), `eyebrow?`, `subtitle?`, `action?` (slot).
- **SectionLabel** — petit label capitales ; `icon?`, `children`.
- **Skeleton** — placeholder pulsant ; dimensions via `className`.
- **Fab** — bouton flottant rond ; `icon`, `label`, `href?` (lien) ou `onClick?`.
- **NavItem** — entrée de nav ; `icon`, `label`, `href`, `active?`.
- **Modal** — dialog en overlay ; `open`, `onClose`, `title?`, `children`.
- **ThemeToggle** — bascule dark/light (aucune prop).

Les icônes (`Fab`, `NavItem`, `SectionLabel`) sont passées en `ReactNode`
(lucide-react dans l'app).
