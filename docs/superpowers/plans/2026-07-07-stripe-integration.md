# Intégration Stripe — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre réel l'adaptateur de paiement Stripe différé du chantier 6a : Checkout hébergé pour l'upgrade, Billing Portal pour la gestion, webhook service-role synchronisant `subscriptions`.

**Architecture:** On remplit la couture `PaymentProvider` existante — aucun changement d'archi. Stripe devient la source de vérité du statut ; la table `subscriptions` est un miroir alimenté par webhook (client service-role, seul chemin d'écriture). `is_premium(uid)` SQL reste la seule source du gating. Bascule mock/réel par `env.STRIPE_SECRET_KEY` ; CI/e2e restent sur le mock.

**Tech Stack:** Next.js 16 App Router (route handler `nodejs`), Supabase (RLS + service-role), `stripe` SDK Node, Zod v4, Vitest, next-intl.

## Global Constraints

- **Mock-first** : `getPaymentProvider()` renvoie Stripe **uniquement** si `env.STRIPE_SECRET_KEY` est défini ; sinon Mock. CI/e2e n'ont pas de clé → mock.
- **Écriture `subscriptions` = service-role uniquement** (`createAdminClient()`), jamais `authenticated`. RLS lecture-seule conservée.
- **`is_premium` / `isPremiumFrom` inchangés** — le webhook mappe l'état Stripe vers l'enum existant `('active','canceled')`, aucune logique de gating réécrite.
- **Enum statut inchangé** : `active`/`trialing`/`past_due` → `active` ; `canceled`/`unpaid`/`incomplete_expired` → `canceled`.
- **Aucun montant en dur** : Price IDs via `env.STRIPE_PRICE_MONTHLY` / `STRIPE_PRICE_YEARLY`.
- **Bénéfices premium inchangés** (gating limite voyages).
- **Vérif pré-push** : `npm run typecheck && npm run lint && npm run test` doivent passer (mémoire `vito-verif-inclut-lint`).
- **AGENTS.md** : lire le guide Next pertinent dans `node_modules/next/dist/docs/` avant d'écrire une route handler (API changée vs training data).
- Types dérivés du schéma via `npm run db:types` après toute migration.
- Branche : `feat/stripe-integration` (déjà créée, le spec y est commité).

---

### Task 1: Migration — colonnes Stripe sur `subscriptions`

**Files:**
- Create: `supabase/migrations/00026_stripe_columns.sql`
- Modify: `src/types/database.types.ts` (régénéré, ne pas éditer à la main)

**Interfaces:**
- Produces: colonnes `subscriptions.stripe_customer_id` (text, unique, nullable), `subscriptions.stripe_subscription_id` (text, unique, nullable). Aucune nouvelle fonction SQL.

- [ ] **Step 1: Écrire la migration**

Create `supabase/migrations/00026_stripe_columns.sql` :

```sql
-- Intégration Stripe réelle : identifiants Stripe sur la ligne subscriptions.
-- Renseignés par le webhook service-role au premier checkout.session.completed.
-- Nullable : les lignes créées en mode mock (mock_subscribe) n'en ont pas.
alter table public.subscriptions
  add column stripe_customer_id text unique,
  add column stripe_subscription_id text unique;

create index subscriptions_stripe_customer_idx
  on public.subscriptions (stripe_customer_id);
```

- [ ] **Step 2: Appliquer la migration en local**

Run: `supabase db reset` (ou `supabase migration up`)
Expected: applique jusqu'à `00026` sans erreur ; `subscriptions` a les 2 nouvelles colonnes.

- [ ] **Step 3: Régénérer les types**

Run: `npm run db:types`
Expected: `src/types/database.types.ts` inclut `stripe_customer_id: string | null` et `stripe_subscription_id: string | null` dans `subscriptions` (Row/Insert/Update).

- [ ] **Step 4: Vérifier la compilation**

Run: `npm run typecheck`
Expected: PASS (aucun usage encore, juste le schéma élargi).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/00026_stripe_columns.sql src/types/database.types.ts
git commit -m "feat(abonnement): colonnes stripe_customer_id/subscription_id sur subscriptions"
```

---

### Task 2: Étendre l'interface `PaymentProvider` + mock `portalUrl`

**Files:**
- Modify: `src/lib/services/payment/types.ts`
- Modify: `src/lib/services/payment/mock.ts`
- Modify: `src/lib/services/payment/mock.test.ts`

**Interfaces:**
- Consumes: rien (types de base).
- Produces :
  - `CheckoutPlan = { period: "monthly" | "yearly"; userId: string; email: string; customerId?: string }`
  - `CheckoutResult = { mode: "activated" } | { mode: "redirect"; url: string }` (inchangé)
  - `PaymentProvider.checkout(plan: CheckoutPlan): Promise<CheckoutResult>` et `PaymentProvider.portalUrl(customerId: string): Promise<string>`
  - `MockPaymentProvider` implémente les deux : `checkout` → `{mode:"activated"}` ; `portalUrl` → `"/abonnement"`.

- [ ] **Step 1: Écrire le test mock**

Modify `src/lib/services/payment/mock.test.ts` — ajouter, après le test existant :

```ts
  it("portalUrl renvoie une URL de repli locale (mode mock)", async () => {
    const r = await new MockPaymentProvider().portalUrl("cus_mock");
    expect(r).toBe("/abonnement");
  });
