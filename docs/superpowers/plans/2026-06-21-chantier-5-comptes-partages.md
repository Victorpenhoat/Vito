# Comptes partagés (dépenses de groupe) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Module « Comptes partagés » : groupes de dépenses (liables à un voyage), répartition égale/exacte, soldes nets, transferts minimaux et remboursements, partagé entre utilisateurs inscrits.

**Architecture:** Calque du module Voyages (C4) : `features/depenses/{domain,data,ui}`, multi-utilisateur via helpers `security definer` anti-récursion (`is_groupe_owner`/`can_access_groupe`), RLS par commande + grants explicites, partage par e-mail via RPC owner-only. Argent en **centimes entiers** ; les parts de chaque participant sont **matérialisées** dans `depense_parts` → soldes = simples `SUM`. Logique de calcul (parts/soldes/transferts) en fonctions **pures testées**.

**Tech Stack:** Next.js 16 (App Router, Server Actions), TypeScript strict, Supabase (Postgres + RLS), Zod, next-intl, Vitest, Playwright.

## Global Constraints

- Next.js 16 non-standard : consulter `node_modules/next/dist/docs/` avant d'utiliser une API Next inconnue ; respecter les avis de dépréciation.
- TypeScript strict avec `noUncheckedIndexedAccess` : tout accès indexé peut être `undefined`.
- RLS **et** grants explicites `to authenticated` sur **chaque** table (RLS seule = « permission denied » en prod).
- Nommage produit **« Comptes partagés »** ; jamais « Tricount » (marque déposée) dans l'UI/routes/chaînes.
- Tables préfixées `depense_*` ; feature `src/features/depenses/` ; route `/depenses` ; namespace i18n `depenses.*`.
- Argent en `bigint` centimes ; jamais de float en base. UUID de seed/test = **v4 valides** (Zod `.uuid()` strict).
- `owner_id`/`paye_par`/`created_by` dérivés de la session, jamais du client.
- Aucune chaîne UI en dur : tout via `messages/fr.json`.
- Helpers `security definer` : `language sql security definer set search_path = '' stable`.
- Migration suivante = `supabase/migrations/00010_depenses.sql`.

---

### Task 1: Migration `00010_depenses.sql` (schéma + RLS + RPC + grants)

**Files:**
- Create: `supabase/migrations/00010_depenses.sql`

**Interfaces:**
- Produces (objets SQL consommés par les couches data/seed) : tables `public.depense_groupes`, `public.depense_groupe_membres`, `public.depenses`, `public.depense_parts`, `public.remboursements` ; enum `public.depense_mode` (`'egal'|'exact'`) ; fonctions `public.is_groupe_owner(uuid)`, `public.can_access_groupe(uuid)`, `public.share_groupe(uuid, text) returns text` (`'ok'|'not_found'|'self'`), `public.unshare_groupe(uuid, uuid) returns void` ; trigger d'auto-insertion du owner dans `depense_groupe_membres`.

- [ ] **Step 1: Écrire la migration complète**

Create `supabase/migrations/00010_depenses.sql` :

```sql
create type public.depense_mode as enum ('egal', 'exact');

create table public.depense_groupes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  voyage_id uuid references public.voyages (id) on delete set null,
  titre text not null check (char_length(titre) <= 200),
  devise text not null default 'EUR' check (char_length(devise) = 3),
  created_at timestamptz not null default now()
);

create table public.depense_groupe_membres (
  groupe_id uuid not null references public.depense_groupes (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'membre' check (role in ('owner', 'membre')),
  added_at timestamptz not null default now(),
  primary key (groupe_id, profile_id)
);

create table public.depenses (
  id uuid primary key default gen_random_uuid(),
  groupe_id uuid not null references public.depense_groupes (id) on delete cascade,
  paye_par uuid not null references public.profiles (id) on delete cascade,
  libelle text not null check (char_length(libelle) <= 200),
  montant_cents bigint not null check (montant_cents > 0),
  date date,
  mode public.depense_mode not null default 'egal',
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.depense_parts (
  depense_id uuid not null references public.depenses (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  part_cents bigint not null check (part_cents >= 0),
  primary key (depense_id, profile_id)
);

create table public.remboursements (
  id uuid primary key default gen_random_uuid(),
  groupe_id uuid not null references public.depense_groupes (id) on delete cascade,
  de_profile_id uuid not null references public.profiles (id) on delete cascade,
  vers_profile_id uuid not null references public.profiles (id) on delete cascade,
  montant_cents bigint not null check (montant_cents > 0),
  date date,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (de_profile_id <> vers_profile_id)
);

create index depense_groupes_owner_idx on public.depense_groupes (owner_id);
create index depense_groupes_voyage_idx on public.depense_groupes (voyage_id);
create index depense_groupe_membres_profile_idx on public.depense_groupe_membres (profile_id);
create index depenses_groupe_idx on public.depenses (groupe_id);
create index depense_parts_profile_idx on public.depense_parts (profile_id);
create index remboursements_groupe_idx on public.remboursements (groupe_id);

-- Helpers security definer (anti-récursion RLS)
create function public.is_groupe_owner(g_id uuid) returns boolean
  language sql security definer set search_path = '' stable as $$
  select exists (select 1 from public.depense_groupes where id = g_id and owner_id = auth.uid());
$$;

create function public.can_access_groupe(g_id uuid) returns boolean
  language sql security definer set search_path = '' stable as $$
  select exists (select 1 from public.depense_groupes where id = g_id and owner_id = auth.uid())
      or exists (select 1 from public.depense_groupe_membres where groupe_id = g_id and profile_id = auth.uid());
$$;

-- Trigger : owner_id immuable (anti-escalade de privilèges, leçon C4)
create function public.depense_groupes_lock_owner() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  if new.owner_id <> old.owner_id then
    raise exception 'owner_id immuable';
  end if;
  return new;
end;
$$;
create trigger depense_groupes_owner_immutable before update on public.depense_groupes
  for each row execute function public.depense_groupes_lock_owner();

-- Trigger : auto-insertion du propriétaire dans depense_groupe_membres à la création
create function public.add_groupe_owner_membre() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  insert into public.depense_groupe_membres (groupe_id, profile_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (groupe_id, profile_id) do nothing;
  return new;
end;
$$;
create trigger on_groupe_created after insert on public.depense_groupes
  for each row execute function public.add_groupe_owner_membre();

-- RLS depense_groupes (une policy par commande)
alter table public.depense_groupes enable row level security;
create policy "depense_groupes_select" on public.depense_groupes for select using (public.can_access_groupe(id));
create policy "depense_groupes_insert" on public.depense_groupes for insert with check (owner_id = auth.uid());
create policy "depense_groupes_update" on public.depense_groupes for update using (public.can_access_groupe(id)) with check (public.can_access_groupe(id));
create policy "depense_groupes_delete" on public.depense_groupes for delete using (public.is_groupe_owner(id));

-- RLS depense_groupe_membres (lecture = membres ; écriture = owner ; owner non retirable)
alter table public.depense_groupe_membres enable row level security;
create policy "depense_groupe_membres_select" on public.depense_groupe_membres for select using (public.can_access_groupe(groupe_id));
create policy "depense_groupe_membres_insert" on public.depense_groupe_membres for insert with check (public.is_groupe_owner(groupe_id));
create policy "depense_groupe_membres_delete" on public.depense_groupe_membres for delete
  using (public.is_groupe_owner(groupe_id) and role <> 'owner');

-- RLS depenses (collaboratif)
alter table public.depenses enable row level security;
create policy "depenses_all" on public.depenses for all
  using (public.can_access_groupe(groupe_id)) with check (public.can_access_groupe(groupe_id));

-- RLS depense_parts (gardé via le groupe de la dépense parente)
alter table public.depense_parts enable row level security;
create policy "depense_parts_all" on public.depense_parts for all
  using (public.can_access_groupe((select groupe_id from public.depenses where id = depense_id)))
  with check (public.can_access_groupe((select groupe_id from public.depenses where id = depense_id)));

-- RLS remboursements (collaboratif)
alter table public.remboursements enable row level security;
create policy "remboursements_all" on public.remboursements for all
  using (public.can_access_groupe(groupe_id)) with check (public.can_access_groupe(groupe_id));

-- Grants explicites
grant select, insert, update, delete on public.depense_groupes to authenticated;
grant select, insert, update, delete on public.depense_groupe_membres to authenticated;
grant select, insert, update, delete on public.depenses to authenticated;
grant select, insert, update, delete on public.depense_parts to authenticated;
grant select, insert, update, delete on public.remboursements to authenticated;

-- RPC de partage (owner-only, sans énumération d'e-mails)
create function public.share_groupe(p_groupe_id uuid, p_email text) returns text
  language plpgsql security definer set search_path = '' as $$
declare v_uid uuid;
begin
  if auth.uid() is null then raise exception 'authentification requise'; end if;
  if not public.is_groupe_owner(p_groupe_id) then raise exception 'non autorisé'; end if;
  select id into v_uid from auth.users where lower(email) = lower(p_email);
  if v_uid is null then return 'not_found'; end if;
  if v_uid = auth.uid() then return 'self'; end if;
  insert into public.depense_groupe_membres (groupe_id, profile_id, role)
  values (p_groupe_id, v_uid, 'membre')
  on conflict (groupe_id, profile_id) do nothing;
  return 'ok';
end;
$$;

create function public.unshare_groupe(p_groupe_id uuid, p_profile_id uuid) returns void
  language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'authentification requise'; end if;
  if not public.is_groupe_owner(p_groupe_id) then raise exception 'non autorisé'; end if;
  delete from public.depense_groupe_membres
  where groupe_id = p_groupe_id and profile_id = p_profile_id and role <> 'owner';
end;
$$;

revoke execute on function public.share_groupe(uuid, text) from anon, public;
grant execute on function public.share_groupe(uuid, text) to authenticated;
revoke execute on function public.unshare_groupe(uuid, uuid) from anon, public;
grant execute on function public.unshare_groupe(uuid, uuid) to authenticated;
revoke execute on function public.is_groupe_owner(uuid) from anon, public;
revoke execute on function public.can_access_groupe(uuid) from anon, public;
grant execute on function public.is_groupe_owner(uuid) to authenticated;
grant execute on function public.can_access_groupe(uuid) to authenticated;
```

