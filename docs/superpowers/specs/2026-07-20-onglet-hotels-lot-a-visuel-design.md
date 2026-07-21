# Spec — Lot A : polish visuel onglet Hôtels (+ Restos partagé)

> Épic « Refonte Resto + Hôtels » (directive `docs/design/restos-hotels-refonte-epic-directive.md`).
> Fait suite au Slice 7 (onglet Hôtels paramétré). Maquettes : `docs/design/Onglet_Hotels.dc.html`
> et `docs/design/Onglet_Resto.dc.html` (mêmes patterns → composant partagé).

## Objectif

Refermer les 3 écarts visuels prioritaires entre les maquettes et l'implémentation réelle de
l'onglet Favoris (mobile + web), identifiés par l'audit du 2026-07-20 :

1. **Vue Liste** : lignes horizontales compactes à miniature 72px (aujourd'hui : cartes verticales `h-40`).
2. **État vide** riche : icône + titre serif + texte + CTA (aujourd'hui : `<p>` générique).
3. **Header** : eyebrow « Mon carnet » + titre conforme maquette + h1 web agrandi.

Les composants (`PlaceCard`, `PlaceListPanel`, `PageHeader`) sont **partagés restos + hôtels**. Les
deux maquettes décrivant les mêmes patterns, on fait évoluer le composant partagé (libellés
paramétrés par catégorie), **pas de fork** hôtel-only. Restos bénéficie donc du même polish, conforme
à sa propre maquette.

## Périmètre

**Migration-free** : aucun changement de schéma DB, aucune server action, aucune nouvelle donnée.
UI + i18n uniquement.

### Décisions PO (validées le 2026-07-20)

1. **Scope = Lot A** (les 3 sections ci-dessous). Le reste des écarts de l'audit est déféré.
2. **Impact restos assumé** : eyebrow, titre, vue Liste et état vide changent aussi pour restos
   (conforme à `Onglet_Resto.dc.html`).
3. **Titres conformes maquette** : `hotels.title` → « Hôtels » ; `restos.title` → « Restaurants ».
4. **Classe étoiles hôtel (★★★★) : hors périmètre** — cohérent avec la décision PO du Slice 7
   (`showStarClass` reste `false`, aucune donnée source). La ligne Liste hôtel n'affiche donc pas
   d'étoiles de classe ; réouvrable si une source fiable apparaît.

### Hors lot (déférés)

- Points d'ajout : FAB mobile, bouton « Ajouter » header web, tuile « Ajouter une adresse ».
- Carte : carte flottante « Voir la fiche → » + pins teardrop stylisés (aujourd'hui : popup Leaflet nu).
- Indicateur favori en cœur bleu (reste ★ or) ; bouton filtre sliders ; compteur « N favoris ».
- Skeleton de chargement en lignes (reste grille de cartes).
- Classe étoiles hôtel (lot data séparé).

## Design par section

### Section 1 — Header (#4)

`src/features/shared/ui/PageHeader.tsx` accepte déjà une prop `eyebrow` (non utilisée aujourd'hui).

- `src/app/[locale]/(app)/hotels/page.tsx` et `.../restos/page.tsx` : passer `eyebrow={t("...")}`
  avec une clé i18n commune « Mon carnet » (ex. `nav.eyebrowCarnet`, réutilisable).
- Renommer `hotels.title` → « Hôtels », `restos.title` → « Restaurants » (fichiers i18n `fr.json`
  et toute autre locale présente).
- `PageHeader` : h1 responsive `text-3xl lg:text-4xl` (≈30px mobile → ≈38px web) pour coller au web.

**Interface** : `PageHeader({ title, eyebrow? , action? })` inchangée hormis l'usage de `eyebrow`.

### Section 2 — État vide (#2)

Remplacer le `<p className="text-sm text-muted">{t("empty")}</p>` (`PlaceListPanel.tsx:100`) par un
composant `PlaceEmptyState` :

- **Structure** : cercle icône (maison = hôtel, couverts = resto, choisi via `categoryConfig`),
  titre serif, paragraphe descriptif, bouton CTA accent.
- **Libellés par catégorie ET par onglet** : Favoris et Recommandés ont un vide distinct dans la
  maquette restos. Clés i18n `places.empty.favoris.{title,body,cta}` et
  `places.empty.recommandes.{title,body,cta}`, avec interpolation de la catégorie pour le CTA
  (« Découvrir des hôtels » / « Découvrir des restos »).
- **Action CTA** : bascule vers l'onglet **Recherche**. Câblage concret : `PlacesTabs` détient
  déjà `const [tab, setTab] = useState(...)` ; il passe `onDiscover={() => setTab("recherche")}` à
  `PlaceListPanel`, qui le transmet à `PlaceEmptyState`. Pas de nouvelle route ni de state global.
- **Dépendances** : `categoryConfig` (icône + descripteur), i18n, primitives kit existantes.

### Section 3 — Vue Liste compacte (#1)

`src/features/places/ui/PlaceCard.tsx`, variant `liste` : carte verticale `h-40` → **ligne horizontale**.

- **Layout** : miniature 72×72 `rounded-card` (photo ou initiale serif en fallback) à gauche ;
  colonne droite `min-w-0` : nom serif ~18px, sous-titre, ligne note + tags.
- **Sous-titre** : « ville » (hôtel) / « cuisine · ville » (resto), via `categoryConfig.descriptor`
  et les champs existants (`type`, ville).
- **Note** : hôtel → label « X,X / ma note » (au lieu de « /10 ») ; resto → étoiles /5 inchangées
  (`computeNotation`). Indicateur favori conservé (★ or).
- **Conteneur** : `PlaceListPanel.tsx` — pour le variant `liste`, passer de
  `grid grid-cols-1 sm:grid-cols-2` à une **liste 1 colonne** (lignes empilées + séparateurs `border-line`).
  Le variant `vignettes` garde la grille 2/3 colonnes actuelle.
- **Étoiles de classe** : non rendues (décision PO §4).

## Design system

Tokens déjà fidèles (accent `#2563EB`, or `#E9B949`, fonds/lignes, Newsreader+Inter). Ajustements
mineurs optionnels, non bloquants : `--radius-card` 4→5px (mobile) et bordure de badge — **exclus du
Lot A** pour éviter tout effet de bord global ; à traiter via `/design-sync` si souhaité.

## Tests

- **e2e** : les `data-testid` (`place-card`, `archived-item`, tabs…) sont **préservés** → les specs
  restos/hôtels restent vertes. Vérifier `hotels.spec.ts` / `restos.spec.ts` après coup.
- **Unitaires** (vitest) :
  - `PlaceEmptyState` : rend le bon CTA/titre selon `category` × onglet ; déclenche `onDiscover`.
  - `PlaceCard` variant `liste` : miniature présente, sous-titre par catégorie, label note hôtel
    « / ma note » vs étoiles resto (étend `PlaceCard.test.tsx`).
- **Vérif pré-push** (mémoire) : `npm run lint` + `typecheck` + `test` + `test:e2e` (la CI `quality`
  enchaîne tout).

## Risques

- **Régression visuelle restos** : la vue Liste et l'état vide restos changent. Atténuation : conforme
  à `Onglet_Resto.dc.html`, et couverture e2e restos existante.
- **i18n multi-locale** : 4 locales présentes (`messages/{fr,en,es,it}.json`). Renommer les titres
  et ajouter les clés d'état vide dans **les 4**, sinon clé manquante à l'exécution.
