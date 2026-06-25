# Slice 1 (épic Le Carnet) — Accueil « Le Carnet » — Design

**Date :** 2026-06-25
**Statut :** Validé. Plan à suivre.
**Branche :** `carnet-accueil`
**Directive :** `docs/design/carnet-refonte-directive.md` · **Fondations :** Slice 0 (mergée)

---

## 0. Contexte

Deuxième slice de l'épic Le Carnet. On re-skinne l'écran **Accueil** (`/accueil`) au style Le Carnet
d'après la maquette `Vito Refonte.dc.html`. **Refonte purement présentationnelle** : toute la donnée
existe déjà (`getDashboardData()` + `greeting()`), aucune requête ni migration ne change. On
s'appuie sur les fondations de la Slice 0 (tokens crème/nuit, serif Newsreader, kit re-skinné).

## 1. Contraintes e2e (NON négociables — `e2e/accueil.spec.ts` doit rester vert sans modification)

- `data-testid="accueil"` visible (le `<main>`).
- `data-testid="hero"` visible **et contient** un texte qui matche `/Bonjour|Bonsoir/`.
- `data-testid="kpi-tiles"` a **exactement 4 enfants directs `> div`** (`locator("> div")` → count 4).
- `data-testid="recent-activity"` visible.
- Un lien de nom accessible **« Demande de conciergerie »** présent dans `accueil` (le `Fab` actuel).

## 2. Layout (maquette Accueil)

`<main data-testid="accueil">` en colonne, fond `--app` (crème/nuit), padding écran.

1. **En-tête** — `data-testid="hero"`, **sans bloc dégradé** (l'ancien `HeroCard` à fond
   `linear-gradient(--hero-from,--hero-to)` est remplacé) :
   - eyebrow : **date courte** en petites capitales accent, ex. « Mardi 25 juin » — via
     `formatter.dateTime(now, { weekday: "long", day: "numeric", month: "long" })`, `capitalize`.
   - salutation : **`h1` serif** `font-serif text-3xl/4xl font-medium text-ink`, forme
     « `{greeting} {firstName}` » — ex. « Bonsoir Victor » (le mot Bonjour/Bonsoir vient de
     `t("greeting.<mode>")`, le prénom de `userName.split(/[\s@]/)[0]`). **Pas d'emoji.**
   - citation : **serif italique** `border-l-[3px] border-accent pl-4 text-muted`, `t("quote")`.
   - (Le compteur « N sorties ce mois » de l'ancien hero est retiré de l'en-tête — l'info vit
     désormais dans le bandeau stats ci-dessous. La clé `sortiesMois` devient inutilisée.)
2. **Bandeau stats** — `data-testid="kpi-tiles"`, rangée **bordée haut+bas** (`border-y border-line`)
   avec **exactement 4 `<div>` enfants directs**, séparés par `border-l border-line` (sauf le 1er) :
   chaque cellule = **grand nombre serif** (`font-serif text-3xl text-ink`) + **label petites
   capitales** (`text-[11px] uppercase tracking-[0.14em] text-faint`). Ordre et valeurs identiques à
   l'actuel : Sorties (`kpis.sorties`), Nouveaux restos (`kpis.nouveauxRestos`), Vins goûtés
   (`kpis.vinsGoutes`), Dépenses voyage (`${Math.round(kpis.depensesVoyageCents/100)} €`). Empilé en
   2×2 sur mobile, 4 colonnes en `md:`. (Remplace les `Tile` colorés ; `Tile` reste dans le kit.)
