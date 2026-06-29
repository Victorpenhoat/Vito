# Spec — Slice 9 : Polish + kit

> Épic « Refonte Resto + Hôtels » (directive `docs/design/restos-hotels-refonte-epic-directive.md`).
> Dernière slice de la roadmap. Suit la Slice 8 (desktop, PR #53, mergée).

## Objectif

Finir l'épic : corriger la fuite `is_archived` sur les surfaces actives, ajouter les error-boundaries
et skeletons manquants aux pages restos/hôtels, affiner l'a11y des onglets, et consolider les Minors
cosmétiques accumulés (slices 2-8). Le kit Claude Design est rafraîchi par le PO via `/design-sync`
(hors code).

## Décisions PO (validées le 2026-06-29)

1. **4 axes inclus** : (a) fix fuite `is_archived` ; (b) error.tsx + loading.tsx restos/hôtels ;
   (c) a11y tablist places ; (d) nettoyage des Minors cosmétiques.
2. **KPI fenêtrés laissés tels quels** : « sorties ce mois » / « nouveaux ce mois » sont des stats
   historiques — archiver après coup ne les réécrit pas. On ne filtre que les surfaces **actives**
   (« à tester » + « ta liste »).
3. **Kit = PO-driven** : je ne pousse pas le kit ; je propose au PO de lancer `/design-sync`. Hors
   périmètre code.

## État de départ (vérifié)

- **Fuite `is_archived`** : `src/features/reco/data/queries.ts` (« ta liste », ~ligne 39) fait
  `from("liste_items").select(...)` **sans** `is_archived`. `src/features/accueil/data/queries.ts`
  « restos à tester » (~ligne 50) `.eq("statut","a_faire")` **sans** `is_archived`. Les compteurs
  fenêtrés (visite/added_at ce mois) sont aux lignes ~34-44.
- **error/loading manquants** : restos et hôtels sont les **seules** routes principales sans
  `error.tsx` (voyages, vins, famille, etc. en ont) ; seul famille a `loading.tsx`.
  Pattern de référence : `src/app/[locale]/(app)/famille/error.tsx` (client, `useTranslations`,
  `role="alert"` + bouton `reset`) et `.../famille/loading.tsx` (`Skeleton` de `@/features/shared/ui/Skeleton`).
- i18n : `restos.error.{title,retry}` **existe** ; `hotels` n'a que `title` (pas d'`error`).
- **a11y tablist** : `PlacesTabs` a `role="tablist"` + 4 boutons `role="tab"` + `aria-selected`, mais
  **pas** d'`id`/`aria-controls` ni de `role="tabpanel"` sur les panneaux. Le lien discret Archivés
  utilise `aria-pressed` (correct, hors tablist).
- **Minors cosmétiques** : `map-list-item` (PlacesMapCombined) sans `truncate` ; `chipCls` défini dans
  le render (`PlaceListPanel`, `PlacesMapCombined`) ; `PlaceCard` liste calcule `subtitle = [type, ville]`
  mais n'affiche que `etablissement.ville`.
- `Skeleton` réutilisable existe. Pages restos/hôtels : `<main className="flex flex-col gap-6 p-4 md:p-8 lg:mx-auto lg:w-full lg:max-w-[1200px]">`.

## Architecture / composants

### 1. Fix fuite `is_archived` (fonctionnel)

- `src/features/reco/data/queries.ts` : sur la requête « ta liste » (`from("liste_items").select(...)`),
  ajouter `.eq("is_archived", false)`.
- `src/features/accueil/data/queries.ts` : sur le compteur « restos à tester »
  (`...eq("statut","a_faire")`), ajouter `.eq("is_archived", false)`. **Ne pas toucher** les compteurs
  fenêtrés « sorties » (visite + ce mois) ni « nouveaux » (added_at + ce mois).

### 2. error.tsx + loading.tsx restos & hôtels

- Créer `src/app/[locale]/(app)/restos/error.tsx` et `hotels/error.tsx` (client, calque famille) :
  `role="alert"` + bouton `reset`, `data-testid="error-boundary"`.
  - restos → `useTranslations("restos.error")` ; hôtels → `useTranslations("hotels.error")`.
- i18n : ajouter `hotels.error.{title,retry}` aux 4 locales (valeurs équivalentes à `restos.error`).
- Créer `src/app/[locale]/(app)/restos/loading.tsx` et `hotels/loading.tsx` : `Skeleton` reproduisant
  le layout places (eyebrow + titre, barre d'onglets, grille de ~6 cartes), dans le même `<main>`
  (mêmes classes de largeur que la page).

### 3. a11y tablist (`PlacesTabs`)

- Chaque onglet (`tab-favoris`/…/`tab-recherche`) : ajouter `id={`tab-${key}`}` et
  `aria-controls={`panel-${key}`}` (en plus des `role="tab"`/`aria-selected` existants).
- Le conteneur de panneau rendu pour l'onglet actif : envelopper dans un élément
  `role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}` (`data-testid="places-panel"`).
  (Le lien Archivés et son panneau restent en `aria-pressed`, hors pattern tablist.)

### 4. Nettoyage Minors cosmétiques

- `PlacesMapCombined` : sur le `<Link>` de `map-list-item`, ajouter `block truncate` (et `min-w-0` sur
  le `<li>` si besoin) pour que les noms longs ne cassent pas la colonne 340px.
- Hoister `chipCls` au niveau module (hors composant) dans `PlaceListPanel` **et** `PlacesMapCombined`
  (fonction pure identique, pas de closure sur l'état).
- `PlaceCard` (variant liste) : afficher `{subtitle}` (`type · ville`) au lieu de `{etablissement.ville}`
  (le `subtitle` est déjà calculé). Si `type` est nul, `subtitle` vaut `ville` — comportement inchangé
  dans ce cas.

### 5. Kit (hors code)

Je propose au PO de lancer `/design-sync`. Aucune modification de kit poussée dans cette slice.

## Tests

- **e2e — a11y** : dans `e2e/places.spec.ts`, ajouter une assertion que la page places expose un
  `role="tabpanel"` (`data-testid="places-panel"`) lié à l'onglet actif.
- **Non-régression** : suite unitaire (`npm test`) + e2e complète vertes ; aucun testid existant retiré.
  Le fix `is_archived` ne change aucune assertion existante (accueil n'assert pas de valeur numérique de
  KPI ; le resto archivé seedé est `2e`, hors pool 17e de recherche).
- error.tsx / loading.tsx = scaffolding (pas d'e2e dédié, comme famille).

## Conventions Vito (rappel)

- Mobile-first PWA, App Router Next 16, i18n 4 locales (parité), aucune chaîne en dur, aucun nouveau
  token. `Link`/actions locale-aware.
- **Vérif pré-push** : `npm run lint && npx tsc --noEmit && npm test` (CI `quality` lance eslint + e2e).
  Re-checker `gh pr checks` avant merge (flakes famille connus → re-run).
- **Aucune migration / pas de go-prod DB.**

## Sécurité

- Le fix `is_archived` **restreint** des lectures (jamais d'élargissement) sous RLS owner-only inchangée.
  error/loading = présentation. a11y = attributs ARIA. Aucune nouvelle surface, aucune écriture.

## Hors périmètre

- Refonte visuelle, nouvelles features. Kit (PO via `/design-sync`). Classe étoiles hôtel (backlog si
  source). Flakes famille e2e (chantier indépendant).
