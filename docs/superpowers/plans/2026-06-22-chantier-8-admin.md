# Back-office admin (lecture seule) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un tableau de bord admin en lecture seule : utilisateurs, abonnements, demandes de conciergerie + compteurs (KPI).

**Architecture:** `features/admin/{domain,data,ui}`. Lecture transverse via policies admin : seul ajout DB = `is_admin()` + une policy `subscriptions_select_admin` (`profiles` et `conciergerie_demandes` sont déjà lisibles par l'admin). `computeAdminStats` (pur, réutilise `isPremiumFrom` de 6a). Page `/admin` gardée `requireRole(["admin"])`. Aucune mutation.

**Tech Stack:** Next.js 16 (App Router), TypeScript strict, Supabase (Postgres + RLS), Zod (déjà présent), next-intl, Vitest, Playwright.

## Global Constraints

- Next.js 16 non-standard : consulter `node_modules/next/dist/docs/` avant une API Next inconnue.
- TypeScript strict avec `noUncheckedIndexedAccess`.
- **Lecture seule** : aucune mutation/action dans ce chantier.
- `/admin` réservé au rôle `admin` : `await requireRole(["admin"])` en PREMIÈRE instruction de la page.
- Lecture transverse via policies admin permissives. `is_admin()` `security definer set search_path = ''`, revoke anon/public + grant authenticated.
- Aucune chaîne UI en dur (i18n `admin.*`). Migration suivante = `00015_admin.sql`. Feature `src/features/admin/`, route `/admin`.
- Réutilise `isPremiumFrom` (`@/features/abonnement/domain/premium`), `requireRole` (`@/lib/rbac/guards`).
- **Pas de régénération `database.types.ts`** : ce chantier ne lit que des tables existantes (profiles/subscriptions/conciergerie_demandes) et n'appelle aucune nouvelle RPC depuis TS.

---

### Task 1: Migration `00015_admin.sql`

**Files:**
- Create: `supabase/migrations/00015_admin.sql`

**Interfaces:**
- Produces : fonction `public.is_admin() returns boolean` ; policy `subscriptions_select_admin` (admin lit tous les abonnements).

- [ ] **Step 1: Écrire la migration**

Create `supabase/migrations/00015_admin.sql` :

```sql
create function public.is_admin() returns boolean
  language sql security definer set search_path = '' stable as $$
  select coalesce(auth.jwt() ->> 'user_role', '') = 'admin';
$$;

-- subscriptions : aujourd'hui select-own (00011). Policy permissive admin-read ajoutée.
create policy "subscriptions_select_admin" on public.subscriptions for select
  using (public.is_admin());

revoke execute on function public.is_admin() from anon, public;
grant execute on function public.is_admin() to authenticated;
```
(Note : `profiles` est déjà lu par l'admin via `profiles_select_self_or_admin` (00001) ;
`conciergerie_demandes` via `conciergerie_select` qui inclut `is_concierge()` = agence/admin (00012).
Les policies RLS sont permissives (OR) : ajouter `subscriptions_select_admin` ne retire rien aux
utilisateurs (select-own conservé).)

- [ ] **Step 2: Appliquer**

Run: `supabase db reset`
Expected: applique 00001→00015 + seed sans erreur.

- [ ] **Step 3: Vérifier structure + comportement (admin lit tous les abonnements)**

Run:
```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" <<'SQL'
select count(*) as has_func from pg_proc where proname='is_admin';
select count(*) as has_policy from pg_policies where tablename='subscriptions' and policyname='subscriptions_select_admin';
-- l'admin (rôle via JWT) doit voir tous les abonnements ; on simule le claim admin
do $$
declare n int;
begin
  perform set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated","user_role":"admin"}', true);
  perform set_config('role', 'authenticated', true);
  select count(*) into n from public.subscriptions;  -- premium@vito a 1 abonnement actif (seed)
  if n < 1 then raise exception 'FAIL: admin ne voit aucun abonnement (n=%)', n; end if;
  raise notice 'OK: admin voit % abonnement(s)', n;
end $$;
SQL
```
Expected: `has_func = 1` ; `has_policy = 1` ; `NOTICE: OK: admin voit 1 abonnement(s)` (ou plus). Aucune ERROR.
(Si `psql` absent : `docker exec -i supabase_db_Vito psql -U postgres -d postgres`. Si la simulation du claim échoue à charger le rôle JWT — `auth.uid()`/`auth.jwt()` dépendent du GUC — se rabattre sur la vérif structure `has_func`/`has_policy` ; le comportement admin est de toute façon couvert par l'e2e Task 4.)

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/00015_admin.sql
git commit -m "feat(admin): migration 00015 (is_admin + subscriptions_select_admin)"
```

---

### Task 2: Domain (computeAdminStats) + Data (queries)

**Files:**
- Create: `src/features/admin/domain/stats.ts` + `stats.test.ts`
- Create: `src/features/admin/data/queries.ts`

**Interfaces:**
- Consumes: `isPremiumFrom` de `@/features/abonnement/domain/premium` ; `createServerSupabase`.
- Produces:
  - `type AdminData = { users: { id: string }[]; subscriptions: { status: string; currentPeriodEnd: string }[]; demandes: { statut: string }[] }`.
  - `computeAdminStats(data: AdminData, now: Date) => { totalUsers: number; premiumActifs: number; demandesParStatut: Record<string, number> }`.
  - `getAdminUsers()`, `getAdminSubscriptions()`, `getAdminDemandes()`.

- [ ] **Step 1: Écrire le test (échec attendu)**

Create `src/features/admin/domain/stats.test.ts` :
```ts
import { describe, it, expect } from "vitest";
import { computeAdminStats } from "./stats";

const now = new Date("2026-06-22T00:00:00Z");

describe("computeAdminStats", () => {
  it("compte users, premium (via isPremiumFrom) et demandes par statut", () => {
    const stats = computeAdminStats(
      {
        users: [{ id: "a" }, { id: "b" }, { id: "c" }],
        subscriptions: [
          { status: "active", currentPeriodEnd: "2026-01-01" }, // premium (actif, même si date passée)
          { status: "canceled", currentPeriodEnd: "2026-12-31" }, // premium (annulé, non expiré)
          { status: "canceled", currentPeriodEnd: "2026-01-01" }, // PAS premium (annulé, expiré)
        ],
        demandes: [{ statut: "nouvelle" }, { statut: "nouvelle" }, { statut: "confirmee" }],
      },
      now,
    );
    expect(stats.totalUsers).toBe(3);
    expect(stats.premiumActifs).toBe(2);
    expect(stats.demandesParStatut).toEqual({ nouvelle: 2, confirmee: 1 });
  });
});
```

- [ ] **Step 2: Lancer (échec)**

Run: `npx vitest run src/features/admin/domain/stats.test.ts`
Expected: FAIL (module introuvable).

- [ ] **Step 3: Implémenter stats.ts**

Create `src/features/admin/domain/stats.ts` :
```ts
import { isPremiumFrom } from "@/features/abonnement/domain/premium";

export type AdminData = {
  users: { id: string }[];
  subscriptions: { status: string; currentPeriodEnd: string }[];
  demandes: { statut: string }[];
};

export function computeAdminStats(data: AdminData, now: Date) {
  const demandesParStatut: Record<string, number> = {};
  for (const d of data.demandes) {
    demandesParStatut[d.statut] = (demandesParStatut[d.statut] ?? 0) + 1;
  }
  return {
    totalUsers: data.users.length,
    premiumActifs: data.subscriptions.filter((s) => isPremiumFrom(s, now)).length,
    demandesParStatut,
  };
}
```

- [ ] **Step 4: Lancer (succès)**

Run: `npx vitest run src/features/admin/domain/stats.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Implémenter queries.ts**

Create `src/features/admin/data/queries.ts` :
```ts
import { createServerSupabase } from "@/lib/supabase/server";

export async function getAdminUsers() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, display_name, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getAdminSubscriptions() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("user_id, status, period, current_period_end")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getAdminDemandes() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("conciergerie_demandes")
    .select("id, type, statut, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
```

- [ ] **Step 6: Vérifier typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS. *(Comportement runtime — l'admin lit tout — couvert par l'e2e Task 4.)*

- [ ] **Step 7: Commit**

```bash
git add src/features/admin/domain src/features/admin/data
git commit -m "feat(admin): computeAdminStats (TDD) + queries (users/subscriptions/demandes)"
```

---

### Task 3: UI (page /admin gardée + composants) + i18n

**Files:**
- Modify: `messages/fr.json` (namespace `admin`)
- Create: `src/features/admin/ui/StatsCards.tsx`
- Create: `src/features/admin/ui/UsersTable.tsx`
- Create: `src/features/admin/ui/SubscriptionsTable.tsx`
- Create: `src/features/admin/ui/DemandesTable.tsx`
- Create: `src/app/[locale]/(app)/admin/page.tsx`
- Create: `src/app/[locale]/(app)/admin/error.tsx`

**Interfaces:**
- Consumes: `getAdminUsers`/`getAdminSubscriptions`/`getAdminDemandes` + `computeAdminStats` (Task 2) ; `requireRole` de `@/lib/rbac/guards`.
- Produces : page `/admin` (réservée admin). `data-testid` : `admin-stats`, `users-table`, `subscriptions-table`, `demandes-table`.

- [ ] **Step 1: i18n**

Modify `messages/fr.json` — ajouter au niveau racine (après le bloc `"agence": { ... }`, virgule de séparation) :
```json
  "admin": {
    "title": "Back-office",
    "kpiUsers": "Utilisateurs",
    "kpiPremium": "Premium actifs",
    "kpiDemandes": "Demandes",
    "users": "Utilisateurs",
    "subscriptions": "Abonnements",
    "demandes": "Conciergerie",
    "colNom": "Nom",
    "colRole": "Rôle",
    "colDate": "Date",
    "colStatut": "Statut",
    "colType": "Type",
    "colPeriode": "Période",
    "colClient": "Client",
    "error": { "title": "Une erreur est survenue", "retry": "Réessayer" }
  }
```

- [ ] **Step 2: StatsCards.tsx**

Create `src/features/admin/ui/StatsCards.tsx` :
```tsx
import { getTranslations } from "next-intl/server";

type Stats = { totalUsers: number; premiumActifs: number; demandesParStatut: Record<string, number> };

export async function StatsCards({ stats }: { stats: Stats }) {
  const t = await getTranslations("admin");
  const totalDemandes = Object.values(stats.demandesParStatut).reduce((a, b) => a + b, 0);
  const cards = [
    { label: t("kpiUsers"), value: stats.totalUsers },
    { label: t("kpiPremium"), value: stats.premiumActifs },
    { label: t("kpiDemandes"), value: totalDemandes },
  ];
  return (
    <section data-testid="admin-stats" className="flex gap-4 flex-wrap">
      {cards.map((c) => (
        <div key={c.label} className="border p-4 min-w-32">
          <div className="text-sm text-gray-600">{c.label}</div>
          <div className="text-2xl font-bold">{c.value}</div>
        </div>
      ))}
    </section>
  );
}
```

- [ ] **Step 3: UsersTable.tsx + SubscriptionsTable.tsx + DemandesTable.tsx**

Create `src/features/admin/ui/UsersTable.tsx` :
```tsx
import { getTranslations } from "next-intl/server";

type User = { id: string; role: string; display_name: string | null; created_at: string };

export async function UsersTable({ users }: { users: User[] }) {
  const t = await getTranslations("admin");
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-semibold">{t("users")}</h2>
      <table data-testid="users-table" className="text-sm">
        <thead>
          <tr><th className="text-left pr-4">{t("colNom")}</th><th className="text-left pr-4">{t("colRole")}</th><th className="text-left">{t("colDate")}</th></tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td className="pr-4">{u.display_name ?? u.id}</td>
              <td className="pr-4">{u.role}</td>
              <td>{new Date(u.created_at).toLocaleDateString("fr-FR")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
```

Create `src/features/admin/ui/SubscriptionsTable.tsx` :
```tsx
import { getTranslations } from "next-intl/server";

type Sub = { user_id: string; status: string; period: string; current_period_end: string };

export async function SubscriptionsTable({ subscriptions }: { subscriptions: Sub[] }) {
  const t = await getTranslations("admin");
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-semibold">{t("subscriptions")}</h2>
      <table data-testid="subscriptions-table" className="text-sm">
        <thead>
          <tr><th className="text-left pr-4">{t("colClient")}</th><th className="text-left pr-4">{t("colStatut")}</th><th className="text-left pr-4">{t("colPeriode")}</th><th className="text-left">{t("colDate")}</th></tr>
        </thead>
        <tbody>
          {subscriptions.map((s) => (
            <tr key={s.user_id}>
              <td className="pr-4">{s.user_id}</td>
              <td className="pr-4">{s.status}</td>
              <td className="pr-4">{s.period}</td>
              <td>{new Date(s.current_period_end).toLocaleDateString("fr-FR")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
```

Create `src/features/admin/ui/DemandesTable.tsx` :
```tsx
import { getTranslations } from "next-intl/server";

type Demande = { id: string; type: string; statut: string; created_at: string };

export async function DemandesTable({ demandes }: { demandes: Demande[] }) {
  const t = await getTranslations("admin");
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-semibold">{t("demandes")}</h2>
      <table data-testid="demandes-table" className="text-sm">
        <thead>
          <tr><th className="text-left pr-4">{t("colType")}</th><th className="text-left pr-4">{t("colStatut")}</th><th className="text-left">{t("colDate")}</th></tr>
        </thead>
        <tbody>
          {demandes.map((d) => (
            <tr key={d.id}>
              <td className="pr-4">{d.type}</td>
              <td className="pr-4">{d.statut}</td>
              <td>{new Date(d.created_at).toLocaleDateString("fr-FR")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
```

- [ ] **Step 4: Page (gardée) + error**

Create `src/app/[locale]/(app)/admin/page.tsx` :
```tsx
import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/rbac/guards";
import { getAdminUsers, getAdminSubscriptions, getAdminDemandes } from "@/features/admin/data/queries";
import { computeAdminStats } from "@/features/admin/domain/stats";
import { StatsCards } from "@/features/admin/ui/StatsCards";
import { UsersTable } from "@/features/admin/ui/UsersTable";
import { SubscriptionsTable } from "@/features/admin/ui/SubscriptionsTable";
import { DemandesTable } from "@/features/admin/ui/DemandesTable";

export default async function AdminPage() {
  await requireRole(["admin"]); // redirige les non-admin
  const t = await getTranslations("admin");
  const [users, subscriptions, demandes] = await Promise.all([
    getAdminUsers(),
    getAdminSubscriptions(),
    getAdminDemandes(),
  ]);
  const stats = computeAdminStats(
    {
      users,
      subscriptions: subscriptions.map((s) => ({ status: s.status, currentPeriodEnd: s.current_period_end })),
      demandes,
    },
    new Date(),
  );
  return (
    <main className="p-6 flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <StatsCards stats={stats} />
      <UsersTable users={users} />
      <SubscriptionsTable subscriptions={subscriptions} />
      <DemandesTable demandes={demandes} />
    </main>
  );
}
```

Create `src/app/[locale]/(app)/admin/error.tsx` :
```tsx
"use client";
import { useTranslations } from "next-intl";
export default function AdminError({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations("admin.error");
  return (
    <main className="p-6">
      <p role="alert">{t("title")}</p>
      <button onClick={reset} className="underline">{t("retry")}</button>
    </main>
  );
}
```

- [ ] **Step 5: Vérifier build (typecheck + lint + unit)**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS (typecheck/lint sans erreur ; tous les tests unitaires verts).

- [ ] **Step 6: Commit**

```bash
git add messages/fr.json src/features/admin/ui src/app/\[locale\]/\(app\)/admin
git commit -m "feat(admin): page /admin gardée (KPI + tableaux users/abonnements/conciergerie) + i18n"
```

---

### Task 4: e2e (dashboard admin + gating)

**Files:**
- Create: `e2e/admin.spec.ts`

**Interfaces:**
- Consumes : `/fr/admin`, `data-testid` de Task 3. Comptes : `admin@vito.test` (rôle admin, display_name "Admin"), `client@vito.test` (rôle client). Mot de passe `password123`.

- [ ] **Step 1: Écrire l'e2e**

Create `e2e/admin.spec.ts` :
```ts
import { test, expect, type Page } from "@playwright/test";

async function login(page: Page, email: string) {
  await page.goto("/fr/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill("password123");
  await page.getByRole("button", { name: "Connexion" }).click();
  await expect(page).toHaveURL(/\/fr\/restos/);
}

test("l'admin voit le tableau de bord (KPI + tableaux)", async ({ page }) => {
  await login(page, "admin@vito.test");
  await page.goto("/fr/admin");
  await expect(page.getByTestId("admin-stats")).toBeVisible();
  // Assertion STABLE : la table users contient l'admin (display_name « Admin », jamais muté).
  // (On n'assert PAS de contenu d'abonnement/demande : leur état varie selon les tests parallèles
  //  — 6a annule premium@vito, 6b répond à la demande seed. On vérifie donc la présence des tables.)
  await expect(page.getByTestId("users-table")).toContainText("Admin");
  await expect(page.getByTestId("subscriptions-table")).toBeVisible();
  await expect(page.getByTestId("demandes-table")).toBeVisible();
});

test("un non-admin ne peut pas accéder à /admin", async ({ page }) => {
  await login(page, "client@vito.test");
  await page.goto("/fr/admin");
  await expect(page).not.toHaveURL(/\/fr\/admin/);
  await expect(page.getByTestId("admin-stats")).toHaveCount(0);
});
```

- [ ] **Step 2: Appliquer le schéma (au cas où) + lancer l'e2e admin**

Run: `supabase db reset && npx playwright test e2e/admin.spec.ts --retries=0`
Expected: PASS (2 tests).

- [ ] **Step 3: Suite complète (non-régression)**

Run: `supabase db reset && npx playwright test --retries=0`
Expected: PASS (toute la suite + admin). (Un seul `db reset` immédiatement avant la suite complète.)

- [ ] **Step 4: Commit**

```bash
git add e2e/admin.spec.ts
git commit -m "test(admin): e2e (dashboard admin peuplé + gating non-admin)"
```

---

## Notes d'exécution

- **Ordre** : 1 (DB) → 2 (domain+data) → 3 (UI) → 4 (e2e). Task 3 dépend de 2 ; Task 4 de tout.
- **Pas de `db push` prod** pendant l'implémentation (prod migrée à la clôture, comme C1–7b).
- **Pas de régénération `database.types.ts`** : aucune nouvelle table/RPC appelée depuis TS (la migration ajoute seulement une policy + une fonction utilisée en RLS).
- **Signaux e2e déterministes** : attendre `admin-stats`/`users-table`/etc. et un contenu connu (« Admin », « active », « nouvelle ») ; jamais `networkidle`. Gating agnostique à la cible de redirection.
- **Aucun changement de seed** : les données existantes (profils multiples, abonnement premium@vito, demande conciergerie démo) suffisent à peupler le dashboard.
