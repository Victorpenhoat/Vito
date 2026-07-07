# Intégration Stripe (paiement réel) — Design

**Date :** 2026-07-07
**Statut :** Validé (design). Plan d'implémentation à suivre.
**Branche :** `feat/stripe-integration`

---

## 0. Contexte

Le chantier 6a (`2026-06-22-chantier-6a-abonnement-design.md`) a posé l'abonnement Free/Premium
**mock-first**, en laissant explicitement la couture pour Stripe : abstraction `PaymentProvider`,
table `subscriptions` en lecture seule, commentaire *« le vrai Stripe passera par un webhook
service-role »*. Ce chantier **rend réel l'adaptateur différé** : Stripe Checkout (hébergé) pour
l'upgrade, Billing Portal pour la gestion, et un webhook service-role qui synchronise la table
`subscriptions`. Aucun changement d'architecture : on remplit la couture, rien de plus.

On respecte les conventions du repo : `features/<module>/{domain,data,ui}`, services mock-first
(`lib/services/<provider>/`), RLS + grants explicites, enforcement DB-level, types dérivés du schéma,
TDD, e2e sur le mock.

## 1. Décisions de cadrage (validées)

| Sujet | Décision |
|-------|----------|
| Type d'intégration | **Stripe Checkout hébergé** (redirect), pas Elements embarqués. La couture `{mode:"redirect"}` l'appelle déjà. |
| Gestion de l'abo | **Option A — Stripe Customer/Billing Portal** : annulation, CB et factures via le portail hébergé. `CancelButton` devient un lien « Gérer mon abonnement ». Pas de bouton annuler in-app. |
| Source de vérité | **Stripe** pour le statut ; la table `subscriptions` est le miroir alimenté **par webhook**. `is_premium(uid)` SQL reste la seule source du gating. |
| Bascule mock/réel | `getPaymentProvider()` renvoie Stripe si `env.STRIPE_SECRET_KEY` est présent, sinon Mock. Même pattern que places(google)/ocr(anthropic). **CI/e2e restent sur le mock.** |
| Bénéfices premium | **Inchangés** : premium débloque le gating existant (limite voyages). On n'élargit pas ce que premium débloque. |
| Prix | Définis dans le dashboard Stripe ; l'app référence des **Price IDs** via env (`STRIPE_PRICE_MONTHLY`/`_YEARLY`). Aucun montant en dur. |
| Hors scope (YAGNI) | Essai gratuit, codes promo, multi-tier (`tier in ('premium')`), renouvellement/facturation custom. |

## 2. Principe d'architecture

Prolonge la leçon C5 du chantier 6a (enforcement DB-level, statut non modifiable par le client) :

- **Écritures de statut uniquement par le service-role.** La table `subscriptions` reste en lecture
  seule pour `authenticated`. Le webhook Stripe écrit avec le **client service-role**
  (`SUPABASE_SERVICE_ROLE_KEY`), qui contourne la RLS légitimement — c'est le seul chemin d'écriture
  réel, exactement ce que le commentaire de `00011` anticipait.
- **`is_premium` inchangé = zéro logique de gating réécrite.** `isPremiumFrom` gère déjà « `canceled`
  mais `current_period_end > now()` » — soit **exactement** le comportement Stripe « cancel at period
  end ». Le webhook mappe l'état Stripe vers l'enum existant ; le gating n'est pas touché.
