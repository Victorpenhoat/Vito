# Slice 6 (épic Le Carnet) — Dépenses : liste + détail (Détail / Total / Équilibre) — Design

**Date :** 2026-06-26
**Statut :** Validé (décisions PO). Plan à suivre.
**Branche :** `carnet-depenses`
**Directive :** `docs/design/carnet-refonte-directive.md` · **Fondations :** Slices 0-5 (mergées)

---

## 0. Contexte

On re-skinne l'écran **Dépenses** (liste des comptes partagés + détail d'un compte) au style Le
Carnet. **Sans migration, sans photo.** La maquette « Dépenses » correspond à la **vue détail** d'un
groupe (Détail des dépenses + aside Total / Équilibre).

## 1. Contraintes e2e (`e2e/depenses.spec.ts` — vert sans modification)

Préserver : `groupe-form` (input `name="titre"` + bouton), `groupe-card` (+ lien interne),
`depense-form` (input `name="libelle"`, input `name="montant"`), `depense-row`, `soldes-panel`,
`solde-row`, `transfert-row`, `solde-regle`. Sous-composants `RemboursementForm`/`MembersList`/
`ShareForm`/`DepenseForm` montés inchangés.

## 2. UI liste (`/depenses`)

- Page : `PageHeader` eyebrow `depenses.eyebrow` (« Comptes partagés ») + titre `depenses.title`.
  `GroupeForm` (création) conservé + `GroupesList`.
- `GroupesList` : cartes re-skinnées — `<li data-testid="groupe-card">` + lien `/depenses/{id}` :
  **titre serif** + devise en `text-muted`. État vide `depenses.vide`.

## 3. UI détail (`GroupeDetail`)

- **En-tête** : eyebrow `depenses.eyebrow` + **titre serif** (`groupe.titre`).
- **Grille 2 colonnes** (`md:grid-cols-[1fr_320px]`) :
  - **gauche — Détail** : `SectionLabel` `depenses.depenses` + `DepensesList` re-skinné + `DepenseForm`.
  - **aside** : **Total** (Card : `SectionLabel` `depenses.total` + montant serif `formatCents(total,
    devise)` + ligne `depenses.parPersonne` = `formatCents(total/nbMembres, devise)`) ; **Équilibre**
    (`SoldesPanel` re-skinné) ; **Remboursement** (`SectionLabel` `depenses.remboursement` +
    `RemboursementForm`) ; **Membres** (Card : `MembersList` + `ShareForm` si owner).
- **Total** = `depenses.reduce((s, d) => s + d.montant_cents, 0)` (calcul local) ; par personne =
  `Math.round(total / Math.max(membres.length, 1))`.

### `DepensesList` (re-skin, `depense-row` conservé)
Lignes : **libellé** (ink) + sous-ligne `depenses.payePar {nom} · {date}` (`text-muted`) ; **montant
serif** (`formatCents`) à droite ; bouton supprimer (`deleteDepense`) conservé. La date (`d.date`)
est ajoutée à l'affichage.

### `SoldesPanel` (re-skin, testids conservés)
- `data-testid="soldes-panel"` + `SectionLabel` `depenses.equilibre`. Pour chaque solde
  (`solde-row`) : nom + montant `formatCents` **coloré selon le signe** (`soldeCents >= 0` →
  `text-kpi-green`, sinon `text-kpi-amber`). Transferts (`transfert-row`) / réglé (`solde-regle`)
  conservés, re-skinnés sobrement.

## 4. i18n (4 locales, parité garantie)

Ajouts : `depenses.eyebrow` (« Comptes partagés » / « Shared accounts » / « Conti condivisi » /
« Cuentas compartidas »), `depenses.total` (« Total du séjour » / « Trip total » / « Totale
soggiorno » / « Total del viaje »), `depenses.parPersonne` (« {montant} par personne » / « {montant}
per person » / « {montant} a persona » / « {montant} por persona »), `depenses.equilibre`
(« Équilibre » / « Balance » / « Bilancio » / « Balance »). Réutilise le reste. Pas de chaîne en dur.

## 5. Sécurité

- Lecture seule (RLS `can_access_groupe` / policies existantes). `getGroupeDetail`/`getMesGroupes`
  inchangés. Aucune action serveur, requête ou migration modifiée. Total calculé côté serveur à
  partir des données déjà chargées.

## 6. Tests

- **Unit** : `calculations`/`money` inchangés (verts) ; typecheck+lint+test verts ; parité i18n verte
  (4 nouvelles clés).
- **e2e** : `depenses.spec.ts` **vert sans modification** (testids + parcours création groupe/dépense
  + soldes conservés). Suite complète verte. Un `db reset` avant.
- **Build** : OK.
- Pas de nouveau test requis (re-skin présentationnel + calcul de total trivial).

## 7. Arbitrages / dette

- **Total / par personne** : somme brute des dépenses (pas de pondération par participant) ÷ nombre
  de membres — vue simple « part moyenne », cohérente avec la maquette. La répartition fine vit dans
  l'Équilibre (soldes).
- `GroupeForm` (création inline) conservé bien que la maquette montre un bouton « Ajouter » —
  fonctionnel nécessaire (e2e), re-skin différé si besoin.
- Couleurs de solde via tokens `--kpi-green` / `--kpi-amber` (déjà retunés Le Carnet en Slice 0).
