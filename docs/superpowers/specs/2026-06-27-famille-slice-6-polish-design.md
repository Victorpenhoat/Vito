# Slice 6 (épic Famille) — Polish (skeletons + a11y + erreurs riches) + kit — Design

**Date :** 2026-06-27
**Statut :** Validé (PO). Plan ensuite.
**Branche :** `famille-polish`
**Directive :** `docs/design/famille-documents-epic-directive.md` (roadmap §6 — **dernière slice de l'épic**)

---

## 0. Contexte

Passe de finition de l'épic Famille (Slices 1-5 en prod). Trois axes de polish **code** (skeletons,
a11y, erreurs riches du tunnel) + un livrable **séparé** : le rafraîchissement du **kit Claude
Design**. Tout est additif ; aucun flux fonctionnel ne change. Aucune migration, aucune dépendance.

État des lieux : `error.tsx` famille existe (basique, conservé) ; **aucun `loading.tsx`** ni primitive
Skeleton dans le repo ; a11y partielle (`reveal` a `aria-label`, manque `aria-pressed` ; rail sans
`aria-current`) ; le tunnel fait un **fallback OCR silencieux** (aucune distinction réseau/illisible).

## 1. Skeletons de chargement

- **`src/features/shared/ui/Skeleton.tsx`** (NOUVEAU) : primitive présentational —
  `Skeleton({ className })` → `<span className={\`block animate-pulse rounded-control bg-line/60 ${className}\`} aria-hidden="true" />`.
  Réutilisable (aucun nouveau token : `bg-line` existe).
- **`src/app/[locale]/(app)/famille/loading.tsx`** (NOUVEAU) : squelette de la liste — `PageHeader`
  réutilisé (titre statique via `getTranslations`) + quelques lignes/cartes `Skeleton` imitant
  `ProchesList`. Affiché par Suspense pendant `getProches`.
- **`src/app/[locale]/(app)/famille/proches/[id]/loading.tsx`** (NOUVEAU) : squelette de la fiche
  (en-tête `Skeleton` rond + lignes + bloc documents). Affiché pendant `getProche`.
- (Le tunnel a déjà son état C « Lecture… » — non concerné.)

## 2. Accessibilité (a11y)

- **`DocumentRow`** : le bouton « révéler » reçoit `aria-pressed={revealed}` (en plus de l'`aria-label`).
- **`FamilleRail`** : le `Link` du proche actif reçoit `aria-current="page"` (en plus du style actif).
- **`DocumentPreview`** : `alt` de l'image = nom de type du document (`t("docTypes.<type>")`) plutôt
  qu'« Aperçu » générique (passer `doc.doc_type`).
- **Focus visible** : ajouter `focus-visible:outline-2 focus-visible:outline-accent` (classe du repo,
  cf. inputs existants) sur les éléments interactifs Famille qui n'en ont pas : `Link`s du rail,
  boutons du tunnel (étapes A type, B photo/importer), bouton « révéler », lignes sélectionnables.
- **Tunnel** : le `<input type=file>` masqué (`sr-only`) doit rester atteignable au clavier via son
  `<label>` ; vérifier que les boutons d'étape ont un libellé textuel (déjà le cas via `t(...)`).
- Pas de chasse exhaustive : on cible ces points concrets, mesurables.

## 3. Erreurs riches du tunnel (étape C)

Aujourd'hui : tout échec du `fetch('/api/famille/documents/read')` → bascule **silencieuse** en D
(manuel). Cible :
- Distinguer dans le `catch`/`!resp.ok` : si la requête échoue (réseau) ou renvoie ≥ 500 → afficher à
  l'étape C un **état d'erreur** (`cErreurTitre` + bouton **« Réessayer la lecture »** qui relance le
  fetch, et bouton **« Saisir manuellement »** qui passe en D avec champs vides + `manual=true`).
- Si la lecture aboutit mais renvoie des champs vides (document peu lisible) → comportement actuel
  conservé (passage en D, l'utilisateur complète).
- Nouveaux états dans `DocumentTunnel` : `readError: boolean`. L'`useEffect` de l'étape C met
  `readError=true` au lieu de basculer en D en cas d'échec ; le rendu de l'étape C affiche soit
  « Lecture… » soit le bloc d'erreur selon `readError`. « Réessayer » remet `readError=false` et
  re-déclenche (re-set step C / incrémente un `attempt`). « Saisir manuellement » → `setManual(true)` +
  `setFields(EMPTY_FIELDS)` + `setStep("D")`.

## 4. i18n (`famille.tunnel.*`, 4 locales — parité)

Ajouts sous `famille.tunnel` :
- `cErreurTitre` (« La lecture a échoué » / Reading failed / Lettura non riuscita / La lectura falló),
- `cReessayer` (« Réessayer la lecture » / Try reading again / Riprova la lettura / Reintentar la lectura),
- `cManuel` (« Saisir manuellement » / Enter manually / Inserisci manualmente / Introducir manualmente).
Aucune chaîne en dur.

## 5. Sécurité

- Aucune surface nouvelle. Skeletons = présentational. Le « Réessayer » re-poste le fichier (déjà en
  mémoire) à la même route OCR authentifiée ; rien n'est persisté avant le submit D.

## 6. Tests

- **e2e** : (a) tunnel — simuler un échec de la route OCR (ex. interception réseau Playwright
  `page.route('**/api/famille/documents/read', r => r.abort())`) → l'étape C affiche le bloc d'erreur ;
  « Réessayer la lecture » (sans interception) aboutit en D pré-rempli ; « Saisir manuellement » → D
  vide. (b) a11y léger : le bouton révéler expose `aria-pressed`. (c) Non-régression : le tunnel
  nominal (mock) reste vert. (d) skeleton : difficile à tester e2e de façon stable → vérifié par build
  + rendu (pas d'assertion e2e fragile sur le flash de loading).
- **Unit** : aucun nouveau utilitaire (composants présentational). Parité i18n verte.
- typecheck/lint (0 warning) ; suite e2e complète verte ; build OK.

## 7. Kit Claude Design (livrable SÉPARÉ, post-merge)

Après merge + prod du code, rafraîchir le projet Design (`/design-sync` via `DesignSync`) avec des
**cartes de preview** des composants Famille : `DocumentTunnel` (états A→D), `DocumentRow`
(masqué/révélé), `ExpiryBadge` (3 statuts), `RelationChip`, `DocTypeIcon` (7 types), `Avatar`
(tailles + couleur), `FamilleRail`, `DocumentPreview`. **Hors pipeline Vito** (pas de PR/CI) :
écriture dans le projet `App restos hotels` via `finalize_plan` (le PO voit la liste des chemins avant
écriture) → `write_files`. Détaillé et exécuté en suivant la skill `/design-sync`.

## 8. Prod

- Aucune migration/dépendance. Merge standard après CI verte. Déploiement Vercel auto. Le kit est
  poussé séparément vers Claude Design (n'affecte pas la prod Vito).

## 9. Arbitrages / dette

- a11y : passe ciblée (pas d'audit AXE complet — possible dette future).
- Skeleton non testé en e2e (flash de chargement instable à asserter) — couvert par build + revue visuelle.
- Alerte d'expiration agrégée (dashboard) : reste hors scope (différée depuis la directive).
