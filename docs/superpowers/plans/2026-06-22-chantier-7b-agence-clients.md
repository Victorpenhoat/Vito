# Agence ↔ clients Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Une agence gère un portefeuille de clients (lien par e-mail) et crée des voyages pour eux (le client possède, l'agence collabore).

**Architecture:** `features/agence/{domain,data,ui}`. Table `agence_clients` + helper `is_agence()` (claim JWT). RPC `security definer` : `lier_client`/`delier_client` (portefeuille) et `creer_voyage_pour_client` (insère un voyage `owner_id=client` + ajoute l'agence comme membre, en vérifiant rôle agence + lien). Réutilise le modèle voyages C4 et `voyageInputSchema`. La limite Free du client (trigger 6a) s'applique.

**Tech Stack:** Next.js 16 (App Router, Server Actions), TypeScript strict, Supabase (Postgres + RLS), Zod, next-intl, Vitest, Playwright.

## Global Constraints

- Next.js 16 non-standard : consulter `node_modules/next/dist/docs/` avant une API Next inconnue.
- TypeScript strict avec `noUncheckedIndexedAccess`.
- RLS **et** grants explicites à `authenticated` sur `agence_clients`.
- `/agence` et les RPC réservés aux rôles `agence`/`admin` : `is_agence()` (DB, `auth.jwt() ->> 'user_role'`) + garde `requireRole(["agence","admin"])` (page). Helpers/RPC `security definer set search_path = ''`.
- `lier_client` sans énumération d'e-mails (`not_found` générique). `creer_voyage_pour_client` vérifie le **lien** agence↔client. `owner_id`(=client) et le membre agence posés côté serveur.
- La **limite Free du client** (trigger `enforce_voyage_limit`, 6a) s'applique à l'insert → peut lever `limite_voyages_free` ; l'action mappe vers un message clair.
- Migration suivante = `00014_agence_clients.sql`. Feature `src/features/agence/`, route `/agence`, namespace i18n `agence.*`. Aucune chaîne UI en dur. UUID seed = v4 valides.
- Réutilise `voyageInputSchema`/`VOYAGE_STATUTS` (`@/features/voyages/domain/schemas`), `requireRole`/`getSessionRole` (`@/lib/rbac/guards`), `Link` (`@/lib/i18n/routing`).

---

### Task 1: Migration `00014_agence_clients.sql`

**Files:**
- Create: `supabase/migrations/00014_agence_clients.sql`

**Interfaces:**
- Produces : table `agence_clients` ; fonction `is_agence() returns boolean` ; RPC `lier_client(text) returns text` (`'ok'|'not_found'|'self'`), `delier_client(uuid) returns void`, `creer_voyage_pour_client(uuid,text,text,date,date,public.voyage_statut) returns uuid` ; RLS (3 policies) + grants.

- [ ] **Step 1: Écrire la migration**

Create `supabase/migrations/00014_agence_clients.sql` :

```sql
create table public.agence_clients (
  agence_id uuid not null references public.profiles (id) on delete cascade,
  client_id uuid not null references public.profiles (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (agence_id, client_id),
  check (agence_id <> client_id)
);

create index agence_clients_client_idx on public.agence_clients (client_id);

-- Rôle agence (agence/admin) via claim JWT
create function public.is_agence() returns boolean
  language sql security definer set search_path = '' stable as $$
  select coalesce(auth.jwt() ->> 'user_role', '') in ('agence', 'admin');
$$;

-- RLS
alter table public.agence_clients enable row level security;
create policy "agence_clients_select" on public.agence_clients for select
  using (agence_id = auth.uid() or client_id = auth.uid());
create policy "agence_clients_insert" on public.agence_clients for insert
  with check (agence_id = auth.uid() and public.is_agence());
create policy "agence_clients_delete" on public.agence_clients for delete
  using (agence_id = auth.uid() or client_id = auth.uid());
grant select, insert, update, delete on public.agence_clients to authenticated;

-- RPC : lier un client par e-mail (sans énumération)
create function public.lier_client(p_email text) returns text
  language plpgsql security definer set search_path = '' as $$
declare v_uid uuid;
begin
  if auth.uid() is null then raise exception 'authentification requise'; end if;
  if not public.is_agence() then raise exception 'réservé aux agences'; end if;
  select id into v_uid from auth.users where lower(email) = lower(p_email);
  if v_uid is null then return 'not_found'; end if;
  if v_uid = auth.uid() then return 'self'; end if;
  insert into public.agence_clients (agence_id, client_id) values (auth.uid(), v_uid)
  on conflict (agence_id, client_id) do nothing;
  return 'ok';
end;
$$;

create function public.delier_client(p_client_id uuid) returns void
  language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'authentification requise'; end if;
  delete from public.agence_clients where agence_id = auth.uid() and client_id = p_client_id;
end;
$$;

-- RPC : créer un voyage POUR un client lié (client owner, agence membre)
create function public.creer_voyage_pour_client(
  p_client_id uuid, p_titre text, p_destination text, p_date_debut date, p_date_fin date, p_statut public.voyage_statut
) returns uuid
  language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'authentification requise'; end if;
  if not public.is_agence() then raise exception 'réservé aux agences'; end if;
  if not exists (select 1 from public.agence_clients where agence_id = auth.uid() and client_id = p_client_id) then
    raise exception 'client non lié';
  end if;
  insert into public.voyages (owner_id, titre, destination, date_debut, date_fin, statut)
  values (p_client_id, p_titre, nullif(p_destination, ''), p_date_debut, p_date_fin, coalesce(p_statut, 'planifie'))
  returning id into v_id;
  insert into public.voyage_membres (voyage_id, profile_id, role) values (v_id, auth.uid(), 'membre')
  on conflict (voyage_id, profile_id) do nothing;
  return v_id;
end;
$$;

revoke execute on function public.is_agence() from anon, public;
grant execute on function public.is_agence() to authenticated;
revoke execute on function public.lier_client(text) from anon, public;
grant execute on function public.lier_client(text) to authenticated;
revoke execute on function public.delier_client(uuid) from anon, public;
grant execute on function public.delier_client(uuid) to authenticated;
revoke execute on function public.creer_voyage_pour_client(uuid, text, text, date, date, public.voyage_statut) from anon, public;
grant execute on function public.creer_voyage_pour_client(uuid, text, text, date, date, public.voyage_statut) to authenticated;
```

- [ ] **Step 2: Appliquer**

Run: `supabase db reset`
Expected: applique 00001→00014 + seed sans erreur.

- [ ] **Step 3: Vérifier structure + comportement (lien + voyage pour client)**

Run:
```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" <<'SQL'
select count(*) as tables from pg_tables where schemaname='public' and tablename='agence_clients';
select count(*) as funcs from pg_proc where proname in ('is_agence','lier_client','delier_client','creer_voyage_pour_client');
select count(*) as policies from pg_policies where tablename='agence_clients';
do $$
declare v_id uuid;
begin
  -- lien direct agence(22222)->client(11111) puis voyage pour le client via insert direct (simulant la RPC, en superuser)
  insert into public.agence_clients (agence_id, client_id) values ('22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111');
  insert into public.voyages (owner_id, titre) values ('11111111-1111-1111-1111-111111111111','Voyage test agence') returning id into v_id;
  insert into public.voyage_membres (voyage_id, profile_id, role) values (v_id, '22222222-2222-2222-2222-222222222222','membre');
  if (select count(*) from public.voyage_membres where voyage_id=v_id) < 2 then
    raise exception 'FAIL: owner + agence membres attendus';
  end if;
  delete from public.voyages where id=v_id;
  delete from public.agence_clients where agence_id='22222222-2222-2222-2222-222222222222' and client_id='11111111-1111-1111-1111-111111111111';
  raise notice 'OK: agence_clients + voyage owner=client + agence membre conformes';
end $$;
SQL
```
Expected: `tables = 1` ; `funcs = 4` ; `policies = 3` ; `NOTICE: OK: ...` et aucune ERROR.
(Si `psql` absent : `docker exec -i supabase_db_Vito psql -U postgres -d postgres`. Note : la vérif behavior des RPC avec `auth.uid()` se fait en e2e Task 4 ; ici on valide la structure et le modèle owner=client + agence-membre via inserts directs.)

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/00014_agence_clients.sql
git commit -m "feat(agence): migration 00014 (agence_clients, is_agence, RLS, RPC lier/voyage-pour-client)"
```

---

### Task 2: Domain (schéma) + Data (actions + queries)

**Files:**
- Create: `src/features/agence/domain/schemas.ts` + `schemas.test.ts`
- Create: `src/features/agence/data/queries.ts`
- Create: `src/features/agence/data/actions.ts`

**Interfaces:**
- Consumes: `createServerSupabase` ; `voyageInputSchema` de `@/features/voyages/domain/schemas` ; `revalidatePath`.
- Produces:
  - `lierClientSchema` → `{ email: string }`.
  - `getMesClients()` → `{ client_id: string; display_name: string|null; added_at: string }[]`.
  - actions `(_prev, formData) → { ok } | { error }` : `lierClient`, `delierClient`, `creerVoyagePourClient`.

- [ ] **Step 1: Écrire le test du schéma (échec attendu)**

Create `src/features/agence/domain/schemas.test.ts` :
```ts
import { describe, it, expect } from "vitest";
import { lierClientSchema } from "./schemas";

describe("lierClientSchema", () => {
  it("email valide requis", () => {
    expect(lierClientSchema.safeParse({ email: "a@b.fr" }).success).toBe(true);
    expect(lierClientSchema.safeParse({ email: "nope" }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Lancer (échec)**

Run: `npx vitest run src/features/agence/domain/schemas.test.ts`
Expected: FAIL (module introuvable).

- [ ] **Step 3: Implémenter schemas.ts**

Create `src/features/agence/domain/schemas.ts` :
```ts
import { z } from "zod";

export const lierClientSchema = z.object({ email: z.string().email() });
export type LierClientInput = z.infer<typeof lierClientSchema>;
```

- [ ] **Step 4: Lancer (succès)**

Run: `npx vitest run src/features/agence/domain/schemas.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Implémenter queries.ts**

Create `src/features/agence/data/queries.ts` :
```ts
import { createServerSupabase } from "@/lib/supabase/server";

export async function getMesClients() {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];
  const { data, error } = await supabase
    .from("agence_clients")
    .select("client_id, added_at, client:profiles!agence_clients_client_id_fkey(display_name)")
    .eq("agence_id", auth.user.id)
    .order("added_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => {
    const p = Array.isArray(r.client) ? r.client[0] : r.client;
    return { client_id: r.client_id, display_name: p?.display_name ?? null, added_at: r.added_at };
  });
}
```
(Note : la RLS `profiles` est self-only, donc `display_name` des clients revient `null` → l'UI retombe sur l'`client_id`. C'est la limitation app-wide connue, à corriger globalement plus tard ; non bloquant ici.)

- [ ] **Step 6: Implémenter actions.ts**

Create `src/features/agence/data/actions.ts` :
```ts
"use server";
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { voyageInputSchema } from "@/features/voyages/domain/schemas";
import { lierClientSchema } from "../domain/schemas";

async function userId(supabase: Awaited<ReturnType<typeof createServerSupabase>>) {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function lierClient(_prev: unknown, formData: FormData) {
  const parsed = lierClientSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: "E-mail invalide" };
  const supabase = await createServerSupabase();
  if (!(await userId(supabase))) return { error: "Non authentifié" };
  const { data, error } = await supabase.rpc("lier_client", { p_email: parsed.data.email });
  if (error) return { error: "Liaison échouée" };
  if (data === "not_found") return { error: "Aucun utilisateur avec cet e-mail" };
  if (data === "self") return { error: "Vous ne pouvez pas vous lier vous-même" };
  revalidatePath("/agence");
  return { ok: true as const };
}

export async function delierClient(_prev: unknown, formData: FormData) {
  const clientId = formData.get("clientId");
  if (typeof clientId !== "string") return { error: "Entrée invalide" };
  const supabase = await createServerSupabase();
  if (!(await userId(supabase))) return { error: "Non authentifié" };
  const { error } = await supabase.rpc("delier_client", { p_client_id: clientId });
  if (error) return { error: "Retrait échoué" };
  revalidatePath("/agence");
  return { ok: true as const };
}

export async function creerVoyagePourClient(_prev: unknown, formData: FormData) {
  const clientId = formData.get("clientId");
  if (typeof clientId !== "string") return { error: "Entrée invalide" };
  const parsed = voyageInputSchema.safeParse({
    titre: formData.get("titre"),
    destination: formData.get("destination") || undefined,
    dateDebut: formData.get("dateDebut") || undefined,
    dateFin: formData.get("dateFin") || undefined,
    statut: formData.get("statut") || undefined,
  });
  if (!parsed.success) return { error: "Voyage invalide" };
  const supabase = await createServerSupabase();
  if (!(await userId(supabase))) return { error: "Non authentifié" };
  const d = parsed.data;
  const { error } = await supabase.rpc("creer_voyage_pour_client", {
    p_client_id: clientId,
    p_titre: d.titre,
    p_destination: d.destination ?? "",
    p_date_debut: d.dateDebut ?? null,
    p_date_fin: d.dateFin ?? null,
    p_statut: d.statut ?? "planifie",
  });
  if (error) {
    if (error.message?.includes("client non lié")) return { error: "Ce client n'est pas dans votre portefeuille" };
    if (error.message?.includes("limite_voyages_free")) return { error: "Le client a atteint sa limite Free" };
    if (error.message?.includes("réservé aux agences")) return { error: "Réservé aux agences" };
    return { error: "Création échouée" };
  }
  revalidatePath("/agence");
  revalidatePath("/voyages");
  return { ok: true as const };
}
```

- [ ] **Step 7: Vérifier typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS. *(Comportement runtime couvert par les e2e en Task 4.)*

- [ ] **Step 8: Commit**

```bash
git add src/features/agence/domain src/features/agence/data
git commit -m "feat(agence): schéma + data (lier/délier client, créer voyage pour client) + queries"
```

---

### Task 3: UI (page /agence gardée + composants) + i18n

**Files:**
- Modify: `messages/fr.json` (namespace `agence`)
- Create: `src/features/agence/ui/LierClientForm.tsx`
- Create: `src/features/agence/ui/ClientsList.tsx`
- Create: `src/features/agence/ui/VoyagePourClientForm.tsx`
- Create: `src/app/[locale]/(app)/agence/page.tsx`
- Create: `src/app/[locale]/(app)/agence/error.tsx`

**Interfaces:**
- Consumes: actions/queries (Task 2) ; `requireRole` de `@/lib/rbac/guards` ; `VOYAGE_STATUTS` de `@/features/voyages/domain/schemas`.
- Produces : page `/agence` (réservée agence/admin). `data-testid` : `lier-client-form`, `client-row`, `voyage-client-form`.

- [ ] **Step 1: i18n**

Modify `messages/fr.json` — ajouter au niveau racine (après le bloc `"famille": { ... }`, virgule de séparation) :
```json
  "agence": {
    "title": "Espace agence",
    "portefeuille": "Mes clients",
    "lier": "Ajouter un client",
    "clientEmail": "E-mail du client",
    "retirer": "Retirer",
    "vide": "Aucun client pour l'instant.",
    "creerVoyage": "Créer un voyage",
    "titre": "Titre du voyage",
    "destination": "Destination",
    "dateDebut": "Date de début",
    "dateFin": "Date de fin",
    "statut": "Statut",
    "envoyer": "Créer le voyage",
    "error": { "title": "Une erreur est survenue", "retry": "Réessayer" }
  }
```

- [ ] **Step 2: LierClientForm.tsx + ClientsList.tsx**

Create `src/features/agence/ui/LierClientForm.tsx` :
```tsx
"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { lierClient } from "../data/actions";

export function LierClientForm() {
  const t = useTranslations("agence");
  const [state, action, pending] = useActionState(lierClient, undefined);
  return (
    <form action={action} data-testid="lier-client-form" className="flex gap-2 items-center">
      <input name="email" type="email" required placeholder={t("clientEmail")} className="border p-2 flex-1" />
      <button type="submit" disabled={pending} className="bg-black text-white p-2">{t("lier")}</button>
      {state && "error" in state && state.error && <p role="alert" className="text-red-600">{state.error}</p>}
    </form>
  );
}
```

Create `src/features/agence/ui/ClientsList.tsx` :
```tsx
"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { delierClient } from "../data/actions";
import { VoyagePourClientForm } from "./VoyagePourClientForm";

type Client = { client_id: string; display_name: string | null; added_at: string };

export function ClientsList({ clients }: { clients: Client[] }) {
  const t = useTranslations("agence");
  const [, delier] = useActionState(delierClient, undefined);
  if (clients.length === 0) return <p>{t("vide")}</p>;
  return (
    <ul className="flex flex-col gap-4">
      {clients.map((c) => (
        <li key={c.client_id} data-testid="client-row" className="border p-3 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="flex-1 font-medium">{c.display_name ?? c.client_id}</span>
            <form action={delier}>
              <input type="hidden" name="clientId" value={c.client_id} />
              <button type="submit" className="underline text-sm">{t("retirer")}</button>
            </form>
          </div>
          <VoyagePourClientForm clientId={c.client_id} />
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 3: VoyagePourClientForm.tsx**

Create `src/features/agence/ui/VoyagePourClientForm.tsx` :
```tsx
"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { creerVoyagePourClient } from "../data/actions";
import { VOYAGE_STATUTS } from "@/features/voyages/domain/schemas";

export function VoyagePourClientForm({ clientId }: { clientId: string }) {
  const t = useTranslations("agence");
  const [state, action, pending] = useActionState(creerVoyagePourClient, undefined);
  return (
    <form action={action} data-testid="voyage-client-form" className="flex flex-col gap-2 border-t pt-2">
      <input type="hidden" name="clientId" value={clientId} />
      <input name="titre" required placeholder={t("titre")} className="border p-2" />
      <input name="destination" placeholder={t("destination")} className="border p-2" />
      <div className="flex gap-2">
        <input name="dateDebut" type="date" aria-label={t("dateDebut")} className="border p-2" />
        <input name="dateFin" type="date" aria-label={t("dateFin")} className="border p-2" />
      </div>
      <select name="statut" aria-label={t("statut")} className="border p-2" defaultValue="planifie">
        {VOYAGE_STATUTS.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      {state && "error" in state && state.error && <p role="alert" className="text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending} className="bg-black text-white p-2">{t("envoyer")}</button>
    </form>
  );
}
```
(Note : les libellés de statut sont affichés bruts ici comme valeur ; pour des libellés FR on pourrait réutiliser `voyages.statuts.*`, mais ce composant est dans le namespace `agence`. Acceptable pour ce slice — option bonus, non requise.)

- [ ] **Step 4: Page (gardée) + error**

Create `src/app/[locale]/(app)/agence/page.tsx` :
```tsx
import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/rbac/guards";
import { getMesClients } from "@/features/agence/data/queries";
import { LierClientForm } from "@/features/agence/ui/LierClientForm";
import { ClientsList } from "@/features/agence/ui/ClientsList";

export default async function AgencePage() {
  await requireRole(["agence", "admin"]); // redirige les non-autorisés vers /login
  const t = await getTranslations("agence");
  const clients = await getMesClients();
  return (
    <main className="p-6 flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">{t("portefeuille")}</h2>
        <LierClientForm />
        <ClientsList clients={clients} />
      </section>
    </main>
  );
}
```

Create `src/app/[locale]/(app)/agence/error.tsx` :
```tsx
"use client";
import { useTranslations } from "next-intl";
export default function AgenceError({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations("agence.error");
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
git add messages/fr.json src/features/agence/ui src/app/\[locale\]/\(app\)/agence
git commit -m "feat(agence): page /agence gardée (portefeuille + créer voyage pour client) + i18n"
```

---

### Task 4: Seed (client dédié) + e2e

**Files:**
- Modify: `supabase/seed.sql` (un client dédié Free)
- Create: `e2e/agence.spec.ts`

**Interfaces:**
- Consumes : `/fr/agence`, `/fr/voyages`, `data-testid` de Task 3. Comptes : `agence@vito.test` (rôle agence, id `22222222-2222-2222-2222-222222222222`), `client7b@vito.test` (rôle client, Free, id `99999999-9999-4999-8999-999999999999`). Mot de passe `password123`.

- [ ] **Step 1: Seed — client dédié Free (aucun lien pré-créé)**

Modify `supabase/seed.sql` — ajouter à la fin :
```sql
-- Compte client dédié au Chantier 7b (Free, 0 voyage ; aucun lien agence pré-créé).
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, reauthentication_token, phone_change, phone_change_token)
values
  ('99999999-9999-4999-8999-999999999999', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'client7b@vito.test',
   crypt('password123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"display_name":"Client 7b","role":"client"}', now(), now(),
   '', '', '', '', '', '', '', '');

insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at)
values
  (gen_random_uuid(), '99999999-9999-4999-8999-999999999999', '99999999-9999-4999-8999-999999999999',
   '{"sub":"99999999-9999-4999-8999-999999999999","email":"client7b@vito.test"}', 'email', now(), now());
```

- [ ] **Step 2: Appliquer**

Run: `supabase db reset`
Expected: applique migrations + seed sans erreur.

- [ ] **Step 3: Écrire l'e2e**

Create `e2e/agence.spec.ts` :
```ts
import { test, expect, type Page } from "@playwright/test";

const CLIENT7B = "99999999-9999-4999-8999-999999999999";

async function login(page: Page, email: string) {
  await page.goto("/fr/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill("password123");
  await page.getByRole("button", { name: "Connexion" }).click();
  await expect(page).toHaveURL(/\/fr\/restos/);
}

test("l'agence relie un client, lui crée un voyage, le client le voit", async ({ browser }) => {
  const ctxA = await browser.newContext();
  const pageA = await ctxA.newPage();
  await login(pageA, "agence@vito.test");
  await pageA.goto("/fr/agence");

  // Relier le client dédié
  await pageA.getByTestId("lier-client-form").locator('input[name="email"]').fill("client7b@vito.test");
  await pageA.getByTestId("lier-client-form").getByRole("button").click();
  const row = pageA.getByTestId("client-row").filter({ hasText: CLIENT7B });
  await expect(row).toBeVisible();

  // Créer un voyage pour ce client
  const titre = `Voyage Agence ${Date.now()}`;
  await row.getByTestId("voyage-client-form").locator('input[name="titre"]').fill(titre);
  await row.getByTestId("voyage-client-form").locator('input[name="destination"]').fill("Lisbonne");
  await row.getByTestId("voyage-client-form").getByRole("button").click();
  await expect(row.getByTestId("voyage-client-form").getByRole("button")).toBeEnabled({ timeout: 10000 });

  // Le client voit le voyage dans « Mes voyages » (il en est owner)
  const ctxB = await browser.newContext();
  const pageB = await ctxB.newPage();
  await login(pageB, "client7b@vito.test");
  await pageB.goto("/fr/voyages");
  await expect(pageB.getByTestId("voyage-card").filter({ hasText: titre })).toBeVisible();

  await ctxA.close();
  await ctxB.close();
});

test("un compte non-agence ne peut pas accéder à /agence", async ({ page }) => {
  await login(page, "client7b@vito.test");
  await page.goto("/fr/agence");
  // requireRole redirige les non-agence hors de /agence : on n'y reste pas et le contenu agence
  // n'est jamais rendu. (Assertion agnostique de la cible de redirection.)
  await expect(page).not.toHaveURL(/\/fr\/agence/);
  await expect(page.getByTestId("lier-client-form")).toHaveCount(0);
});
```

- [ ] **Step 4: Lancer l'e2e agence**

Run: `npx playwright test e2e/agence.spec.ts --retries=0`
Expected: PASS (2 tests).

- [ ] **Step 5: Suite complète (non-régression)**

Run: `npx playwright test --retries=0`
Expected: PASS (toute la suite + agence). En particulier les e2e voyages/famille existants restent verts (le client dédié 7b ne les touche pas).

- [ ] **Step 6: Commit**

```bash
git add supabase/seed.sql e2e/agence.spec.ts
git commit -m "test(agence): client dédié + e2e (lier client, voyage pour client, gating /agence)"
```

---

## Notes d'exécution

- **Ordre** : 1 (DB) → 2 (domain+data) → 3 (UI) → 4 (seed + e2e). Task 3 dépend de 2 ; Task 4 de tout.
- **Pas de `db push` prod** pendant l'implémentation (prod migrée à la clôture, comme C1–7a).
- **Signaux e2e déterministes** : attendre `client-row`/`voyage-card` ou le ré-enable du bouton ; jamais `networkidle`.
- **Comptes e2e** : `agence@vito` (agence existante) + `client7b@vito` (client dédié Free, 0 voyage → reste sous la limite, n'affecte pas les e2e voyages/famille). `db reset` AVANT la suite complète.
- **`database.types.ts`** : si le data layer (Task 2) ne typecheck pas faute des types de `agence_clients` + des 3 RPC, régénérer via `supabase gen types typescript --local > src/types/database.types.ts` (la migration 00014 doit être appliquée d'abord) et l'inclure dans le commit de Task 2.
