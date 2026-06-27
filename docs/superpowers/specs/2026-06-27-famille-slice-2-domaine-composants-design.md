# Slice 2 (épic Famille) — Domaine + composants d'affichage — Design

**Date :** 2026-06-27
**Statut :** Validé (PO). Plan ensuite.
**Branche :** `famille-composants`
**Directive :** `docs/design/famille-documents-epic-directive.md`

---

## 0. Contexte

Fondations UI de l'épic Famille : **utils purs** (statut d'expiration, masquage de numéro, couleur
d'avatar) + **composants d'affichage** réutilisés par la liste, la fiche et le tunnel (slices 3-5).
Aucune donnée ni écran. e2e inchangé.

## 1. Token

Ajouter `--danger-bg` dans `globals.css` (clair `#FEF3F2`, sombre `rgba(244,63,63,0.14)`) + mapping
`@theme --color-danger-bg`. (« Expire bientôt » réutilise `--kpi-amber`/`--kpi-amber-bg` = le `--warn`
du brief ; « valide » réutilise `--kpi-green`/`--kpi-green-bg`.)

## 2. Domaine (`src/features/famille/domain/`)

- **`expiry.ts`** :
  - `expiryStatus(expiry: string | null, now: Date): "expired" | "soon" | "valid" | null` — `null` si
    pas de date ; `expired` si `expiry < now` ; `soon` si `< 6 mois` ; sinon `valid`. Seuil 6 mois
    (passeport valide 6 mois après retour).
  - `monthsUntil(expiry: string, now: Date): number` — nb de mois entiers restants (≥ 0).
- **`mask.ts`** : `maskDocNumber(num: string | null): string` — `""` si nul ; masque tout sauf les
  **3 derniers** caractères (`"•".repeat(len-3) + last3`) ; si `len ≤ 3`, tout masqué.
- **`avatarColor.ts`** : `avatarColor(seed: string): string` — couleur déterministe (hash simple du
  seed) parmi une palette sobre : `["#211E1A","#6B7A8F","#8A7A64","#9A8466","#5E7163"]`.
- Tests unitaires (TDD) pour les trois.

## 3. Composants

### `Avatar` (étendre `src/features/shared/ui/Avatar.tsx`, rétrocompatible)
- Props : `{ name: string; size?: "sm" | "md" | "lg" | "xl"; color?: string }`. Tailles : `sm` 32px
  (inchangé), `md` 40px (inchangé), **`lg` 46px**, **`xl` 72px**. `color` (hex) → fond inline
  `style={{ backgroundColor: color }}` ; **défaut `bg-accent`** (usages existants shell/foyer
  inchangés). Initiales blanches (helper `initials` existant).

### `RelationChip` (`src/features/famille/ui/RelationChip.tsx`)
- Prop `{ relation }`. Pill bleue (`bg-accent-50 text-accent`, `rounded-full`), libellé via
  `t("relations.<relation>")`.

### `ExpiryBadge` (`src/features/famille/ui/ExpiryBadge.tsx`)
- Props `{ status: "expired" | "soon" | "valid"; monthsLeft?: number }` (présentational ; le parent
  calcule via `expiryStatus`/`monthsUntil`). Pill : `valid` → vert (`kpi-green`/`-bg`, `t("expiry.
  valide")`) ; `soon` → orange (`kpi-amber`/`-bg`, `t("expiry.expireDans", { n: monthsLeft })`) ;
  `expired` → rouge (`text-danger` sur `bg-danger-bg`, `t("expiry.expire")`).

### `DocTypeIcon` (`src/features/famille/ui/DocTypeIcon.tsx`)
- Prop `{ docType }`. Carré 40px `rounded-[6px] bg-accent-50`, icône lucide centrée selon le type
  (passeport → `BookUser` ; carte_identite → `IdCard` ; permis_conduire → `Car` ; permis_bateau →
  `Ship` ; visa → `Stamp` ; titre_sejour → `FileBadge` ; autre → `FileText`). (Si une icône n'existe
  pas dans la version lucide installée, fallback `FileText` — l'implémenteur vérifie les noms.)

## 4. i18n (`famille.*`, 4 locales — parité garantie)

- `famille.relations` = `{ conjoint, enfant, parent, beau_parent, ami, autre }` (Conjoint·e / Enfant /
  Parent / Beau-parent / Ami·e / Autre, + EN/IT/ES).
- `famille.docTypes` = `{ passeport, carte_identite, permis_conduire, permis_bateau, visa,
  titre_sejour, autre }` (Passeport / Carte d'identité / Permis de conduire / Permis bateau / Visa /
  Titre de séjour / Autre, + EN/IT/ES).
- `famille.expiry` = `{ valide, expireDans, expire }` (« Valide » / « Expire dans {n} mois » /
  « Expiré », + EN/IT/ES ; `expireDans` ICU `{n}`).
- Pas de chaîne en dur.

## 5. Sécurité

- Aucune donnée, aucun accès Storage/réseau. `maskDocNumber` est l'utilitaire de confidentialité
  d'affichage (numéro complet jamais rendu par défaut — appliqué côté écrans en slice 3).

## 6. Tests

- **Unit** : `expiryStatus` (null / expired / soon < 6 mois / valid ; bornes), `monthsUntil`,
  `maskDocNumber` (nul, ≤3, >3), `avatarColor` (déterministe : même seed → même couleur, dans la
  palette). typecheck+lint+test verts ; parité i18n verte.
- **e2e** : inchangé (aucun écran) — suite verte. Build OK.

## 7. Arbitrages / dette

- Composants présentational → `ExpiryBadge` reçoit `status`/`monthsLeft` (le calcul vit dans les
  écrans, slice 3). Publication au **kit Claude Design** : slice 6 (fin d'épic).
- `Avatar` étendu in-place (pas de fork) ; les variantes `lg`/`xl` sont nouvelles, `sm`/`md` inchangées.
