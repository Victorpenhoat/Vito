# Slice 7 (épic Le Carnet) — Cercle : Famille + Conciergerie + Abonnement — Design

**Date :** 2026-06-26
**Statut :** Validé (décisions PO). Plan à suivre.
**Branche :** `carnet-cercle`
**Directive :** `docs/design/carnet-refonte-directive.md` · **Fondations :** Slices 0-6 (mergées)
**Dernière slice de l'épic Le Carnet.**

---

## 0. Contexte

On re-skinne les **trois écrans du groupe Cercle** (Famille, Conciergerie, Abonnement) au style Le
Carnet. **Sans migration, sans nouveau data.** Re-skin éditorial : en-têtes eyebrow + titres serif,
2 colonnes, pastilles de statut, cartes du kit. Décision PO : **grille tarifaire complète** pour
l'Abonnement, prix **9,90 €/mois · 99 €/an** (Gratuit = 0 €).

## 1. Contraintes e2e (vert sans modification)

- **Famille** (`famille.spec.ts`) : `famille-form`, `ajouter-famille`, `invite-form`, `membre-row`,
  `famille-resto-row`, `resto-search`.
- **Conciergerie** (`conciergerie.spec.ts`) : `demande-resto-form`, `demande-row`, `demande-statut`
  (texte exact = `t("statuts.<s>")`, ex. « Nouvelle »), `reponse-form`, `conciergerie-premium-cta`.
- **Abonnement** (`abonnement.spec.ts`) : `plan-actuel` (contient « jusqu'au » si annulé),
  `premium-badge`, `subscribe-monthly`, `cancel-sub`, `subscribe-form`, `subscribe-yearly`.
  Sous-composants `SubscribeButtons`/`CancelButton`/`DemandeHotelForm`/`InviteForm`/`MembresList`/
  `FamilleRestos`/`ConciergeInbox`/`ReponseForm` montés inchangés (sauf re-skin léger interne décrit).

## 2. Famille (`famille/page.tsx`)

- `PageHeader` eyebrow `famille.eyebrow` (« Mon foyer ») + titre = `ma.famille.nom` (ou `t("title")`
  si pas de foyer) + subtitle (compte membres/restos si foyer).
- Avec foyer : **2 colonnes** (`md:grid-cols-[1fr_300px]`) — gauche **Membres** (`SectionLabel` +
  `MembresList` + `InviteForm` si owner) ; aside **Card** « Partagé avec le foyer » (gros nombre serif
  = nb `famille-resto-row`) ; sous la grille, section **Restos** (`SectionLabel` + `FamilleRestos`).
- Sans foyer : eyebrow + titre + `FamilleForm` (re-skin léger).
- `MembresList`/`FamilleRestos` : testids conservés ; héritent des tokens (re-skin léger optionnel des
  lignes, sans changer la structure ni les actions).

## 3. Conciergerie (`conciergerie/page.tsx`)

- Client : `PageHeader` eyebrow `conciergerie.eyebrow` (« Service premium ») + titre `t("title")` +
  pastille `conciergerie.premiumActif` (« Premium actif »). **2 colonnes** — gauche **Mes demandes**
  (`SectionLabel` + `DemandesList`) ; aside **Card** « Nouvelle demande » (`DemandeHotelForm` ou un
  rappel + `demande-resto-form` selon l'existant). CTA premium (`conciergerie-premium-cta`) conservé.
- Staff (agence/admin) : `PageHeader` eyebrow + titre `t("inbox")` + `ConciergeInbox` (re-skin léger ;
  `reponse-form` conservé).
- **`DemandesList`** : chaque `demande-row` re-skinnée en ligne éditoriale (titre + détail) avec une
  **pastille de statut colorée** ; `data-testid="demande-statut"` conservé, **texte = `t("statuts.
  <s>")` inchangé** (l'e2e l'asserte). Couleur via map locale `statutBadge(statut)` (nouvelle → info,
  en_cours → amber, confirmee/traitee → green, refusee → red, défaut neutre).

## 4. Abonnement (`abonnement/page.tsx`) — grille tarifaire

- `PageHeader` eyebrow `abonnement.eyebrow` (« Votre formule ») + titre `t("title")`.
- **Grille 2 cartes** (`md:grid-cols-2`, `max-w-3xl`) :
  - **Gratuit** : label `abonnement.gratuit` + prix serif `abonnement.gratuitPrix` (« 0 € ») +
    `abonnement.gratuitSous` (« pour toujours ») + liste de features (carnet ✓, voyages ✓,
    conciergerie —, foyer —).
  - **Premium** : `data-testid="plan-actuel"`, bordure accent ; label `t("premium")` + prix serif
    `abonnement.prixMois` (« 9,90 € / mois ») + `abonnement.prixAn` (« ou 99 € / an ») + features (les
    4 ✓). **Badge** `premium-badge` (visible si `isPremium`). CTA :
    - `!isPremium` → `SubscribeButtons` (`subscribe-monthly`/`subscribe-yearly`) ;
    - `isPremium && !canceled` → `CancelButton` (`cancel-sub`) + ligne `renewsOn` ;
    - `canceled` → ligne `premiumUntil` (« Premium jusqu'au {date} » → contient « jusqu'au »).
- Composant interne `FeatureRow({ ok, label })` : ✓ accent si `ok`, sinon — `text-faint`.
- `plan-actuel` reste présent dans tous les états (la carte Premium) et contient le texte de statut.

## 5. i18n (4 locales, parité garantie)

Ajouts :
- `famille.eyebrow` (« Mon foyer »…).
- `conciergerie.eyebrow` (« Service premium »…), `conciergerie.premiumActif` (« Premium actif »…).
- `abonnement.eyebrow` (« Votre formule »…), `abonnement.gratuit` (« Gratuit »…),
  `abonnement.gratuitPrix` (« 0 € »), `abonnement.gratuitSous` (« pour toujours »…),
  `abonnement.prixMois` (« 9,90 € / mois »…), `abonnement.prixAn` (« ou 99 € / an »…),
  `abonnement.feat` = `{ carnet, voyages, conciergerie, foyer }` (4 libellés).

Pas de chaîne en dur ; les montants sont des libellés i18n (validés PO : 9,90 €/mois · 99 €/an).

## 6. Sécurité

- Lecture seule + actions existantes inchangées (RLS famille/conciergerie/abonnement en place). Aucune
  requête, action serveur ou migration modifiée. RBAC conciergerie (staff vs client) inchangé.

## 7. Tests

- **Unit** : typecheck+lint+test verts ; parité i18n verte (toutes les nouvelles clés × 4 locales).
- **e2e** : `famille.spec.ts` / `conciergerie.spec.ts` / `abonnement.spec.ts` **verts sans
  modification** (testids + parcours conservés ; `demande-statut` texte inchangé ; flux abonnement
  free→premium→cancel intact). Suite complète verte. Un `db reset` avant.
- **Build** : OK.
- Pas de nouveau test requis (re-skin présentationnel).

## 8. Arbitrages / dette

- Prix Premium en dur via i18n (9,90 €/mois · 99 €/an) — pas de facturation réelle branchée ; à relier
  à un vrai pricing si Stripe/billing évolue.
- `MembresList`/`FamilleRestos`/`ConciergeInbox` : re-skin léger (héritent des tokens) ; refonte fine
  de leurs lignes différable.
- Inputs en `rounded-xl` résiduels (dette globale de l'épic) : harmonisation `rounded-control`
  différée.
- **Fin de l'épic Le Carnet** après cette slice : tous les écrans de la maquette sont re-skinnés.
