# Refonte Core.Badakan — Slice C : Écran d'accueil de référence — Design

**Date :** 2026-06-24
**Statut :** Validé (direction). Plan d'implémentation à suivre.
**Branche :** `dashboard`

---

## 0. Contexte

Troisième et dernière slice de la refonte Core.Badakan. Remplace le stub `/accueil` (Slice B) par le
**dashboard d'accueil de référence** qui fige l'esthétique « dashboard Badakan » : hero dégradé,
sections (À FAIRE / CE MOIS-CI / DÉCOUVERTES), activité récente, FAB. Réutilise le kit (Card, Tile,
SectionLabel, Badge, Fab) et les tokens. **Données mockées** (le but est l'esthétique ; le câblage aux
vraies requêtes viendra plus tard), **sauf la salutation** (vrai prénom de la session + heure).

## 1. Décisions de cadrage (validées)

| Sujet | Décision |
|-------|----------|
| Données | **Mockées** (module dédié), pour figer le visuel. Câblage réel = slice ultérieure. |
| Salutation | **Réelle** : « Bonjour/Bonsoir {prénom} » selon l'heure (helper pur testé) + date du jour. Prénom = `display_name` (déjà fourni au shell) ou e-mail. |
| Home | **Repointer le post-login + l'accueil connecté vers `/accueil`** (le dashboard devient la home). |
| FAB | Action rapide → `/conciergerie` ; positionné **au-dessus de la bottom-nav** sur mobile (`bottom-20 md:bottom-6`) pour ne pas la chevaucher. |
| i18n | Labels/section/greeting via next-intl (namespace `accueil`, 4 locales). Le **contenu mocké** (noms de restos, citation, activité) vit dans un module mock (texte FR — donnée factice, pas du chrome). |

## 2. Repointage de la home (`actions.ts`, landing)

- `src/features/auth/data/actions.ts` : `signIn` et `signUp` → `redirect({ href: "/accueil", locale })`
  (au lieu de `/restos`).
- `src/app/[locale]/page.tsx` (landing) : redirection des connectés → `/accueil`.

## 3. Données mockées (`src/features/accueil/mock.ts`)

Objets typés, sans logique :
- `MONTHLY_KPIS: { key: "sorties"|"nouveauxRestos"|"vinsGoutes"|"depensesVoyage"; tone: Tone; value: string|number }[]`
  (ex. 12, 4, 7, « 320 € »).
- `TODO: { icon: NavKey-like; labelKey: string; count: number }[]` (Restos à tester 5, Voyages à venir 2,
  Vins à racheter 3) — les libellés via i18n `accueil.todo.*`.
- `DISCOVERIES: { title: string; source: string }[]` (titres factices FR).
- `ACTIVITY: { title: string; agoKey: string }[]` (texte factice + horodatage relatif via i18n
  `accueil.activity.ago` paramétré, ou libellés simples).
- `SORTIES_THIS_MONTH = 12` (badge discret du hero).

(Le mock est volontairement statique ; aucune date dynamique dedans.)

## 4. Helper salutation (`src/features/accueil/greeting.ts` + test)

```ts
export function greeting(hour: number): "bonjour" | "bonsoir"; // bonsoir si hour >= 18 ou < 5, sinon bonjour
```
Pur, testé. La page (server component) l'appelle avec l'heure serveur (`new Date().getHours()`) — la clé
i18n `accueil.greeting.bonjour|bonsoir` fournit le texte, suivi du prénom.

## 5. Page dashboard (`src/app/[locale]/(app)/accueil/page.tsx`) + sous-composants

Server component (récupère prénom via la session, comme le layout). Structure :
- `HeroCard` : carte pleine largeur, `bg-[linear-gradient(135deg,var(--hero-from),var(--hero-to))]`,
  `rounded-card`. Salutation (greeting + prénom + emoji 🌙/☀️), date du jour (i18n date), citation avec
  **barre d'accent à gauche** (`border-l-4 border-accent pl-3`), et en haut à droite « {n} sorties ce
  mois » + 3 étoiles (lucide `Star`).
- Lien d'action sous le hero : « + Ajouter un resto » → `/restos`.
- Grille 3 colonnes (`grid gap-4 md:grid-cols-3`) :
  - `ToDoCard` (`Card` + `SectionLabel` « À FAIRE ») : lignes (icône + libellé i18n + `Badge` compteur).
  - `MonthlyCard` (`SectionLabel` « CE MOIS-CI ») : grille 2×2 de `Tile` (label i18n + valeur).
  - `DiscoveriesCard` (`SectionLabel` « DÉCOUVERTES ») : lignes (titre + source).
- `RecentActivity` : `Card` pleine largeur (`SectionLabel` « ACTIVITÉ RÉCENTE ») : lignes (icône + titre +
  horodatage relatif).
- `Fab` (kit) : `/conciergerie`, `bottom-20 md:bottom-6` (au-dessus de la bottom-nav mobile).
- Sous-composants dans `src/features/accueil/ui/`. `data-testid` : `accueil` (sur le `<main>`),
  `hero`, `kpi-tiles`, `recent-activity`.

## 6. i18n (`accueil` namespace, 4 locales)

Étendre `accueil` : `greeting.bonjour/bonsoir`, `quote`, `sortiesMois` (paramétré `{n}`),
`addResto`, `sections.todo/month/discoveries/activity`, `todo.{restosATester,voyagesAVenir,vinsARacheter}`,
`kpi.{sorties,nouveauxRestos,vinsGoutes,depensesVoyage}`. Ajouter en FR puis traduire dans en/it/es
(comme Slice B). Date via `next-intl` `useFormatter`/`format.dateTime` (locale-aware), pas de date en dur.

## 7. Sécurité

- `/accueil` est sous `(app)` → garde `requireRole` du shell conservée. Le prénom vient de la session.
  Aucune donnée réelle d'autres modules (tout est mock). Pas de migration, pas de DB.

## 8. Tests

- **Unit (Vitest)** : `greeting(hour)` — `bonsoir` à 20h/2h, `bonjour` à 9h/14h, bornes 18h→bonsoir,
  5h→bonjour, 17h→bonjour.
- **e2e (Playwright)** : connecté (`client@vito.test`) → après login l'URL est `/fr/accueil` (repointage) ;
  `accueil` visible ; `hero` contient le prénom et une salutation ; `kpi-tiles` montre 4 tuiles ;
  `recent-activity` visible ; le FAB (lien vers `/conciergerie`) est présent. Signaux déterministes.
- **Mise à jour obligatoire des helpers de login existants** : ~15 specs e2e assertent `toHaveURL(/\/fr\/restos/)`
  après connexion. Le repointage vers `/accueil` les casse → remplacer dans **chaque** spec concerné
  `toHaveURL(/\/fr\/restos/)` par `toHaveURL(/\/fr\/accueil/)` (et, si un test enchaînait sur du contenu
  `/restos`, ajouter un `page.goto("/fr/restos")` explicite). C'est une **désambiguïsation mécanique**,
  pas un affaiblissement. La suite complète doit repasser verte.

## 9. Arbitrages / dette signalés

- **Câblage des vraies données** (KPI/à-faire/activité/découvertes depuis les modules) → slice ultérieure
  (le dashboard est aujourd'hui mocké).
- **Polish interne des écrans métier** (restos/voyages/dépenses…) → slices ultérieures (objet de la suite
  de la refonte).
- Personnalisation des découvertes (reco réelle) ; widgets configurables → différés.
- Greeting basé sur l'heure **serveur** (imprécision de fuseau acceptable pour une salutation).