```

- [ ] **Step 2: Lancer le test → échec**

Run: `npm run test -- src/lib/services/payment/mock.test.ts`
Expected: FAIL (`portalUrl` n'existe pas sur `MockPaymentProvider`).

- [ ] **Step 3: Étendre les types**

Replace le contenu de `src/lib/services/payment/types.ts` par :

```ts
export type CheckoutPlan = {
  period: "monthly" | "yearly";
  userId: string;
  email: string;
  customerId?: string; // stripe_customer_id si déjà connu
};
export type CheckoutResult = { mode: "activated" } | { mode: "redirect"; url: string };

export interface PaymentProvider {
  checkout(plan: CheckoutPlan): Promise<CheckoutResult>;
  portalUrl(customerId: string): Promise<string>;
}
```

- [ ] **Step 4: Étendre le mock**

Replace le contenu de `src/lib/services/payment/mock.ts` par :

```ts
import type { PaymentProvider, CheckoutPlan, CheckoutResult } from "./types";

// Mock-first : « paie » immédiatement. L'activation premium réelle se fait via la RPC mock_subscribe.
export class MockPaymentProvider implements PaymentProvider {
  async checkout(_plan: CheckoutPlan): Promise<CheckoutResult> {
    return { mode: "activated" };
  }
  async portalUrl(_customerId: string): Promise<string> {
    return "/abonnement";
  }
}
```

- [ ] **Step 5: Lancer les tests → succès**

Run: `npm run test -- src/lib/services/payment/mock.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/services/payment/types.ts src/lib/services/payment/mock.ts src/lib/services/payment/mock.test.ts
git commit -m "feat(payment): étendre PaymentProvider (contexte user + portalUrl)"
```

---

### Task 3: `StripePaymentProvider` + bascule `getPaymentProvider`

**Files:**
- Create: `src/lib/services/payment/stripe.ts`
- Create: `src/lib/services/payment/stripe.test.ts`
- Modify: `src/lib/services/payment/index.ts`
- Modify: `package.json` (dépendance `stripe`)

**Interfaces:**
- Consumes: `PaymentProvider`, `CheckoutPlan`, `CheckoutResult` (Task 2) ; `env` (Task 4 ajoute les clés, mais `STRIPE_SECRET_KEY` existe déjà).
- Produces:
  - `StripePaymentProvider` (implémente `PaymentProvider`) — constructeur `new StripePaymentProvider(stripe: Stripe)` (injection pour testabilité).
  - `getPaymentProvider(): PaymentProvider` — Stripe si `env.STRIPE_SECRET_KEY`, sinon Mock.

- [ ] **Step 1: Installer le SDK Stripe**

Run: `npm install stripe`
Expected: `stripe` ajouté à `dependencies` de `package.json`.

- [ ] **Step 2: Écrire les tests**

Create `src/lib/services/payment/stripe.test.ts` :

```ts
import { describe, it, expect, vi } from "vitest";
import { StripePaymentProvider } from "./stripe";

vi.mock("@/lib/env", () => ({
  env: {
    STRIPE_PRICE_MONTHLY: "price_m",
    STRIPE_PRICE_YEARLY: "price_y",
    NEXT_PUBLIC_APP_URL: "https://vito.test",
  },
}));

function fakeStripe() {
  return {
    checkout: { sessions: { create: vi.fn(async () => ({ url: "https://checkout.stripe/x" })) } },
    billingPortal: { sessions: { create: vi.fn(async () => ({ url: "https://portal.stripe/y" })) } },
  };
}

describe("StripePaymentProvider", () => {
  it("checkout crée une session subscription et renvoie l'URL de redirect", async () => {
    const s = fakeStripe();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = new StripePaymentProvider(s as any);
    const r = await p.checkout({ period: "monthly", userId: "u1", email: "a@b.c" });
    expect(r).toEqual({ mode: "redirect", url: "https://checkout.stripe/x" });
    const arg = s.checkout.sessions.create.mock.calls[0][0];
    expect(arg).toMatchObject({
      mode: "subscription",
      client_reference_id: "u1",
      customer_email: "a@b.c",
      line_items: [{ price: "price_m", quantity: 1 }],
    });
    expect(arg.success_url).toContain("https://vito.test");
  });

  it("checkout utilise le price annuel et customer existant", async () => {
    const s = fakeStripe();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = new StripePaymentProvider(s as any);
    await p.checkout({ period: "yearly", userId: "u1", email: "a@b.c", customerId: "cus_1" });
    const arg = s.checkout.sessions.create.mock.calls[0][0];
    expect(arg.line_items[0].price).toBe("price_y");
    expect(arg.customer).toBe("cus_1");
    expect(arg.customer_email).toBeUndefined();
  });

  it("portalUrl crée une session de portail et renvoie l'URL", async () => {
    const s = fakeStripe();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = new StripePaymentProvider(s as any);
    const url = await p.portalUrl("cus_1");
    expect(url).toBe("https://portal.stripe/y");
    expect(s.billingPortal.sessions.create.mock.calls[0][0]).toMatchObject({ customer: "cus_1" });
  });
});
```

- [ ] **Step 3: Lancer les tests → échec**

Run: `npm run test -- src/lib/services/payment/stripe.test.ts`
Expected: FAIL (`./stripe` introuvable).

- [ ] **Step 4: Écrire l'adaptateur**

Create `src/lib/services/payment/stripe.ts` :

```ts
import Stripe from "stripe";
import { env } from "@/lib/env";
import type { PaymentProvider, CheckoutPlan, CheckoutResult } from "./types";

// Adaptateur Stripe réel. Checkout hébergé (redirect) + Billing Portal.
// Le statut premium est ensuite synchronisé par le webhook (jamais ici).
export class StripePaymentProvider implements PaymentProvider {
  constructor(private readonly stripe: Stripe) {}

