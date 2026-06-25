# Slice 3 (épic Le Carnet) — Vins : vignettes + onglets couleur + fiche hero — Design

**Date :** 2026-06-25
**Statut :** Validé (décisions PO). Plan à suivre.
**Branche :** `carnet-vins`
**Directive :** `docs/design/carnet-refonte-directive.md` · **Fondations :** Slices 0/1/2 (mergées)

---

## 0. Contexte

On re-skinne l'écran **Vins** (liste + fiche) au style Le Carnet. **Sans migration, sans photo**
(les vins sont créés par l'utilisateur, sans `place_id`/Google) : les vignettes utilisent un
**placeholder coloré par couleur**. Décisions PO : **onglets de couleur** en filtre primaire +
**filtres secondaires conservés** (région/note/dates) ; note **/5** (modèle de données) conservée.

## 1. Contraintes e2e (`e2e/vins.spec.ts`)

Préserver : `vin-row` (+ lien interne), `degustation-form`, `buy-button`, `degustation-row`.
**Seule modification autorisée** : le filtre couleur passe d'un `<select>` dans `vins-filters` à un
**onglet** → mettre à jour la ligne qui faisait `vins-filters … select … selectOption("blanc")` pour
cliquer l'onglet couleur « Blanc ». Le reste du parcours (capturer un vin depuis une fiche resto,
le retrouver, filtrer, ouvrir le détail, `buy-button`) inchangé. Ne jamais affaiblir un test.

## 2. Couleurs & placeholder (`src/features/vins/domain/couleurTint.ts`)

`VIN_COULEURS = ["rouge","blanc","rose","petillant","autre"]` (labels i18n `vins.couleurs.*` déjà
présents ; « Tous » = `vins.filtres.tous`). Helper pur **`couleurTint(couleur)`** → un dégradé CSS
par couleur, pour le bandeau de vignette et le hero (fallback neutre `--hero-from/--hero-to`) :
- `rouge` → grenat profond ; `blanc` → or pâle ; `rose` → rosé ; `petillant` → or clair ;
  `autre`/null → dégradé neutre tokens. (Valeurs hex exactes fixées au plan.)
Testable (entrée couleur → chaîne attendue non vide ; couleur inconnue → fallback).

## 3. Filtrage

- **`VinsCouleurTabs`** (nouveau, client) : onglets **Tous + chaque couleur** ; l'onglet actif reflète
  le param d'URL `couleur` ; un clic met à jour le searchParam `couleur` (via `router.replace`, comme
  `VinsFilters`) → `VinsList` (serveur) re-filtre. testids : `vin-tab-tous` + `vin-tab-{couleur}`,
  `aria-selected` sur l'actif. Libellés via `vins.filtres.tous` / `vins.couleurs.{couleur}`.
- **`VinsFilters`** : **retirer le `<select>` couleur** (déplacé en onglets) ; **conserver** région,
  note min, dates, reset. `data-testid="vins-filters"` conservé. (Filtrage serveur via searchParams
  inchangé : `getMesVins`/`filtersToQuery` non modifiés.)

## 4. UI liste (`VinsList`)

Grille responsive (1 col / 2 col `md:`) de **vignettes** (chaque `<li data-testid="vin-row">`
conservé, devient une carte) :
- bandeau coloré `couleurTint(v.couleur)` (pas de photo) ;
- eyebrow petites capitales : `region · couleur` (libellés i18n) ;
- **nom serif** + millésime ;
- pied : `derniere_note/5` (si présente) + `vins.fois` (nb dégustations) ;
- lien interne vers `/vins/{id}` (conservé). État vide `vins.vide`.

## 5. UI fiche (`VinDetail`)

- **Hero** coloré `couleurTint(vin.couleur)` (pas de photo) : eyebrow `region · couleur` + **titre
  serif** `vin.nom` (+ millésime) en surimpression.
- **Aside « Fiche »** (Card kit) : millésime / cépages / région (réutilise les données déjà
  chargées). `BuyButton` conservé.
- Section **dégustations** : liste `degustation-row` conservée (date · note/5 · prix · commentaire).
- Testids `degustation-row`, `buy-button` conservés ; `DegustationForm` (`degustation-form`) intact.

## 6. Page (`vins/page.tsx`)

`PageHeader` avec **eyebrow** `vins.eyebrow` (« La cave ») + titre `vins.title` + **subtitle** =
`vins.compte` (nombre de vins). Puis `VinsCouleurTabs`, `VinsFilters`, `VinsList`. Le nombre de vins
pour le subtitle vient d'un appel léger (ou de la longueur de la liste — décidé au plan, sans
double requête lourde).

## 7. i18n (4 locales, parité garantie)

Ajouts : `vins.eyebrow` (FR « La cave » · EN « The cellar » · IT « La cantina » · ES « La bodega ») ;
`vins.compte` (FR « {n} vins » · EN « {n} wines » · IT « {n} vini » · ES « {n} vinos »). Réutilise
`vins.couleurs.*`, `vins.filtres.*`, `vins.fois`, `vins.vide`, `vins.title`. Pas de chaîne en dur.

## 8. Sécurité

- Lecture seule (RLS owner sur `vins`/`degustations` déjà en place). Aucune action serveur, requête
  ou migration modifiée. Pas de photo, pas d'appel externe nouveau.

## 9. Tests

- **Unit** : `couleurTint` (couleur connue → non vide ; inconnue/null → fallback). typecheck+lint+test
  verts. Parité i18n verte (`eyebrow`/`compte` × 4).
- **e2e** : `vins.spec.ts` — couleur filtrée via l'onglet « Blanc » (au lieu du select) ; reste du
  parcours vert. Suite complète verte. Un `db reset` avant.
- **Build** : OK.

## 10. Arbitrages / dette

- **Pas de photo de vin** (placeholder coloré) — pas d'infra photo pour les vins (assumé).
- Note **/5** conservée (modèle de données ; la maquette illustrait /20 — non retenu).
- Pas de bouton « Noter un vin » sur la liste (l'ajout d'une dégustation se fait depuis la fiche
  resto, flux inchangé) — la maquette l'affichait, hors périmètre ici.
- Filtres secondaires (région/note/dates) gardés tels quels (pas de régression) ; harmonisation fine
  de leur style possible plus tard.
