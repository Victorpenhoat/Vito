# Polish P1 — Cœur carnet (Restos, Vins, Recherche) — Design

**Date :** 2026-06-24
**Statut :** Validé (direction : appliquer le kit Core.Badakan). Plan à suivre.
**Branche :** `polish-p1`

---

## 0. Contexte

Première des 4 slices de **polish des écrans métier** (après la refonte A/B/C : design system + shell +
dashboard). Les écrans métier héritent déjà du thème sombre et de la navigation, mais leur **mise en page
interne** est encore en Tailwind ad-hoc (`bg-black text-white`, `border p-2`, `text-2xl font-bold`,
`text-gray-500`). P1 applique le **kit Core.Badakan** (Slice A) aux écrans **Restos, Vins, Recherche**.

**Invariant absolu :** **polish visuel uniquement.** Aucun changement de logique, de requête, d'action,
ni de `data-testid`. Les server actions, queries, props et identifiants de test restent identiques → la
suite e2e existante reste verte sans modification.

## 1. Décisions de cadrage (validées)

| Sujet | Décision |
|-------|----------|
| Direction | Appliquer le kit (Slice A) — pas de nouveau design. |
| Ordre | P1 = **Restos, Vins, Recherche** (cœur d'usage quotidien). |
| Contrainte | **Visuel only** : conserver chaque `data-testid`, chaque action/query, chaque comportement. |
| Réutilisable | Introduire `PageHeader` (kit) pour le motif d'en-tête de page répété, utilisable par toutes les slices de polish. |

## 2. Règles de mapping (bricolage → kit)

Appliquées dans **chaque** composant des écrans P1 :

| Avant (ad-hoc) | Après (kit / token) |
|---|---|
| `<button className="bg-black text-white p-2 …">` (submit/action) | `<Button>` (`variant="primary"` par défaut ; `variant="ghost"`/`"subtle"` pour secondaire), `pending`/`disabled` conservés |
| Conteneur de carte/ligne `border p-3` / `border p-2` | `<Card>` (ou classe `rounded-card border-line bg-surface`) |
| `text-2xl font-bold` (titre de page) | `<PageHeader>` (cf. §3) |
| `text-gray-500/600/700` | `text-muted` (secondaire) / `text-faint` (discret) |
| `<input className="border p-2">` | `rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:outline-2 focus:outline-accent` |
| pastille de compteur / statut | `<Badge>` |
| valeurs chiffrées « highlight » (notes, prix, compteurs mensuels) | `<Tile tone=…>` quand c'est un KPI ; sinon `text-accent`/`text-ink` |
| liens | `text-accent hover:underline` |

- Ne PAS introduire de logique ; ne PAS renommer/retirer un `data-testid` ; ne PAS toucher aux imports
  de data/actions.
- Réutiliser le kit existant (`Button`, `Card`, `Badge`, `Tile`, `SectionLabel`) ; `Link` reste
  `@/lib/i18n/routing`.

## 3. Nouveau composant kit `PageHeader` (`src/features/shared/ui/PageHeader.tsx`)

Motif d'en-tête répété sur chaque page (`<main className="p-6"><h1 className="text-2xl font-bold">…`) :
```tsx
// PageHeader : titre + action optionnelle à droite, espacement cohérent
export function PageHeader({ title, action }: { title: string; action?: ReactNode }): JSX.Element
// rend <header class="flex items-center justify-between gap-3 mb-2"><h1 class="text-2xl font-bold text-ink">{title}</h1>{action}</header>
```
Présentational pur. Utilisé par les pages restos/vins/recherche (et les slices suivantes).

## 4. Écrans & fichiers concernés

- **Restos** : `restos/ui/{RestoList,RestoSearch,FavoriteToggle,TagPicker,AvisForm,FicheResto}.tsx`,
  `reco/ui/GoutsBanner.tsx` (affiché sur la page restos), pages `(app)/restos/page.tsx` &
  `(app)/restos/[id]/page.tsx`.
- **Vins** : `vins/ui/{VinsList,VinsFilters,VinDetail,DegustationForm,BuyButton}.tsx`, pages
  `(app)/vins/page.tsx` & `(app)/vins/[id]/page.tsx`.
- **Recherche** : `reco/ui/{RechercheForm,RechercheResults}.tsx`, page `(app)/recherche/page.tsx`.

(Chaque fichier est relu par l'implémenteur, qui applique les règles §2 en conservant strictement
testids/logique.)

## 5. Sécurité

- Aucun changement de surface : pas de migration, pas de RLS, pas d'action/query modifiée. Le polish ne
  touche que le rendu. Les gardes RBAC/RLS existantes restent intactes.

## 6. Tests

- **Non-régression e2e** : les specs existants (`restos.spec.ts`, `vins.spec.ts`, et les éventuels
  parcours recherche) doivent rester **verts sans modification** (testids/flux inchangés). Si un test
  casse, c'est qu'un testid ou un comportement a bougé → corriger le composant (pas le test).
- **Build/typecheck/lint** verts. Pas de nouveau test unitaire (présentational ; `PageHeader` trivial).
- Vérification visuelle via la prod/preview (sombre + kit cohérents sur les 3 écrans).

## 7. Arbitrages / dette signalés

- Slices de polish suivantes : **P2** (Voyages, Dépenses), **P3** (Famille, Conciergerie, Abonnement,
  Goûts), **P4** (Agence, Admin).
- Refontes fonctionnelles (nouveaux champs, nouvelles vues) : hors périmètre — polish visuel seulement.
- Câblage des vraies données du dashboard (Slice séparée) : indépendant.
