# Slice 4 (épic Le Carnet) — Recherche : en-tête éditorial + form pastilles + résultats avec miniature — Design

**Date :** 2026-06-25
**Statut :** Validé (décisions PO). Plan à suivre.
**Branche :** `carnet-recherche`
**Directive :** `docs/design/carnet-refonte-directive.md` · **Fondations :** Slices 0-3 (mergées)

---

## 0. Contexte

On re-skinne l'écran **Recherche** (`/recherche`) au style Le Carnet. La recherche de Vito est
**par critères** (zone / budget / type → « ta liste d'abord » puis recos scorées) ; **pas de texte
libre** (la recherche externe Google = épic places Slice 5, différée). **Sans migration.**

## 1. Contraintes e2e (`e2e/recherche.spec.ts` — vert sans modification)

Préserver : `recherche-form` (le parcours ne touche pas ses champs internes — il passe `?zone=17e`
en URL et règle les goûts via `gouts-form`), `ma-liste-section`, `recos-section`, `resto-result`.
La structure **deux sections** (ta liste / recos) est conservée.

## 2. UI

### Page (`recherche/page.tsx`)
`PageHeader` avec **eyebrow** `recherche.eyebrow` (« Explorer ») + titre `recherche.title`
(« Rechercher »). Puis `RechercheForm`, `RechercheResults`.

### `RechercheForm` (client, `recherche-form` conservé)
Re-skin Le Carnet — aucune dépendance e2e sur les champs internes :
- **zone** (input) + **budget** (input number) en style éditorial (coins `rounded-control`) ;
- **type** rendu en **pastilles** (Tous + chaque type de `TYPES`), la pastille active reflète le
  param `type`, un clic met à jour le searchParam `type` (via `router.replace`, comme aujourd'hui).
- Tous les champs continuent d'écrire les searchParams lus par `RechercheResults`/`rechercheRestos`
  (comportement de filtrage inchangé).

### `RechercheResults` (server) — deux sections re-skinnées
- Chaque section (`ma-liste-section`, `recos-section`) : **libellé** (`SectionLabel` :
  `recherche.maListe` / `recherche.recos`) + liste de **lignes avec miniature**.
- **Ligne** (`<li data-testid="resto-result">` conservé) : vignette **56×56** (photo
  `/api/places/photo?ref={photo_ref}&w=200` si `photo_ref`, sinon **initiale** sur fond dégradé
  neutre `--hero-from/--hero-to`) + **nom serif** + sous-ligne `type · arrondissement/ville`
  (`text-muted`). Lien interne vers `/restos/{id}` conservé. État vide `recherche.vide`.

## 3. Données (`src/features/reco/data/queries.ts`)

- `RestoResult` gagne `photo_ref: string | null`.
- `rechercheRestos` : ajouter `photo_ref` aux deux `select` `etablissements` (embed liste ligne ~39
  et pool ligne ~78). Le scoring/matching (`matchObjectif`, `scoreEtablissement`) **inchangé**.
- Recos du pool seedé sans `photo_ref` → miniature placeholder (initiale). Aucun appel Google.

## 4. i18n (4 locales, parité garantie)

- Ajout : `recherche.eyebrow` (FR « Explorer » · EN « Explore » · IT « Esplora » · ES « Explorar »).
- Réutilise `recherche.title`/`maListe`/`recos`/`vide`/`zone`/`budget`/`type`/`tous` (déjà présents).
  Pas de chaîne en dur.

## 5. Sécurité

- Lecture seule (RLS owner sur `liste_items`/`avis`, lecture authentifiée sur `etablissements` déjà
  en place). Aucune action serveur, migration ou requête de scoring modifiée. `photo_ref` est une
  réf publique non sensible ; octets jamais persistés (proxy inchangé).

## 6. Tests

- **Unit** : `scoring`/`implicit` inchangés (toujours verts) ; typecheck+lint+test verts ; parité
  i18n verte (`eyebrow` × 4).
- **e2e** : `recherche.spec.ts` **vert sans modification** (testids + parcours goûts/zone conservés ;
  `resto-result` présents dans `recos-section`). Suite complète verte. Un `db reset` avant.
- **Build** : OK.
- Pas de nouveau test requis (re-skin présentationnel + ajout de champ `select`).

## 7. Arbitrages / dette

- **Recherche par critères** conservée (pas de texte libre) ; la recherche externe Google priorisée
  est l'épic places Slice 5 (différée). La grande barre de recherche de la maquette n'est donc pas
  branchée (le form critères la remplace fonctionnellement).
- Miniatures : photo pour les restos en ayant une (cache Slice 2), initiale sinon (recos pool).
- Tri « pertinence » de la maquette = déjà le scoring des recos (implicite) ; pas de sélecteur de tri
  exposé (YAGNI).