- [ ] **Step 2: Appliquer et vérifier la migration**

Run: `supabase db reset`
Expected: applique 00001→00010 + seed sans erreur (« Finished supabase db reset. »).

- [ ] **Step 3: Vérifier tables, policies et trigger owner**

Run :
```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "
select count(*) as tables from pg_tables where schemaname='public'
  and tablename in ('depense_groupes','depense_groupe_membres','depenses','depense_parts','remboursements');
select count(*) as policies from pg_policies where schemaname='public'
  and tablename in ('depense_groupes','depense_groupe_membres','depenses','depense_parts','remboursements');
insert into public.depense_groupes (owner_id, titre)
  values ('11111111-1111-1111-1111-111111111111','TestTrigger') returning id \gset
select role from public.depense_groupe_membres where groupe_id = :'id';
delete from public.depense_groupes where id = :'id';
"
```
Expected: `tables = 5` ; `policies >= 9` ; la ligne `role` retournée = `owner` (le trigger a auto-inséré le propriétaire).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/00010_depenses.sql
git commit -m "feat(depenses): migration 00010 (schéma, RLS, RPC partage, grants)"
```

---

### Task 2: Domain — argent (`money.ts`) + schémas Zod (`schemas.ts`)

**Files:**
- Create: `src/features/depenses/domain/money.ts`
- Create: `src/features/depenses/domain/money.test.ts`
- Create: `src/features/depenses/domain/schemas.ts`
- Create: `src/features/depenses/domain/schemas.test.ts`

**Interfaces:**
- Produces:
  - `centsFromEuros: z.ZodType<number>` — schéma transformant une chaîne euros (`"12,50"`, `"12.5"`, `"12"`) en **centimes entiers > 0** ; rejette `> 2` décimales, non-numérique, `0`.
  - `formatCents(cents: number, devise: string): string` — ex. `formatCents(1250,"EUR") === "12,50 EUR"`.
  - `DEPENSE_MODES = ["egal","exact"] as const`.
  - `groupeInputSchema` → `{ titre: string; devise?: string; voyageId?: string }`.
  - `depenseInputSchema` → `{ groupeId: string; payePar: string; libelle: string; montantCents: number; date?: string; mode: "egal"|"exact"; participants: string[] }`.
  - `remboursementInputSchema` → `{ groupeId: string; deProfileId: string; versProfileId: string; montantCents: number; date?: string }`.
  - `shareGroupeSchema` → `{ groupeId: string; email: string }`.

- [ ] **Step 1: Écrire les tests money (échec attendu)**

Create `src/features/depenses/domain/money.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { centsFromEuros, formatCents } from "./money";

describe("centsFromEuros", () => {
  it("convertit virgule et point en centimes", () => {
    expect(centsFromEuros.parse("12,50")).toBe(1250);
    expect(centsFromEuros.parse("12.5")).toBe(1250);
    expect(centsFromEuros.parse("12")).toBe(1200);
  });
  it("rejette 0, négatif, >2 décimales et non-numérique", () => {
    expect(centsFromEuros.safeParse("0").success).toBe(false);
    expect(centsFromEuros.safeParse("-1").success).toBe(false);
    expect(centsFromEuros.safeParse("12.555").success).toBe(false);
    expect(centsFromEuros.safeParse("abc").success).toBe(false);
  });
});

describe("formatCents", () => {
  it("formate en devise avec 2 décimales et virgule", () => {
    expect(formatCents(1250, "EUR")).toBe("12,50 EUR");
    expect(formatCents(7000, "EUR")).toBe("70,00 EUR");
    expect(formatCents(0, "EUR")).toBe("0,00 EUR");
  });
});
```

- [ ] **Step 2: Lancer les tests money (échec)**

Run: `npx vitest run src/features/depenses/domain/money.test.ts`
Expected: FAIL (« Cannot find module './money' »).

- [ ] **Step 3: Implémenter money.ts**

Create `src/features/depenses/domain/money.ts` :

```ts
import { z } from "zod";

export const centsFromEuros = z
  .string()
  .regex(/^\d+([.,]\d{1,2})?$/, "Montant invalide")
  .transform((s) => Math.round(Number.parseFloat(s.replace(",", ".")) * 100))
  .refine((c) => c > 0, "Montant doit être > 0");

export function formatCents(cents: number, devise: string): string {
  return `${(cents / 100).toFixed(2).replace(".", ",")} ${devise}`;
}
```

- [ ] **Step 4: Lancer les tests money (succès)**

Run: `npx vitest run src/features/depenses/domain/money.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Écrire les tests schémas (échec attendu)**

Create `src/features/depenses/domain/schemas.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { groupeInputSchema, depenseInputSchema, remboursementInputSchema, shareGroupeSchema } from "./schemas";

const A = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const B = "b1ffc88a-1c2b-4ef8-bb6d-6bb9bd380a22";

describe("groupeInputSchema", () => {
  it("titre requis ; voyageId optionnel uuid", () => {
    expect(groupeInputSchema.safeParse({ titre: "Rome" }).success).toBe(true);
    expect(groupeInputSchema.safeParse({}).success).toBe(false);
    expect(groupeInputSchema.safeParse({ titre: "X", voyageId: "nope" }).success).toBe(false);
  });
});

describe("depenseInputSchema", () => {
  it("accepte une dépense égale valide (montant euros -> cents)", () => {
    const r = depenseInputSchema.safeParse({
      groupeId: A, payePar: A, libelle: "Hôtel", montantCents: "30", mode: "egal", participants: [A, B],
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.montantCents).toBe(3000);
  });
  it("rejette participants vide, mode invalide, montant nul", () => {
    expect(depenseInputSchema.safeParse({ groupeId: A, payePar: A, libelle: "X", montantCents: "10", mode: "egal", participants: [] }).success).toBe(false);
    expect(depenseInputSchema.safeParse({ groupeId: A, payePar: A, libelle: "X", montantCents: "10", mode: "parts", participants: [A] }).success).toBe(false);
    expect(depenseInputSchema.safeParse({ groupeId: A, payePar: A, libelle: "X", montantCents: "0", mode: "egal", participants: [A] }).success).toBe(false);
  });
});

describe("remboursementInputSchema", () => {
  it("de != vers, montant > 0", () => {
    expect(remboursementInputSchema.safeParse({ groupeId: A, deProfileId: A, versProfileId: B, montantCents: "20" }).success).toBe(true);
    expect(remboursementInputSchema.safeParse({ groupeId: A, deProfileId: A, versProfileId: A, montantCents: "20" }).success).toBe(false);
  });
});

describe("shareGroupeSchema", () => {
  it("email valide requis", () => {
    expect(shareGroupeSchema.safeParse({ groupeId: A, email: "a@b.fr" }).success).toBe(true);
    expect(shareGroupeSchema.safeParse({ groupeId: A, email: "nope" }).success).toBe(false);
  });
});
```

- [ ] **Step 6: Lancer les tests schémas (échec)**

Run: `npx vitest run src/features/depenses/domain/schemas.test.ts`
Expected: FAIL (« Cannot find module './schemas' »).

