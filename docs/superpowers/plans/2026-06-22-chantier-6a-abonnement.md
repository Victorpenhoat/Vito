# Abonnement (Free / Premium) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Niveaux Free/Premium avec paiement mock-first, statut premium infalsifiable, et limite de 2 voyages en Free levée par Premium.

**Architecture:** `features/abonnement/{domain,data,ui}` + abstraction `lib/services/payment/` (mock-first, Stripe gaté par env, différé). Enforcement **DB-level** (leçon C5) : `subscriptions` en lecture seule pour `authenticated`, écritures via RPC `security definer` (`mock_subscribe`/`cancel_subscription`) ; limite de voyages via **trigger `BEFORE INSERT`** sur `voyages`. `isPremiumFrom` = fonction pure miroir de la SQL `is_premium`.

**Tech Stack:** Next.js 16 (App Router, Server Actions), TypeScript strict, Supabase (Postgres + RLS), Zod, next-intl, Vitest, Playwright.

## Global Constraints

- Next.js 16 non-standard : consulter `node_modules/next/dist/docs/` avant une API Next inconnue.
- TypeScript strict avec `noUncheckedIndexedAccess`.
- RLS **et** grants explicites sur chaque table (mais `subscriptions` n'a **aucun** grant d'écriture à `authenticated`).
- **Statut premium infalsifiable** : `subscriptions` en lecture seule ; écritures uniquement via RPC `security definer` ou service-role.
- **Gating DB-level** : limite Free via trigger `BEFORE INSERT` sur `voyages` (non contournable via REST).
- `FREE_VOYAGE_LIMIT = 2` : codé en dur dans le trigger SQL **et** la constante domain — garder synchronisés.
- `isPremium` = `active` OU (`canceled` ET `current_period_end > now()`).
- `auth.uid()` enforcé dans toutes les RPC. Helpers `security definer` : `language sql/plpgsql security definer set search_path = ''`.
- Migration suivante = `supabase/migrations/00011_abonnements.sql`. Feature `src/features/abonnement/`, route `/abonnement`, namespace i18n `abonnement.*`.
- Aucune chaîne UI en dur. UUID seed = v4 valides.

---

### Task 1: Migration `00011_abonnements.sql`

**Files:**
- Create: `supabase/migrations/00011_abonnements.sql`

**Interfaces:**
- Produces : table `public.subscriptions` ; fonctions `public.is_premium(uuid) returns boolean`, `public.mock_subscribe(text) returns void`, `public.cancel_subscription() returns void` ; trigger `voyages_free_limit` (via `public.enforce_voyage_limit()`) qui refuse l'insert d'un 3e voyage pour un owner non-premium.

- [ ] **Step 1: Écrire la migration**

Create `supabase/migrations/00011_abonnements.sql` :

```sql
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  tier text not null default 'premium' check (tier in ('premium')),
  status text not null check (status in ('active', 'canceled')),
  period text not null check (period in ('monthly', 'yearly')),
  current_period_end timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index subscriptions_user_idx on public.subscriptions (user_id);

-- Statut premium (security definer : lit subscriptions sans exposer les lignes d'autrui)
create function public.is_premium(uid uuid) returns boolean
  language sql security definer set search_path = '' stable as $$
  select exists (
    select 1 from public.subscriptions
    where user_id = uid
      and (status = 'active' or (status = 'canceled' and current_period_end > now()))
  );
$$;

-- Souscription mock (le vrai Stripe passera par un webhook service-role)
create function public.mock_subscribe(p_period text) returns void
  language plpgsql security definer set search_path = '' as $$
declare v_uid uuid; v_end timestamptz;
begin
  v_uid := auth.uid();
  if v_uid is null then raise exception 'authentification requise'; end if;
  if p_period not in ('monthly', 'yearly') then raise exception 'période invalide'; end if;
  v_end := now() + (case p_period when 'monthly' then interval '1 month' else interval '1 year' end);
  insert into public.subscriptions (user_id, tier, status, period, current_period_end)
  values (v_uid, 'premium', 'active', p_period, v_end)
  on conflict (user_id) do update
    set status = 'active', period = excluded.period,
        current_period_end = excluded.current_period_end, updated_at = now();
end;
$$;

create function public.cancel_subscription() returns void
  language plpgsql security definer set search_path = '' as $$
declare v_uid uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then raise exception 'authentification requise'; end if;
  update public.subscriptions set status = 'canceled', updated_at = now()
  where user_id = v_uid;
end;
$$;

-- Limite de voyages en Free (gating DB-level ; FREE_VOYAGE_LIMIT = 2, à garder synchro avec la constante domain)
create function public.enforce_voyage_limit() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_premium(new.owner_id)
     and (select count(*) from public.voyages where owner_id = new.owner_id) >= 2 then
    raise exception 'limite_voyages_free' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger voyages_free_limit before insert on public.voyages
  for each row execute function public.enforce_voyage_limit();

-- RLS : lecture de sa propre ligne uniquement ; AUCUNE écriture directe par authenticated
alter table public.subscriptions enable row level security;
create policy "subscriptions_select_own" on public.subscriptions
  for select using (user_id = auth.uid());
grant select on public.subscriptions to authenticated;

-- Grants des fonctions
revoke execute on function public.is_premium(uuid) from anon, public;
revoke execute on function public.mock_subscribe(text) from anon, public;
revoke execute on function public.cancel_subscription() from anon, public;
grant execute on function public.is_premium(uuid) to authenticated;
grant execute on function public.mock_subscribe(text) to authenticated;
grant execute on function public.cancel_subscription() to authenticated;
```

