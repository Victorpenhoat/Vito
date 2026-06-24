# Polish P2 — Voyages & Comptes partagés (Dépenses) — Design

**Date :** 2026-06-24
**Statut :** Validé (même approche que P1 : appliquer le kit Core.Badakan). Plan à suivre.
**Branche :** `polish-p2`

---

## 0. Contexte

Deuxième slice de polish des écrans métier (après P1 — cœur carnet). Applique le **kit Core.Badakan**
(+`PageHeader`, livré en P1) aux écrans **Voyages** et **Comptes partagés (Dépenses)** — les plus
riches. Même contrat qu'en P1 : **polish visuel uniquement**, testids/logique/requêtes inchangés, e2e
verts sans modification.

## 1. Décisions de cadrage (validées)

| Sujet | Décision |
|-------|----------|
| Direction | Appliquer le kit (Slice A) + `PageHeader` (P1). Pas de nouveau design. |
| Périmètre | **Voyages** (8 composants + 2 pages) + **Dépenses** (9 composants + 2 pages). |
| Contrainte | **Visuel only** : conserver chaque `data-testid`, action, query, prop, i18n, comportement. |

## 2. Règles de mapping (bricolage → kit)

Identiques à P1 :

| Avant | Après |
|---|---|
| `<button className="bg-black text-white …">` | `<Button>` (variant primary/ghost/subtle), `disabled`/`pending`/`type` conservés |
| `border p-2`/`border p-3` (carte/ligne) | `<Card>` ou `rounded-card border border-line bg-surface p-4` (classe carte si `<li>`) |
| `text-2xl font-bold` (titre page) | `<PageHeader title=… action=… />` |
| `text-gray-500/600/700` | `text-muted` / `text-faint` |
| `<input/select/textarea className="border p-2">` | `rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:outline-2 focus:outline-accent` |
| pastille compteur/statut/solde | `<Badge>` ; soldes/montants en highlight → `text-accent`/`text-ink` (ou `<Tile>` si présenté en KPI) |
| liens | `text-accent hover:underline` |

Interdits : modifier/retirer/renommer un `data-testid` ; changer une action/query/prop/i18n/href ; toucher
au comportement (calculs de soldes, partage, réservations, upload documents…).

## 3. Écrans & fichiers

- **Voyages** : `voyages/ui/{VoyagesList,VoyageForm,VoyageDetail,ReservationForm,MembersList,ShareForm,DocumentsList,DocumentUploadForm}.tsx`, pages `(app)/voyages/page.tsx` & `(app)/voyages/[id]/page.tsx`.
- **Dépenses** : `depenses/ui/{GroupesList,GroupeForm,GroupeDetail,DepensesList,DepenseForm,RemboursementForm,SoldesPanel,MembersList,ShareForm}.tsx`, pages `(app)/depenses/page.tsx` & `(app)/depenses/[id]/page.tsx`.

(Chaque fichier relu par l'implémenteur ; application des règles §2 en conservant strictement
testids/logique.)

## 4. Sécurité

- Aucun changement de surface : pas de migration, pas de RLS, pas d'action/query modifiée. Les calculs
  financiers, le partage et l'upload de documents (chiffrés) ne sont **pas** touchés — rendu seulement.

## 5. Tests

- **Non-régression e2e** : `voyages.spec.ts`, `depenses.spec.ts`, et la suite complète restent **verts
  sans modification**. Build/typecheck/lint verts. Pas de nouveau test (présentational).
- Vérification visuelle prod/preview.

## 6. Arbitrages / dette signalés

- Slices restantes : **P3** (Famille, Conciergerie, Abonnement, Goûts), **P4** (Agence, Admin).
- `text-red-600` brut (erreurs) : convention pré-existante, hors périmètre (token danger plus tard).
- Refontes fonctionnelles : hors périmètre — polish visuel seulement.