- [ ] **Step 7: Implémenter schemas.ts**

Create `src/features/depenses/domain/schemas.ts` :

```ts
import { z } from "zod";
import { centsFromEuros } from "./money";

export const DEPENSE_MODES = ["egal", "exact"] as const;

export const groupeInputSchema = z.object({
  titre: z.string().min(1).max(200),
  devise: z.string().length(3).optional(),
  voyageId: z.string().uuid().optional(),
});
export type GroupeInput = z.infer<typeof groupeInputSchema>;

export const depenseInputSchema = z.object({
  groupeId: z.string().uuid(),
  payePar: z.string().uuid(),
  libelle: z.string().min(1).max(200),
  montantCents: centsFromEuros,
  date: z.string().date().optional(),
  mode: z.enum(DEPENSE_MODES),
  participants: z.array(z.string().uuid()).min(1),
});
export type DepenseInput = z.infer<typeof depenseInputSchema>;

export const remboursementInputSchema = z
  .object({
    groupeId: z.string().uuid(),
    deProfileId: z.string().uuid(),
    versProfileId: z.string().uuid(),
    montantCents: centsFromEuros,
    date: z.string().date().optional(),
  })
  .refine((d) => d.deProfileId !== d.versProfileId, { message: "de et vers doivent différer", path: ["versProfileId"] });
export type RemboursementInput = z.infer<typeof remboursementInputSchema>;

export const shareGroupeSchema = z.object({
  groupeId: z.string().uuid(),
  email: z.string().email(),
});
export type ShareGroupeInput = z.infer<typeof shareGroupeSchema>;
```

- [ ] **Step 8: Lancer les tests schémas (succès)**

Run: `npx vitest run src/features/depenses/domain/schemas.test.ts`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/features/depenses/domain/money.ts src/features/depenses/domain/money.test.ts src/features/depenses/domain/schemas.ts src/features/depenses/domain/schemas.test.ts
git commit -m "feat(depenses): money (centimes) + schémas Zod (TDD)"
```

---

### Task 3: Domain — calculs parts/soldes/transferts (`calculations.ts`)

**Files:**
- Create: `src/features/depenses/domain/calculations.ts`
- Create: `src/features/depenses/domain/calculations.test.ts`

**Interfaces:**
- Consumes: rien (logique pure).
- Produces:
  - `type Part = { profileId: string; partCents: number }`
  - `type Balance = { profileId: string; soldeCents: number }`
  - `type Transfert = { deProfileId: string; versProfileId: string; montantCents: number }`
  - `computeParts(montantCents: number, mode: "egal"|"exact", participantIds: string[], exactsCents?: Record<string, number>): Part[]` — **égal** : reste réparti déterministe (ordre `profileId` croissant) ; **exact** : exige `exactsCents` pour chaque participant et `somme === montantCents`, sinon `throw`.
  - `computeBalances(memberIds: string[], depenses: { payePar: string; parts: Part[] }[], remboursements: Transfert[]): Balance[]` — payeur crédité de `somme(parts)`, chaque participant débité de sa part ; remboursement `de→vers` : `de +montant`, `vers -montant`. Invariant `somme = 0`.
  - `simplifyDebts(balances: Balance[]): Transfert[]` — glouton, déterministe.

- [ ] **Step 1: Écrire les tests (échec attendu)**

Create `src/features/depenses/domain/calculations.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { computeParts, computeBalances, simplifyDebts } from "./calculations";

const A = "aaaa", B = "bbbb", C = "cccc";

describe("computeParts", () => {
  it("égal : répartit le reste de façon déterministe (ordre profileId)", () => {
    const parts = computeParts(1000, "egal", [C, A, B]); // 1000/3 = 333 reste 1
    const byId = Object.fromEntries(parts.map((p) => [p.profileId, p.partCents]));
    expect(byId[A]).toBe(334); // premier dans l'ordre trié
    expect(byId[B]).toBe(333);
    expect(byId[C]).toBe(333);
    expect(parts.reduce((s, p) => s + p.partCents, 0)).toBe(1000);
  });
  it("exact : utilise les montants fournis si la somme correspond", () => {
    const parts = computeParts(9000, "exact", [A, B], { [A]: 5000, [B]: 4000 });
    expect(parts).toEqual([{ profileId: A, partCents: 5000 }, { profileId: B, partCents: 4000 }]);
  });
  it("exact : throw si la somme ne correspond pas", () => {
    expect(() => computeParts(9000, "exact", [A, B], { [A]: 5000, [B]: 3000 })).toThrow();
  });
  it("exact : throw si un participant n'a pas de montant", () => {
    expect(() => computeParts(9000, "exact", [A, B], { [A]: 9000 })).toThrow();
  });
});

describe("computeBalances", () => {
  it("invariant : somme des soldes = 0 ; valeurs attendues", () => {
    const balances = computeBalances(
      [A, B],
      [
        { payePar: A, parts: [{ profileId: A, partCents: 10000 }, { profileId: B, partCents: 10000 }] },
        { payePar: B, parts: [{ profileId: A, partCents: 5000 }, { profileId: B, partCents: 4000 }] },
      ],
      [{ deProfileId: A, versProfileId: B, montantCents: 2000 }],
    );
    const byId = Object.fromEntries(balances.map((b) => [b.profileId, b.soldeCents]));
    expect(byId[A]).toBe(7000);
    expect(byId[B]).toBe(-7000);
    expect(balances.reduce((s, b) => s + b.soldeCents, 0)).toBe(0);
  });
});

describe("simplifyDebts", () => {
  it("2 membres : le débiteur paie le créancier", () => {
    expect(simplifyDebts([{ profileId: A, soldeCents: 7000 }, { profileId: B, soldeCents: -7000 }]))
      .toEqual([{ deProfileId: B, versProfileId: A, montantCents: 7000 }]);
  });
  it("3 membres : total transféré = total dû, soldes nuls ignorés", () => {
    const t = simplifyDebts([
      { profileId: A, soldeCents: 6000 },
      { profileId: B, soldeCents: -4000 },
      { profileId: C, soldeCents: -2000 },
    ]);
    expect(t.reduce((s, x) => s + x.montantCents, 0)).toBe(6000);
    expect(t.every((x) => x.versProfileId === A)).toBe(true);
  });
});
```

- [ ] **Step 2: Lancer les tests (échec)**

Run: `npx vitest run src/features/depenses/domain/calculations.test.ts`
Expected: FAIL (« Cannot find module './calculations' »).

- [ ] **Step 3: Implémenter calculations.ts**

Create `src/features/depenses/domain/calculations.ts` :

```ts
export type Part = { profileId: string; partCents: number };
export type Balance = { profileId: string; soldeCents: number };
export type Transfert = { deProfileId: string; versProfileId: string; montantCents: number };

export function computeParts(
  montantCents: number,
  mode: "egal" | "exact",
  participantIds: string[],
  exactsCents?: Record<string, number>,
): Part[] {
  const ids = [...participantIds].sort((a, b) => a.localeCompare(b));
  if (mode === "exact") {
    const parts = ids.map((profileId) => {
      const partCents = exactsCents?.[profileId];
      if (partCents === undefined) throw new Error(`montant exact manquant pour ${profileId}`);
      return { profileId, partCents };
    });
    const sum = parts.reduce((s, p) => s + p.partCents, 0);
    if (sum !== montantCents) throw new Error("somme des montants exacts != total");
    return parts;
  }
  const n = ids.length;
  const base = Math.floor(montantCents / n);
  const reste = montantCents - base * n;
  return ids.map((profileId, i) => ({ profileId, partCents: base + (i < reste ? 1 : 0) }));
}

export function computeBalances(
  memberIds: string[],
  depenses: { payePar: string; parts: Part[] }[],
  remboursements: Transfert[],
): Balance[] {
  const solde = new Map<string, number>(memberIds.map((id) => [id, 0]));
  const bump = (id: string, delta: number) => solde.set(id, (solde.get(id) ?? 0) + delta);
  for (const d of depenses) {
    const total = d.parts.reduce((s, p) => s + p.partCents, 0);
    bump(d.payePar, total);
    for (const p of d.parts) bump(p.profileId, -p.partCents);
  }
  for (const r of remboursements) {
    bump(r.deProfileId, r.montantCents);
    bump(r.versProfileId, -r.montantCents);
  }
  return [...solde.entries()].map(([profileId, soldeCents]) => ({ profileId, soldeCents }));
}