  async checkout(plan: CheckoutPlan): Promise<CheckoutResult> {
    const price = plan.period === "monthly" ? env.STRIPE_PRICE_MONTHLY! : env.STRIPE_PRICE_YEARLY!;
    const base = env.NEXT_PUBLIC_APP_URL!;
    const session = await this.stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      client_reference_id: plan.userId,
      ...(plan.customerId ? { customer: plan.customerId } : { customer_email: plan.email }),
      success_url: `${base}/abonnement?checkout=success`,
      cancel_url: `${base}/abonnement?checkout=cancel`,
    });
    return { mode: "redirect", url: session.url! };
  }

  async portalUrl(customerId: string): Promise<string> {
    const session = await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${env.NEXT_PUBLIC_APP_URL!}/abonnement`,
    });
    return session.url;
  }
}
```

- [ ] **Step 5: Câbler la bascule**

Replace `src/lib/services/payment/index.ts` par :

```ts
import Stripe from "stripe";
import { env } from "@/lib/env";
import { MockPaymentProvider } from "./mock";
import { StripePaymentProvider } from "./stripe";
import type { PaymentProvider } from "./types";

export function getPaymentProvider(): PaymentProvider {
  // Bascule mock/réel : sans clé Stripe (local/CI/e2e) on reste sur le mock.
  if (env.STRIPE_SECRET_KEY) {
    return new StripePaymentProvider(new Stripe(env.STRIPE_SECRET_KEY));
  }
  return new MockPaymentProvider();
}

export type { PaymentProvider, CheckoutPlan, CheckoutResult } from "./types";
```

- [ ] **Step 6: Lancer les tests → succès**

Run: `npm run test -- src/lib/services/payment/`
Expected: PASS (mock 2 + stripe 3).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/lib/services/payment/stripe.ts src/lib/services/payment/stripe.test.ts src/lib/services/payment/index.ts
git commit -m "feat(payment): adaptateur Stripe réel (Checkout + Portal) + bascule env"
```

---

### Task 4: Env — clés Stripe + refine de cohérence

**Files:**
- Modify: `src/lib/env.ts`
- Create: `src/lib/env.test.ts`
- Modify: `.env.example`

**Interfaces:**
- Consumes: rien.
- Produces: `env.STRIPE_WEBHOOK_SECRET`, `env.STRIPE_PRICE_MONTHLY`, `env.STRIPE_PRICE_YEARLY`, `env.NEXT_PUBLIC_APP_URL` (tous `string | undefined`). Refine : si `STRIPE_SECRET_KEY` défini, les 4 ci-dessus + `SUPABASE_SERVICE_ROLE_KEY` sont requis.

- [ ] **Step 1: Écrire le test du refine**

Create `src/lib/env.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { z } from "zod";

// Reproduit le schéma + refine de src/lib/env.ts pour tester la règle de cohérence
// sans muter process.env global. La forme testée DOIT rester identique à env.ts.
function buildSchema() {
  return z
    .object({
      NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
      NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
      SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
      STRIPE_SECRET_KEY: z.string().optional(),
      STRIPE_WEBHOOK_SECRET: z.string().optional(),
      STRIPE_PRICE_MONTHLY: z.string().optional(),
      STRIPE_PRICE_YEARLY: z.string().optional(),
      NEXT_PUBLIC_APP_URL: z.string().url().optional(),
    })
    .refine((v) => !v.STRIPE_SECRET_KEY || (v.STRIPE_WEBHOOK_SECRET && v.STRIPE_PRICE_MONTHLY && v.STRIPE_PRICE_YEARLY && v.NEXT_PUBLIC_APP_URL && v.SUPABASE_SERVICE_ROLE_KEY), {
      message: "STRIPE_SECRET_KEY présent : STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_MONTHLY, STRIPE_PRICE_YEARLY, NEXT_PUBLIC_APP_URL et SUPABASE_SERVICE_ROLE_KEY sont requis",
    });
}

const base = { NEXT_PUBLIC_SUPABASE_URL: "http://x.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "k" };

describe("env refine Stripe", () => {
  it("mock-first : sans clé Stripe, valide", () => {
    expect(buildSchema().safeParse(base).success).toBe(true);
  });
  it("clé Stripe sans compléments → invalide", () => {
    expect(buildSchema().safeParse({ ...base, STRIPE_SECRET_KEY: "sk" }).success).toBe(false);
  });
  it("clé Stripe avec tous les compléments → valide", () => {
    const r = buildSchema().safeParse({
      ...base, STRIPE_SECRET_KEY: "sk", STRIPE_WEBHOOK_SECRET: "wh",
      STRIPE_PRICE_MONTHLY: "pm", STRIPE_PRICE_YEARLY: "py",
      NEXT_PUBLIC_APP_URL: "https://a.co", SUPABASE_SERVICE_ROLE_KEY: "srv",
    });
    expect(r.success).toBe(true);
  });
});
```

- [ ] **Step 2: Lancer le test → échec**

Run: `npm run test -- src/lib/env.test.ts`
Expected: PASS déjà possible (le test est autonome). Si PASS, continuer — c'est le contrat qu'`env.ts` doit refléter.

- [ ] **Step 3: Modifier `env.ts`**

Dans `src/lib/env.ts`, ajouter les 4 champs au `z.object` (après `STRIPE_SECRET_KEY`) :

```ts
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_MONTHLY: z.string().optional(),
  STRIPE_PRICE_YEARLY: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
```

Ajouter les 4 clés correspondantes dans l'objet passé à `safeParse` :

```ts
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  STRIPE_PRICE_MONTHLY: process.env.STRIPE_PRICE_MONTHLY,
  STRIPE_PRICE_YEARLY: process.env.STRIPE_PRICE_YEARLY,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
```

Remplacer `const schema = z.object({ ... });` pour chaîner le refine — càd transformer la déclaration en :

```ts
const schema = z
  .object({
    // ... tous les champs existants + les 4 ajoutés ...
  })
  .refine(
    (v) =>
      !v.STRIPE_SECRET_KEY ||
      (v.STRIPE_WEBHOOK_SECRET &&
        v.STRIPE_PRICE_MONTHLY &&
        v.STRIPE_PRICE_YEARLY &&
        v.NEXT_PUBLIC_APP_URL &&
        v.SUPABASE_SERVICE_ROLE_KEY),
    { message: "STRIPE_SECRET_KEY présent : STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_MONTHLY, STRIPE_PRICE_YEARLY, NEXT_PUBLIC_APP_URL et SUPABASE_SERVICE_ROLE_KEY sont requis" }
  );
```

- [ ] **Step 4: Documenter dans `.env.example`**

Ajouter à `.env.example` (créer le fichier s'il n'existe pas — reprendre d'abord les clés déjà présentes) :

```
# Stripe (optionnel — absent = paiement mock). Si STRIPE_SECRET_KEY est défini,
# les 4 lignes suivantes + SUPABASE_SERVICE_ROLE_KEY deviennent obligatoires.
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_MONTHLY=
STRIPE_PRICE_YEARLY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

- [ ] **Step 5: Vérifier**

Run: `npm run test -- src/lib/env.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/env.ts src/lib/env.test.ts .env.example
git commit -m "feat(env): clés Stripe + refine de cohérence (clé ⇒ compléments requis)"
```

---

### Task 5: Mapping statut + synchro webhook (logique pure, testable)

**Files:**
- Create: `src/features/abonnement/domain/stripeStatus.ts`
- Create: `src/features/abonnement/domain/stripeStatus.test.ts`

**Interfaces:**
- Consumes: rien.
- Produces:
  - `mapStripeStatus(s: string): "active" | "canceled"` — `active`/`trialing`/`past_due` → `active` ; tout le reste → `canceled`.
  - `intervalToPeriod(i: string): "monthly" | "yearly"` — `"month"` → `"monthly"`, `"year"` → `"yearly"`.

- [ ] **Step 1: Écrire les tests**

Create `src/features/abonnement/domain/stripeStatus.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { mapStripeStatus, intervalToPeriod } from "./stripeStatus";

describe("mapStripeStatus", () => {
  it.each(["active", "trialing", "past_due"])("%s → active", (s) => {
    expect(mapStripeStatus(s)).toBe("active");
  });
  it.each(["canceled", "unpaid", "incomplete_expired"])("%s → canceled", (s) => {
    expect(mapStripeStatus(s)).toBe("canceled");
  });
});

describe("intervalToPeriod", () => {
  it("month → monthly", () => expect(intervalToPeriod("month")).toBe("monthly"));
  it("year → yearly", () => expect(intervalToPeriod("year")).toBe("yearly"));
});
```

- [ ] **Step 2: Lancer → échec**

Run: `npm run test -- src/features/abonnement/domain/stripeStatus.test.ts`
Expected: FAIL (module absent).

- [ ] **Step 3: Écrire la logique**

Create `src/features/abonnement/domain/stripeStatus.ts` :

```ts
// Mapping Stripe → enum subscriptions ('active'|'canceled'). past_due reste premium
// le temps que Stripe relance (dunning géré côté Stripe).
export function mapStripeStatus(s: string): "active" | "canceled" {
  return s === "active" || s === "trialing" || s === "past_due" ? "active" : "canceled";
}

export function intervalToPeriod(i: string): "monthly" | "yearly" {
  return i === "year" ? "yearly" : "monthly";
}
```

- [ ] **Step 4: Lancer → succès**

Run: `npm run test -- src/features/abonnement/domain/stripeStatus.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/abonnement/domain/stripeStatus.ts src/features/abonnement/domain/stripeStatus.test.ts
git commit -m "feat(abonnement): mapping statut/période Stripe (pur, testé)"
```

---

### Task 6: Handler de synchro `subscriptions` (service-role)

**Files:**
- Create: `src/features/abonnement/data/syncStripe.ts`
- Create: `src/features/abonnement/data/syncStripe.test.ts`

**Interfaces:**
- Consumes: `mapStripeStatus`, `intervalToPeriod` (Task 5) ; `createAdminClient` (existant, `src/lib/supabase/admin.ts`).
- Produces: `syncSubscriptionFromEvent(event: Stripe.Event, stripe: Stripe): Promise<void>` — sur `checkout.session.completed` / `customer.subscription.updated` / `customer.subscription.deleted`, upsert la ligne `subscriptions` (par `user_id`). Ignore silencieusement les autres types.

- [ ] **Step 1: Écrire les tests**

Create `src/features/abonnement/data/syncStripe.test.ts` :

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabase } from "@/test/supabaseMock";

let mock: ReturnType<typeof createMockSupabase>;
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => mock.client }));