3. **Deux colonnes** — `grid md:grid-cols-[1.5fr_1fr] gap` :
   - **Activité récente** (gauche) : `SectionLabel` « Activité récente » + liste
     `data-testid="recent-activity"` : chaque ligne = `label` (ink) + temps relatif
     (`formatter.relativeTime`) en `text-faint`, séparateur `border-b border-line-soft`. État vide :
     `t("activity.vide")` (le `recent-activity` reste présent dans les deux cas).
   - **Aside** (droite) : deux `Card` du kit empilées —
     - **À faire** : `SectionLabel` `t("sections.todo")` + 3 lignes (`todo.restosATester` /
       `voyagesAVenir` / `conciergerieEnAttente`) avec libellé + `Badge` compteur.
     - **À découvrir** : `SectionLabel` `t("sections.discoveries")` + liste (max 3) : nom en serif
       (`font-serif text-ink`) + sous-ligne `t("discoveries.suggested") · {ville}` en `text-muted` ;
       état vide `t("discoveries.vide")`.
4. **Fab conciergerie** conservé (`Fab href="/conciergerie" label={t("fab")}`) — satisfait l'e2e,
   affordance mobile.

Le lien « + Ajouter un resto » actuel (`t("addResto")`) est conservé sous l'en-tête (ou intégré
discrètement) — non requis par l'e2e mais utile ; le garder évite une régression fonctionnelle.

## 3. Composants / fichiers

- **`src/features/accueil/ui/HeroCard.tsx`** — réécrit : rend l'en-tête sans dégradé (eyebrow date +
  salutation serif + citation), `data-testid="hero"` conservé. Reçoit `userName` (le compteur
  `sorties` n'est plus nécessaire — adapter la signature ; le seul appelant est `accueil/page.tsx`).
- **`src/features/accueil/ui/StatsRow.tsx`** (nouveau, présentational) — reçoit les 4 stats
  `{ label, value }[]` et rend la rangée bordée (`data-testid="kpi-tiles"`, 4 `<div>`).
- **`src/app/[locale]/(app)/accueil/page.tsx`** — recomposé selon le layout §2 : `HeroCard`,
  `StatsRow`, grille 2 colonnes (activité / aside À faire + À découvrir), `Fab`. Réutilise
  `getDashboardData()` tel quel.
- Pas de changement dans `data/queries.ts`, `greeting.ts`, `monthRange.ts`.

## 4. i18n (4 locales, parité garantie par `messages-parity.test.ts`)

- **Ajout** : `accueil.discoveries.suggested` — FR « Suggéré » · EN « Suggested » · IT « Suggerito »
  · ES « Sugerido ».
- Clés réutilisées telles quelles : `greeting.*`, `quote`, `sections.*`, `todo.*`, `kpi.*`,
  `activity.vide`, `discoveries.vide`, `addResto`, `fab`. `sortiesMois` devient inutilisée
  (laissée en place pour ne pas casser la parité ; suppression hors-scope).

## 5. Sécurité

- Lecture seule via `getDashboardData()` (RLS owner déjà en place). Aucune action serveur, aucune
  requête, aucune migration, aucun secret touchés.

## 6. Tests

- **Unit** : `typecheck && lint && test` verts (125). Parité i18n verte (clé `suggested` × 4).
  `greeting.test.ts` inchangé (la logique `greeting()` ne bouge pas).
- **e2e** : `e2e/accueil.spec.ts` **vert sans modification** (cf. §1). Suite complète verte. Un
  `db reset` avant.
- **Build** : `npm run build` OK.
- Pas de nouveau test requis (re-skin présentationnel) ; si un sélecteur changeait, on corrige le
  composant, pas le test — mais l'objectif est zéro changement de testid.

## 7. Arbitrages / dette

- `Tile` (tuiles colorées KPI) n'est plus utilisé par l'Accueil mais **reste dans le kit** (autres
  usages potentiels) ; nettoyage éventuel hors-scope.
- `sortiesMois` (clé i18n) devient inutilisée → laissée pour la parité ; retrait différé.
- Le compteur « sorties ce mois » migre de l'en-tête vers le bandeau stats (déjà présent comme KPI
  « Sorties ») — pas de perte d'information.
- Les recommandations « À découvrir » restent celles de `rechercheRestos({})` (logique inchangée).
