# Stabilité e2e (durcissement post-action) — Design

**Date :** 2026-07-10
**Statut :** Validé (design). Plan d'implémentation à suivre.
**Branche :** `feat/e2e-stability`

---

## 0. Contexte

La suite Playwright (25 specs, 68 tests, `workers:1`, `retries:2` en CI) flake de façon récurrente
sous charge CI : re-runs nécessaires cette session (#103 depenses, #106 tempête 15 min). Cause
racine = **race RSC routeur systémique** (mémoire `vito-rsc-race-fiche-proche` : après une server
action, le slot enfant n'est parfois jamais commité — URL/rail à jour, ni page/loading/boundary, 0
erreur serveur ; interne Next). Elle frappe **n'importe quelle** assertion de visibilité post-action,
sur des tests différents selon le run.

Aujourd'hui la flakiness est *absorbée* par `retries:2`, mais au prix de re-runs, et via un
**patchwork de mitigations ad-hoc** réinventé spec par spec : `try/reload` (depenses, places,
restos), locators `.or()` de repli (depenses), `{ timeout: 10000-15000 }` dispersés (agence,
famille, restos), et des assertions post-action **non protégées** (voyages, abonnement,
conciergerie…). Aucun helper partagé.

Ce chantier remplace ce patchwork par **un helper partagé appliqué de façon cohérente**. Test-only :
zéro changement applicatif, zéro changement d'archi.

## 1. Décisions de cadrage (validées)

| Sujet | Décision |
|-------|----------|
| Approche | **Durcissement test-only** (option 1) : helper de robustesse post-action + migration cohérente. PAS de parallélisme/storageState (option 2), PAS d'investigation Next de fond (option 3). |
| Filet | `retries:2` en CI **conservé** (ceinture + bretelles). `workers:1` **conservé**. |
| Périmètre | Les assertions post-action vulnérables des **specs à form-submit** (9 specs recensées à l'audit) + les copies ad-hoc existantes, unifiées sur le helper. |
| But | Réduire les re-runs / tempêtes : la race est absorbée par un `reload` ciblé **sans** consommer un retry entier. |
| Hors scope (YAGNI) | storageState/parallélisme, fix Next, réécriture des tests non-mutateurs, nouveaux tests de features. |

## 2. Principe d'architecture

La race se manifeste sur une **assertion de visibilité/texte juste après une server action** (submit
d'un `*-form`, ou nav cliente déclenchée par une action). Un `page.reload()` re-rend la page fraîche
depuis la base et **re-commit le slot** — ça répare les deux sous-cas (refresh même-page ET redirect
nav, où recharger l'URL de destination reconstruit le rendu). Le helper encapsule : *tenter
l'assertion ; sur échec, reload ; ré-assertion*.

Point clé de conception : le reload **ne s'active que sur échec** de la 1ʳᵉ tentative. Un vrai bug
(élément réellement absent) échoue quand même après le reload → **le helper ne masque pas les vrais
échecs**, il n'absorbe que la race transitoire.

## 3. Le helper (`e2e/helpers.ts`)

```ts
import { expect, type Page, type Locator } from "@playwright/test";

// Assertion post-server-action robuste à la race RSC (slot non commité) : tente la visibilité,
// et sur échec recharge la page (rendu frais depuis la base, re-commit du slot) puis ré-assert.
// Le reload ne se déclenche QUE sur échec → un élément réellement absent échoue quand même
// (les vrais bugs ne sont pas masqués). Timeout court sur la 1ʳᵉ passe pour ne pas rallonger
// inutilement les cas nominaux.
export async function expectVisibleWithReload(
  page: Page,
  locator: Locator,
  opts: { timeout?: number } = {},
): Promise<void> {
  const timeout = opts.timeout ?? 10_000;
  try {
    await expect(locator).toBeVisible({ timeout });
  } catch {
    await page.reload();
    await expect(locator).toBeVisible({ timeout });
  }
}

// Variante texte (soldes, statuts) : même stratégie sur toContainText.
export async function expectTextWithReload(
  page: Page,
  locator: Locator,
  text: string | RegExp,
  opts: { timeout?: number } = {},
): Promise<void> {
  const timeout = opts.timeout ?? 10_000;
  try {
    await expect(locator).toContainText(text, { timeout });
  } catch {
    await page.reload();
    await expect(locator).toContainText(text, { timeout });
  }
}
```

Notes :
- Ces helpers **relocalisent** après reload : `locator` est ré-évalué (les `Locator` Playwright sont
  paresseux), donc la ré-assertion s'applique au DOM rechargé.
- Le timeout par défaut (10 s) unifie les `{ timeout: 15000 }` dispersés. Un appel peut le surcharger
  pour un cas légitimement lent (ex. build de carte).
- Contrainte : n'utiliser le helper que pour des assertions **idempotentes au reload** — l'état
  vérifié doit être persistant en base (un remboursement enregistré, un proche créé), pas un état
  éphémère d'UI (toast, focus). Les toasts/alertes de formulaire (ex. `getByRole("alert")`) restent
  en assertion directe.

## 4. Migration des specs

Pour chaque spec à form-submit, remplacer les assertions post-action vulnérables :

- **`depenses.spec.ts`** : les 2 `try/reload` manuscrits (partage test 1, solde-regle test 2)
  → `expectVisibleWithReload` ; le solde `toContainText("50,00")` → `expectTextWithReload`.
- **`restos.spec.ts`** : les 4 `reload()` ad-hoc → helper ; assertions d'avis/tag/favori post-action.
- **`places.spec.ts`** : le `reload()` ad-hoc (l.129) → helper.
- **`voyages.spec.ts`** : assertions post-création voyage/réservation/partage (aujourd'hui nues).
- **`famille.spec.ts`** : post-invite (`membre-row` count), post-création proche (heading fiche),
  post-modif. NB : les assertions **multi-contexte** (`pageA`/`ctxA`) et les `getByRole("alert")`
  (toast « déjà ») restent directes — pas idempotentes au reload.
- **`agence.spec.ts`** : `toBeEnabled` d'un bouton lent → garder `{ timeout }` direct (ce n'est pas
  une race post-action mais une activation de formulaire) ; assertions post-création voyage → helper.
- **`abonnement.spec.ts`, `conciergerie.spec.ts`, `vins.spec.ts`** : assertions post-action de statut
  / de ligne → helper là où l'état est persistant.

Règle : **ne migrer que les assertions post-server-action sur état persistant**. Laisser intactes
les assertions d'UI éphémère (toasts, `alert`, `toBeEnabled`), les navigations pures (`toHaveURL`),
et les assertions déjà déterministes.

## 5. Gestion des erreurs / non-régression

- Le helper ne masque pas les vrais échecs (§2). Un test dont l'assertion échoue réellement échoue
  après le reload (2× le timeout au pire — acceptable, c'est un échec).
- `retries:2` reste actif en CI : le helper **réduit** le recours aux retries, il ne les remplace pas.
- Les specs migrées doivent rester vertes en local CI-mode (`CI=true --retries=0`) — si une passe
  sans le helper mais échoue avec (impossible en principe, le helper est un sur-ensemble), investiguer.

## 6. Tests / vérification

- **Sanity du helper** : un mini-spec (`e2e/helpers.spec.ts`) qui vérifie le contrat sans dépendre de
  la race, sur une page réelle de l'app (ex. `/fr/login`, sans auth) : (a) un locator présent d'emblée
  (ex. le champ E-mail) → `expectVisibleWithReload` passe sans lever ; (b) un locator absent
  (`getByTestId("nexiste-pas")`) → le helper **lève** (via `await expect(fn()).rejects.toThrow()`),
  prouvant qu'il ne réussit pas à tort. Pour le cas (b), passer `{ timeout: 500 }` afin que la double
  tentative reste rapide (~1 s, pas 2×10 s).
- **Par spec migrée** : `CI=true npx playwright test <spec> --retries=0` reste vert (≥1 passe ;
  idéalement 2-3 pour la confiance).
- **Suite complète** : `npm run test:e2e` vert ; `npm run lint` + `npm run typecheck` clean (specs typées).
- **Mesure indicative** : quelques passes CI-mode de la suite complète pour constater la baisse de
  flakes (mesure, pas preuve — la race est non déterministe).

## 7. Découpage d'implémentation (indicatif, pour le plan)

1. `e2e/helpers.ts` (les 2 fonctions) + sanity du contrat (present → ok ; absent → échec après reload).
2. Migrer `depenses.spec.ts` (unifie ses 2 try/reload) — pilote de référence.
3. Migrer les autres specs à form-submit par lots (restos/places ; voyages/famille/agence ;
   abonnement/conciergerie/vins), chaque spec restant verte.
4. Vérif complète (suite + lint + typecheck) + PR.

## 8. Dépendances

Aucune nouvelle dépendance (`@playwright/test` déjà présent).