import { syncSubscriptionFromEvent } from "./syncStripe";

const sub = {
  id: "sub_1",
  customer: "cus_1",
  status: "active",
  current_period_end: 1893456000, // 2030-01-01
  items: { data: [{ price: { recurring: { interval: "month" } } }] },
  metadata: {},
};

function stripeStub(retrieved: unknown) {
  return { subscriptions: { retrieve: vi.fn(async () => retrieved) } };
}

beforeEach(() => { mock = createMockSupabase({ on: () => ({ data: null, error: null }) }); });

describe("syncSubscriptionFromEvent", () => {
  it("checkout.session.completed → upsert subscriptions active", async () => {
    const s = stripeStub(sub);
    const event = { type: "checkout.session.completed", data: { object: { client_reference_id: "u1", subscription: "sub_1", customer: "cus_1" } } };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await syncSubscriptionFromEvent(event as any, s as any);
    const call = mock.calls.find((c) => c.kind === "table" && c.op === "insert");
    expect(call).toMatchObject({ table: "subscriptions", op: "insert" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload = (call as any).payload;
    expect(payload).toMatchObject({
      user_id: "u1", status: "active", period: "monthly",
      stripe_customer_id: "cus_1", stripe_subscription_id: "sub_1",
    });
    expect(payload.current_period_end).toBe("2030-01-01T00:00:00.000Z");
  });

  it("customer.subscription.deleted → upsert canceled", async () => {
    const s = stripeStub(sub);
    const event = { type: "customer.subscription.deleted", data: { object: { ...sub, status: "canceled", metadata: { user_id: "u1" } } } };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await syncSubscriptionFromEvent(event as any, s as any);
    const call = mock.calls.find((c) => c.kind === "table" && c.op === "insert");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((call as any).payload).toMatchObject({ user_id: "u1", status: "canceled" });
  });

  it("type non géré → aucun appel DB", async () => {
    const s = stripeStub(sub);
    const event = { type: "invoice.paid", data: { object: {} } };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await syncSubscriptionFromEvent(event as any, s as any);
    expect(mock.calls.length).toBe(0);
  });
});
```

- [ ] **Step 2: Ajouter `upsert` au harnais mock**

Le harnais `src/test/supabaseMock.ts` ne gère pas `.upsert()`. Ajouter dans l'objet `q` de `from()` (à côté de `insert`), et compter comme `op: "insert"` (même sémantique côté assertion) :

```ts
      upsert: (payload: unknown) => { state.op = "insert"; state.payload = payload; calls.push({ kind: "table", table, op: "insert", payload }); return q; },
```

- [ ] **Step 3: Lancer → échec**

Run: `npm run test -- src/features/abonnement/data/syncStripe.test.ts`
Expected: FAIL (`./syncStripe` absent).

- [ ] **Step 4: Écrire le handler**

Create `src/features/abonnement/data/syncStripe.ts` :

```ts
import "server-only";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { mapStripeStatus, intervalToPeriod } from "../domain/stripeStatus";

// Écrit le miroir subscriptions depuis un event Stripe. Service-role (contourne la RLS
// lecture-seule) : c'est le seul chemin d'écriture réel. Idempotent (upsert par user_id).
export async function syncSubscriptionFromEvent(event: Stripe.Event, stripe: Stripe): Promise<void> {
  let userId: string | null = null;
  let subscriptionId: string | null = null;

  if (event.type === "checkout.session.completed") {
    const s = event.data.object as Stripe.Checkout.Session;
    userId = s.client_reference_id;
    subscriptionId = typeof s.subscription === "string" ? s.subscription : null;
  } else if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const s = event.data.object as Stripe.Subscription;
    subscriptionId = s.id;
    userId = (s.metadata?.user_id as string | undefined) ?? null;
  } else {
    return; // type non géré
  }

  if (!subscriptionId) return;
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  // user_id : client_reference_id (checkout) sinon metadata.user_id ; à défaut, abandon (event orphelin).
  userId = userId ?? ((sub.metadata?.user_id as string | undefined) ?? null);
  if (!userId) return;

  const interval = sub.items.data[0]?.price.recurring?.interval ?? "month";
  const admin = createAdminClient();
  await admin.from("subscriptions").upsert(
    {
      user_id: userId,
      tier: "premium",
      status: mapStripeStatus(sub.status),
      period: intervalToPeriod(interval),
      current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
      stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
      stripe_subscription_id: sub.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
}
```

- [ ] **Step 5: Lancer → succès**

Run: `npm run test -- src/features/abonnement/data/syncStripe.test.ts src/test`
Expected: PASS (3 tests syncStripe ; le harnais reste vert pour les autres features).

- [ ] **Step 6: Commit**

```bash
git add src/features/abonnement/data/syncStripe.ts src/features/abonnement/data/syncStripe.test.ts src/test/supabaseMock.ts
git commit -m "feat(abonnement): synchro subscriptions depuis events Stripe (service-role, upsert)"
```

---

### Task 7: Route webhook `/api/stripe/webhook`

**Files:**
- Create: `src/app/api/stripe/webhook/route.ts`
- Create: `src/app/api/stripe/webhook/route.test.ts`

**Interfaces:**
- Consumes: `syncSubscriptionFromEvent` (Task 6) ; `env.STRIPE_SECRET_KEY`, `env.STRIPE_WEBHOOK_SECRET`.
- Produces: `POST(req: Request): Promise<Response>` (route handler `nodejs`). 400 signature invalide ; 200 sinon (event traité ou ignoré) ; 500 si la synchro jette.

- [ ] **Step 0: Lire le guide Next**

Read: `node_modules/next/dist/docs/` — section route handlers / `runtime`. Confirmer la façon de déclarer `export const runtime = "nodejs"` et la signature `POST(request: Request)` dans cette version.

- [ ] **Step 1: Écrire les tests**

Create `src/app/api/stripe/webhook/route.test.ts` :

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/env", () => ({ env: { STRIPE_SECRET_KEY: "sk", STRIPE_WEBHOOK_SECRET: "wh" } }));

const constructEvent = vi.fn();
const sync = vi.fn(async () => {});
vi.mock("stripe", () => ({
  default: class {
    webhooks = { constructEvent };
  },
}));
vi.mock("@/features/abonnement/data/syncStripe", () => ({ syncSubscriptionFromEvent: (...a: unknown[]) => sync(...a) }));

import { POST } from "./route";

function req(body = "{}") {
  return new Request("http://x/api/stripe/webhook", {
    method: "POST", body, headers: { "stripe-signature": "sig" },
  });
}

beforeEach(() => { constructEvent.mockReset(); sync.mockClear(); });

describe("POST /api/stripe/webhook", () => {
  it("signature valide → 200 + synchro", async () => {
    constructEvent.mockReturnValue({ type: "checkout.session.completed", data: { object: {} } });
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(sync).toHaveBeenCalledOnce();
  });

  it("signature invalide → 400, pas de synchro", async () => {
    constructEvent.mockImplementation(() => { throw new Error("bad sig"); });
    const res = await POST(req());
    expect(res.status).toBe(400);
    expect(sync).not.toHaveBeenCalled();
  });

  it("synchro qui jette → 500 (Stripe rejoue)", async () => {
    constructEvent.mockReturnValue({ type: "checkout.session.completed", data: { object: {} } });
    sync.mockRejectedValueOnce(new Error("db down"));
    const res = await POST(req());
    expect(res.status).toBe(500);
  });
});
```

- [ ] **Step 2: Lancer → échec**

Run: `npm run test -- src/app/api/stripe/webhook/route.test.ts`
Expected: FAIL (`./route` absent).

- [ ] **Step 3: Écrire la route**

Create `src/app/api/stripe/webhook/route.ts` :

```ts
import Stripe from "stripe";
import { env } from "@/lib/env";
import { logActionError } from "@/lib/actionError";
import { syncSubscriptionFromEvent } from "@/features/abonnement/data/syncStripe";

// Corps brut requis pour la vérif de signature → runtime nodejs (pas edge).
export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const stripe = new Stripe(env.STRIPE_SECRET_KEY!);
  const body = await request.text();
  const sig = request.headers.get("stripe-signature") ?? "";

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    logActionError("stripe.webhook.signature", err);
    return new Response("signature invalide", { status: 400 });
  }

  try {
    await syncSubscriptionFromEvent(event, stripe);
  } catch (err) {
    logActionError("stripe.webhook.sync", err);
    return new Response("erreur de synchro", { status: 500 }); // Stripe rejouera
  }
  return new Response(null, { status: 200 });
}
```

- [ ] **Step 4: Lancer → succès**

Run: `npm run test -- src/app/api/stripe/webhook/route.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/stripe/webhook/route.ts src/app/api/stripe/webhook/route.test.ts
git commit -m "feat(abonnement): route webhook Stripe (signature + synchro service-role)"
```

---

### Task 8: Actions `subscribe` enrichie + `manageSubscription`

**Files:**
- Modify: `src/features/abonnement/data/actions.ts`
- Modify: `src/features/abonnement/data/actions.test.ts`
- Modify: `src/features/abonnement/data/queries.ts`

**Interfaces:**
- Consumes: `getPaymentProvider` (Task 3) ; `getSubscription` (existant, à étendre pour exposer `stripe_customer_id`).
- Produces:
  - `subscribe` : passe `{ period, userId, email, customerId }` au provider ; renvoie `{redirect}` (Stripe) ou `{ok}` (mock) — inchangé côté forme.
  - `manageSubscription(_prev, _formData)` : `{redirect: portalUrl}` ou `{error}` si pas de `stripe_customer_id`.
  - `getSubscription` renvoie aussi `stripe_customer_id`.

- [ ] **Step 1: Étendre `getSubscription`**

Dans `src/features/abonnement/data/queries.ts`, ajouter `stripe_customer_id` au `select` :

```ts
  const { data } = await supabase
    .from("subscriptions")
    .select("status, period, current_period_end, stripe_customer_id")
    .eq("user_id", auth.user.id)
    .maybeSingle();
```

- [ ] **Step 2: Écrire les tests des actions**

Dans `src/features/abonnement/data/actions.test.ts`, ajouter le mock du provider en haut (après les mocks existants) et de nouveaux cas. Ajouter :

```ts
const checkout = vi.fn();
const portalUrl = vi.fn();
vi.mock("@/lib/services/payment", () => ({ getPaymentProvider: () => ({ checkout, portalUrl }) }));
```

Et un bloc de tests :

```ts
describe("subscribe — provider redirect (Stripe)", () => {
  it("provider renvoie redirect → l'action propage {redirect}", async () => {
    setup({ on: () => ({ data: { stripe_customer_id: null }, error: null }) });
    checkout.mockResolvedValueOnce({ mode: "redirect", url: "https://checkout/x" });
    const res = await subscribe(undefined, fd([["period", "monthly"]]));
    expect(res).toEqual({ redirect: "https://checkout/x" });
  });
});

describe("manageSubscription", () => {
  it("avec customer → {redirect} portail", async () => {
    setup({ on: () => ({ data: { stripe_customer_id: "cus_1" }, error: null }) });
    portalUrl.mockResolvedValueOnce("https://portal/y");
    const { manageSubscription } = await import("./actions");
    expect(await manageSubscription(undefined, fd([]))).toEqual({ redirect: "https://portal/y" });
  });
  it("sans customer → {error}", async () => {
    setup({ on: () => ({ data: { stripe_customer_id: null }, error: null }) });
    const { manageSubscription } = await import("./actions");
    expect(await manageSubscription(undefined, fd([]))).toEqual({ error: "Aucun abonnement à gérer" });
  });
});
```

> Note : les tests mock existants utilisent `rpc` ; le nouveau mock provider renvoie `checkout` par défaut `undefined` → pour le cas mock existant, faire `checkout.mockResolvedValue({ mode: "activated" })` dans un `beforeEach` du bloc mock, ou régler par test. Ajuster `beforeEach` global : `checkout.mockReset(); portalUrl.mockReset();`.

- [ ] **Step 3: Lancer → échec**

Run: `npm run test -- src/features/abonnement/data/actions.test.ts`
Expected: FAIL (`manageSubscription` absent ; `subscribe` n'appelle pas encore le provider avec le contexte).

- [ ] **Step 4: Réécrire les actions**

Replace `src/features/abonnement/data/actions.ts` par :

```ts
"use server";
import { revalidatePath } from "next/cache";
import { logActionError } from "@/lib/actionError";
import { createServerSupabase } from "@/lib/supabase/server";
import { getPaymentProvider } from "@/lib/services/payment";
import { subscribeSchema } from "../domain/schemas";

export async function subscribe(_prev: unknown, formData: FormData) {
  const parsed = subscribeSchema.safeParse({ period: formData.get("period") });
  if (!parsed.success) return { error: "Période invalide" };
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Non authentifié" };
  const { data: existing } = await supabase
    .from("subscriptions").select("stripe_customer_id").eq("user_id", auth.user.id).maybeSingle();
  const result = await getPaymentProvider().checkout({
    period: parsed.data.period,
    userId: auth.user.id,
    email: auth.user.email ?? "",
    customerId: existing?.stripe_customer_id ?? undefined,
  });
  if (result.mode === "redirect") return { redirect: result.url }; // Stripe réel
  const { error } = await supabase.rpc("mock_subscribe", { p_period: parsed.data.period });
  if (error) { logActionError("abonnement.subscribe", error); return { error: "Souscription échouée" }; }
  revalidatePath("/abonnement");
  revalidatePath("/voyages");
  return { ok: true as const };
}

export async function manageSubscription(_prev: unknown, _formData: FormData) {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Non authentifié" };
  const { data: sub } = await supabase
    .from("subscriptions").select("stripe_customer_id").eq("user_id", auth.user.id).maybeSingle();
  if (!sub?.stripe_customer_id) return { error: "Aucun abonnement à gérer" };
  try {
    const url = await getPaymentProvider().portalUrl(sub.stripe_customer_id);
    return { redirect: url };
  } catch (err) {
    logActionError("abonnement.manageSubscription", err);
    return { error: "Gestion indisponible" };
  }
}

export async function cancelSubscription(_prev: unknown, _formData: FormData) {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Non authentifié" };
  const { error } = await supabase.rpc("cancel_subscription");
  if (error) { logActionError("abonnement.cancelSubscription", error); return { error: "Annulation échouée" }; }
  revalidatePath("/abonnement");
  return { ok: true as const };
}
```

> `cancelSubscription` est conservé pour le fallback mock (Task 9). Le refine union TS : garder les `return { ... }` littéraux inline (mémoire : ne pas typer le retour, sinon `state?.redirect`/`state?.error` casse côté UI).

- [ ] **Step 5: Lancer → succès**

Run: `npm run test -- src/features/abonnement/data/actions.test.ts`
Expected: PASS (mock existants + redirect + manageSubscription).

- [ ] **Step 6: Commit**

```bash
git add src/features/abonnement/data/actions.ts src/features/abonnement/data/actions.test.ts src/features/abonnement/data/queries.ts
git commit -m "feat(abonnement): subscribe enrichi (contexte user) + action manageSubscription"
```

---

### Task 9: UI — redirect Checkout + bouton « Gérer mon abonnement »

**Files:**
- Modify: `src/features/abonnement/ui/SubscribeButtons.tsx`
- Create: `src/features/abonnement/ui/ManageButton.tsx`
- Modify: `src/app/[locale]/(app)/abonnement/page.tsx`
- Modify: `messages/fr.json`, `messages/en.json`, `messages/es.json`, `messages/it.json`
- Conservé tel quel: `src/features/abonnement/ui/CancelButton.tsx` (chemin mock/sans-customer)

**Décision de conception (affine le spec §6) :** plutôt qu'un `ManageButton` à fallback interne (deux clics, libellé instable → casse l'e2e), la **page tranche** : si la ligne a un `stripe_customer_id` → `ManageButton` (portail Stripe) ; sinon → `CancelButton` existant (RPC mock). `ManageButton` reste donc pur (portail seul), et le parcours e2e mock garde exactement son bouton « Annuler » actuel. C'est l'intention du spec (« ne pas casser l'e2e ») réalisée plus proprement.

**Interfaces:**
- Consumes: `subscribe`, `manageSubscription` (Task 8) ; `getSubscription().stripe_customer_id` (Task 8 step 1) ; clé i18n `abonnement.manage`.
- Produces: `ManageButton` (client) — poste `manageSubscription`, suit `{redirect}`. Aucun fallback interne.

- [ ] **Step 1: Gérer `{redirect}` dans `SubscribeButtons`**

Replace `src/features/abonnement/ui/SubscribeButtons.tsx` par :

```tsx
"use client";
import { useActionState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { subscribe } from "../data/actions";
import { Button } from "@/features/shared/ui/Button";

export function SubscribeButtons() {
  const t = useTranslations("abonnement");
  const [state, action, pending] = useActionState(subscribe, undefined);
  useEffect(() => {
    if (state && "redirect" in state && state.redirect) window.location.href = state.redirect;
  }, [state]);
  return (
    <form action={action} data-testid="subscribe-form" className="flex flex-col gap-2 max-w-sm">
      <p className="text-sm text-muted">{t("upsell")}</p>
      <div className="flex gap-2">
        <Button type="submit" name="period" value="monthly" pending={pending} data-testid="subscribe-monthly" className="flex-1">{t("monthly")}</Button>
        <Button type="submit" name="period" value="yearly" pending={pending} data-testid="subscribe-yearly" className="flex-1">{t("yearly")}</Button>
      </div>
      {state && "error" in state && state.error && <p role="alert" className="text-danger">{state.error}</p>}
    </form>
  );
}
```

- [ ] **Step 2: Créer `ManageButton` (portail pur)**

Create `src/features/abonnement/ui/ManageButton.tsx` :

```tsx
"use client";
import { useActionState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { manageSubscription } from "../data/actions";
import { Button } from "@/features/shared/ui/Button";

export function ManageButton() {
  const t = useTranslations("abonnement");
  const [state, action, pending] = useActionState(manageSubscription, undefined);
  useEffect(() => {
    if (state && "redirect" in state && state.redirect) window.location.href = state.redirect;
  }, [state]);
  return (
    <form action={action} data-testid="manage-form">
      <Button type="submit" variant="ghost" pending={pending} data-testid="manage-sub">{t("manage")}</Button>
      {state && "error" in state && state.error && <p role="alert" className="text-danger">{state.error}</p>}
    </form>
  );
}
```

- [ ] **Step 3: Câbler la page (branche sur `stripe_customer_id`)**

Dans `src/app/[locale]/(app)/abonnement/page.tsx` : ajouter l'import `ManageButton` (garder l'import `CancelButton`), et remplacer la ligne d'action premium. `getSubscription` renvoie désormais `stripe_customer_id` (Task 8 step 1).

```tsx
import { CancelButton } from "@/features/abonnement/ui/CancelButton";
import { ManageButton } from "@/features/abonnement/ui/ManageButton";
```

Remplacer :
```tsx
            {isPremium && !canceled && <CancelButton />}
```
par :
```tsx
            {isPremium && !canceled && (sub?.stripe_customer_id ? <ManageButton /> : <CancelButton />)}
```

- [ ] **Step 4: Ajouter la clé i18n `manage` (4 locales)**

Dans chaque `messages/<loc>.json`, sous `"abonnement"`, ajouter à côté de `"cancel"` :

- `messages/fr.json` : `"manage": "Gérer mon abonnement",`
- `messages/en.json` : `"manage": "Manage subscription",`
- `messages/es.json` : `"manage": "Gestionar mi suscripción",`
- `messages/it.json` : `"manage": "Gestisci abbonamento",`

- [ ] **Step 5: Vérifier compilation + tests**

Run: `npm run typecheck && npm run test -- src/features/abonnement`
Expected: PASS. `CancelButton` reste importé et utilisé (chemin mock) — aucune suppression.

- [ ] **Step 6: Commit**

```bash
git add -A src/features/abonnement/ui src/app/\[locale\]/\(app\)/abonnement/page.tsx messages
git commit -m "feat(abonnement): redirect Checkout + bouton Gérer mon abonnement (Portal)"
```

---

### Task 10: Vérification complète + e2e mock

**Files:**
- (aucun nouveau — vérification de bout en bout)

**Interfaces:**
- Consumes: tout ce qui précède.

- [ ] **Step 1: Suite unitaire complète**

Run: `npm run test`
Expected: PASS (tous les nouveaux tests + non-régression). Compter que la suite est passée de N à N+~14 tests.

- [ ] **Step 2: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS (aucune erreur ESLint — cf. mémoire `vito-verif-inclut-lint`, la CI quality échoue sinon).

- [ ] **Step 3: e2e (mode mock, sans clé Stripe)**

Run: `npm run test:e2e -- abonnement` (ou la suite complète si le runner l'exige)
Expected: PASS — le parcours abonnement mock fonctionne toujours (upgrade → premium ; le bouton « Gérer » retombe sur l'annulation RPC faute de customer Stripe). Vérifier qu'aucun `getPaymentProvider` ne bascule sur Stripe (pas de `STRIPE_SECRET_KEY` en env de test).

- [ ] **Step 4: RLS pgTAP (non-régression)**

Run: `npm run test:rls`
Expected: PASS — `subscriptions` reste lecture-seule pour `authenticated` (les 2 colonnes ajoutées n'ouvrent aucune écriture).

- [ ] **Step 5: Commit éventuel de finition**

Si des ajustements ont été nécessaires :
```bash
git add -A
git commit -m "test(abonnement): vérification bout-en-bout Stripe (mock) verte"
```

- [ ] **Step 6: Ouvrir la PR**

```bash
git push -u origin feat/stripe-integration
gh pr create --base main --title "feat(abonnement): intégration Stripe réelle (Checkout + Portal + webhook)" --body "Implémente docs/superpowers/specs/2026-07-07-stripe-integration-design.md. Mock-first conservé (CI/e2e sur mock), is_premium inchangé, écritures subscriptions via webhook service-role uniquement."
```

---

## Notes de déploiement (hors code — pour l'activation réelle)

Ces étapes ne sont **pas** dans le périmètre du code mais requises pour activer Stripe en prod (à faire par le PO dans le dashboard Stripe + l'hébergeur) :
1. Créer 2 Prices récurrents (mensuel/annuel) → renseigner `STRIPE_PRICE_MONTHLY` / `STRIPE_PRICE_YEARLY`.
2. Créer un endpoint webhook pointant sur `https://<domaine>/api/stripe/webhook`, événements `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted` → renseigner `STRIPE_WEBHOOK_SECRET`.
3. Activer le Billing Portal (paramètres → Customer Portal).
4. Renseigner `STRIPE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL` en env de prod.
5. Tester en mode test Stripe (carte `4242…`) avant de passer en live.
