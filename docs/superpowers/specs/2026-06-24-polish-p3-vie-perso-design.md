# Polish P3 — Vie perso (Famille, Conciergerie, Abonnement, Goûts) — Design

**Date :** 2026-06-24
**Statut :** Validé (même approche kit que P1/P2). Plan à suivre.
**Branche :** `polish-p3`

---

## 0. Contexte

Troisième slice de polish des écrans métier. Applique le kit Core.Badakan (+`PageHeader`) aux écrans
**Famille, Conciergerie, Abonnement, Goûts** — **polish visuel uniquement**, testids/logique/requêtes
inchangés, e2e verts sans modification. Mêmes règles que P1/P2.

## 1. Décisions de cadrage (validées)

| Sujet | Décision |
|-------|----------|
| Direction | Appliquer le kit (Slice A) + `PageHeader`. Pas de nouveau design. |
| Périmètre | **Famille** (5 comp.), **Conciergerie** (5 comp.), **Abonnement** (2 comp.), **Goûts** (`GoutsForm` + page `/gouts`). |
| Contrainte | **Visuel only** : conserver chaque `data-testid`, action, query, prop, i18n, comportement. Pas de doublon de valeur dans l'UI. |

## 2. Règles de mapping (bricolage → kit)

Identiques à P1/P2 :

| Avant | Après |
|---|---|
| `<button className="bg-black text-white …">` | `<Button>` (variant primary/ghost/subtle), `disabled`/`pending`/`type` conservés |
| `border p-2`/`border p-3` (carte/ligne) | `<Card>` ou `rounded-card border border-line bg-surface p-4` (classe carte si `<li>`) |
| `text-2xl font-bold` (titre page) | `<PageHeader title=… action=… />` |
| `text-gray-*` | `text-muted` / `text-faint` |
| `<input/select/textarea className="border p-2">` | `rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:outline-2 focus:outline-accent` |
| pastille compteur/statut | `<Badge>` ; liens → `text-accent hover:underline` ; pages `p-6` → `p-4 md:p-6` |

Interdits : modifier/retirer/renommer un `data-testid` ; changer une action/query/prop/i18n/href ; toucher
au comportement (statuts de demandes conciergerie, premium/abonnement, invitations famille, sélection de
goûts). Ne pas afficher deux fois la même donnée (texte + Badge).

## 3. Écrans & fichiers

- **Famille** : `famille/ui/{AjouterFamilleButton,FamilleForm,FamilleRestos,InviteForm,MembresList}.tsx`, page `(app)/famille/page.tsx`.
- **Conciergerie** : `conciergerie/ui/{ConciergeInbox,DemandeHotelForm,DemandeRestoForm,DemandesList,ReponseForm}.tsx`, page `(app)/conciergerie/page.tsx`.
- **Abonnement** : `abonnement/ui/{CancelButton,SubscribeButtons}.tsx`, page `(app)/abonnement/page.tsx`.
- **Goûts** : `reco/ui/GoutsForm.tsx`, page `(app)/gouts/page.tsx`.

(Chaque fichier relu par l'implémenteur ; application des règles §2 en conservant strictement testids/logique.)

## 4. Sécurité

- Aucun changement de surface : pas de migration, pas de RLS, pas d'action/query modifiée. Statuts de
  conciergerie, état premium et invitations famille ne sont **pas** touchés — rendu seulement.

## 5. Tests

- **Non-régression e2e** : `famille.spec.ts`, `conciergerie.spec.ts`, `abonnement.spec.ts`, et la suite
  complète restent **verts sans modification**. Build/typecheck/lint verts. Pas de nouveau test.
- Vérification visuelle prod/preview.

## 6. Arbitrages / dette signalés

- Dernière slice de polish : **P4** (Agence, Admin).
- `text-red-600` brut (erreurs) : convention pré-existante, hors périmètre.
- Refontes fonctionnelles : hors périmètre — polish visuel seulement.
