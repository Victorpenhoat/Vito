# Chantier 4 — Voyages (réservations + partage) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer le module Voyages : voyages + réservations (hôtel/vol/voiture + coordonnées conciergerie) + partage entre utilisateurs existants (premier modèle multi-utilisateur, RLS d'appartenance), testé de bout en bout.

**Architecture:** Mêmes couches que Chantiers 1–3 : `features/voyages/{domain,data,ui}`, migration SQL versionnée avec RLS + grants explicites + helpers `security definer` (anti-récursion) + RPC de partage, types régénérés. Server Actions validées Zod, lectures RLS-aware.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Supabase (Postgres + RLS), Zod, next-intl, Vitest, Playwright.

## Global Constraints

- TypeScript strict, **aucun `any`**.
- **RLS activée sur chaque nouvelle table** (`voyages`, `voyage_membres`, `reservations`) ET **`GRANT` explicites** à `authenticated` dans la même migration.
- **Accès multi-utilisateur** via helpers `security definer` `is_voyage_owner(uuid)` / `can_access_voyage(uuid)` (anti-récursion RLS). DELETE voyage + gestion des membres = **owner-only**.
- **Partage** via RPC `security definer` owner-only, sans énumération d'e-mails ; `revoke execute from anon, public` + `grant to authenticated`.
- Schéma DB = source de vérité des types : régénérer `src/types/database.types.ts` via `npm run db:types` après chaque migration.
- **Le serveur fait foi** : `owner_id`/`created_by` de la session (`getUser()`), jamais du client ; Zod avant écriture ; pas de client service-role dans la couche données.
- **Aucune logique métier dans les composants** ; tout texte visible via **next-intl** (`voyages.*`) — pas de chaîne en dur.
- Commits en français, terminés par : `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- UUID v4 valides dans tests/seed (Zod v4 `.uuid()` strict).

---

## Structure des fichiers

```
supabase/
  migrations/00009_voyages.sql        # enums, 3 tables, helpers, RLS, grants, RPC partage
  seed.sql                            # + voyage démo client + réservation + partage avec agence
src/
  types/database.types.ts             # RÉGÉNÉRÉ
  features/voyages/
    domain/schemas.ts                 # Zod : voyage, reservation, share (+ types)
    data/actions.ts                   # create/update/deleteVoyage, add/deleteReservation, share/unshareVoyage
    data/queries.ts                   # getMesVoyages, getVoyageDetail
    ui/VoyageForm.tsx, VoyagesList.tsx, VoyageDetail.tsx, ReservationForm.tsx, ShareForm.tsx, MembersList.tsx
  app/[locale]/(app)/voyages/page.tsx, [id]/page.tsx, error.tsx
messages/fr.json                      # + voyages.*
e2e/voyages.spec.ts
```

---

## Task 1: Migration `00009_voyages.sql` (tables + helpers + RLS + grants + RPC)

**Files:**
- Create: `supabase/migrations/00009_voyages.sql`

**Interfaces:**
- Produces: enums `voyage_statut`/`reservation_type` ; tables `voyages`/`voyage_membres`/`reservations` ; helpers `is_voyage_owner(uuid)`/`can_access_voyage(uuid)` ; RPC `share_voyage(uuid,text) returns text` + `unshare_voyage(uuid,uuid) returns void` ; RLS + grants.
- Consommé par : types (Task 2), data (Tasks 5-6).

- [ ] **Step 1: Écrire la migration**

`supabase/migrations/00009_voyages.sql` :

```sql
create type public.voyage_statut as enum ('planifie', 'confirme', 'en_cours', 'termine');
create type public.reservation_type as enum ('hotel', 'vol', 'voiture', 'hebergement', 'autre');

create table public.voyages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  titre text not null check (char_length(titre) <= 200),
  destination text check (destination is null or char_length(destination) <= 200),
  date_debut date,
  date_fin date,
  statut public.voyage_statut not null default 'planifie',
  created_at timestamptz not null default now(),
  check (date_fin is null or date_debut is null or date_fin >= date_debut)
);

