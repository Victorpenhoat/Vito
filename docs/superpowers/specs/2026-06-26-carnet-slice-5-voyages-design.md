# Slice 5 (épic Le Carnet) — Voyages : liste (prochain départ + carnet de route) + fiche hero — Design

**Date :** 2026-06-26
**Statut :** Validé (décisions PO). Plan à suivre.
**Branche :** `carnet-voyages`
**Directive :** `docs/design/carnet-refonte-directive.md` · **Fondations :** Slices 0-4 (mergées)

---

## 0. Contexte

On re-skinne l'écran **Voyages** (liste + fiche) au style Le Carnet. Les voyages **n'ont pas de
photo** (modèle : titre/destination/dates/statut) → visuels = **placeholders dégradés** (teintés
selon le statut). **Sans migration.**

## 1. Contraintes e2e (`e2e/voyages.spec.ts` — vert sans modification)

Préserver : `voyage-form` (input `name="titre"` + bouton), `voyage-card` (+ lien interne),
`reservation-form` (select `name="type"`, input `name="fournisseur"`, bouton), `reservation-row`,
`share-form` (input `name="email"` + bouton), `member-row`, `documents-section`. Le parcours
(créer « Lisbonne », ajouter une réservation hôtel, partager avec l'agence ; l'agence voit « Rome »)
doit rester vert. Chaque voyage rend un `voyage-card` avec un lien — qu'il soit en « prochain
départ » ou dans la grille.

## 2. Découpage liste (`src/features/voyages/domain/splitVoyages.ts`)

Helper pur **`splitVoyages(voyages, today)`** → `{ prochain: Voyage | null; reste: Voyage[] }` :
- `prochain` = le voyage **à venir** le plus proche : `statut` ∈ {planifié, confirmé} **et**
  `date_debut >= today`, trié par `date_debut` croissant → le premier. `null` si aucun.
- `reste` = tous les autres (dans l'ordre reçu, déjà trié par `date_debut`).
Testable (à venir vs passé, statut terminé exclu du « prochain », aucun à venir → `prochain=null`).
(Les valeurs exactes de l'enum `statut` sont confirmées au plan.)

## 3. UI liste

### Page (`voyages/page.tsx`)
`PageHeader` eyebrow `voyages.eyebrow` (« Mes voyages ») + titre `voyages.title` + subtitle
`voyages.compte` (« {avenir} à venir · {passes} passés »). Puis `VoyageForm` (création, re-skin,
testid `voyage-form` conservé) + `VoyagesList`.

### `VoyagesList`
- Si `prochain` : section **`voyages.prochainDepart`** (`SectionLabel`) avec une **carte large**
  (`VoyageFeatured`) : bandeau dégradé (teinte statut) + pastille statut + titre serif + destination·
  dates + **méta** (réservations / voyageurs / documents — comptes via `getVoyageMeta(id)`).
- Section **`voyages.carnetRoute`** : **grille** (1/2/3 col) de `VoyageCard` (bandeau dégradé,
  pastille statut, titre serif, destination·dates ; **statut terminé atténué** `opacity-70`).
- Chaque carte (featured + grille) = `<… data-testid="voyage-card">` + lien `/voyages/{id}`. État
  vide global `voyages.vide`.

### Composants
- `VoyageCard` (présentational) : carte vignette. `VoyageFeatured` (présentational) : carte large.
  `statutTint(statut)` (helper) : dégradé/teinte par statut (confirmé / planifié / terminé / défaut).

## 4. UI fiche (`VoyageDetail`)

- **Hero** dégradé (teinte statut) : pastille statut + titre serif + destination·dates en
  surimpression.
- **Grille 2 colonnes** (`md:grid-cols-[1fr_320px]`) :
  - **gauche** : **Réservations** (`SectionLabel` + lignes `reservation-row` re-skinnées : type en
    petites capitales accent + fournisseur/référence serif + dates + liens tél/mail/lien ;
    `ReservationForm` conservé) ; **Documents** (`documents-section` conservé : `DocumentsList` +
    `DocumentUploadForm`).
  - **aside** : **Voyageurs** (Card : `MembersList` `member-row` + `ShareForm` si owner) ;
    **Dépenses** (Card : lien « ouvrir le compte » via `openVoyageGroupe`).
- Tous les testids conservés. Le reste du comportement (actions, RLS `can_access_voyage`) inchangé.

## 5. Données (`src/features/voyages/data/queries.ts`)

- `getMesVoyages` **inchangé** (titre/destination/dates/statut/owner_id).
- Ajout **`getVoyageMeta(id)`** → `{ reservations: number; documents: number; voyageurs: number }`
  (trois `count: "exact", head: true` sur `reservations`/`voyage_documents`/`voyage_membres` pour le
  SEUL voyage en avant). RLS s'applique. Pas d'appel par carte de la grille.
- `getVoyageDetail`/`getVoyageDocuments` inchangés.

## 6. i18n (4 locales, parité garantie)

Ajouts : `voyages.eyebrow` (« Mes voyages »…), `voyages.prochainDepart` (« Prochain départ »…),
`voyages.carnetRoute` (« Carnet de route »…), `voyages.compte` (ICU « {avenir} à venir · {passes}
passés »). Réutilise `voyages.title`/`vide`/`statuts.*`/`reservations`/`membres`/`documents.titre`/
`types.*`/`ouvrirCompte`/`voirLien`. Pas de chaîne en dur.

## 7. Sécurité

- Lecture seule additionnelle (`getVoyageMeta` = comptes soumis à la RLS `can_access_voyage` /
  policies existantes). Aucune action serveur, requête de fond ou migration modifiée.

## 8. Tests

- **Unit** : `splitVoyages` (à venir/passé/terminé/aucun) ; `statutTint` (statut connu → non vide,
  inconnu → fallback) ; typecheck+lint+test verts ; parité i18n verte (4 nouvelles clés).
- **e2e** : `voyages.spec.ts` **vert sans modification** (testids + parcours conservés ; « Lisbonne »
  et « Rome » trouvés en `voyage-card` qu'ils soient en featured ou grille). Suite complète verte.
  Un `db reset` avant.
- **Build** : OK.

## 9. Arbitrages / dette

- **Pas de photo de voyage** (placeholder dégradé teinté par statut) — pas d'infra photo.
- Méta (réservations/voyageurs/documents) calculée **uniquement** pour la carte « prochain départ »
  (1 voyage) ; pas de comptes par carte de grille (évite N requêtes).
- `VoyageForm` (création inline) conservé bien que la maquette montre seulement un bouton « Ajouter »
  — flux fonctionnel nécessaire (e2e), re-skinné.
- Dépenses détaillées : écran dédié (Slice 6) ; ici seulement le lien « ouvrir le compte ».