- [ ] **Step 2: Appliquer la migration**

Run: `supabase db reset`
Expected: applique 00001→00011 + seed sans erreur (« Finished supabase db reset. »).

- [ ] **Step 3: Vérifier la structure**

Run:
```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "
select count(*) as has_table from pg_tables where schemaname='public' and tablename='subscriptions';
select count(*) as has_funcs from pg_proc where proname in ('is_premium','mock_subscribe','cancel_subscription');
select count(*) as has_trigger from pg_trigger where tgname='voyages_free_limit';
select count(*) as has_policy from pg_policies where tablename='subscriptions';
"
```
Expected: `has_table = 1` ; `has_funcs = 3` ; `has_trigger = 1` ; `has_policy = 1`.

- [ ] **Step 4: Vérifier le comportement (is_premium + trigger) en superuser**

Run:
```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" <<'SQL'
do $$
begin
  -- admin (33333...) n'a pas d'abonnement -> is_premium false
  if public.is_premium('33333333-3333-3333-3333-333333333333') then
    raise exception 'FAIL: is_premium devrait être false sans abonnement';
  end if;
  -- avec un abonnement actif -> true
  insert into public.subscriptions (user_id, status, period, current_period_end)
    values ('33333333-3333-3333-3333-333333333333','active','monthly', now() + interval '1 month');
  if not public.is_premium('33333333-3333-3333-3333-333333333333') then
    raise exception 'FAIL: is_premium devrait être true avec abonnement actif';
  end if;
  delete from public.subscriptions where user_id = '33333333-3333-3333-3333-333333333333';
  -- trigger : 2 voyages ok pour admin (free), le 3e doit échouer
  insert into public.voyages (owner_id, titre) values ('33333333-3333-3333-3333-333333333333','t1');
  insert into public.voyages (owner_id, titre) values ('33333333-3333-3333-3333-333333333333','t2');
  begin
    insert into public.voyages (owner_id, titre) values ('33333333-3333-3333-3333-333333333333','t3');
    raise exception 'FAIL: le 3e voyage Free aurait dû être bloqué';
  exception when others then
    if sqlerrm not like '%limite_voyages_free%' then raise; end if;
  end;
  -- nettoyage
  delete from public.voyages where owner_id = '33333333-3333-3333-3333-333333333333';
  raise notice 'OK: is_premium + trigger conformes';
end $$;
SQL
```
Expected: `NOTICE:  OK: is_premium + trigger conformes` et aucune ERROR. (Les RPC `mock_subscribe`/`cancel_subscription` utilisent `auth.uid()` → couvertes par l'e2e en Task 6.)

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/00011_abonnements.sql
git commit -m "feat(abonnement): migration 00011 (subscriptions, is_premium, RPC, trigger limite voyages)"
```

---

### Task 2: Abstraction paiement (`lib/services/payment/`) + env

**Files:**
- Modify: `src/lib/env.ts` (ajout `STRIPE_SECRET_KEY` optionnel)
- Create: `src/lib/services/payment/types.ts`
- Create: `src/lib/services/payment/mock.ts`
- Create: `src/lib/services/payment/index.ts`
- Create: `src/lib/services/payment/mock.test.ts`

**Interfaces:**
- Produces:
  - `type CheckoutPlan = { period: "monthly" | "yearly" }`
  - `type CheckoutResult = { mode: "activated" } | { mode: "redirect"; url: string }`
  - `interface PaymentProvider { checkout(plan: CheckoutPlan): Promise<CheckoutResult> }`
  - `getPaymentProvider(): PaymentProvider` (mock par défaut)

- [ ] **Step 1: Ajouter `STRIPE_SECRET_KEY` à l'env**

Modify `src/lib/env.ts` — ajouter dans l'objet `schema` après `MERCHANT_PARTNER_URL` :
```ts
  STRIPE_SECRET_KEY: z.string().optional(),
```
et dans l'objet passé à `schema.safeParse(...)` après `MERCHANT_PARTNER_URL` :
```ts
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
```

- [ ] **Step 2: Écrire le test du mock (échec attendu)**

Create `src/lib/services/payment/mock.test.ts` :
```ts
import { describe, it, expect } from "vitest";
import { MockPaymentProvider } from "./mock";

describe("MockPaymentProvider", () => {
  it("checkout active immédiatement (mode activated)", async () => {
    const r = await new MockPaymentProvider().checkout({ period: "monthly" });
    expect(r).toEqual({ mode: "activated" });
  });
});
```

- [ ] **Step 3: Lancer le test (échec)**

Run: `npx vitest run src/lib/services/payment/mock.test.ts`
Expected: FAIL (« Cannot find module './mock' »).

- [ ] **Step 4: Implémenter types.ts, mock.ts, index.ts**

Create `src/lib/services/payment/types.ts` :
```ts
export type CheckoutPlan = { period: "monthly" | "yearly" };
export type CheckoutResult = { mode: "activated" } | { mode: "redirect"; url: string };

export interface PaymentProvider {
  checkout(plan: CheckoutPlan): Promise<CheckoutResult>;
}
```

Create `src/lib/services/payment/mock.ts` :
```ts
import type { PaymentProvider, CheckoutPlan, CheckoutResult } from "./types";

// Mock-first : « paie » immédiatement. L'activation premium réelle se fait via la RPC mock_subscribe.
export class MockPaymentProvider implements PaymentProvider {
  async checkout(_plan: CheckoutPlan): Promise<CheckoutResult> {
    return { mode: "activated" };
  }
}
```

Create `src/lib/services/payment/index.ts` :
```ts
import { MockPaymentProvider } from "./mock";
import type { PaymentProvider } from "./types";

export function getPaymentProvider(): PaymentProvider {
  // Mock-first : l'adaptateur Stripe réel (Checkout + webhooks, gaté par env.STRIPE_SECRET_KEY)
  // est différé. On renvoie toujours le mock pour ce slice.
  return new MockPaymentProvider();
}

export type { PaymentProvider, CheckoutPlan, CheckoutResult } from "./types";
```

- [ ] **Step 5: Lancer le test (succès) + typecheck**

Run: `npx vitest run src/lib/services/payment/mock.test.ts && npm run typecheck`
Expected: PASS (1 test) ; typecheck sans erreur.

- [ ] **Step 6: Commit**

```bash
git add src/lib/env.ts src/lib/services/payment
git commit -m "feat(abonnement): abstraction PaymentProvider mock-first + env STRIPE_SECRET_KEY"
```

---

### Task 3: Domain (constantes + premium + schémas)

**Files:**
- Create: `src/features/abonnement/domain/constants.ts`
- Create: `src/features/abonnement/domain/premium.ts`
- Create: `src/features/abonnement/domain/premium.test.ts`
- Create: `src/features/abonnement/domain/schemas.ts`
- Create: `src/features/abonnement/domain/schemas.test.ts`

**Interfaces:**
- Produces:
  - `FREE_VOYAGE_LIMIT = 2`
  - `type SubscriptionRow = { status: string; currentPeriodEnd: string } | null`
  - `isPremiumFrom(sub: SubscriptionRow, now: Date): boolean`
  - `SUBSCRIPTION_PERIODS = ["monthly","yearly"] as const`
  - `subscribeSchema` → `{ period: "monthly" | "yearly" }`

- [ ] **Step 1: Écrire les tests (échec attendu)**

Create `src/features/abonnement/domain/premium.test.ts` :
```ts
import { describe, it, expect } from "vitest";
import { isPremiumFrom } from "./premium";

const now = new Date("2026-06-22T00:00:00Z");

describe("isPremiumFrom", () => {
  it("null -> false", () => expect(isPremiumFrom(null, now)).toBe(false));
  it("active -> true (même si period_end passé)", () =>
    expect(isPremiumFrom({ status: "active", currentPeriodEnd: "2026-01-01T00:00:00Z" }, now)).toBe(true));
  it("canceled avant expiry -> true", () =>
    expect(isPremiumFrom({ status: "canceled", currentPeriodEnd: "2026-12-31T00:00:00Z" }, now)).toBe(true));
  it("canceled après expiry -> false", () =>
    expect(isPremiumFrom({ status: "canceled", currentPeriodEnd: "2026-01-01T00:00:00Z" }, now)).toBe(false));
});
```

Create `src/features/abonnement/domain/schemas.test.ts` :
```ts
import { describe, it, expect } from "vitest";
import { subscribeSchema } from "./schemas";

describe("subscribeSchema", () => {
  it("accepte monthly et yearly", () => {
    expect(subscribeSchema.safeParse({ period: "monthly" }).success).toBe(true);
    expect(subscribeSchema.safeParse({ period: "yearly" }).success).toBe(true);
  });
  it("rejette une période invalide", () => {
    expect(subscribeSchema.safeParse({ period: "weekly" }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Lancer les tests (échec)**

Run: `npx vitest run src/features/abonnement/domain/`
Expected: FAIL (modules introuvables).

- [ ] **Step 3: Implémenter constants.ts, premium.ts, schemas.ts**

Create `src/features/abonnement/domain/constants.ts` :
```ts
// Limite de voyages en formule Free. DOIT rester synchronisé avec le trigger SQL
// enforce_voyage_limit (supabase/migrations/00011_abonnements.sql), où la valeur 2 est codée en dur.
export const FREE_VOYAGE_LIMIT = 2;
```

Create `src/features/abonnement/domain/premium.ts` :
```ts
export type SubscriptionRow = { status: string; currentPeriodEnd: string } | null;

// Miroir exact de la SQL public.is_premium : actif, ou annulé mais pas encore expiré.
export function isPremiumFrom(sub: SubscriptionRow, now: Date): boolean {
  if (!sub) return false;
  if (sub.status === "active") return true;
  if (sub.status === "canceled") return new Date(sub.currentPeriodEnd) > now;
  return false;
}
```

Create `src/features/abonnement/domain/schemas.ts` :
```ts
import { z } from "zod";

export const SUBSCRIPTION_PERIODS = ["monthly", "yearly"] as const;
export const subscribeSchema = z.object({ period: z.enum(SUBSCRIPTION_PERIODS) });
export type SubscribeInput = z.infer<typeof subscribeSchema>;
```

- [ ] **Step 4: Lancer les tests (succès)**

Run: `npx vitest run src/features/abonnement/domain/`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/abonnement/domain
git commit -m "feat(abonnement): domain (FREE_VOYAGE_LIMIT, isPremiumFrom, schémas) TDD"
```

---

### Task 4: Data (actions + queries) + gating createVoyage

**Files:**
- Create: `src/features/abonnement/data/queries.ts`
- Create: `src/features/abonnement/data/actions.ts`
- Modify: `src/features/voyages/data/actions.ts` (gating dans `createVoyage`)

**Interfaces:**
- Consumes: `getPaymentProvider` de `@/lib/services/payment` ; `subscribeSchema` de `../domain/schemas` ; `isPremiumFrom` de `../domain/premium` ; `FREE_VOYAGE_LIMIT` de `../domain/constants` ; `createServerSupabase` ; `revalidatePath`.
- Produces:
  - `getSubscription(): Promise<{ status: string; period: string; current_period_end: string } | null>`
  - `getIsPremium(): Promise<boolean>`
  - actions `subscribe(_prev, formData)` et `cancelSubscription(_prev, formData)` (retour `{ ok: true } | { error } | { redirect }`)
  - `createVoyage` renvoie en plus `{ error, limit: true }` quand la limite Free est atteinte.

- [ ] **Step 1: Implémenter queries.ts**

Create `src/features/abonnement/data/queries.ts` :
```ts
import { createServerSupabase } from "@/lib/supabase/server";
import { isPremiumFrom } from "../domain/premium";

export async function getSubscription() {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data } = await supabase
    .from("subscriptions")
    .select("status, period, current_period_end")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  return data;
}

export async function getIsPremium(): Promise<boolean> {
  const sub = await getSubscription();
  return isPremiumFrom(sub ? { status: sub.status, currentPeriodEnd: sub.current_period_end } : null, new Date());
}
```

- [ ] **Step 2: Implémenter actions.ts**

Create `src/features/abonnement/data/actions.ts` :
```ts
"use server";
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { getPaymentProvider } from "@/lib/services/payment";
import { subscribeSchema } from "../domain/schemas";

export async function subscribe(_prev: unknown, formData: FormData) {
  const parsed = subscribeSchema.safeParse({ period: formData.get("period") });
  if (!parsed.success) return { error: "Période invalide" };
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Non authentifié" };
  const result = await getPaymentProvider().checkout({ period: parsed.data.period });
  if (result.mode === "redirect") return { redirect: result.url }; // Stripe réel (différé)
  const { error } = await supabase.rpc("mock_subscribe", { p_period: parsed.data.period });
  if (error) return { error: "Souscription échouée" };
  revalidatePath("/abonnement");
  revalidatePath("/voyages");
  return { ok: true as const };
}

export async function cancelSubscription(_prev: unknown, _formData: FormData) {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Non authentifié" };
  const { error } = await supabase.rpc("cancel_subscription");
  if (error) return { error: "Annulation échouée" };
  revalidatePath("/abonnement");
  return { ok: true as const };
}
```

- [ ] **Step 3: Gating dans `createVoyage`**

Modify `src/features/voyages/data/actions.ts` — ajouter les imports en tête (après les imports existants) :
```ts
import { getIsPremium } from "@/features/abonnement/data/queries";
import { FREE_VOYAGE_LIMIT } from "@/features/abonnement/domain/constants";
```
Dans `createVoyage`, juste après le garde `if (!uid) return { error: "Non authentifié" };` et **avant** le `insert`, insérer le check proactif ; et remplacer le bloc `if (error) ...` par une version qui mappe l'erreur du trigger. Le corps de `createVoyage` devient :
```ts
  if (!uid) return { error: "Non authentifié" };
  // Gating Free : limite de voyages (le trigger DB reste le garde autoritaire).
  if (!(await getIsPremium())) {
    const { count } = await supabase
      .from("voyages")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", uid);
    if ((count ?? 0) >= FREE_VOYAGE_LIMIT) return { error: "Limite Free atteinte", limit: true as const };
  }
  const { error } = await supabase.from("voyages").insert({
    owner_id: uid,
    titre: parsed.data.titre,
    destination: parsed.data.destination ?? null,
    date_debut: parsed.data.dateDebut ?? null,
    date_fin: parsed.data.dateFin ?? null,
    statut: parsed.data.statut ?? "planifie",
  });
  if (error) {
    if (error.message?.includes("limite_voyages_free")) return { error: "Limite Free atteinte", limit: true as const };
    return { error: "Création échouée" };
  }
  revalidatePath("/voyages");
  return { ok: true as const };
```

- [ ] **Step 4: Vérifier typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS. *(Comportement runtime couvert par les e2e en Task 6 ; pas de test unitaire DB, conformément aux modules précédents.)*

- [ ] **Step 5: Commit**

```bash
git add src/features/abonnement/data src/features/voyages/data/actions.ts
git commit -m "feat(abonnement): actions subscribe/cancel + queries + gating createVoyage"
```

---

### Task 5: UI (page abonnement + composants) + i18n + CTA voyages

**Files:**
- Modify: `messages/fr.json` (namespace `abonnement` + clé `voyages.limitCta`)
- Create: `src/features/abonnement/ui/SubscribeButtons.tsx`
- Create: `src/features/abonnement/ui/CancelButton.tsx`
- Create: `src/app/[locale]/(app)/abonnement/page.tsx`
- Create: `src/app/[locale]/(app)/abonnement/error.tsx`
- Modify: `src/features/voyages/ui/VoyageForm.tsx` (CTA limite)

**Interfaces:**
- Consumes: `subscribe`/`cancelSubscription` de `../data/actions` ; `getSubscription`/`getIsPremium` de `@/features/abonnement/data/queries` ; `Link` de `@/lib/i18n/routing`.
- Produces : page `/abonnement`. `data-testid` : `plan-actuel`, `premium-badge`, `subscribe-monthly`, `subscribe-yearly`, `cancel-sub`, `voyage-limit-cta`.

- [ ] **Step 1: i18n**

Modify `messages/fr.json` :
(a) ajouter au niveau racine (après le bloc `"depenses": { ... }`, virgule de séparation) :
```json
  "abonnement": {
    "title": "Abonnement",
    "free": "Vous êtes en formule Free.",
    "premium": "Premium",
    "renewsOn": "Renouvellement le {date}",
    "premiumUntil": "Premium jusqu'au {date}",
    "upsell": "Passez Premium pour des voyages illimités.",
    "monthly": "Mensuel",
    "yearly": "Annuel",
    "cancel": "Annuler l'abonnement",
    "error": { "title": "Une erreur est survenue", "retry": "Réessayer" }
  }
```
(b) dans le bloc `"voyages": { ... }`, ajouter la clé (après `"ouvrirCompte": ...,` ou toute autre clé existante, en respectant les virgules) :
```json
    "limitCta": "Limite Free atteinte — passez Premium",
```

- [ ] **Step 2: Créer SubscribeButtons.tsx + CancelButton.tsx**

Create `src/features/abonnement/ui/SubscribeButtons.tsx` :
```tsx
"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { subscribe } from "../data/actions";

export function SubscribeButtons() {
  const t = useTranslations("abonnement");
  const [state, action, pending] = useActionState(subscribe, undefined);
  return (
    <form action={action} data-testid="subscribe-form" className="flex flex-col gap-2 max-w-sm">
      <p className="text-sm text-gray-600">{t("upsell")}</p>
      <div className="flex gap-2">
        <button type="submit" name="period" value="monthly" disabled={pending} data-testid="subscribe-monthly" className="bg-black text-white p-2 flex-1">{t("monthly")}</button>
        <button type="submit" name="period" value="yearly" disabled={pending} data-testid="subscribe-yearly" className="bg-black text-white p-2 flex-1">{t("yearly")}</button>
      </div>
      {state && "error" in state && state.error && <p role="alert" className="text-red-600">{state.error}</p>}
    </form>
  );
}
```

Create `src/features/abonnement/ui/CancelButton.tsx` :
```tsx
"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { cancelSubscription } from "../data/actions";

export function CancelButton() {
  const t = useTranslations("abonnement");
  const [state, action, pending] = useActionState(cancelSubscription, undefined);
  return (
    <form action={action} data-testid="cancel-form">
      <button type="submit" disabled={pending} data-testid="cancel-sub" className="underline">{t("cancel")}</button>
      {state && "error" in state && state.error && <p role="alert" className="text-red-600">{state.error}</p>}
    </form>
  );
}
```

- [ ] **Step 3: Créer la page + error**

Create `src/app/[locale]/(app)/abonnement/page.tsx` :
```tsx
import { getTranslations } from "next-intl/server";
import { getSubscription, getIsPremium } from "@/features/abonnement/data/queries";
import { SubscribeButtons } from "@/features/abonnement/ui/SubscribeButtons";
import { CancelButton } from "@/features/abonnement/ui/CancelButton";

export default async function AbonnementPage() {
  const t = await getTranslations("abonnement");
  const sub = await getSubscription();
  const isPremium = await getIsPremium();
  const canceled = sub?.status === "canceled";
  const periodEnd = sub?.current_period_end ? new Date(sub.current_period_end).toLocaleDateString("fr-FR") : "";
  return (
    <main className="p-6 flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <section data-testid="plan-actuel" className="border p-4">
        {isPremium ? (
          <p>
            <span data-testid="premium-badge" className="font-semibold text-green-700">{t("premium")}</span>{" "}
            {canceled ? t("premiumUntil", { date: periodEnd }) : t("renewsOn", { date: periodEnd })}
          </p>
        ) : (
          <p>{t("free")}</p>
        )}
      </section>
      {!isPremium && <SubscribeButtons />}
      {isPremium && !canceled && <CancelButton />}
    </main>
  );
}
```

Create `src/app/[locale]/(app)/abonnement/error.tsx` :
```tsx
"use client";
import { useTranslations } from "next-intl";
export default function AbonnementError({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations("abonnement.error");
  return (
    <main className="p-6">
      <p role="alert">{t("title")}</p>
      <button onClick={reset} className="underline">{t("retry")}</button>
    </main>
  );
}
```

- [ ] **Step 4: CTA limite dans VoyageForm**

Modify `src/features/voyages/ui/VoyageForm.tsx` — ajouter l'import en tête :
```tsx
import { Link } from "@/lib/i18n/routing";
```
et, juste après la ligne `{state?.error && <p role="alert" className="text-red-600">{state.error}</p>}`, ajouter le CTA conditionnel :
```tsx
      {state && "limit" in state && state.limit && (
        <p data-testid="voyage-limit-cta">
          <Link href="/abonnement" className="underline">{t("limitCta")}</Link>
        </p>
      )}
```
(`t` est déjà `useTranslations("voyages")` dans ce composant.)

- [ ] **Step 5: Vérifier build (typecheck + lint + unit)**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS (typecheck/lint sans erreur ; tous les tests unitaires verts, incl. les nouveaux d'abonnement).

- [ ] **Step 6: Commit**

```bash
git add messages/fr.json src/features/abonnement/ui src/app/\[locale\]/\(app\)/abonnement src/features/voyages/ui/VoyageForm.tsx
git commit -m "feat(abonnement): page abonnement (statut, souscrire, annuler) + CTA limite voyages + i18n"
```

---

### Task 6: Seed (comptes dédiés) + e2e (gating + annulation)

**Files:**
- Modify: `supabase/seed.sql` (2 comptes dédiés + abonnement premium)
- Create: `e2e/abonnement.spec.ts`

**Interfaces:**
- Consumes : route `/fr/abonnement`, `/fr/voyages` ; `data-testid` de Task 5. Comptes seed dédiés : `free@vito.test` (id `44444444-4444-4444-8444-444444444444`, Free, 0 voyage), `premium@vito.test` (id `55555555-5555-4555-8555-555555555555`, abonnement actif). Mot de passe `password123`.

- [ ] **Step 1: Seed — comptes dédiés + abonnement premium**

Modify `supabase/seed.sql` — ajouter à la fin du fichier :
```sql
-- Comptes dédiés au Chantier 6 (isolés des autres e2e). UUID v4 valides.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, reauthentication_token, phone_change, phone_change_token)
values
  ('44444444-4444-4444-8444-444444444444', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'free@vito.test',
   crypt('password123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"display_name":"Free Démo","role":"client"}', now(), now(),
   '', '', '', '', '', '', '', ''),
  ('55555555-5555-4555-8555-555555555555', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'premium@vito.test',
   crypt('password123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"display_name":"Premium Démo","role":"client"}', now(), now(),
   '', '', '', '', '', '', '', '');

insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at)
values
  (gen_random_uuid(), '44444444-4444-4444-8444-444444444444', '44444444-4444-4444-8444-444444444444',
   '{"sub":"44444444-4444-4444-8444-444444444444","email":"free@vito.test"}', 'email', now(), now()),
  (gen_random_uuid(), '55555555-5555-4555-8555-555555555555', '55555555-5555-4555-8555-555555555555',
   '{"sub":"55555555-5555-4555-8555-555555555555","email":"premium@vito.test"}', 'email', now(), now());

-- premium@vito.test : abonnement premium actif (annuel, expire dans 1 an)
insert into public.subscriptions (user_id, tier, status, period, current_period_end)
values ('55555555-5555-4555-8555-555555555555', 'premium', 'active', 'yearly', now() + interval '1 year');
```

- [ ] **Step 2: Appliquer le seed**

Run: `supabase db reset`
Expected: applique migrations + seed sans erreur.

- [ ] **Step 3: Écrire les e2e**

Create `e2e/abonnement.spec.ts` :
```ts
import { test, expect, type Page } from "@playwright/test";

async function login(page: Page, email: string) {
  await page.goto("/fr/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill("password123");
  await page.getByRole("button", { name: "Connexion" }).click();
  await expect(page).toHaveURL(/\/fr\/restos/);
}

async function creerVoyage(page: Page, titre: string) {
  await page.getByTestId("voyage-form").locator('input[name="titre"]').fill(titre);
  await page.getByTestId("voyage-form").getByRole("button").click();
}

test("Free atteint la limite de voyages, souscrit, puis crée au-delà", async ({ page }) => {
  await login(page, "free@vito.test");
  await page.goto("/fr/voyages");

  const tag = Date.now();
  // 2 créations OK (limite Free = 2)
  await creerVoyage(page, `V1 ${tag}`);
  await expect(page.getByTestId("voyage-card").filter({ hasText: `V1 ${tag}` })).toBeVisible();
  await creerVoyage(page, `V2 ${tag}`);
  await expect(page.getByTestId("voyage-card").filter({ hasText: `V2 ${tag}` })).toBeVisible();

  // 3e création bloquée -> CTA upgrade (signal déterministe)
  await creerVoyage(page, `V3 ${tag}`);
  await expect(page.getByTestId("voyage-limit-cta")).toBeVisible();
  await expect(page.getByTestId("voyage-card").filter({ hasText: `V3 ${tag}` })).toHaveCount(0);

  // Souscrire (mock) -> premium
  await page.goto("/fr/abonnement");
  await page.getByTestId("subscribe-monthly").click();
  await expect(page.getByTestId("premium-badge")).toBeVisible();

  // Le 3e voyage passe désormais
  await page.goto("/fr/voyages");
  await creerVoyage(page, `V3 ${tag}`);
  await expect(page.getByTestId("voyage-card").filter({ hasText: `V3 ${tag}` })).toBeVisible();
});

test("Premium annule : reste premium jusqu'à la fin de période", async ({ page }) => {
  await login(page, "premium@vito.test");
  await page.goto("/fr/abonnement");
  await expect(page.getByTestId("premium-badge")).toBeVisible();

  await page.getByTestId("cancel-sub").click();
  // Toujours premium, mais libellé « Premium jusqu'au ... »
  await expect(page.getByTestId("premium-badge")).toBeVisible();
  await expect(page.getByTestId("plan-actuel")).toContainText("jusqu'au");
});
```

- [ ] **Step 4: Lancer les e2e abonnement**

Run: `npx playwright test e2e/abonnement.spec.ts --retries=0`
Expected: PASS (2 tests).

- [ ] **Step 5: Suite e2e complète (non-régression : C4/C5 non cassés par le trigger)**

Run: `npx playwright test --retries=0`
Expected: PASS (suite complète : restos/voyages/vins/recherche/auth/depenses + abonnement). En particulier l'e2e voyages « créer un voyage » (client) doit rester vert.

- [ ] **Step 6: Commit**

```bash
git add supabase/seed.sql e2e/abonnement.spec.ts
git commit -m "test(abonnement): comptes dédiés + e2e gating limite voyages et annulation"
```

---

## Notes d'exécution

- **Ordre** : 1 (DB) → 2 (payment) → 3 (domain) → 4 (data + gating) → 5 (UI) → 6 (seed + e2e). Task 4 dépend de 2 et 3 ; Task 5 de 4 ; Task 6 de tout.
- **Pas de `db push` prod pendant l'implémentation** : la prod n'est migrée qu'à la clôture (après PR mergée), comme C1–C5.
- **Signaux e2e déterministes** : attendre l'apparition de `voyage-card` / `voyage-limit-cta` / `premium-badge` — jamais `networkidle` (leçon du hotfix PR #6).
- **Isolation des comptes** : les e2e d'abonnement n'utilisent que `free@vito.test` / `premium@vito.test` ; ne pas réutiliser `client`/`agence` (évite de fragiliser C4/C5 face au trigger de limite).