export function simplifyDebts(balances: Balance[]): Transfert[] {
  const cred = balances.filter((b) => b.soldeCents > 0).map((b) => ({ id: b.profileId, amt: b.soldeCents }));
  const deb = balances.filter((b) => b.soldeCents < 0).map((b) => ({ id: b.profileId, amt: -b.soldeCents }));
  cred.sort((a, b) => b.amt - a.amt || a.id.localeCompare(b.id));
  deb.sort((a, b) => b.amt - a.amt || a.id.localeCompare(b.id));
  const transferts: Transfert[] = [];
  let i = 0;
  let j = 0;
  while (i < deb.length && j < cred.length) {
    const d = deb[i];
    const c = cred[j];
    if (!d || !c) break;
    const m = Math.min(d.amt, c.amt);
    transferts.push({ deProfileId: d.id, versProfileId: c.id, montantCents: m });
    d.amt -= m;
    c.amt -= m;
    if (d.amt === 0) i++;
    if (c.amt === 0) j++;
  }
  return transferts;
}
```

- [ ] **Step 4: Lancer les tests (succès)**

Run: `npx vitest run src/features/depenses/domain/calculations.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/depenses/domain/calculations.ts src/features/depenses/domain/calculations.test.ts
git commit -m "feat(depenses): calculs parts/soldes/transferts purs (TDD)"
```

---

### Task 4: Data — actions + queries

**Files:**
- Create: `src/features/depenses/data/actions.ts`
- Create: `src/features/depenses/data/queries.ts`

**Interfaces:**
- Consumes: `createServerSupabase` de `@/lib/supabase/server` ; `groupeInputSchema`, `depenseInputSchema`, `remboursementInputSchema`, `shareGroupeSchema` de `../domain/schemas` ; `computeParts`, `computeBalances`, `simplifyDebts`, types de `../domain/calculations` ; `redirect` de `@/lib/i18n/routing` ; `getLocale` de `next-intl/server` ; `revalidatePath` de `next/cache`.
- Produces (consommés par l'UI Task 5) :
  - Actions `useActionState` (signature `(_prev: unknown, formData: FormData)`, retour `{ ok: true } | { error: string }`) : `createGroupe`, `updateGroupe`, `deleteGroupe`, `addDepense`, `deleteDepense`, `addRemboursement`, `deleteRemboursement`, `shareGroupe`, `unshareGroupe`.
  - Action serveur simple (signature `(formData: FormData)`, redirige) : `openVoyageGroupe`.
  - `getMesGroupes(): Promise<{ id: string; titre: string; devise: string; voyage_id: string | null; owner_id: string }[]>`.
  - `getGroupeDetail(id: string)` → `{ groupe, membres: { profile_id; role; display_name: string|null }[], depenses: { id; paye_par; libelle; montant_cents; date; mode; parts: Part[] }[], remboursements: { id; de_profile_id; vers_profile_id; montant_cents; date }[], soldes: Balance[], transferts: Transfert[], isOwner: boolean }`.

- [ ] **Step 1: Implémenter queries.ts**

Create `src/features/depenses/data/queries.ts` :

```ts
import { createServerSupabase } from "@/lib/supabase/server";
import { computeBalances, simplifyDebts, type Part } from "../domain/calculations";

