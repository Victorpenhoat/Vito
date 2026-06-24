# Polish P4 — Pro / back-office (Agence, Admin) + nettoyage kit — Design

**Date :** 2026-06-24
**Statut :** Validé (même approche kit que P1-P3). Plan à suivre.
**Branche :** `polish-p4`

---

## 0. Contexte

Dernière slice de polish des écrans métier. Applique le kit Core.Badakan (+`PageHeader`, `Tile`) aux
écrans **Agence** et **Admin** — **polish visuel uniquement**. Inclut un petit **nettoyage du kit** :
faire forwarder les attributs HTML (`data-testid`, etc.) par `Card` et `Badge` (dette relevée en P3),
pour que les conteneurs porteurs de testid utilisent `<Card>` directement.

## 1. Décisions de cadrage (validées)

| Sujet | Décision |
|-------|----------|
| Kit | `Card` et `Badge` forwardent désormais `...rest` (`HTMLAttributes`) — additif, n'altère aucun usage existant. |
| Direction | Appliquer le kit (Slice A) + `PageHeader` + `Tile` (pour les KPI admin). Pas de nouveau design. |
| Périmètre | **Agence** (3 comp. + page), **Admin** (4 comp. + page : StatsCards KPI + 3 tableaux). |
| Contrainte | **Visuel only** : conserver chaque `data-testid`, action, query, prop, i18n, comportement. Pas de doublon de valeur, pas de contenu perdu. |

## 2. Nettoyage kit (`Card`/`Badge` → forward `...rest`)

```tsx
// Card.tsx
import type { HTMLAttributes } from "react";
export function Card({ className = "", children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`rounded-card border border-line bg-surface p-5 ${className}`} {...rest}>{children}</div>;
}
// Badge.tsx — idem avec HTMLAttributes<HTMLSpanElement>, classes inchangées.
```
Additif (les appelants actuels passent `className`/`children` → inchangés). Permet `<Card data-testid=…>`.
La suite e2e complète (Task finale) confirme l'absence de régression sur tous les écrans utilisant le kit.

## 3. Règles de mapping (bricolage → kit)

Identiques à P1-P3, plus :
- **KPI admin** (StatsCards : total users, premium actifs, demandes par statut) → `<Tile tone=…>` (label + grande valeur).
- **Tableaux** (UsersTable/SubscriptionsTable/DemandesTable) : envelopper dans `<Card>` ; en-têtes `text-muted text-xs uppercase` ; bordures de lignes `border-line` ; texte secondaire `text-muted`. **Conserver la structure `<table>` et tous les `data-testid`** (`users-table`, `subscriptions-table`, `demandes-table`, `admin-stats`).
- Agence : `<button bg-black>` → `<Button>` ; lignes client (`client-row`) → cartes ; formulaires (`lier-client-form`, `voyage-client-form`) → champs tokenisés ; `text-gray-*` → `text-muted` ; page titre → `PageHeader`.

Interdits : modifier/retirer/renommer un `data-testid` ; changer une action/query/prop/i18n/href ; toucher
au comportement (liaison client, création voyage agence, lecture admin/RBAC). Pas de doublon de valeur.

## 4. Écrans & fichiers

- **Kit** : `shared/ui/Card.tsx`, `shared/ui/Badge.tsx`.
- **Agence** : `agence/ui/{ClientsList,LierClientForm,VoyagePourClientForm}.tsx`, page `(app)/agence/page.tsx`.
- **Admin** : `admin/ui/{StatsCards,UsersTable,SubscriptionsTable,DemandesTable}.tsx`, page `(app)/admin/page.tsx`.

## 5. Sécurité

- Aucun changement de surface : pas de migration, pas de RLS, pas d'action/query modifiée. L'admin reste
  en lecture seule, gardé par `requireRole(["admin"])` ; l'agence par `is_agence`. Rendu seulement.

## 6. Tests

- **Non-régression e2e** : `agence.spec.ts`, `admin.spec.ts`, et la suite complète restent **verts sans
  modification**. Build/typecheck/lint verts. Pas de nouveau test.
- Vérification visuelle prod/preview.

## 7. Arbitrages / dette signalés

- Fin du polish des écrans métier (P1-P4 couvrent tous les écrans).
- `text-red-600` brut (erreurs) : convention pré-existante, hors périmètre.
- Refontes fonctionnelles (pagination/filtres admin, etc.) : hors périmètre.