- **Webhook idempotent et vérifié.** Signature validée (`STRIPE_WEBHOOK_SECRET`) sur le **corps brut** ;
  upsert sur `user_id` ; events périmés ignorés (comparaison d'horodatage). Stripe rejoue en cas de 5xx.

## 3. Modèle de données (`supabase/migrations/00026_stripe_columns.sql`)

Ajout de deux colonnes à `subscriptions` (le reste du schéma 6a est conservé) :

```sql
alter table public.subscriptions
  add column stripe_customer_id text unique,
  add column stripe_subscription_id text unique;

create index subscriptions_stripe_customer_idx on public.subscriptions (stripe_customer_id);
```

- Le webhook upsert par `user_id` (contrainte unique existante), en renseignant
  `stripe_customer_id`/`stripe_subscription_id` au premier `checkout.session.completed`.
- **Mapping statut Stripe → enum `('active','canceled')`** (fait côté webhook, pas de nouvel enum) :
  `active`/`trialing`/`past_due` → `active` ; `canceled`/`unpaid`/`incomplete_expired` → `canceled`
  (avec `current_period_end` renseigné pour que `is_premium` prolonge jusqu'à échéance).
  *(Décision : `past_due` reste premium le temps que Stripe relance — dunning géré par Stripe.)*
- `mock_subscribe`/`cancel_subscription` (RPC 6a) **restent** pour le mode mock ; aucune modification.

## 4. Services (`src/lib/services/payment/`)

L'interface s'étend pour porter le contexte utilisateur (aujourd'hui `{period}` seul) :

```ts
// types.ts
export type CheckoutPlan = {
  period: "monthly" | "yearly";
  userId: string;
  email: string;
  customerId?: string; // stripe_customer_id si déjà connu
};
export type CheckoutResult = { mode: "activated" } | { mode: "redirect"; url: string };

export interface PaymentProvider {
  checkout(plan: CheckoutPlan): Promise<CheckoutResult>;
  portalUrl(customerId: string): Promise<string>; // Billing Portal (option A)
}
```

- **`stripe.ts` — `StripePaymentProvider`** (nouveau) :
  - `checkout` : crée une Checkout Session `mode: "subscription"`, `line_items` = Price ID selon
    `period`, `client_reference_id = userId`, `customer` (si `customerId`) sinon `customer_email`,
    `success_url`/`cancel_url` dérivées de `NEXT_PUBLIC_APP_URL` → `{mode:"redirect", url: session.url}`.
  - `portalUrl` : crée une Billing Portal Session pour `customerId` → URL de redirect.
  - Lit `STRIPE_SECRET_KEY`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY`, `NEXT_PUBLIC_APP_URL`.
- **`mock.ts`** : gagne `portalUrl()` (renvoie une URL factice `/abonnement`) pour satisfaire
  l'interface ; `checkout` inchangé (`{mode:"activated"}`).
- **`index.ts` — `getPaymentProvider()`** : `env.STRIPE_SECRET_KEY ? new StripePaymentProvider() : new MockPaymentProvider()`.

## 5. Webhook (`src/app/api/stripe/webhook/route.ts`)

- **Runtime `nodejs`** (pas edge — le SDK Stripe et la lecture du corps brut l'exigent) ; `POST` only.
- Lit le corps brut (`await req.text()`), vérifie la signature (`stripe.webhooks.constructEvent`).
- Client **service-role** dédié (`createServiceRoleClient()` avec `SUPABASE_SERVICE_ROLE_KEY`) — nouveau
  helper minimal dans `src/lib/supabase/` s'il n'existe pas.
- Events traités :
  - `checkout.session.completed` → upsert `subscriptions` (status `active`, `period`, `current_period_end`,
    `stripe_customer_id`, `stripe_subscription_id`) pour `user_id = session.client_reference_id`.
  - `customer.subscription.updated` → maj status (mapping §3), `current_period_end`, `period`.
  - `customer.subscription.deleted` → status `canceled`, `current_period_end` = fin de période.
- `revalidatePath("/abonnement")` + `/voyages` après écriture (le gating dépend de `is_premium`).

## 6. Actions & UI (`src/features/abonnement/`)

- **`subscribe` (existante)** : inchangée dans sa forme — elle renvoie déjà `{redirect}` quand le
  provider renvoie `redirect`. On lui passe désormais `userId`/`email`/`customerId` récupérés côté
  serveur (getCachedUser + ligne `subscriptions`).
- **`manageSubscription` (nouvelle action)** : lit `stripe_customer_id` de l'utilisateur → `portalUrl`
  → `{redirect}`. Erreur claire si pas de customer (utilisateur mock/jamais payé).
- **`SubscribeButtons`** : ajout de la gestion `{redirect}` (`useEffect` sur `state.redirect` →
  `window.location.href = url`). En mode mock, `subscribe` renvoie toujours `{ok}` → comportement actuel
  conservé.
- **`CancelButton` → `ManageButton`** : « Gérer mon abonnement » ; poste `manageSubscription`, gère
  `{redirect}`. En mode mock, on garde un fallback vers `cancel_subscription` pour ne pas casser l'e2e.
- **i18n** : clés `manage` (remplace/complète `cancel`) dans les messages `abonnement`.

## 7. Env (`src/lib/env.ts`)

Ajouts (tous **optionnels** — cohérent mock-first ; l'absence force le mock) :

```
STRIPE_WEBHOOK_SECRET   z.string().optional()
STRIPE_PRICE_MONTHLY    z.string().optional()
STRIPE_PRICE_YEARLY     z.string().optional()
NEXT_PUBLIC_APP_URL     z.string().url().optional()
```

`STRIPE_SECRET_KEY` et `SUPABASE_SERVICE_ROLE_KEY` sont **déjà** déclarés. Documenter le tout dans
`.env.example`. **Validation de cohérence** : si `STRIPE_SECRET_KEY` est présent, les 4 autres
(`WEBHOOK_SECRET`, les 2 Price IDs, `APP_URL`) et `SUPABASE_SERVICE_ROLE_KEY` deviennent requis —
un refine Zod qui échoue au cold-start avec un message lisible plutôt qu'un 500 opaque au premier paiement.

## 8. Gestion des erreurs

| Cas | Comportement |
|-----|--------------|
| Signature webhook invalide | `400`, rien écrit. |
| Event non géré | `200` (ignoré, pas d'erreur — Stripe ne rejoue pas). |
| Erreur DB dans le webhook | `500` → Stripe rejoue (idempotence garantit l'absence de double-effet). |
| `client_reference_id` absent/inconnu | log `logActionError`, `200` (on ne fait pas rejouer indéfiniment un event orphelin). |
| Échec création session Checkout/Portal | l'action renvoie `{error}` ; l'UI affiche le message. |
| `manageSubscription` sans customer | `{error}` « Aucun abonnement à gérer ». |

## 9. Tests

- **Unit (vitest)** :
  - `StripePaymentProvider` avec le SDK Stripe **mocké** : `checkout` construit la bonne session
    (price selon period, client_reference_id, urls) ; `portalUrl`.
  - Handler webhook : fixtures signées (via `stripe.webhooks.generateTestHeaderString`) pour les 3
    events → assert l'upsert (client Supabase mocké, cf. `src/test/supabaseMock.ts`) ; mapping statut ;
    idempotence ; signature invalide → 400.
  - `env` refine : `STRIPE_SECRET_KEY` sans les compléments → throw.
- **e2e (Playwright)** : **inchangés, sur le mock** (pas de vrai Stripe en CI). La bascule env garantit
  que `getPaymentProvider()` reste le mock en CI. On vérifie que le parcours mock (upgrade → premium →
  gestion) fonctionne toujours.
- **Vérif pré-push** : `npm run lint` + `tsc` + `test` (cf. mémoire `vito-verif-inclut-lint`).

## 10. Découpage d'implémentation (indicatif, pour le plan)

1. Migration `00026` (colonnes Stripe) + regénération types.
2. Interface `PaymentProvider` étendue + `mock.portalUrl` + tests mock verts (rien ne casse).
3. `StripePaymentProvider` + `getPaymentProvider()` bascule + tests unit.
4. Env (ajouts + refine) + `.env.example`.
5. Helper service-role + webhook + tests unit.
6. Actions (`subscribe` enrichie, `manageSubscription`) + UI (`SubscribeButtons` redirect, `ManageButton`) + i18n.
7. Vérif complète + e2e mock verts.

## 11. Dépendances

- `stripe` (SDK Node officiel) en dépendance de prod.
- Aucune nouvelle dépendance front (Checkout/Portal sont des redirects hébergés).