export async function getMesGroupes() {
  const supabase = await createServerSupabase();
  // RLS (can_access_groupe) renvoie automatiquement les groupes possédés + partagés.
  const { data, error } = await supabase
    .from("depense_groupes")
    .select("id, titre, devise, voyage_id, owner_id")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getGroupeDetail(id: string) {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id ?? null;

  const [gRes, mRes, dRes, rRes] = await Promise.all([
    supabase.from("depense_groupes").select("id, titre, devise, voyage_id, owner_id").eq("id", id).single(),
    supabase.from("depense_groupe_membres").select("profile_id, role, profile:profiles(display_name)").eq("groupe_id", id),
    supabase.from("depenses").select("id, paye_par, libelle, montant_cents, date, mode").eq("groupe_id", id).order("date", { ascending: true, nullsFirst: false }),
    supabase.from("remboursements").select("id, de_profile_id, vers_profile_id, montant_cents, date").eq("groupe_id", id).order("date", { ascending: true, nullsFirst: false }),
  ]);
  if (gRes.error) throw gRes.error;
  if (mRes.error) throw mRes.error;
  if (dRes.error) throw dRes.error;
  if (rRes.error) throw rRes.error;

  const depenseIds = (dRes.data ?? []).map((d) => d.id);
  let parts: { depense_id: string; profile_id: string; part_cents: number }[] = [];
  if (depenseIds.length) {
    const partsRes = await supabase.from("depense_parts").select("depense_id, profile_id, part_cents").in("depense_id", depenseIds);
    if (partsRes.error) throw partsRes.error;
    parts = partsRes.data ?? [];
  }

  const partsByDepense = new Map<string, Part[]>();
  for (const p of parts) {
    const arr = partsByDepense.get(p.depense_id) ?? [];
    arr.push({ profileId: p.profile_id, partCents: p.part_cents });
    partsByDepense.set(p.depense_id, arr);
  }

  const membres = (mRes.data ?? []).map((m) => {
    const p = Array.isArray(m.profile) ? m.profile[0] : m.profile;
    return { profile_id: m.profile_id, role: m.role, display_name: p?.display_name ?? null };
  });
  const depenses = (dRes.data ?? []).map((d) => ({ ...d, parts: partsByDepense.get(d.id) ?? [] }));

  const memberIds = membres.map((m) => m.profile_id);
  const soldes = computeBalances(
    memberIds,
    depenses.map((d) => ({ payePar: d.paye_par, parts: d.parts })),
    (rRes.data ?? []).map((r) => ({ deProfileId: r.de_profile_id, versProfileId: r.vers_profile_id, montantCents: r.montant_cents })),
  );
  const transferts = simplifyDebts(soldes);

  return {
    groupe: gRes.data,
    membres,
    depenses,
    remboursements: rRes.data ?? [],
    soldes,
    transferts,
    isOwner: gRes.data.owner_id === uid,
  };
}
```

- [ ] **Step 2: Implémenter actions.ts**

Create `src/features/depenses/data/actions.ts` :

```ts
"use server";
import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { redirect } from "@/lib/i18n/routing";
import { centsFromEuros } from "../domain/money";
import { computeParts } from "../domain/calculations";
import { groupeInputSchema, depenseInputSchema, remboursementInputSchema, shareGroupeSchema } from "../domain/schemas";

async function userId(supabase: Awaited<ReturnType<typeof createServerSupabase>>) {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function createGroupe(_prev: unknown, formData: FormData) {
  const parsed = groupeInputSchema.safeParse({
    titre: formData.get("titre"),
    devise: formData.get("devise") || undefined,
    voyageId: formData.get("voyageId") || undefined,
  });
  if (!parsed.success) return { error: "Groupe invalide" };
  const supabase = await createServerSupabase();
  const uid = await userId(supabase);
  if (!uid) return { error: "Non authentifié" };
  const { data: groupe, error } = await supabase
    .from("depense_groupes")
    .insert({ owner_id: uid, titre: parsed.data.titre, devise: parsed.data.devise ?? "EUR", voyage_id: parsed.data.voyageId ?? null })
    .select("id")
    .single();
  if (error || !groupe) return { error: "Création échouée" };
  if (parsed.data.voyageId) {
    const { data: vm } = await supabase.from("voyage_membres").select("profile_id").eq("voyage_id", parsed.data.voyageId);
    const rows = (vm ?? []).filter((m) => m.profile_id !== uid).map((m) => ({ groupe_id: groupe.id, profile_id: m.profile_id, role: "membre" as const }));
    if (rows.length) await supabase.from("depense_groupe_membres").insert(rows);
  }
  revalidatePath("/depenses");
  return { ok: true as const };
}

export async function updateGroupe(_prev: unknown, formData: FormData) {
  const id = formData.get("groupeId");
  if (typeof id !== "string") return { error: "Entrée invalide" };
  const parsed = groupeInputSchema.safeParse({
    titre: formData.get("titre"),
    devise: formData.get("devise") || undefined,
  });
  if (!parsed.success) return { error: "Groupe invalide" };
  const supabase = await createServerSupabase();
  if (!(await userId(supabase))) return { error: "Non authentifié" };
  const { error } = await supabase
    .from("depense_groupes")
    .update({ titre: parsed.data.titre, devise: parsed.data.devise ?? "EUR" })
    .eq("id", id);
  if (error) return { error: "Mise à jour échouée" };
  revalidatePath(`/depenses/${id}`);
  return { ok: true as const };
}

export async function deleteGroupe(_prev: unknown, formData: FormData) {
  const id = formData.get("groupeId");
  if (typeof id !== "string") return { error: "Entrée invalide" };
  const supabase = await createServerSupabase();
  if (!(await userId(supabase))) return { error: "Non authentifié" };
  const { data, error } = await supabase.from("depense_groupes").delete().eq("id", id).select("id").maybeSingle();
  if (error) return { error: "Suppression échouée" };
  if (!data) return { error: "Suppression non autorisée" };
  revalidatePath("/depenses");
  return { ok: true as const };
}

export async function addDepense(_prev: unknown, formData: FormData) {
  const parsed = depenseInputSchema.safeParse({
    groupeId: formData.get("groupeId"),
    payePar: formData.get("payePar"),
    libelle: formData.get("libelle"),
    montantCents: formData.get("montant"),
    date: formData.get("date") || undefined,
    mode: formData.get("mode"),
    participants: formData.getAll("participants"),
  });
  if (!parsed.success) return { error: "Dépense invalide" };
  const d = parsed.data;
  const supabase = await createServerSupabase();
  const uid = await userId(supabase);
  if (!uid) return { error: "Non authentifié" };

  let exactsCents: Record<string, number> | undefined;
  if (d.mode === "exact") {
    exactsCents = {};
    for (const pid of d.participants) {
      const raw = formData.get(`exact:${pid}`);
      const c = centsFromEuros.safeParse(typeof raw === "string" ? raw : "");
      if (!c.success) return { error: "Montant exact invalide" };
      exactsCents[pid] = c.data;
    }
  }
  let parts;
  try {
    parts = computeParts(d.montantCents, d.mode, d.participants, exactsCents);
  } catch {
    return { error: "Répartition invalide" };
  }

  const { data: dep, error } = await supabase
    .from("depenses")
    .insert({ groupe_id: d.groupeId, paye_par: d.payePar, libelle: d.libelle, montant_cents: d.montantCents, date: d.date ?? null, mode: d.mode, created_by: uid })
    .select("id")
    .single();
  if (error || !dep) return { error: "Ajout de dépense échoué" };
  const rows = parts.map((p) => ({ depense_id: dep.id, profile_id: p.profileId, part_cents: p.partCents }));
  const { error: pErr } = await supabase.from("depense_parts").insert(rows);
  if (pErr) {
    await supabase.from("depenses").delete().eq("id", dep.id); // rollback best-effort
    return { error: "Enregistrement des parts échoué" };
  }
  revalidatePath(`/depenses/${d.groupeId}`);
  return { ok: true as const };
}

export async function deleteDepense(_prev: unknown, formData: FormData) {
  const id = formData.get("depenseId");
  const groupeId = formData.get("groupeId");
  if (typeof id !== "string" || typeof groupeId !== "string") return { error: "Entrée invalide" };
  const supabase = await createServerSupabase();
  if (!(await userId(supabase))) return { error: "Non authentifié" };
  const { data, error } = await supabase.from("depenses").delete().eq("id", id).select("id").maybeSingle();
  if (error) return { error: "Suppression échouée" };
  if (!data) return { error: "Suppression non autorisée" };
  revalidatePath(`/depenses/${groupeId}`);
  return { ok: true as const };
}

export async function addRemboursement(_prev: unknown, formData: FormData) {
  const parsed = remboursementInputSchema.safeParse({
    groupeId: formData.get("groupeId"),
    deProfileId: formData.get("deProfileId"),
    versProfileId: formData.get("versProfileId"),
    montantCents: formData.get("montant"),
    date: formData.get("date") || undefined,
  });
  if (!parsed.success) return { error: "Remboursement invalide" };
  const r = parsed.data;
  const supabase = await createServerSupabase();
  const uid = await userId(supabase);
  if (!uid) return { error: "Non authentifié" };
  const { error } = await supabase.from("remboursements").insert({
    groupe_id: r.groupeId, de_profile_id: r.deProfileId, vers_profile_id: r.versProfileId, montant_cents: r.montantCents, date: r.date ?? null, created_by: uid,
  });
  if (error) return { error: "Ajout de remboursement échoué" };
  revalidatePath(`/depenses/${r.groupeId}`);
  return { ok: true as const };
}

export async function deleteRemboursement(_prev: unknown, formData: FormData) {
  const id = formData.get("remboursementId");
  const groupeId = formData.get("groupeId");
  if (typeof id !== "string" || typeof groupeId !== "string") return { error: "Entrée invalide" };
  const supabase = await createServerSupabase();
  if (!(await userId(supabase))) return { error: "Non authentifié" };
  const { data, error } = await supabase.from("remboursements").delete().eq("id", id).select("id").maybeSingle();
  if (error) return { error: "Suppression échouée" };
  if (!data) return { error: "Suppression non autorisée" };
  revalidatePath(`/depenses/${groupeId}`);
  return { ok: true as const };
}

export async function shareGroupe(_prev: unknown, formData: FormData) {
  const parsed = shareGroupeSchema.safeParse({ groupeId: formData.get("groupeId"), email: formData.get("email") });
  if (!parsed.success) return { error: "E-mail invalide" };
  const supabase = await createServerSupabase();
  if (!(await userId(supabase))) return { error: "Non authentifié" };
  const { data, error } = await supabase.rpc("share_groupe", { p_groupe_id: parsed.data.groupeId, p_email: parsed.data.email });
  if (error) return { error: "Partage échoué" };
  if (data === "not_found") return { error: "Aucun utilisateur avec cet e-mail" };
  if (data === "self") return { error: "Vous êtes déjà propriétaire" };
  revalidatePath(`/depenses/${parsed.data.groupeId}`);
  return { ok: true as const };
}

export async function unshareGroupe(_prev: unknown, formData: FormData) {
  const groupeId = formData.get("groupeId");
  const profileId = formData.get("profileId");
  if (typeof groupeId !== "string" || typeof profileId !== "string") return { error: "Entrée invalide" };
  const supabase = await createServerSupabase();
  if (!(await userId(supabase))) return { error: "Non authentifié" };
  const { error } = await supabase.rpc("unshare_groupe", { p_groupe_id: groupeId, p_profile_id: profileId });
  if (error) return { error: "Retrait échoué" };
  revalidatePath(`/depenses/${groupeId}`);
  return { ok: true as const };
}

// Intégration C4 : depuis le détail d'un voyage, crée (ou ouvre) le groupe lié et redirige.
export async function openVoyageGroupe(formData: FormData) {
  const voyageId = formData.get("voyageId");
  if (typeof voyageId !== "string") return;
  const supabase = await createServerSupabase();
  const uid = await userId(supabase);
  if (!uid) return;
  const { data: existing } = await supabase.from("depense_groupes").select("id").eq("voyage_id", voyageId).limit(1);
  let groupeId = existing?.[0]?.id;
  if (!groupeId) {
    const { data: v } = await supabase.from("voyages").select("titre").eq("id", voyageId).single();
    const { data: g, error } = await supabase
      .from("depense_groupes")
      .insert({ owner_id: uid, titre: v?.titre ?? "Comptes partagés", voyage_id: voyageId, devise: "EUR" })
      .select("id")
      .single();
    if (error || !g) return;
    groupeId = g.id;
    const { data: vm } = await supabase.from("voyage_membres").select("profile_id").eq("voyage_id", voyageId);
    const rows = (vm ?? []).filter((m) => m.profile_id !== uid).map((m) => ({ groupe_id: groupeId as string, profile_id: m.profile_id, role: "membre" as const }));
    if (rows.length) await supabase.from("depense_groupe_membres").insert(rows);
  }
  const locale = await getLocale();
  redirect({ href: `/depenses/${groupeId}`, locale });
}
```

- [ ] **Step 3: Vérifier typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS (aucune erreur). *(Le comportement runtime de cette couche est couvert par les e2e en Task 6 ; pas de test unitaire DB ici, conformément au module Voyages.)*

- [ ] **Step 4: Commit**

```bash
git add src/features/depenses/data/actions.ts src/features/depenses/data/queries.ts
git commit -m "feat(depenses): actions + queries (CRUD, partage, intégration voyage)"
```

---

### Task 5: UI — i18n + composants + pages + intégration voyage

**Files:**
- Modify: `messages/fr.json` (ajout namespace `depenses`)
- Create: `src/features/depenses/ui/GroupeForm.tsx`
- Create: `src/features/depenses/ui/GroupesList.tsx`
- Create: `src/features/depenses/ui/GroupeDetail.tsx`
- Create: `src/features/depenses/ui/DepenseForm.tsx`
- Create: `src/features/depenses/ui/DepensesList.tsx`
- Create: `src/features/depenses/ui/SoldesPanel.tsx`
- Create: `src/features/depenses/ui/RemboursementForm.tsx`
- Create: `src/features/depenses/ui/MembersList.tsx`
- Create: `src/features/depenses/ui/ShareForm.tsx`
- Create: `src/app/[locale]/(app)/depenses/page.tsx`
- Create: `src/app/[locale]/(app)/depenses/[id]/page.tsx`
- Create: `src/app/[locale]/(app)/depenses/error.tsx`
- Modify: `src/features/voyages/ui/VoyageDetail.tsx` (lien « Comptes partagés »)

**Interfaces:**
- Consumes: actions/queries de Task 4 ; `formatCents` de `../domain/money` ; `DEPENSE_MODES` de `../domain/schemas` ; `getMesVoyages` de `@/features/voyages/data/queries` ; `Link` de `@/lib/i18n/routing` ; `openVoyageGroupe` de `@/features/depenses/data/actions`.
- Produces : pages `/depenses` et `/depenses/[id]`. `data-testid` : `groupe-form`, `groupe-card`, `depense-form`, `depense-row`, `soldes-panel`, `solde-row`, `transfert-row`, `solde-regle`, `remboursement-form`, `member-row`, `share-form`.

- [ ] **Step 1: Ajouter le namespace i18n `depenses`**

Modify `messages/fr.json` — ajouter cette clé au niveau racine (après le bloc `"voyages": { ... }`, en veillant à la virgule séparatrice) :

```json
  "depenses": {
    "title": "Comptes partagés",
    "create": "Créer un compte partagé",
    "titre": "Titre",
    "devise": "Devise",
    "voyageLie": "Voyage lié (optionnel)",
    "aucunVoyage": "Aucun",
    "vide": "Aucun compte partagé pour l'instant.",
    "depenses": "Dépenses",
    "addDepense": "Ajouter une dépense",
    "libelle": "Libellé",
    "montant": "Montant",
    "payePar": "Payé par",
    "date": "Date",
    "mode": "Répartition",
    "modes": { "egal": "Égale", "exact": "Montants exacts" },
    "participants": "Participants",
    "soldes": "Soldes",
    "solde": "Solde",
    "transferts": "Qui paie qui",
    "transfertVers": "doit",
    "regle": "Tout est réglé.",
    "remboursement": "Enregistrer un remboursement",
    "de": "De",
    "vers": "À",
    "membres": "Membres",
    "partager": "Partager",
    "partagerEmail": "E-mail de la personne",
    "retirer": "Retirer",
    "supprimer": "Supprimer",
    "save": "Enregistrer",
    "error": { "title": "Une erreur est survenue", "retry": "Réessayer" }
  }
```

- [ ] **Step 2: Créer GroupeForm.tsx**

Create `src/features/depenses/ui/GroupeForm.tsx` :

```tsx
"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { createGroupe } from "../data/actions";

type VoyageOption = { id: string; titre: string };

export function GroupeForm({ voyages }: { voyages: VoyageOption[] }) {
  const t = useTranslations("depenses");
  const [state, action, pending] = useActionState(createGroupe, undefined);
  return (
    <form action={action} data-testid="groupe-form" className="flex flex-col gap-2 max-w-md">
      <input name="titre" required placeholder={t("titre")} className="border p-2" />
      <input name="devise" defaultValue="EUR" maxLength={3} aria-label={t("devise")} className="border p-2" />
      <select name="voyageId" aria-label={t("voyageLie")} className="border p-2" defaultValue="">
        <option value="">{t("aucunVoyage")}</option>
        {voyages.map((v) => <option key={v.id} value={v.id}>{v.titre}</option>)}
      </select>
      {state?.error && <p role="alert" className="text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending} className="bg-black text-white p-2">{t("create")}</button>
    </form>
  );
}
```

- [ ] **Step 3: Créer GroupesList.tsx**

Create `src/features/depenses/ui/GroupesList.tsx` :

```tsx
import { getMesGroupes } from "../data/queries";
import { Link } from "@/lib/i18n/routing";
import { getTranslations } from "next-intl/server";

export async function GroupesList() {
  const t = await getTranslations("depenses");
  const groupes = await getMesGroupes();
  if (groupes.length === 0) return <p>{t("vide")}</p>;
  return (
    <ul className="flex flex-col gap-2">
      {groupes.map((g) => (
        <li key={g.id} data-testid="groupe-card" className="border p-3">
          <Link href={`/depenses/${g.id}`}>
            <span className="font-semibold">{g.titre}</span>{" "}
            <span className="text-gray-500">· {g.devise}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 4: Créer DepenseForm.tsx**

Create `src/features/depenses/ui/DepenseForm.tsx` :

```tsx
"use client";
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { addDepense } from "../data/actions";
import { DEPENSE_MODES } from "../domain/schemas";

type Membre = { profile_id: string; display_name: string | null };

export function DepenseForm({ groupeId, membres }: { groupeId: string; membres: Membre[] }) {
  const t = useTranslations("depenses");
  const [state, action, pending] = useActionState(addDepense, undefined);
  const [mode, setMode] = useState<"egal" | "exact">("egal");
  const nom = (m: Membre) => m.display_name ?? m.profile_id;
  return (
    <form action={action} data-testid="depense-form" className="flex flex-col gap-2 border-t pt-3">
      <input type="hidden" name="groupeId" value={groupeId} />
      <input name="libelle" required placeholder={t("libelle")} className="border p-2" />
      <input name="montant" required inputMode="decimal" placeholder={t("montant")} className="border p-2" />
      <select name="payePar" aria-label={t("payePar")} className="border p-2" defaultValue={membres[0]?.profile_id ?? ""}>
        {membres.map((m) => <option key={m.profile_id} value={m.profile_id}>{nom(m)}</option>)}
      </select>
      <input name="date" type="date" aria-label={t("date")} className="border p-2" />
      <select name="mode" aria-label={t("mode")} className="border p-2" value={mode} onChange={(e) => setMode(e.target.value as "egal" | "exact")}>
        {DEPENSE_MODES.map((m) => <option key={m} value={m}>{t(`modes.${m}`)}</option>)}
      </select>
      <fieldset className="flex flex-col gap-1">
        <legend className="text-sm font-medium">{t("participants")}</legend>
        {membres.map((m) => (
          <label key={m.profile_id} className="flex items-center gap-2">
            <input type="checkbox" name="participants" value={m.profile_id} defaultChecked />
            <span className="flex-1">{nom(m)}</span>
            {mode === "exact" && (
              <input name={`exact:${m.profile_id}`} inputMode="decimal" placeholder={t("montant")} className="border p-1 w-24" />
            )}
          </label>
        ))}
      </fieldset>
      {state?.error && <p role="alert" className="text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending} className="bg-black text-white p-2">{t("addDepense")}</button>
    </form>
  );
}
```

- [ ] **Step 5: Créer DepensesList.tsx**

Create `src/features/depenses/ui/DepensesList.tsx` :

```tsx
"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { deleteDepense } from "../data/actions";
import { formatCents } from "../domain/money";

type Depense = { id: string; paye_par: string; libelle: string; montant_cents: number; date: string | null; mode: string };

export function DepensesList({ groupeId, depenses, devise, nameById }: {
  groupeId: string;
  depenses: Depense[];
  devise: string;
  nameById: Record<string, string>;
}) {
  const t = useTranslations("depenses");
  const [, action] = useActionState(deleteDepense, undefined);
  return (
    <ul className="flex flex-col gap-1">
      {depenses.map((d) => (
        <li key={d.id} data-testid="depense-row" className="flex items-center gap-2 border-b py-1">
          <span className="flex-1">
            <span className="font-medium">{d.libelle}</span>{" "}
            {formatCents(d.montant_cents, devise)} · {t("payePar")} {nameById[d.paye_par] ?? d.paye_par}
          </span>
          <form action={action}>
            <input type="hidden" name="depenseId" value={d.id} />
            <input type="hidden" name="groupeId" value={groupeId} />
            <button type="submit" className="underline text-sm">{t("supprimer")}</button>
          </form>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 6: Créer SoldesPanel.tsx**

Create `src/features/depenses/ui/SoldesPanel.tsx` :

```tsx
import { getTranslations } from "next-intl/server";
import { formatCents } from "../domain/money";
import type { Balance, Transfert } from "../domain/calculations";

export async function SoldesPanel({ soldes, transferts, devise, nameById }: {
  soldes: Balance[];
  transferts: Transfert[];
  devise: string;
  nameById: Record<string, string>;
}) {
  const t = await getTranslations("depenses");
  return (
    <section data-testid="soldes-panel" className="flex flex-col gap-2">
      <h2 className="font-semibold">{t("soldes")}</h2>
      <ul className="flex flex-col gap-1">
        {soldes.map((s) => (
          <li key={s.profileId} data-testid="solde-row">
            {nameById[s.profileId] ?? s.profileId} : {formatCents(s.soldeCents, devise)}
          </li>
        ))}
      </ul>
      <h3 className="font-medium">{t("transferts")}</h3>
      {transferts.length === 0 ? (
        <p data-testid="solde-regle">{t("regle")}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {transferts.map((tr, i) => (
            <li key={i} data-testid="transfert-row">
              {nameById[tr.deProfileId] ?? tr.deProfileId} {t("transfertVers")} {formatCents(tr.montantCents, devise)} {t("vers").toLowerCase()} {nameById[tr.versProfileId] ?? tr.versProfileId}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 7: Créer RemboursementForm.tsx**

Create `src/features/depenses/ui/RemboursementForm.tsx` :

```tsx
"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { addRemboursement } from "../data/actions";

type Membre = { profile_id: string; display_name: string | null };

export function RemboursementForm({ groupeId, membres }: { groupeId: string; membres: Membre[] }) {
  const t = useTranslations("depenses");
  const [state, action, pending] = useActionState(addRemboursement, undefined);
  const nom = (m: Membre) => m.display_name ?? m.profile_id;
  return (
    <form action={action} data-testid="remboursement-form" className="flex flex-col gap-2 border-t pt-3">
      <input type="hidden" name="groupeId" value={groupeId} />
      <div className="flex gap-2 items-center">
        <select name="deProfileId" aria-label={t("de")} className="border p-2" defaultValue={membres[0]?.profile_id ?? ""}>
          {membres.map((m) => <option key={m.profile_id} value={m.profile_id}>{nom(m)}</option>)}
        </select>
        <select name="versProfileId" aria-label={t("vers")} className="border p-2" defaultValue={membres[1]?.profile_id ?? ""}>
          {membres.map((m) => <option key={m.profile_id} value={m.profile_id}>{nom(m)}</option>)}
        </select>
        <input name="montant" required inputMode="decimal" placeholder={t("montant")} className="border p-2 w-28" />
      </div>
      <input name="date" type="date" aria-label={t("date")} className="border p-2" />
      {state?.error && <p role="alert" className="text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending} className="bg-black text-white p-2">{t("remboursement")}</button>
    </form>
  );
}
```

- [ ] **Step 8: Créer MembersList.tsx + ShareForm.tsx**

Create `src/features/depenses/ui/MembersList.tsx` :

```tsx
"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { unshareGroupe } from "../data/actions";

type Membre = { profile_id: string; role: string; display_name: string | null };

export function MembersList({ groupeId, membres, isOwner }: { groupeId: string; membres: Membre[]; isOwner: boolean }) {
  const t = useTranslations("depenses");
  const [, action] = useActionState(unshareGroupe, undefined);
  return (
    <ul className="flex flex-col gap-1">
      {membres.map((m) => (
        <li key={m.profile_id} data-testid="member-row" className="flex items-center gap-2">
          <span>{m.display_name ?? m.profile_id} {m.role === "owner" ? "(owner)" : ""}</span>
          {isOwner && m.role !== "owner" && (
            <form action={action}>
              <input type="hidden" name="groupeId" value={groupeId} />
              <input type="hidden" name="profileId" value={m.profile_id} />
              <button type="submit" className="underline text-sm">{t("retirer")}</button>
            </form>
          )}
        </li>
      ))}
    </ul>
  );
}
```

Create `src/features/depenses/ui/ShareForm.tsx` :

```tsx
"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { shareGroupe } from "../data/actions";

export function ShareForm({ groupeId }: { groupeId: string }) {
  const t = useTranslations("depenses");
  const [state, action, pending] = useActionState(shareGroupe, undefined);
  return (
    <form action={action} data-testid="share-form" className="flex gap-2 items-center">
      <input type="hidden" name="groupeId" value={groupeId} />
      <input name="email" type="email" required placeholder={t("partagerEmail")} className="border p-2 flex-1" />
      <button type="submit" disabled={pending} className="bg-black text-white p-2">{t("partager")}</button>
      {state?.error && <p role="alert" className="text-red-600">{state.error}</p>}
    </form>
  );
}
```

- [ ] **Step 9: Créer GroupeDetail.tsx**

Create `src/features/depenses/ui/GroupeDetail.tsx` :

```tsx
import { getTranslations } from "next-intl/server";
import { getGroupeDetail } from "../data/queries";
import { DepenseForm } from "./DepenseForm";
import { DepensesList } from "./DepensesList";
import { SoldesPanel } from "./SoldesPanel";
import { RemboursementForm } from "./RemboursementForm";
import { MembersList } from "./MembersList";
import { ShareForm } from "./ShareForm";

export async function GroupeDetail({ id }: { id: string }) {
  const t = await getTranslations("depenses");
  const { groupe, membres, depenses, soldes, transferts, isOwner } = await getGroupeDetail(id);
  const nameById = Object.fromEntries(membres.map((m) => [m.profile_id, m.display_name ?? m.profile_id]));
  const membresSimple = membres.map((m) => ({ profile_id: m.profile_id, display_name: m.display_name }));
  return (
    <article className="flex flex-col gap-6">
      <header>
        <h1 className="text-xl font-bold">{groupe.titre}</h1>
        <p className="text-gray-600">{groupe.devise}</p>
      </header>

      <section>
        <h2 className="font-semibold">{t("depenses")}</h2>
        <DepensesList groupeId={groupe.id} depenses={depenses} devise={groupe.devise} nameById={nameById} />
        <DepenseForm groupeId={groupe.id} membres={membresSimple} />
      </section>

      <SoldesPanel soldes={soldes} transferts={transferts} devise={groupe.devise} nameById={nameById} />

      <section>
        <h2 className="font-semibold">{t("remboursement")}</h2>
        <RemboursementForm groupeId={groupe.id} membres={membresSimple} />
      </section>

      <section>
        <h2 className="font-semibold">{t("membres")}</h2>
        <MembersList groupeId={groupe.id} membres={membres} isOwner={isOwner} />
        {isOwner && <ShareForm groupeId={groupe.id} />}
      </section>
    </article>
  );
}
```

- [ ] **Step 10: Créer les pages + error**

Create `src/app/[locale]/(app)/depenses/page.tsx` :

```tsx
import { getTranslations } from "next-intl/server";
import { GroupeForm } from "@/features/depenses/ui/GroupeForm";
import { GroupesList } from "@/features/depenses/ui/GroupesList";
import { getMesVoyages } from "@/features/voyages/data/queries";

export default async function DepensesPage() {
  const t = await getTranslations("depenses");
  const voyages = (await getMesVoyages()).map((v) => ({ id: v.id, titre: v.titre }));
  return (
    <main className="p-6 flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <GroupeForm voyages={voyages} />
      <GroupesList />
    </main>
  );
}
```

Create `src/app/[locale]/(app)/depenses/[id]/page.tsx` :

```tsx
import { GroupeDetail } from "@/features/depenses/ui/GroupeDetail";

export default async function GroupeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <main className="p-6"><GroupeDetail id={id} /></main>;
}
```

Create `src/app/[locale]/(app)/depenses/error.tsx` :

```tsx
"use client";
import { useTranslations } from "next-intl";
export default function DepensesError({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations("depenses.error");
  return (
    <main className="p-6">
      <p role="alert">{t("title")}</p>
      <button onClick={reset} className="underline">{t("retry")}</button>
    </main>
  );
}
```

- [ ] **Step 11: Intégration C4 — lien depuis le détail voyage**

D'abord, ajouter la clé de libellé **dans le namespace `voyages`** de `messages/fr.json` (le bouton est rendu par `VoyageDetail`, qui utilise `getTranslations("voyages")`). Ajouter, dans le bloc `"voyages": { ... }`, après `"supprimer": "...",` :

```json
    "ouvrirCompte": "Comptes partagés",
```

Ensuite, `Modify src/features/voyages/ui/VoyageDetail.tsx` — ajouter l'import en tête (après les imports existants) :

```tsx
import { openVoyageGroupe } from "@/features/depenses/data/actions";
```

et insérer une nouvelle `<section>` juste avant la fermeture `</article>` (après la section membres). `VoyageDetail` est un composant serveur et `openVoyageGroupe` est une action serveur à argument unique `(formData)` — elle s'utilise directement comme `action` d'un `<form>` :

```tsx
      <section>
        <form action={openVoyageGroupe}>
          <input type="hidden" name="voyageId" value={voyage.id} />
          <button type="submit" className="underline">{t("ouvrirCompte")}</button>
        </form>
      </section>
```

Le bouton crée (ou ouvre s'il existe) le groupe lié à ce voyage et redirige vers `/depenses/[id]`.

- [ ] **Step 12: Vérifier build (typecheck + lint + unit)**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS (typecheck/lint sans erreur ; 57 + nouveaux tests unitaires verts).

- [ ] **Step 13: Commit**

```bash
git add messages/fr.json src/features/depenses/ui src/app/[locale]/\(app\)/depenses src/features/voyages/ui/VoyageDetail.tsx
git commit -m "feat(depenses): UI (groupes, dépenses, soldes, remboursements, partage) + intégration voyage"
```

---

### Task 6: Seed + e2e (cross-utilisateur + boucle de règlement)

**Files:**
- Modify: `supabase/seed.sql` (ajout d'un groupe démo lié au voyage Rome)
- Create: `e2e/depenses.spec.ts`

**Interfaces:**
- Consumes : route `/fr/depenses`, `data-testid` de Task 5 (`groupe-form`, `groupe-card`, `depense-form`, `soldes-panel`, `solde-regle`, `remboursement-form`, `share-form`). Comptes seed : `client@vito.test` (id `11111111-1111-1111-1111-111111111111`), `agence@vito.test` (id `22222222-2222-2222-2222-222222222222`), mot de passe `password123`. Voyage Rome : `11111111-2222-4333-8444-555555555555`.

- [ ] **Step 1: Ajouter le seed (groupe « Dépenses Rome »)**

Modify `supabase/seed.sql` — ajouter à la fin :

```sql
-- Comptes partagés : groupe lié au voyage Rome, partagé client <-> agence (UUID v4 valides)
insert into public.depense_groupes (id, owner_id, voyage_id, titre, devise)
values ('66666666-6666-4666-8666-666666666666', '11111111-1111-1111-1111-111111111111',
  '11111111-2222-4333-8444-555555555555', 'Dépenses Rome', 'EUR');

-- Le trigger on_groupe_created insère déjà la ligne 'owner' (client). On ajoute l'agence.
insert into public.depense_groupe_membres (groupe_id, profile_id, role) values
  ('66666666-6666-4666-8666-666666666666', '22222222-2222-2222-2222-222222222222', 'membre')
on conflict (groupe_id, profile_id) do nothing;

-- Dépense 1 : hôtel 200,00 € payé par le client, split égal (100/100)
insert into public.depenses (id, groupe_id, paye_par, libelle, montant_cents, date, mode, created_by)
values ('66666666-6666-4666-8666-aaaaaaaaaaaa', '66666666-6666-4666-8666-666666666666',
  '11111111-1111-1111-1111-111111111111', 'Hôtel', 20000, '2026-09-12', 'egal',
  '11111111-1111-1111-1111-111111111111');
insert into public.depense_parts (depense_id, profile_id, part_cents) values
  ('66666666-6666-4666-8666-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 10000),
  ('66666666-6666-4666-8666-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 10000);

-- Dépense 2 : dîner 90,00 € payé par l'agence, exact (client 50,00 / agence 40,00)
insert into public.depenses (id, groupe_id, paye_par, libelle, montant_cents, date, mode, created_by)
values ('66666666-6666-4666-8666-bbbbbbbbbbbb', '66666666-6666-4666-8666-666666666666',
  '22222222-2222-2222-2222-222222222222', 'Dîner', 9000, '2026-09-13', 'exact',
  '22222222-2222-2222-2222-222222222222');
insert into public.depense_parts (depense_id, profile_id, part_cents) values
  ('66666666-6666-4666-8666-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 5000),
  ('66666666-6666-4666-8666-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 4000);
```

*(Calcul des soldes du seed : Dépense 1 → client +100,00, agence −100,00 ; Dépense 2 → agence +50,00, client −50,00. Net : **client +50,00 € ; agence −50,00 €**. simplifyDebts → « agence doit 50,00 € au client ».)*

- [ ] **Step 2: Appliquer le seed**

Run: `supabase db reset`
Expected: applique migrations + seed sans erreur.

- [ ] **Step 3: Écrire les tests e2e**

Create `e2e/depenses.spec.ts` :

```ts
import { test, expect, type Page } from "@playwright/test";

async function login(page: Page, email: string) {
  await page.goto("/fr/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill("password123");
  await page.getByRole("button", { name: "Connexion" }).click();
  await expect(page).toHaveURL(/\/fr\/restos/);
}

test("créer un compte partagé, partager, ajouter une dépense égale, vérifier les soldes", async ({ page }) => {
  await login(page, "client@vito.test");
  await page.goto("/fr/depenses");

  const titre = `Compte E2E ${Date.now()}`;
  await page.getByTestId("groupe-form").locator('input[name="titre"]').fill(titre);
  await page.getByTestId("groupe-form").getByRole("button").click();
  await expect(page.getByTestId("groupe-card").filter({ hasText: titre }).first()).toBeVisible();

  await page.getByTestId("groupe-card").filter({ hasText: titre }).first().getByRole("link").click();
  await expect(page).toHaveURL(/\/fr\/depenses\//);

  // Partager avec l'agence (pour avoir 2 participants)
  await page.getByTestId("share-form").locator('input[name="email"]').fill("agence@vito.test");
  await page.getByTestId("share-form").getByRole("button").click();
  await expect(page.getByTestId("member-row").filter({ hasText: "agence" }).or(page.getByTestId("member-row").nth(1))).toBeVisible();

  // Ajouter une dépense égale de 30,00 € payée par le client, participants = tous (cochés par défaut)
  await page.getByTestId("depense-form").locator('input[name="libelle"]').fill("Taxi");
  await page.getByTestId("depense-form").locator('input[name="montant"]').fill("30");
  await page.getByTestId("depense-form").getByRole("button").click();

  // La dépense apparaît (signal déterministe) et les soldes sont calculés
  await expect(page.getByTestId("depense-row").filter({ hasText: "Taxi" })).toBeVisible();
  await expect(page.getByTestId("soldes-panel")).toContainText("15,00");
});

test("l'agence voit le compte partagé du seed, ajoute un remboursement, le compte est soldé", async ({ page }) => {
  await login(page, "agence@vito.test");
  await page.goto("/fr/depenses");

  await page.getByTestId("groupe-card").filter({ hasText: "Dépenses Rome" }).first().getByRole("link").click();
  await expect(page).toHaveURL(/\/fr\/depenses\//);

  // Soldes du seed : un transfert de 50,00 € est suggéré (agence doit 50,00 € au client)
  await expect(page.getByTestId("soldes-panel")).toContainText("50,00");

  // L'agence rembourse 50,00 € au client (de=agence, vers=client) — sélection par
  // valeur (profile_id du seed) pour un sens déterministe, indépendant de l'ordre d'affichage.
  const CLIENT = "11111111-1111-1111-1111-111111111111";
  const AGENCE = "22222222-2222-2222-2222-222222222222";
  const form = page.getByTestId("remboursement-form");
  await form.locator('select[name="deProfileId"]').selectOption(AGENCE);
  await form.locator('select[name="versProfileId"]').selectOption(CLIENT);
  await form.locator('input[name="montant"]').fill("50");
  await form.getByRole("button").click();

  // Après remboursement, plus aucun transfert : « Tout est réglé. »
  await expect(page.getByTestId("solde-regle")).toBeVisible();
});
```

Note : le sens du remboursement est **agence → client** (l'agence doit). La sélection par `value` (profile_id du seed) garantit ce sens quel que soit l'ordre d'affichage des membres.

- [ ] **Step 4: Lancer les e2e**

Run: `npx playwright test e2e/depenses.spec.ts`
Expected: PASS (2 tests). Si le 2e échoue sur le sens du remboursement, corriger la sélection `de`/`vers` (agence doit, client reçoit) puis relancer.

- [ ] **Step 5: Lancer toute la suite e2e (non-régression)**

Run: `npx playwright test`
Expected: PASS (suite complète, incl. restos/voyages/vins/recherche/auth + depenses).

- [ ] **Step 6: Commit**

```bash
git add supabase/seed.sql e2e/depenses.spec.ts
git commit -m "test(depenses): seed groupe Rome + e2e cross-utilisateur et boucle de règlement"
```

---

## Notes d'exécution

- **Ordre des tâches** : 1 (DB) → 2, 3 (domain pur) → 4 (data) → 5 (UI) → 6 (seed+e2e). Task 4 dépend de 2 et 3 ; Task 5 dépend de 4 ; Task 6 dépend de tout.
- **Pas de `db push` prod pendant l'implémentation** : la prod n'est migrée qu'à la clôture du chantier (après PR mergée), comme pour C1–C4.
- **Signal e2e déterministe** : les tests attendent l'apparition de la ligne résultante (`depense-row`, `solde-regle`) ou un texte de solde — jamais `networkidle` (leçon du hotfix PR #6).