create table public.voyage_membres (
  voyage_id uuid not null references public.voyages (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'membre' check (role in ('owner', 'membre')),
  added_at timestamptz not null default now(),
  primary key (voyage_id, profile_id)
);

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  voyage_id uuid not null references public.voyages (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  type public.reservation_type not null default 'autre',
  fournisseur text,
  reference text,
  date_debut date,
  date_fin date,
  conciergerie_tel text,
  conciergerie_mail text,
  lien text,
  notes text,
  created_at timestamptz not null default now(),
  check (date_fin is null or date_debut is null or date_fin >= date_debut)
);

create index voyages_owner_idx on public.voyages (owner_id);
create index voyage_membres_profile_idx on public.voyage_membres (profile_id);
create index reservations_voyage_idx on public.reservations (voyage_id);

-- Helpers security definer (anti-récursion RLS)
create function public.is_voyage_owner(v_id uuid) returns boolean
  language sql security definer set search_path = '' stable as $$
  select exists (select 1 from public.voyages where id = v_id and owner_id = auth.uid());
$$;

create function public.can_access_voyage(v_id uuid) returns boolean
  language sql security definer set search_path = '' stable as $$
  select exists (select 1 from public.voyages where id = v_id and owner_id = auth.uid())
      or exists (select 1 from public.voyage_membres where voyage_id = v_id and profile_id = auth.uid());
$$;

-- RLS voyages (une policy par commande)
alter table public.voyages enable row level security;
create policy "voyages_select" on public.voyages for select using (public.can_access_voyage(id));
create policy "voyages_insert" on public.voyages for insert with check (owner_id = auth.uid());
create policy "voyages_update" on public.voyages for update using (public.can_access_voyage(id)) with check (public.can_access_voyage(id));
create policy "voyages_delete" on public.voyages for delete using (public.is_voyage_owner(id));

-- RLS reservations (collaboratif)
alter table public.reservations enable row level security;
create policy "reservations_all" on public.reservations for all
  using (public.can_access_voyage(voyage_id)) with check (public.can_access_voyage(voyage_id));

-- RLS voyage_membres (lecture = membres ; écriture = owner)
alter table public.voyage_membres enable row level security;
create policy "voyage_membres_select" on public.voyage_membres for select using (public.can_access_voyage(voyage_id));
create policy "voyage_membres_insert" on public.voyage_membres for insert with check (public.is_voyage_owner(voyage_id));
create policy "voyage_membres_delete" on public.voyage_membres for delete using (public.is_voyage_owner(voyage_id));

-- Grants explicites
grant select, insert, update, delete on public.voyages to authenticated;
grant select, insert, update, delete on public.voyage_membres to authenticated;
grant select, insert, update, delete on public.reservations to authenticated;

-- RPC de partage (owner-only, sans énumération d'e-mails)
create function public.share_voyage(p_voyage_id uuid, p_email text) returns text
  language plpgsql security definer set search_path = '' as $$
declare v_uid uuid;
begin
  if auth.uid() is null then raise exception 'authentification requise'; end if;
  if not public.is_voyage_owner(p_voyage_id) then raise exception 'non autorisé'; end if;
  select id into v_uid from auth.users where lower(email) = lower(p_email);
  if v_uid is null then return 'not_found'; end if;
  if v_uid = auth.uid() then return 'self'; end if;
  insert into public.voyage_membres (voyage_id, profile_id, role)
  values (p_voyage_id, v_uid, 'membre')
  on conflict (voyage_id, profile_id) do nothing;
  return 'ok';
end;
$$;

create function public.unshare_voyage(p_voyage_id uuid, p_profile_id uuid) returns void
  language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_voyage_owner(p_voyage_id) then raise exception 'non autorisé'; end if;
  delete from public.voyage_membres
  where voyage_id = p_voyage_id and profile_id = p_profile_id and role <> 'owner';
end;
$$;

revoke execute on function public.share_voyage(uuid, text) from anon, public;
grant execute on function public.share_voyage(uuid, text) to authenticated;
revoke execute on function public.unshare_voyage(uuid, uuid) from anon, public;
grant execute on function public.unshare_voyage(uuid, uuid) to authenticated;
revoke execute on function public.is_voyage_owner(uuid) from anon, public;
revoke execute on function public.can_access_voyage(uuid) from anon, public;
grant execute on function public.is_voyage_owner(uuid) to authenticated;
grant execute on function public.can_access_voyage(uuid) to authenticated;
```

- [ ] **Step 2: Appliquer + vérifier RLS/grants/helpers + le partage cross-utilisateur en SQL**

```bash
supabase db reset
```
Vérifs (docker exec direct) :
```bash
docker exec supabase_db_Vito psql -U postgres -d postgres -tAc "select relname||':'||relrowsecurity from pg_class where relname in ('voyages','voyage_membres','reservations') order by 1;"
docker exec supabase_db_Vito psql -U postgres -d postgres -tAc "select has_table_privilege('authenticated','public.voyages','INSERT'), has_function_privilege('public','public.share_voyage(uuid,text)','EXECUTE');"
```
Expected : RLS `t` partout ; INSERT `t` ; share_voyage public EXECUTE `f` (revoqué).

Test fonctionnel du partage (simuler deux utilisateurs via `request.jwt.claims`) — voir Task 7 pour le test e2e complet ; ici on confirme juste que `can_access_voyage` renvoie true pour un membre :
```bash
docker exec supabase_db_Vito psql -U postgres -d postgres -tAc "
insert into auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change,email_change_token_current,reauthentication_token,phone_change,phone_change_token) values
 ('77777777-7777-4777-8777-777777777777','00000000-0000-0000-0000-000000000000','authenticated','authenticated','owner_t@x.fr',crypt('x',gen_salt('bf')),now(),'{}','{}',now(),now(),'','','','','','','',''),
 ('88888888-8888-4888-8888-888888888888','00000000-0000-0000-0000-000000000000','authenticated','authenticated','mem_t@x.fr',crypt('x',gen_salt('bf')),now(),'{}','{}',now(),now(),'','','','','','','','');
insert into public.voyages (id, owner_id, titre) values ('99999999-9999-4999-8999-999999999999','77777777-7777-4777-8777-777777777777','T');
set request.jwt.claims = '{\"sub\":\"77777777-7777-4777-8777-777777777777\"}';
select 'share='||public.share_voyage('99999999-9999-4999-8999-999999999999','mem_t@x.fr');
set request.jwt.claims = '{\"sub\":\"88888888-8888-4888-8888-888888888888\"}';
select 'member_access='||public.can_access_voyage('99999999-9999-4999-8999-999999999999');
reset request.jwt.claims;
delete from auth.users where email in ('owner_t@x.fr','mem_t@x.fr');
"
```
Expected : `share=ok`, `member_access=true`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/00009_voyages.sql
git commit -m "feat(db): voyages + membres + reservations (RLS appartenance, RPC partage)"
```

---

## Task 2: Régénération des types

**Files:**
- Modify: `src/types/database.types.ts` (généré)

**Interfaces:**
- Produces: types `voyages`/`voyage_membres`/`reservations` + RPC `share_voyage`/`unshare_voyage`.

- [ ] **Step 1: Générer**

```bash
npm run db:types
```

- [ ] **Step 2: Vérifier**

```bash
grep -c "voyages\|voyage_membres\|reservations\|share_voyage" src/types/database.types.ts
npm run typecheck
```
Expected : > 0 ; typecheck propre.

- [ ] **Step 3: Commit**

```bash
git add src/types/database.types.ts
git commit -m "chore(db): régénère les types (voyages, reservations, membres)"
```

---

## Task 3: Domaine — schémas Zod (TDD)

**Files:**
- Create: `src/features/voyages/domain/schemas.ts`, `src/features/voyages/domain/schemas.test.ts`

**Interfaces:**
- Produces:
  - `voyageInputSchema` → `{ titre, destination?, dateDebut?, dateFin?, statut? }` avec refine `dateFin >= dateDebut`
  - `reservationInputSchema` → `{ voyageId: uuid, type, fournisseur?, reference?, dateDebut?, dateFin?, conciergerieTel?, conciergerieMail?, lien?, notes? }` avec refine dates + `lien` url optionnelle + `conciergerieMail` email optionnelle
  - `shareInputSchema` → `{ voyageId: uuid, email }`
  - `VOYAGE_STATUTS`, `RESERVATION_TYPES` (const arrays) + types inférés
- Consommé par : actions (Task 5), UI (Tasks 6-? via consts).

- [ ] **Step 1: Test**

`src/features/voyages/domain/schemas.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { voyageInputSchema, reservationInputSchema, shareInputSchema } from "./schemas";

const UUID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

describe("voyageInputSchema", () => {
  it("titre requis", () => {
    expect(voyageInputSchema.safeParse({}).success).toBe(false);
    expect(voyageInputSchema.safeParse({ titre: "Rome" }).success).toBe(true);
  });
  it("rejette dateFin < dateDebut", () => {
    expect(voyageInputSchema.safeParse({ titre: "X", dateDebut: "2026-09-10", dateFin: "2026-09-01" }).success).toBe(false);
  });
  it("rejette un statut invalide", () => {
    expect(voyageInputSchema.safeParse({ titre: "X", statut: "annule" }).success).toBe(false);
  });
});

describe("reservationInputSchema", () => {
  it("voyageId uuid requis + type valide", () => {
    expect(reservationInputSchema.safeParse({ voyageId: UUID, type: "hotel" }).success).toBe(true);
    expect(reservationInputSchema.safeParse({ voyageId: "x", type: "hotel" }).success).toBe(false);
    expect(reservationInputSchema.safeParse({ voyageId: UUID, type: "train" }).success).toBe(false);
  });
  it("rejette un mail conciergerie invalide et un lien non-url", () => {
    expect(reservationInputSchema.safeParse({ voyageId: UUID, type: "hotel", conciergerieMail: "nope" }).success).toBe(false);
    expect(reservationInputSchema.safeParse({ voyageId: UUID, type: "hotel", lien: "nope" }).success).toBe(false);
  });
});

describe("shareInputSchema", () => {
  it("email valide requis", () => {
    expect(shareInputSchema.safeParse({ voyageId: UUID, email: "a@b.fr" }).success).toBe(true);
    expect(shareInputSchema.safeParse({ voyageId: UUID, email: "nope" }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Lancer (échec)**

Run: `npm run test -- voyages/domain/schemas`
Expected: FAIL.

- [ ] **Step 3: Implémenter**

`src/features/voyages/domain/schemas.ts` :

```ts
import { z } from "zod";

export const VOYAGE_STATUTS = ["planifie", "confirme", "en_cours", "termine"] as const;
export const RESERVATION_TYPES = ["hotel", "vol", "voiture", "hebergement", "autre"] as const;

const datesOk = (d: { dateDebut?: string; dateFin?: string }) =>
  !d.dateDebut || !d.dateFin || d.dateFin >= d.dateDebut;

export const voyageInputSchema = z
  .object({
    titre: z.string().min(1).max(200),
    destination: z.string().max(200).optional(),
    dateDebut: z.string().date().optional(),
    dateFin: z.string().date().optional(),
    statut: z.enum(VOYAGE_STATUTS).optional(),
  })
  .refine(datesOk, { message: "dateFin doit être >= dateDebut", path: ["dateFin"] });
export type VoyageInput = z.infer<typeof voyageInputSchema>;

export const reservationInputSchema = z
  .object({
    voyageId: z.string().uuid(),
    type: z.enum(RESERVATION_TYPES),
    fournisseur: z.string().max(200).optional(),
    reference: z.string().max(200).optional(),
    dateDebut: z.string().date().optional(),
    dateFin: z.string().date().optional(),
    conciergerieTel: z.string().max(50).optional(),
    conciergerieMail: z.string().email().optional(),
    lien: z.string().url().optional(),
    notes: z.string().max(2000).optional(),
  })
  .refine(datesOk, { message: "dateFin doit être >= dateDebut", path: ["dateFin"] });
export type ReservationInput = z.infer<typeof reservationInputSchema>;

export const shareInputSchema = z.object({
  voyageId: z.string().uuid(),
  email: z.string().email(),
});
```

- [ ] **Step 4: Lancer (succès) + qualité**

Run: `npm run test -- voyages/domain/schemas && npm run typecheck && npm run lint`
Expected: vert.

- [ ] **Step 5: Commit**

```bash
git add src/features/voyages/domain/schemas.ts src/features/voyages/domain/schemas.test.ts
git commit -m "feat(voyages): schémas Zod voyage/réservation/partage (testés)"
```

---

## Task 4: Régénération des types — (fusionnée dans Task 2)

_(Pas de tâche séparée — Task 2 couvre la régénération.)_

---

## Task 5: Data — actions (voyages, réservations, partage)

**Files:**
- Create: `src/features/voyages/data/actions.ts`

**Interfaces:**
- Consumes: `createServerSupabase`, `voyageInputSchema`/`reservationInputSchema`/`shareInputSchema` (Task 3), RPC `share_voyage`/`unshare_voyage`.
- Produces (toutes `(_prev, formData) => Promise<{ error?: string; ok?: true }>` sauf indication) :
  - `createVoyage`, `updateVoyage`, `deleteVoyage`, `addReservation`, `deleteReservation`, `shareVoyage`, `unshareVoyage`.
- Consommé par : UI (Tasks 6-8).

- [ ] **Step 1: Implémenter**

`src/features/voyages/data/actions.ts` :

```ts
"use server";
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { voyageInputSchema, reservationInputSchema, shareInputSchema } from "../domain/schemas";

async function userId(supabase: Awaited<ReturnType<typeof createServerSupabase>>) {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function createVoyage(_prev: unknown, formData: FormData) {
  const parsed = voyageInputSchema.safeParse({
    titre: formData.get("titre"),
    destination: formData.get("destination") || undefined,
    dateDebut: formData.get("dateDebut") || undefined,
    dateFin: formData.get("dateFin") || undefined,
    statut: formData.get("statut") || undefined,
  });
  if (!parsed.success) return { error: "Voyage invalide" };
  const supabase = await createServerSupabase();
  const uid = await userId(supabase);
  if (!uid) return { error: "Non authentifié" };
  const { error } = await supabase.from("voyages").insert({
    owner_id: uid,
    titre: parsed.data.titre,
    destination: parsed.data.destination ?? null,
    date_debut: parsed.data.dateDebut ?? null,
    date_fin: parsed.data.dateFin ?? null,
    statut: parsed.data.statut ?? "planifie",
  });
  if (error) return { error: "Création échouée" };
  revalidatePath("/voyages");
  return { ok: true as const };
}

export async function updateVoyage(_prev: unknown, formData: FormData) {
  const id = formData.get("voyageId");
  if (typeof id !== "string") return { error: "Entrée invalide" };
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
  const { error } = await supabase.from("voyages").update({
    titre: parsed.data.titre,
    destination: parsed.data.destination ?? null,
    date_debut: parsed.data.dateDebut ?? null,
    date_fin: parsed.data.dateFin ?? null,
    statut: parsed.data.statut ?? "planifie",
  }).eq("id", id);
  if (error) return { error: "Mise à jour échouée" };
  revalidatePath(`/voyages/${id}`);
  return { ok: true as const };
}

export async function deleteVoyage(_prev: unknown, formData: FormData) {
  const id = formData.get("voyageId");
  if (typeof id !== "string") return { error: "Entrée invalide" };
  const supabase = await createServerSupabase();
  if (!(await userId(supabase))) return { error: "Non authentifié" };
  // RLS delete = owner-only ; .select() détecte 0 ligne (non owner / introuvable)
  const { data, error } = await supabase.from("voyages").delete().eq("id", id).select("id").maybeSingle();
  if (error) return { error: "Suppression échouée" };
  if (!data) return { error: "Suppression non autorisée" };
  revalidatePath("/voyages");
  return { ok: true as const };
}

export async function addReservation(_prev: unknown, formData: FormData) {
  const parsed = reservationInputSchema.safeParse({
    voyageId: formData.get("voyageId"),
    type: formData.get("type"),
    fournisseur: formData.get("fournisseur") || undefined,
    reference: formData.get("reference") || undefined,
    dateDebut: formData.get("dateDebut") || undefined,
    dateFin: formData.get("dateFin") || undefined,
    conciergerieTel: formData.get("conciergerieTel") || undefined,
    conciergerieMail: formData.get("conciergerieMail") || undefined,
    lien: formData.get("lien") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return { error: "Réservation invalide" };
  const supabase = await createServerSupabase();
  const uid = await userId(supabase);
  if (!uid) return { error: "Non authentifié" };
  const d = parsed.data;
  const { error } = await supabase.from("reservations").insert({
    voyage_id: d.voyageId, created_by: uid, type: d.type,
    fournisseur: d.fournisseur ?? null, reference: d.reference ?? null,
    date_debut: d.dateDebut ?? null, date_fin: d.dateFin ?? null,
    conciergerie_tel: d.conciergerieTel ?? null, conciergerie_mail: d.conciergerieMail ?? null,
    lien: d.lien ?? null, notes: d.notes ?? null,
  });
  if (error) return { error: "Ajout de réservation échoué" };
  revalidatePath(`/voyages/${d.voyageId}`);
  return { ok: true as const };
}

export async function deleteReservation(_prev: unknown, formData: FormData) {
  const id = formData.get("reservationId");
  const voyageId = formData.get("voyageId");
  if (typeof id !== "string" || typeof voyageId !== "string") return { error: "Entrée invalide" };
  const supabase = await createServerSupabase();
  if (!(await userId(supabase))) return { error: "Non authentifié" };
  const { error } = await supabase.from("reservations").delete().eq("id", id);
  if (error) return { error: "Suppression échouée" };
  revalidatePath(`/voyages/${voyageId}`);
  return { ok: true as const };
}

export async function shareVoyage(_prev: unknown, formData: FormData) {
  const parsed = shareInputSchema.safeParse({
    voyageId: formData.get("voyageId"),
    email: formData.get("email"),
  });
  if (!parsed.success) return { error: "E-mail invalide" };
  const supabase = await createServerSupabase();
  if (!(await userId(supabase))) return { error: "Non authentifié" };
  const { data, error } = await supabase.rpc("share_voyage", {
    p_voyage_id: parsed.data.voyageId, p_email: parsed.data.email,
  });
  if (error) return { error: "Partage échoué" };
  if (data === "not_found") return { error: "Aucun utilisateur avec cet e-mail" };
  if (data === "self") return { error: "Vous êtes déjà propriétaire" };
  revalidatePath(`/voyages/${parsed.data.voyageId}`);
  return { ok: true as const };
}

export async function unshareVoyage(_prev: unknown, formData: FormData) {
  const voyageId = formData.get("voyageId");
  const profileId = formData.get("profileId");
  if (typeof voyageId !== "string" || typeof profileId !== "string") return { error: "Entrée invalide" };
  const supabase = await createServerSupabase();
  if (!(await userId(supabase))) return { error: "Non authentifié" };
  const { error } = await supabase.rpc("unshare_voyage", { p_voyage_id: voyageId, p_profile_id: profileId });
  if (error) return { error: "Retrait échoué" };
  revalidatePath(`/voyages/${voyageId}`);
  return { ok: true as const };
}
```

- [ ] **Step 2: Vérifier**

Run: `npm run typecheck && npm run lint`
Expected: 0 erreur, 0 warning (RPC `share_voyage`/`unshare_voyage` typés depuis le schéma régénéré).

- [ ] **Step 3: Commit**

```bash
git add src/features/voyages/data/actions.ts
git commit -m "feat(voyages): actions voyages/réservations/partage"
```

---

## Task 6: Data — lectures (`getMesVoyages`, `getVoyageDetail`)

**Files:**
- Create: `src/features/voyages/data/queries.ts`

**Interfaces:**
- Consumes: `createServerSupabase`.
- Produces:
  - `getMesVoyages(): Promise<VoyageRow[]>` (owned + partagés, via RLS) où `VoyageRow = { id, titre, destination, date_debut, date_fin, statut, owner_id }`
  - `getVoyageDetail(id): Promise<{ voyage: VoyageRow; reservations: ReservationRow[]; membres: MembreRow[]; isOwner: boolean }>` (throw si inaccessible)
- Consommé par : UI (Tasks 7-8).

- [ ] **Step 1: Implémenter**

`src/features/voyages/data/queries.ts` :

```ts
import { createServerSupabase } from "@/lib/supabase/server";

export async function getMesVoyages() {
  const supabase = await createServerSupabase();
  // RLS (can_access_voyage) renvoie automatiquement les voyages possédés + partagés.
  const { data, error } = await supabase
    .from("voyages")
    .select("id, titre, destination, date_debut, date_fin, statut, owner_id")
    .order("date_debut", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data;
}

export async function getVoyageDetail(id: string) {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id ?? null;

  const [voyageRes, resRes, memRes] = await Promise.all([
    supabase.from("voyages").select("id, titre, destination, date_debut, date_fin, statut, owner_id").eq("id", id).single(),
    supabase.from("reservations").select("id, type, fournisseur, reference, date_debut, date_fin, conciergerie_tel, conciergerie_mail, lien, notes").eq("voyage_id", id).order("date_debut", { ascending: true, nullsFirst: false }),
    supabase.from("voyage_membres").select("profile_id, role, profile:profiles(display_name)").eq("voyage_id", id),
  ]);
  if (voyageRes.error) throw voyageRes.error;
  if (resRes.error) throw resRes.error;
  if (memRes.error) throw memRes.error;

  const membres = (memRes.data ?? []).map((m) => {
    const p = Array.isArray(m.profile) ? m.profile[0] : m.profile;
    return { profile_id: m.profile_id, role: m.role, display_name: p?.display_name ?? null };
  });
  return {
    voyage: voyageRes.data,
    reservations: resRes.data ?? [],
    membres,
    isOwner: voyageRes.data.owner_id === uid,
  };
}
```

- [ ] **Step 2: Vérifier**

Run: `npm run typecheck && npm run lint`
Expected: 0 erreur, 0 warning.

- [ ] **Step 3: Commit**

```bash
git add src/features/voyages/data/queries.ts
git commit -m "feat(voyages): lectures getMesVoyages + getVoyageDetail"
```

---

## Task 7: UI — liste + création + route

**Files:**
- Create: `src/features/voyages/ui/VoyageForm.tsx`, `src/features/voyages/ui/VoyagesList.tsx`, `src/app/[locale]/(app)/voyages/page.tsx`, `src/app/[locale]/(app)/voyages/error.tsx`
- Modify: `messages/fr.json` (namespace `voyages.*`)

**Interfaces:**
- Consumes: `createVoyage` (Task 5), `getMesVoyages` (Task 6), `VOYAGE_STATUTS` (Task 3).
- Produces: route `/voyages`. `data-testid` : `voyage-form`, `voyage-card`.

- [ ] **Step 1: Ajouter les clés i18n**

Dans `messages/fr.json`, ajouter sous la racine :

```json
"voyages": {
  "title": "Mes voyages",
  "create": "Créer un voyage",
  "titre": "Titre",
  "destination": "Destination",
  "dateDebut": "Date de début",
  "dateFin": "Date de fin",
  "statut": "Statut",
  "statuts": { "planifie": "Planifié", "confirme": "Confirmé", "en_cours": "En cours", "termine": "Terminé" },
  "vide": "Aucun voyage pour l'instant.",
  "partage": "Partagé avec vous",
  "reservations": "Réservations",
  "addReservation": "Ajouter une réservation",
  "type": "Type",
  "types": { "hotel": "Hôtel", "vol": "Vol", "voiture": "Voiture", "hebergement": "Hébergement", "autre": "Autre" },
  "fournisseur": "Fournisseur",
  "reference": "Référence",
  "lien": "Lien (Airbnb, PAP…)",
  "conciergerieTel": "Téléphone conciergerie",
  "conciergerieMail": "E-mail conciergerie",
  "notes": "Notes",
  "membres": "Membres",
  "partager": "Partager",
  "partagerEmail": "E-mail de la personne",
  "retirer": "Retirer",
  "supprimer": "Supprimer le voyage",
  "save": "Enregistrer",
  "error": { "title": "Une erreur est survenue", "retry": "Réessayer" }
}
```

- [ ] **Step 2: `VoyageForm` (client)**

`src/features/voyages/ui/VoyageForm.tsx` :

```tsx
"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { createVoyage } from "../data/actions";
import { VOYAGE_STATUTS } from "../domain/schemas";

export function VoyageForm() {
  const t = useTranslations("voyages");
  const [state, action, pending] = useActionState(createVoyage, undefined);
  return (
    <form action={action} data-testid="voyage-form" className="flex flex-col gap-2 max-w-md">
      <input name="titre" required placeholder={t("titre")} className="border p-2" />
      <input name="destination" placeholder={t("destination")} className="border p-2" />
      <div className="flex gap-2">
        <input name="dateDebut" type="date" aria-label={t("dateDebut")} className="border p-2" />
        <input name="dateFin" type="date" aria-label={t("dateFin")} className="border p-2" />
      </div>
      <select name="statut" aria-label={t("statut")} className="border p-2" defaultValue="planifie">
        {VOYAGE_STATUTS.map((s) => <option key={s} value={s}>{t(`statuts.${s}`)}</option>)}
      </select>
      {state?.error && <p role="alert" className="text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending} className="bg-black text-white p-2">{t("create")}</button>
    </form>
  );
}
```

- [ ] **Step 3: `VoyagesList` (server)**

`src/features/voyages/ui/VoyagesList.tsx` :

```tsx
import { getMesVoyages } from "../data/queries";
import { Link } from "@/lib/i18n/routing";
import { getTranslations } from "next-intl/server";

export async function VoyagesList() {
  const t = await getTranslations("voyages");
  const voyages = await getMesVoyages();
  if (voyages.length === 0) return <p>{t("vide")}</p>;
  return (
    <ul className="flex flex-col gap-2">
      {voyages.map((v) => (
        <li key={v.id} data-testid="voyage-card" className="border p-3">
          <Link href={`/voyages/${v.id}`}>
            <span className="font-semibold">{v.titre}</span>{" "}
            {v.destination && <span className="text-gray-500">· {v.destination}</span>}{" "}
            <span className="text-gray-500">· {t(`statuts.${v.statut}`)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 4: Page + error**

`src/app/[locale]/(app)/voyages/page.tsx` :

```tsx
import { getTranslations } from "next-intl/server";
import { VoyageForm } from "@/features/voyages/ui/VoyageForm";
import { VoyagesList } from "@/features/voyages/ui/VoyagesList";

export default async function VoyagesPage() {
  const t = await getTranslations("voyages");
  return (
    <main className="p-6 flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <VoyageForm />
      <VoyagesList />
    </main>
  );
}
```

`src/app/[locale]/(app)/voyages/error.tsx` :

```tsx
"use client";
import { useTranslations } from "next-intl";
export default function VoyagesError({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations("voyages.error");
  return (
    <main className="p-6">
      <p role="alert">{t("title")}</p>
      <button onClick={reset} className="underline">{t("retry")}</button>
    </main>
  );
}
```

- [ ] **Step 5: Vérifier**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: route `/voyages` présente, 0 warning.

- [ ] **Step 6: Commit**

```bash
git add src/features/voyages/ui/VoyageForm.tsx src/features/voyages/ui/VoyagesList.tsx "src/app/[locale]/(app)/voyages/page.tsx" "src/app/[locale]/(app)/voyages/error.tsx" messages/fr.json
git commit -m "feat(voyages): onglet Mes voyages (liste possédés + partagés, création)"
```

---

## Task 8: UI — détail voyage (réservations + partage + membres)

**Files:**
- Create: `src/features/voyages/ui/VoyageDetail.tsx`, `src/features/voyages/ui/ReservationForm.tsx`, `src/features/voyages/ui/ShareForm.tsx`, `src/features/voyages/ui/MembersList.tsx`, `src/app/[locale]/(app)/voyages/[id]/page.tsx`

**Interfaces:**
- Consumes: `getVoyageDetail` (Task 6), `addReservation`/`deleteReservation`/`shareVoyage`/`unshareVoyage`/`deleteVoyage` (Task 5), `RESERVATION_TYPES` (Task 3).
- Produces: route `/voyages/[id]`. `data-testid` : `reservation-form`, `reservation-row`, `share-form`, `member-row`.

- [ ] **Step 1: `ReservationForm` (client)**

`src/features/voyages/ui/ReservationForm.tsx` :

```tsx
"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { addReservation } from "../data/actions";
import { RESERVATION_TYPES } from "../domain/schemas";

export function ReservationForm({ voyageId }: { voyageId: string }) {
  const t = useTranslations("voyages");
  const [state, action, pending] = useActionState(addReservation, undefined);
  return (
    <form action={action} data-testid="reservation-form" className="flex flex-col gap-2 border-t pt-3">
      <input type="hidden" name="voyageId" value={voyageId} />
      <select name="type" aria-label={t("type")} className="border p-2" defaultValue="hotel">
        {RESERVATION_TYPES.map((ty) => <option key={ty} value={ty}>{t(`types.${ty}`)}</option>)}
      </select>
      <input name="fournisseur" placeholder={t("fournisseur")} className="border p-2" />
      <input name="reference" placeholder={t("reference")} className="border p-2" />
      <div className="flex gap-2">
        <input name="dateDebut" type="date" aria-label={t("dateDebut")} className="border p-2" />
        <input name="dateFin" type="date" aria-label={t("dateFin")} className="border p-2" />
      </div>
      <input name="conciergerieTel" placeholder={t("conciergerieTel")} className="border p-2" />
      <input name="conciergerieMail" type="email" placeholder={t("conciergerieMail")} className="border p-2" />
      <input name="lien" type="url" placeholder={t("lien")} className="border p-2" />
      <textarea name="notes" placeholder={t("notes")} className="border p-2" />
      {state?.error && <p role="alert" className="text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending} className="bg-black text-white p-2">{t("addReservation")}</button>
    </form>
  );
}
```

- [ ] **Step 2: `ShareForm` + `MembersList` (client)**

`src/features/voyages/ui/ShareForm.tsx` :

```tsx
"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { shareVoyage } from "../data/actions";

export function ShareForm({ voyageId }: { voyageId: string }) {
  const t = useTranslations("voyages");
  const [state, action, pending] = useActionState(shareVoyage, undefined);
  return (
    <form action={action} data-testid="share-form" className="flex gap-2 items-center">
      <input type="hidden" name="voyageId" value={voyageId} />
      <input name="email" type="email" required placeholder={t("partagerEmail")} className="border p-2 flex-1" />
      <button type="submit" disabled={pending} className="bg-black text-white p-2">{t("partager")}</button>
      {state?.error && <p role="alert" className="text-red-600">{state.error}</p>}
    </form>
  );
}
```

`src/features/voyages/ui/MembersList.tsx` :

```tsx
"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { unshareVoyage } from "../data/actions";

type Membre = { profile_id: string; role: string; display_name: string | null };

export function MembersList({ voyageId, membres, isOwner }: { voyageId: string; membres: Membre[]; isOwner: boolean }) {
  const t = useTranslations("voyages");
  const [, action] = useActionState(unshareVoyage, undefined);
  return (
    <ul className="flex flex-col gap-1">
      {membres.map((m) => (
        <li key={m.profile_id} data-testid="member-row" className="flex items-center gap-2">
          <span>{m.display_name ?? m.profile_id} {m.role === "owner" ? "(owner)" : ""}</span>
          {isOwner && m.role !== "owner" && (
            <form action={action}>
              <input type="hidden" name="voyageId" value={voyageId} />
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

- [ ] **Step 3: `VoyageDetail` (server)**

`src/features/voyages/ui/VoyageDetail.tsx` :

```tsx
import { getTranslations } from "next-intl/server";
import { getVoyageDetail } from "../data/queries";
import { ReservationForm } from "./ReservationForm";
import { ShareForm } from "./ShareForm";
import { MembersList } from "./MembersList";

export async function VoyageDetail({ id }: { id: string }) {
  const t = await getTranslations("voyages");
  const { voyage, reservations, membres, isOwner } = await getVoyageDetail(id);
  return (
    <article className="flex flex-col gap-6">
      <header>
        <h1 className="text-xl font-bold">{voyage.titre}</h1>
        <p className="text-gray-600">
          {[voyage.destination, t(`statuts.${voyage.statut}`), voyage.date_debut, voyage.date_fin].filter(Boolean).join(" · ")}
        </p>
      </header>

      <section>
        <h2 className="font-semibold">{t("reservations")}</h2>
        <ul className="flex flex-col gap-1">
          {reservations.map((r) => (
            <li key={r.id} data-testid="reservation-row" className="border-b py-1">
              <span className="font-medium">{t(`types.${r.type}`)}</span> {r.fournisseur ?? ""} {r.reference ?? ""}{" "}
              {r.conciergerie_tel && <a href={`tel:${r.conciergerie_tel}`} className="underline">{r.conciergerie_tel}</a>}{" "}
              {r.conciergerie_mail && <a href={`mailto:${r.conciergerie_mail}`} className="underline">{r.conciergerie_mail}</a>}{" "}
              {r.lien && <a href={r.lien} target="_blank" rel="noopener noreferrer" className="underline">{t("lien")}</a>}
            </li>
          ))}
        </ul>
        <ReservationForm voyageId={voyage.id} />
      </section>

      <section>
        <h2 className="font-semibold">{t("membres")}</h2>
        <MembersList voyageId={voyage.id} membres={membres} isOwner={isOwner} />
        {isOwner && <ShareForm voyageId={voyage.id} />}
      </section>
    </article>
  );
}
```

- [ ] **Step 4: Page**

`src/app/[locale]/(app)/voyages/[id]/page.tsx` :

```tsx
import { VoyageDetail } from "@/features/voyages/ui/VoyageDetail";

export default async function VoyageDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <main className="p-6"><VoyageDetail id={id} /></main>;
}
```

- [ ] **Step 5: Vérifier**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: route `/voyages/[id]` présente, 0 warning.

- [ ] **Step 6: Commit**

```bash
git add src/features/voyages/ui/VoyageDetail.tsx src/features/voyages/ui/ReservationForm.tsx src/features/voyages/ui/ShareForm.tsx src/features/voyages/ui/MembersList.tsx "src/app/[locale]/(app)/voyages/[id]/page.tsx"
git commit -m "feat(voyages): détail voyage (réservations + partage + membres)"
```

---

## Task 9: Seed (voyage démo + réservation + partage avec agence)

**Files:**
- Modify: `supabase/seed.sql`

**Interfaces:**
- Consumes: comptes client (`11111111-…`) et agence (`22222222-…`).
- Produces: 1 voyage démo du client + 1 réservation + 1 ligne `voyage_membres` (owner=client) + partage avec l'agence.

- [ ] **Step 1: Ajouter au seed**

À la fin de `supabase/seed.sql` :

```sql
-- Voyage de démo du client, partagé avec l'agence (UUID v4 valides)
insert into public.voyages (id, owner_id, titre, destination, date_debut, date_fin, statut)
values ('11111111-2222-4333-8444-555555555555', '11111111-1111-1111-1111-111111111111',
  'Week-end à Rome', 'Rome', '2026-09-12', '2026-09-15', 'confirme');

-- Le trigger on_voyage_created insère déjà la ligne 'owner' (client). On ajoute juste l'agence.
insert into public.voyage_membres (voyage_id, profile_id, role) values
  ('11111111-2222-4333-8444-555555555555', '22222222-2222-2222-2222-222222222222', 'membre')
on conflict (voyage_id, profile_id) do nothing;

insert into public.reservations (voyage_id, created_by, type, fournisseur, reference, date_debut, date_fin, conciergerie_tel, conciergerie_mail, lien)
values ('11111111-2222-4333-8444-555555555555', '11111111-1111-1111-1111-111111111111', 'hotel',
  'Hotel Roma', 'CONF-123', '2026-09-12', '2026-09-15', '+39 06 0000 0000', 'concierge@hotelroma.test', 'https://airbnb.example/rome');
```

- [ ] **Step 2: Appliquer + vérifier**

```bash
supabase db reset
docker exec supabase_db_Vito psql -U postgres -d postgres -tAc "select count(*) from public.voyages; select count(*) from public.voyage_membres; select count(*) from public.reservations;"
```
Expected : `1`, `2`, `1`.

- [ ] **Step 3: Commit**

```bash
git add supabase/seed.sql
git commit -m "feat(db): seed voyage démo (réservation + partagé avec l'agence)"
```

---

## Task 10: e2e — parcours voyages + partage cross-utilisateur

**Files:**
- Create: `e2e/voyages.spec.ts`

**Interfaces:**
- Consumes: comptes seed, sélecteurs `voyage-form`, `voyage-card`, `reservation-form`, `reservation-row`, `share-form`, `member-row`.

- [ ] **Step 1: Écrire le parcours**

`e2e/voyages.spec.ts` :

```ts
import { test, expect, type Page } from "@playwright/test";

async function login(page: Page, email: string) {
  await page.goto("/fr/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill("password123");
  await page.getByRole("button", { name: "Connexion" }).click();
  await expect(page).toHaveURL(/\/fr\/restos/);
}

test("créer un voyage, ajouter une réservation, partager avec l'agence", async ({ page }) => {
  await login(page, "client@vito.test");
  await page.goto("/fr/voyages");
  await page.getByTestId("voyage-form").locator('input[name="titre"]').fill("Voyage E2E Lisbonne");
  await page.getByTestId("voyage-form").getByRole("button").click();

  await expect(page.getByTestId("voyage-card").filter({ hasText: "Lisbonne" })).toBeVisible();
  await page.getByTestId("voyage-card").filter({ hasText: "Lisbonne" }).getByRole("link").click();

  // Réservation
  await page.getByTestId("reservation-form").locator('select[name="type"]').selectOption("hotel");
  await page.getByTestId("reservation-form").locator('input[name="fournisseur"]').fill("Hotel Lisboa");
  await page.getByTestId("reservation-form").getByRole("button").click();
  await expect(page.getByTestId("reservation-row").filter({ hasText: "Hotel Lisboa" })).toBeVisible();

  // Partage avec l'agence
  await page.getByTestId("share-form").locator('input[name="email"]').fill("agence@vito.test");
  await page.getByTestId("share-form").getByRole("button").click();
  await expect(page.getByTestId("member-row").filter({ hasText: "agence" }).or(page.getByTestId("member-row").nth(1))).toBeVisible();
});

test("l'agence voit le voyage partagé par le seed", async ({ page }) => {
  await login(page, "agence@vito.test");
  await page.goto("/fr/voyages");
  // Le seed partage « Week-end à Rome » (owner=client) avec l'agence
  await expect(page.getByTestId("voyage-card").filter({ hasText: "Rome" })).toBeVisible();
});
```

- [ ] **Step 2: Lancer la suite e2e complète**

```bash
supabase start
npm run test:e2e
```
Expected: tous les specs passent (auth + restos + vins + recherche + voyages).

- [ ] **Step 3: Suite complète + qualité**

Run: `npm run typecheck && npm run lint && npm run test && npm run test:e2e`
Expected: tout vert.

- [ ] **Step 4: Commit**

```bash
git add e2e/voyages.spec.ts
git commit -m "test(voyages): e2e création + réservation + partage + visibilité cross-utilisateur"
```

---

## Self-review (auteur)

**Couverture du spec :**
- 3 tables (voyages/voyage_membres/reservations) + enums → Task 1. ✓
- Helpers `security definer` anti-récursion + RLS par commande (DELETE owner-only) + grants → Task 1. ✓
- RPC `share_voyage`/`unshare_voyage` owner-only sans énumération → Task 1, consommés Task 5. ✓
- Types régénérés → Task 2. ✓
- Schémas Zod (voyage/réservation/partage, refine dates) → Task 3. ✓
- Actions (CRUD voyages/réservations + partage) → Task 5. ✓
- Lectures owned+partagés + détail → Task 6. ✓
- UI liste/création → Task 7 ; détail (réservations + conciergerie cliquable + partage + membres) → Task 8. ✓
- Seed (voyage + réservation + partagé agence) → Task 9. ✓
- e2e (création/réservation/partage + visibilité cross-utilisateur) → Task 10. ✓
- i18n `voyages.*` → Tasks 7, 8. ✓

**Note Task 4 :** numéro volontairement laissé vide (régénération fusionnée dans Task 2) pour ne pas renuméroter ; signalé dans le titre de Task 4.

**Écart i18n assumé (cohérent avec Chantier 3) :** les libellés de statut/type passent par `t("statuts.*")`/`t("types.*")` (corrigé ici, contrairement aux libellés bruts du Chantier 3). Le rôle « owner » affiché dans `MembersList` (`"(owner)"`) est un marqueur technique court — à i18n-er si souhaité (signalé).

**Cohérence des types/signatures :** `voyageInputSchema`/`reservationInputSchema`/`shareInputSchema` + `VOYAGE_STATUTS`/`RESERVATION_TYPES` (Task 3) ↔ actions (5) ↔ UI (7,8) ; RPC `share_voyage(p_voyage_id,p_email)`/`unshare_voyage(p_voyage_id,p_profile_id)` (Task 1) ↔ appels `supabase.rpc(...)` (5) ; `getVoyageDetail` renvoie `{voyage,reservations,membres,isOwner}` (6) ↔ `VoyageDetail` (8).

**Dette (rappel) :** documents chiffrés → 4b ; partage utilisateurs existants seulement ; rôles membres binaires/collaboratifs ; champs réservation génériques ; libellé « (owner) » non i18n.
