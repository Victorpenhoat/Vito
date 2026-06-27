# Slice 5 (épic Famille) — Desktop (master-detail + aperçu + modale) — Design

**Date :** 2026-06-27
**Statut :** Validé (PO). Plan ensuite.
**Branche :** `famille-desktop`
**Directive :** `docs/design/famille-documents-epic-directive.md` (roadmap §5)
**Maquette :** `Onglet Famille.dc.html` — écrans « Web liste », « Web fiche », « Web ajout modale » (cadres 1280px, layout `300px 1fr`, grille proches 3 col, modale ~880px sur backdrop, aperçu document).

---

## 0. Contexte

Slice 5 = **enrichissement desktop** des écrans Famille (Slices 3-4). 100 % responsive : le mobile-first
existant reste **inchangé** ; on ajoute des variantes `lg:`. Décisions PO : **master-detail avec rail
partagé** (300px) ; **tunnel = page stylée en modale** (pas de route interceptrice). Aucune donnée,
aucune sécurité nouvelle (l'aperçu réutilise la route déchiffrée existante).

**Acquis :** `AppShell`/`Sidebar` (nav globale desktop `md:pl-64`) ; pages/composants Famille
Slices 3-4 ; route `/api/famille/documents/[id]` (déchiffre + streame, `private,no-store`) ;
`getProches`/`getProche`.

## 1. Layout master-detail (`src/app/[locale]/(app)/famille/layout.tsx`, NOUVEAU)

Server Component enveloppant toutes les routes `famille/*`. Récupère `getProches()` (mis en `cache()`
React — voir §5) et rend :
- **`lg:` (desktop)** : grille `lg:grid lg:grid-cols-[300px_1fr] lg:gap-6` → **`FamilleRail`** (rail
  gauche, `hidden lg:block`) + `{children}` (colonne 1fr).
- **mobile** : la grille s'effondre, le rail est masqué → `{children}` seul, navigation route-based
  inchangée.

Le rail s'imbrique dans la zone de contenu de l'`AppShell` (déjà `md:pl-64`) : nav globale + rail +
détail = 3 panes à 1280px, conforme à la maquette.

## 2. `FamilleRail` (`src/features/famille/ui/FamilleRail.tsx`, NOUVEAU, client)

Props `{ proches: Proche[] }`. Rend la navigation du répertoire : sections par cercle (Proches /
Élargie / Amis) avec, pour chaque proche, un `Link` compact (`@/lib/i18n/routing`) vers
`/famille/proches/[id]` + `Avatar` size sm + nom + `ExpiryBadge` si urgence. **État actif** via
`usePathname()` (`@/lib/i18n/routing`) → surlignage du proche courant. En-tête de rail : titre
`t("proches.titre")` + lien « Ajouter un proche ». Aucune chaîne en dur.

## 3. Répertoire & fiche responsives

- **`ProchesList`** (modif) : le `<ul>` de chaque cercle passe en grille sur desktop —
  `flex flex-col gap-2 lg:grid lg:grid-cols-2 xl:grid-cols-3` (liste sur mobile, grille 2-3 col en
  `lg:`/`xl:`). Aucune autre logique touchée.
- **`FichePersonne`** (modif) : sur `lg:`, 2 colonnes `lg:grid lg:grid-cols-[280px_1fr] lg:gap-8` —
  colonne gauche = en-tête identité (Avatar xl + nom + `RelationChip` + cercle + contacts) ; colonne
  droite = **`DocumentsPanel`** (documents + aperçu). Mobile = empilé, inchangé.
- **`DocumentsPanel`** (`src/features/famille/ui/DocumentsPanel.tsx`, NOUVEAU, client) : reçoit
  `documents: DocMeta[]`. Liste les `DocumentRow` (inchangés). En `lg:`, gère une **sélection** (state)
  et affiche **`DocumentPreview`** du document sélectionné (par défaut le premier) dans un panneau.
  Sur mobile : seulement la liste + « Voir le document » (route, nouvel onglet) comme aujourd'hui — le
  panneau d'aperçu est `hidden lg:block`.
- **`DocumentPreview`** (`src/features/famille/ui/DocumentPreview.tsx`, NOUVEAU, client) : props
  `{ doc: DocMeta }`. Source = `/api/famille/documents/${doc.id}`. Si `mime_type` commence par
  `image/` → `<img src=… className="max-w-full rounded-card">` ; si `application/pdf` →
  `<iframe src=… className="w-full h-[480px] rounded-card border border-line" title=…>`. Titre
  `t("fiche.apercu")`. (La route impose déjà RLS owner-only + `private,no-store` — aucune fuite.)

## 4. Tunnel desktop — page stylée en modale

- **Page** `documents/nouveau` (modif) : sur `lg:`, centre le `DocumentTunnel` dans une **carte modale**
  (`lg:mx-auto lg:max-w-[880px] lg:rounded-card lg:border lg:border-line lg:bg-surface lg:shadow-lg
  lg:p-8`) sur le fond crème assombri du conteneur. Mobile = pleine page inchangée.
- **`DocumentTunnel`** (modif) : ajoute un **`StepIndicator` horizontal** (`hidden lg:flex`) — 4 pastilles
  numérotées + libellés courts (Type / Document / Lecture / Vérification), l'étape courante mise en
  avant (accent). Le texte « n / 4 » mobile reste. Aucune logique de flux modifiée.

## 5. Performance — `getProches` en cache

`getProches` est désormais appelé par le **layout** (rail) **et** par la **page** `/famille`
(grille). Pour éviter une double requête par rendu, envelopper `getProches` avec `cache` de `react`
(`export const getProches = cache(async () => { … })`). Comportement inchangé, une seule requête par
requête HTTP.

## 6. i18n (4 locales — parité)

Ajouts sous `famille` :
- `famille.fiche.apercu` (« Aperçu » / Preview / Anteprima / Vista previa).
- `famille.tunnel.steps` = `{ type, document, lecture, verification }` (libellés courts du
  `StepIndicator` ; FR : Type / Document / Lecture / Vérification + EN/IT/ES).
Aucune chaîne en dur.

## 7. Sécurité

- Aucune surface nouvelle. L'aperçu (`<img>`/`<iframe>`) charge la route déchiffrée existante
  (RLS owner-only → 404 pour autrui, `private,no-store`). `contenu_chiffre` jamais exposé.

## 8. Tests

- **e2e desktop** (`e2e/famille-desktop.spec.ts`, viewport 1280×800 via `test.use`) : login client →
  `/fr/famille` → **rail visible** (`FamilleRail`) + grille proches ; cliquer un proche dans le rail →
  fiche ; **aperçu** rendu (image/iframe présent pour le doc seedé PDF → `<iframe>`). Tunnel : depuis la
  fiche, ouvrir « Ajouter un document » → en desktop le `StepIndicator` horizontal est visible.
- **e2e mobile (non-régression)** : viewport mobile (≈ 390×844 via `test.use`) → le rail est **masqué**
  (`FamilleRail` non visible), la liste mobile s'affiche, le flux CRUD/tunnel existant reste vert.
- typecheck/lint/test verts ; parité i18n ; suite e2e complète verte ; build OK.

## 9. Prod

- **Aucune migration**, aucune dépendance. Merge standard après CI verte. Déploiement Vercel auto.

## 10. Arbitrages / dette

- Pas de route interceptrice pour la modale (choix PO : page stylée — zéro régression). Vraie modale
  overlay = évolution possible ultérieure.
- L'aperçu PDF via `<iframe>` dépend du rendu PDF natif du navigateur (suffisant ; pas de viewer custom — YAGNI).
- Le rail charge tous les proches (pas de pagination) — cohérent avec l'échelle (répertoire familial), à
  revoir si volumétrie inattendue.
