# Slice 0 (épic Le Carnet) — Fondations design (tokens + kit + shell) — Design

**Date :** 2026-06-25
**Statut :** Validé (décisions épic). Plan à suivre.
**Branche :** `carnet-fondations`
**Directive :** `docs/design/carnet-refonte-directive.md`

---

## 0. Contexte

Première slice de l'épic « Le Carnet ». On remplace les **fondations** du design system
Core.Badakan par Le Carnet, **sans toucher au contenu des écrans métier**. Le système est déjà
piloté par variables CSS (`--app/--surface/--line/--ink/--muted/--faint/--accent/--badge`) mappées
via `@theme` dans `globals.css`, donc re-skinner = changer les **valeurs**, ajouter une **serif**,
**arrondir moins**, et adapter le **kit** (`features/shared/ui/`) + le **shell**
(`features/shell/`). Les noms de tokens sont **conservés** pour que tous les composants héritent.

**Filet de sécurité :** refonte **visuelle pure**. Tous les `data-testid` et le texte des écrans
restent identiques → la **suite e2e reste verte sans modification**. Aucune migration.

## 1. Tokens (`src/app/globals.css`)

Remplacer les **valeurs** des blocs `:root,[data-theme="dark"]` (sombre, défaut) et
`[data-theme="light"]` par les palettes Le Carnet. **Conserver les noms de variables existants**
(et donc les mappings `@theme`). Le défaut reste **sombre**.

**Sombre (`:root, [data-theme="dark"]`) :**
```
--app:#161310; --sidebar:#110E0A;
--surface:#1E1A14; --surface-hover:#26211A;
--line:rgba(255,255,255,0.08); --line-soft:rgba(255,255,255,0.06);
--accent:#4F8BF0; --accent-hover:#6BA0F5;
--accent-50:rgba(79,139,240,0.14); --accent-600:#6BA0F5;
--ink:#F2EDE3; --muted:#A39A8A; --faint:#6E665A;
--badge:#26211A; --gold:#E9B949;
--kpi-green:#7BE0A0; --kpi-green-bg:rgba(34,197,94,0.14);
--kpi-blue:#4F8BF0;  --kpi-blue-bg:rgba(79,139,240,0.14);
--kpi-amber:#E9B949; --kpi-amber-bg:rgba(233,185,73,0.14);
--kpi-violet:#C9A0F5;--kpi-violet-bg:rgba(168,85,247,0.14);
--hero-from:#26211A; --hero-to:#161310;
```

**Clair (`[data-theme="light"]`) :**
```
--app:#FBF9F3; --sidebar:#F4F1E9;
--surface:#FFFFFF; --surface-hover:#F4F1E9;
--line:#E4DDD0; --line-soft:#F0EBE0;
--accent:#2563EB; --accent-hover:#1D4ED8;
--accent-50:#E6EDFC; --accent-600:#1D4ED8;
--ink:#211E1A; --muted:#7A736A; --faint:#9A9081;
--badge:#F0EBE0; --gold:#E9B949;
--kpi-green:#15803D; --kpi-green-bg:#E7F2EB;
--kpi-blue:#2563EB;  --kpi-blue-bg:#E6EDFC;
--kpi-amber:#B45309; --kpi-amber-bg:#FBF0DF;
--kpi-violet:#9333EA;--kpi-violet-bg:#F3E8FF;
--hero-from:#E4DDD0; --hero-to:#FBF9F3;
```

**`@theme` (ajouts/changements) :**
- Ajouter `--color-line-soft: var(--line-soft);` et `--color-gold: var(--gold);`.
- **Arrondis éditoriaux** : `--radius-card: 4px;` (était 18px), `--radius-tile: 4px;` (était 14px),
  ajouter `--radius-control: 3px;`.
- **Serif** : ajouter `--font-serif: var(--font-newsreader), Georgia, serif;` (le `--font-sans`
  Inter reste le défaut du `body`).

## 2. Fonts (`src/app/[locale]/layout.tsx`)

Ajouter Newsreader à côté d'Inter :
```ts
import { Inter, Newsreader } from "next/font/google";
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const newsreader = Newsreader({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-newsreader" });
```
Appliquer les deux variables sur `<html className={...}>` :
`className={`${inter.variable} ${newsreader.variable}`}`. Body inchangé (reste Inter). Le titre
serif s'obtient via la classe `font-serif` (Tailwind, depuis `--font-serif`).

## 3. Kit (`src/features/shared/ui/`)

Re-skin **visuel** uniquement ; **signatures et `data-testid` inchangés**.

- **`Card`** — `rounded-card` (= 4px désormais) ; bordure `border-line`, fond `bg-surface`. Inchangé
  par ailleurs (le token fait le travail).
- **`Button`** — `rounded-xl` → `rounded-control` (3px). Variantes conservées (`primary` bleu plein,
  `ghost`, `subtle`). Texte `font-semibold`.
- **`NavItem`** — actif = `bg-surface text-ink font-semibold` + **liseré gauche accent**
  (`border-l-2 border-accent`) ; inactif `text-muted hover:bg-surface-hover`. Coins
  `rounded-control`. `aria-current`/`data-testid` conservés.
- **`PageHeader`** — adopter le motif Le Carnet **en élargissant l'API** (rétrocompatible) :
  ```ts
  function PageHeader({ title, eyebrow, subtitle, action }:
    { title: string; eyebrow?: string; subtitle?: string; action?: ReactNode })
  ```
  Rendu : `eyebrow` en petites capitales accent (si présent) ; `h1` **serif** (`font-serif`,
  `text-3xl/4xl font-medium text-ink`) ; `subtitle` en `text-muted` (si présent). Le slot `action`
  reste à droite. Les appels existants (`title` + éventuel `action`) fonctionnent tels quels — seul
  le H1 passe en serif.
- **`SectionLabel`** — couleur `text-faint` (au lieu de `text-muted`), `tracking` plus large
  (`tracking-[0.14em]`), reste uppercase 11px. API inchangée.
- **`Badge`** — pastille `rounded-full` conservée (déjà conforme). Le fallback couleur via `style`
  (utilisé par les tags resto) reste intact.
- Les autres (`Avatar`, `Fab`, `Modal`, `Toast`, `Tile`, `ThemeToggle`) : seulement les arrondis/
  couleurs hérités des tokens ; ajuster `rounded-*` codés en dur vers `rounded-control`/`rounded-card`
  si visuellement nécessaire, **sans changer leur API ni leurs testids**.

## 4. Shell (`src/features/shell/`)

- **`nav-config.ts`** — ajouter un champ `group` aux entrées :
  `type NavGroup = "carnet" | "voyages" | "cercle";` et `group: NavGroup` sur chaque `NavEntry`.
  Répartition : `accueil/restos/vins/recherche → carnet` ; `voyages/depenses → voyages` ;
  `famille/conciergerie/abonnement → cercle` ; `agence/admin → cercle` (en bas, RBAC inchangé via
  `roles`). `BOTTOM_KEYS` et `filterNav` **inchangés**.
- **`Sidebar`** — entête : wordmark `VITO` (gras, tracking large) + sous-titre serif italique
  « le carnet » (clé i18n `app.tagline`). Nav rendue **par groupes** : pour chaque groupe non vide,
  un libellé en petites capitales (`t("nav.group.<g>")`) puis ses `NavItem`. `data-testid="sidebar"`
  et `nav-<key>` **conservés**.
- **`Drawer`** (mobile « plus ») — mêmes groupes que la Sidebar (réutiliser le même rendu groupé).
  `BottomNav` (4 clés) **inchangé**.
- **`ShellFooter`** — avatar initiales (cercle) + nom + rôle ; couleurs alignées aux tokens. API
  inchangée.

## 5. i18n (`messages/{fr,en,it,es}.json`)

Ajouter (parité garantie par `messages-parity.test.ts`) :
- `app.tagline` — FR « le carnet » · EN « the journal » · IT « il taccuino » · ES « el cuaderno ».
- `nav.group.carnet` / `nav.group.voyages` / `nav.group.cercle` — FR « Carnet / Voyages / Cercle » ;
  EN « Journal / Trips / Circle » ; IT « Taccuino / Viaggi / Cerchia » ; ES « Cuaderno / Viajes /
  Círculo ». Pas de chaîne en dur.

## 6. Sécurité

- Aucune migration, aucune action serveur, aucune requête modifiées. RLS/grants intacts.
- Fonts auto-hébergées par `next/font` (pas d'appel CDN externe). Toggle/cookie thème inchangés.

## 7. Tests

- **Unit** : `npm run typecheck && lint && test` verts. `messages-parity` vert (nouvelles clés sur
  les 4 locales). `helpers.test.ts` du kit reste vert.
- **e2e (non-régression)** : suite complète **verte sans modifier les specs** — testids/texte
  inchangés (`sidebar`, `nav-*`, `app-shell`, headers de page, `tags-saved`, `place-card`, etc.).
  Un `db reset` avant la suite.
- **Build** : `npm run build` OK.
- Pas de nouveau test e2e requis (refonte visuelle) ; tests unitaires seulement si un helper change.

## 8. Arbitrages / dette

- Le **contenu** des écrans (dashboard, restos, vins…) ne change pas ici — chaque slice ultérieure
  re-skinne son écran en s'appuyant sur ce kit. Le H1 serif via `PageHeader` est la seule
  modification visuelle qui se propage immédiatement à tous les écrans (intentionnel).
- La **carte photo** (vignette resto) n'est PAS dans le kit Slice 0 — elle est spécifique et arrive
  en Slice 2.
- KPI tokens retunés « au mieux » ; ajustement fin possible lors de la Slice Accueil.
- Composants peu arrondis : si un composant hors-scope paraît incohérent, on le corrige dans sa
  slice, pas ici.
