# Famille (foyer + liste resto partagée) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un foyer (famille) avec membres invités par e-mail et une liste de restos partagée par tous les membres.

**Architecture:** `features/famille/{domain,data,ui}`. Modèle membres + helpers `security definer` anti-récursion (comme C4/C5), `owner_id` immuable, RPC d'invitation owner-only par e-mail. **Une famille par utilisateur** via `UNIQUE(profile_id)` sur `famille_membres`. La liste resto réutilise l'infra restos/Places (`upsert_etablissement`). Gratuit (pas de gating premium).

**Tech Stack:** Next.js 16 (App Router, Server Actions), TypeScript strict, Supabase (Postgres + RLS), Zod, next-intl, Vitest, Playwright.

## Global Constraints

- Next.js 16 non-standard : consulter `node_modules/next/dist/docs/` avant une API Next inconnue.
- TypeScript strict avec `noUncheckedIndexedAccess`.
- RLS **et** grants explicites à `authenticated` sur chaque table.
- **Une famille par utilisateur** : `UNIQUE(profile_id)` sur `famille_membres` (DB-level, non contournable).
- Accès owner **ou** membre via helpers `security definer` (`is_famille_owner`/`can_access_famille`), `set search_path = ''`. `owner_id` immuable (trigger) ; owner non retirable ; owner-membre auto-inséré (trigger).
- Invitation owner-only via RPC `security definer`, sans énumération d'e-mails (retour générique `not_found`). `owner_id`/`added_by` de la session.
- Migration suivante = `00013_famille.sql`. Feature `src/features/famille/`, route `/famille`, namespace i18n `famille.*`. Aucune chaîne UI en dur. UUID seed = v4 valides.
- Réutilise `upsert_etablissement` (00003), l'abstraction Places, les idiomes d'actions de `src/features/voyages/data/actions.ts` et `src/features/restos/data/actions.ts`.

---

### Task 1: Migration `00013_famille.sql`

**Files:**
- Create: `supabase/migrations/00013_famille.sql`

**Interfaces:**
- Produces : tables `familles`, `famille_membres` (`UNIQUE(profile_id)`), `famille_restos` ; fonctions `is_famille_owner(uuid)`, `can_access_famille(uuid)`, RPC `inviter_famille(uuid, text) returns text` (`'ok'|'not_found'|'self'|'deja_famille'`), `quitter_famille() returns void`, `retirer_membre_famille(uuid, uuid) returns void` ; triggers `owner_id` immuable + auto-insert owner.

- [ ] **Step 1: Écrire la migration**

Create `supabase/migrations/00013_famille.sql` :

```sql
create table public.familles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  nom text not null check (char_length(nom) between 1 and 120),
  created_at timestamptz not null default now()
);

create table public.famille_membres (
  famille_id uuid not null references public.familles (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'membre' check (role in ('owner', 'membre')),
  added_at timestamptz not null default now(),
  primary key (famille_id, profile_id),
  unique (profile_id)
);

create table public.famille_restos (
  famille_id uuid not null references public.familles (id) on delete cascade,
  etablissement_id uuid not null references public.etablissements (id) on delete cascade,
  added_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (famille_id, etablissement_id)
);

create index familles_owner_idx on public.familles (owner_id);
create index famille_restos_famille_idx on public.famille_restos (famille_id);

-- Helpers security definer (anti-récursion RLS)
create function public.is_famille_owner(f_id uuid) returns boolean
  language sql security definer set search_path = '' stable as $$
  select exists (select 1 from public.familles where id = f_id and owner_id = auth.uid());
$$;

create function public.can_access_famille(f_id uuid) returns boolean
  language sql security definer set search_path = '' stable as $$
  select exists (select 1 from public.familles where id = f_id and owner_id = auth.uid())
      or exists (select 1 from public.famille_membres where famille_id = f_id and profile_id = auth.uid());
$$;

-- Trigger : owner_id immuable
create function public.familles_lock_owner() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  if new.owner_id <> old.owner_id then raise exception 'owner_id immuable'; end if;
  return new;
end;
$$;
create trigger familles_owner_immutable before update on public.familles
  for each row execute function public.familles_lock_owner();

-- Trigger : auto-insertion du owner dans famille_membres (échoue si déjà dans une famille -> UNIQUE)
create function public.add_famille_owner_membre() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  insert into public.famille_membres (famille_id, profile_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;
create trigger on_famille_created after insert on public.familles
  for each row execute function public.add_famille_owner_membre();

-- RLS familles
alter table public.familles enable row level security;
create policy "familles_select" on public.familles for select using (public.can_access_famille(id));
create policy "familles_insert" on public.familles for insert with check (owner_id = auth.uid());
create policy "familles_update" on public.familles for update using (public.can_access_famille(id)) with check (public.can_access_famille(id));
create policy "familles_delete" on public.familles for delete using (public.is_famille_owner(id));

-- RLS famille_membres (lecture = membres ; écriture owner ; owner non retirable)
alter table public.famille_membres enable row level security;
create policy "famille_membres_select" on public.famille_membres for select using (public.can_access_famille(famille_id));
create policy "famille_membres_insert" on public.famille_membres for insert with check (public.is_famille_owner(famille_id));
create policy "famille_membres_delete" on public.famille_membres for delete using (public.is_famille_owner(famille_id) and role <> 'owner');

-- RLS famille_restos (collaboratif)
alter table public.famille_restos enable row level security;
create policy "famille_restos_all" on public.famille_restos for all
  using (public.can_access_famille(famille_id)) with check (public.can_access_famille(famille_id));

-- Grants explicites
grant select, insert, update, delete on public.familles to authenticated;
grant select, insert, update, delete on public.famille_membres to authenticated;
grant select, insert, update, delete on public.famille_restos to authenticated;

-- RPC invitation (owner-only, sans énumération, gère l'unicité de foyer)
create function public.inviter_famille(p_famille_id uuid, p_email text) returns text
  language plpgsql security definer set search_path = '' as $$
declare v_uid uuid;
begin
  if auth.uid() is null then raise exception 'authentification requise'; end if;
  if not public.is_famille_owner(p_famille_id) then raise exception 'non autorisé'; end if;
  select id into v_uid from auth.users where lower(email) = lower(p_email);
  if v_uid is null then return 'not_found'; end if;
  if v_uid = auth.uid() then return 'self'; end if;
  begin
    insert into public.famille_membres (famille_id, profile_id, role) values (p_famille_id, v_uid, 'membre');
  exception when unique_violation then
    return 'deja_famille';
  end;
  return 'ok';
end;
$$;

create function public.quitter_famille() returns void
  language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'authentification requise'; end if;
  delete from public.famille_membres where profile_id = auth.uid() and role <> 'owner';
end;
$$;

create function public.retirer_membre_famille(p_famille_id uuid, p_profile_id uuid) returns void
  language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'authentification requise'; end if;
  if not public.is_famille_owner(p_famille_id) then raise exception 'non autorisé'; end if;
  delete from public.famille_membres where famille_id = p_famille_id and profile_id = p_profile_id and role <> 'owner';
end;
$$;

revoke execute on function public.inviter_famille(uuid, text) from anon, public;
grant execute on function public.inviter_famille(uuid, text) to authenticated;
revoke execute on function public.quitter_famille() from anon, public;
grant execute on function public.quitter_famille() to authenticated;
revoke execute on function public.retirer_membre_famille(uuid, uuid) from anon, public;
grant execute on function public.retirer_membre_famille(uuid, uuid) to authenticated;
revoke execute on function public.is_famille_owner(uuid) from anon, public;
revoke execute on function public.can_access_famille(uuid) from anon, public;
grant execute on function public.is_famille_owner(uuid) to authenticated;
grant execute on function public.can_access_famille(uuid) to authenticated;
```

- [ ] **Step 2: Appliquer**

Run: `supabase db reset`
Expected: applique 00001→00013 + seed sans erreur.

- [ ] **Step 3: Vérifier structure + comportement (owner trigger + unicité foyer)**

Run:
```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" <<'SQL'
select count(*) as tables from pg_tables where schemaname='public' and tablename in ('familles','famille_membres','famille_restos');
select count(*) as policies from pg_policies where tablename in ('familles','famille_membres','famille_restos');
do $$
declare f1 uuid;
begin
  -- admin (33333) crée une famille -> trigger insère la ligne owner
  insert into public.familles (owner_id, nom) values ('33333333-3333-3333-3333-333333333333','F1') returning id into f1;
  if (select role from public.famille_membres where famille_id=f1 and profile_id='33333333-3333-3333-3333-333333333333') <> 'owner' then
    raise exception 'FAIL: owner membre non créé';
  end if;
  -- une 2e famille pour admin doit échouer (UNIQUE profile_id via le trigger owner)
  begin
    insert into public.familles (owner_id, nom) values ('33333333-3333-3333-3333-333333333333','F2');
    raise exception 'FAIL: 2e famille acceptée (unicité foyer non respectée)';
  exception when unique_violation then null;
  end;
  delete from public.familles where id=f1;
  raise notice 'OK: owner trigger + unicité foyer conformes';
end $$;
SQL
```
Expected: `tables = 3` ; `policies = 8` ; `NOTICE: OK: owner trigger + unicité foyer conformes` et aucune ERROR.
(Si `psql` absent du PATH : `docker exec -i supabase_db_Vito psql -U postgres -d postgres`.)

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/00013_famille.sql
git commit -m "feat(famille): migration 00013 (familles, membres unique-foyer, restos, RLS, RPC)"
```

---

### Task 2: Domain (schémas) + Data (actions + queries)

**Files:**
- Create: `src/features/famille/domain/schemas.ts` + `schemas.test.ts`
- Create: `src/features/famille/data/queries.ts`
- Create: `src/features/famille/data/actions.ts`

**Interfaces:**
- Consumes: `createServerSupabase` ; `getPlacesProvider` ; `mapPlaceToEtablissement` de `@/features/restos/domain/mapPlaceToEtablissement` ; `upsert_etablissement` RPC ; `revalidatePath`.
- Produces:
  - `familleInputSchema` → `{ nom: string }` ; `inviteSchema` → `{ email: string }`.
  - `getMaFamille()` → `{ famille: { id; nom; owner_id }, membres: { profile_id; role; display_name: string|null }[], isOwner } | null`.
  - `getFamilleRestos(familleId)` → restos partagés (jointure établissement).
  - actions `(_prev, formData) → { ok } | { error }` : `creerFamille`, `inviterMembre`, `retirerMembre`, `quitterFamille`, `supprimerFamille`, `ajouterRestoFiche`, `ajouterRestoRecherche`, `retirerResto` ; `chercherEtablissements(query) → PlaceSummary[]`.

- [ ] **Step 1: Écrire les tests des schémas (échec attendu)**

Create `src/features/famille/domain/schemas.test.ts` :
```ts
import { describe, it, expect } from "vitest";
import { familleInputSchema, inviteSchema } from "./schemas";

describe("familleInputSchema", () => {
  it("nom requis, 1..120", () => {
    expect(familleInputSchema.safeParse({ nom: "Famille Martin" }).success).toBe(true);
    expect(familleInputSchema.safeParse({ nom: "" }).success).toBe(false);
    expect(familleInputSchema.safeParse({ nom: "x".repeat(121) }).success).toBe(false);
  });
});

describe("inviteSchema", () => {
  it("email valide requis", () => {
    expect(inviteSchema.safeParse({ email: "a@b.fr" }).success).toBe(true);
    expect(inviteSchema.safeParse({ email: "nope" }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Lancer (échec)**

Run: `npx vitest run src/features/famille/domain/schemas.test.ts`
Expected: FAIL (module introuvable).

- [ ] **Step 3: Implémenter schemas.ts**

Create `src/features/famille/domain/schemas.ts` :
```ts
import { z } from "zod";

export const familleInputSchema = z.object({ nom: z.string().min(1).max(120) });
export type FamilleInput = z.infer<typeof familleInputSchema>;

export const inviteSchema = z.object({ email: z.string().email() });
export type InviteInput = z.infer<typeof inviteSchema>;
```

- [ ] **Step 4: Lancer (succès)**

Run: `npx vitest run src/features/famille/domain/schemas.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Implémenter queries.ts**

Create `src/features/famille/data/queries.ts` :
```ts
import { createServerSupabase } from "@/lib/supabase/server";

export async function getMaFamille() {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id ?? null;
  if (!uid) return null;
  // RLS (can_access_famille) : l'utilisateur a 0 ou 1 famille (unicité foyer).
  const { data: fam, error } = await supabase.from("familles").select("id, nom, owner_id").maybeSingle();
  if (error) throw error;
  if (!fam) return null;
  const { data: mems, error: mErr } = await supabase
    .from("famille_membres")
    .select("profile_id, role, profile:profiles(display_name)")
    .eq("famille_id", fam.id);
  if (mErr) throw mErr;
  const membres = (mems ?? []).map((m) => {
    const p = Array.isArray(m.profile) ? m.profile[0] : m.profile;
    return { profile_id: m.profile_id, role: m.role, display_name: p?.display_name ?? null };
  });
  return { famille: fam, membres, isOwner: fam.owner_id === uid };
}

export async function getFamilleRestos(familleId: string) {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("famille_restos")
    .select("etablissement_id, created_at, etablissement:etablissements(nom, ville)")
    .eq("famille_id", familleId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
```

- [ ] **Step 6: Implémenter actions.ts**

Create `src/features/famille/data/actions.ts` :
```ts
"use server";
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { getPlacesProvider } from "@/lib/services/places";
import { mapPlaceToEtablissement } from "@/features/restos/domain/mapPlaceToEtablissement";
import { familleInputSchema, inviteSchema } from "../domain/schemas";

async function userId(supabase: Awaited<ReturnType<typeof createServerSupabase>>) {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

// id de la famille de l'utilisateur (possédée ou rejointe), ou null
async function maFamilleId(supabase: Awaited<ReturnType<typeof createServerSupabase>>) {
  const { data } = await supabase.from("familles").select("id, owner_id").maybeSingle();
  return data ?? null;
}

export async function creerFamille(_prev: unknown, formData: FormData) {
  const parsed = familleInputSchema.safeParse({ nom: formData.get("nom") });
  if (!parsed.success) return { error: "Nom invalide" };
  const supabase = await createServerSupabase();
  const uid = await userId(supabase);
  if (!uid) return { error: "Non authentifié" };
  const { error } = await supabase.from("familles").insert({ owner_id: uid, nom: parsed.data.nom });
  if (error) {
    // le trigger owner-membre viole UNIQUE(profile_id) si déjà dans une famille
    if (error.code === "23505" || error.message?.includes("unique")) return { error: "Vous êtes déjà dans une famille" };
    return { error: "Création échouée" };
  }
  revalidatePath("/famille");
  return { ok: true as const };
}

export async function inviterMembre(_prev: unknown, formData: FormData) {
  const parsed = inviteSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: "E-mail invalide" };
  const supabase = await createServerSupabase();
  if (!(await userId(supabase))) return { error: "Non authentifié" };
  const fam = await maFamilleId(supabase);
  if (!fam) return { error: "Aucune famille" };
  const { data, error } = await supabase.rpc("inviter_famille", { p_famille_id: fam.id, p_email: parsed.data.email });
  if (error) return { error: "Invitation échouée" };
  if (data === "not_found") return { error: "Aucun utilisateur avec cet e-mail" };
  if (data === "self") return { error: "Vous êtes déjà membre" };
  if (data === "deja_famille") return { error: "Cette personne est déjà dans une famille" };
  revalidatePath("/famille");
  return { ok: true as const };
}

export async function retirerMembre(_prev: unknown, formData: FormData) {
  const profileId = formData.get("profileId");
  if (typeof profileId !== "string") return { error: "Entrée invalide" };
  const supabase = await createServerSupabase();
  if (!(await userId(supabase))) return { error: "Non authentifié" };
  const fam = await maFamilleId(supabase);
  if (!fam) return { error: "Aucune famille" };
  const { error } = await supabase.rpc("retirer_membre_famille", { p_famille_id: fam.id, p_profile_id: profileId });
  if (error) return { error: "Retrait échoué" };
  revalidatePath("/famille");
  return { ok: true as const };
}

export async function quitterFamille(_prev: unknown, _formData: FormData) {
  const supabase = await createServerSupabase();
  if (!(await userId(supabase))) return { error: "Non authentifié" };
  const { error } = await supabase.rpc("quitter_famille");
  if (error) return { error: "Impossible de quitter" };
  revalidatePath("/famille");
  return { ok: true as const };
}

export async function supprimerFamille(_prev: unknown, _formData: FormData) {
  const supabase = await createServerSupabase();
  const uid = await userId(supabase);
  if (!uid) return { error: "Non authentifié" };
  const fam = await maFamilleId(supabase);
  if (!fam) return { error: "Aucune famille" };
  // RLS delete = owner-only ; .select() détecte 0 ligne (non owner)
  const { data, error } = await supabase.from("familles").delete().eq("id", fam.id).select("id").maybeSingle();
  if (error) return { error: "Suppression échouée" };
  if (!data) return { error: "Suppression non autorisée" };
  revalidatePath("/famille");
  return { ok: true as const };
}

export async function ajouterRestoFiche(_prev: unknown, formData: FormData) {
  const etablissementId = formData.get("etablissementId");
  if (typeof etablissementId !== "string") return { error: "Entrée invalide" };
  const supabase = await createServerSupabase();
  const uid = await userId(supabase);
  if (!uid) return { error: "Non authentifié" };
  const fam = await maFamilleId(supabase);
  if (!fam) return { error: "Aucune famille" };
  const { error } = await supabase.from("famille_restos").upsert(
    { famille_id: fam.id, etablissement_id: etablissementId, added_by: uid },
    { onConflict: "famille_id,etablissement_id" },
  );
  if (error) return { error: "Ajout échoué" };
  revalidatePath("/famille");
  return { ok: true as const };
}

export async function ajouterRestoRecherche(_prev: unknown, formData: FormData) {
  const placeId = formData.get("placeId");
  if (typeof placeId !== "string" || !placeId) return { error: "Place invalide" };
  const supabase = await createServerSupabase();
  const uid = await userId(supabase);
  if (!uid) return { error: "Non authentifié" };
  const fam = await maFamilleId(supabase);
  if (!fam) return { error: "Aucune famille" };
  const place = await getPlacesProvider().details(placeId);
  if (!place) return { error: "Établissement introuvable" };
  const input = mapPlaceToEtablissement(place);
  const { data: etabId, error: rpcErr } = await supabase.rpc("upsert_etablissement", { p: { ...input, enriched_at: new Date().toISOString() } });
  if (rpcErr || !etabId) return { error: "Enregistrement échoué" };
  const { error } = await supabase.from("famille_restos").upsert(
    { famille_id: fam.id, etablissement_id: etabId, added_by: uid },
    { onConflict: "famille_id,etablissement_id" },
  );
  if (error) return { error: "Ajout échoué" };
  revalidatePath("/famille");
  return { ok: true as const };
}

export async function retirerResto(_prev: unknown, formData: FormData) {
  const etablissementId = formData.get("etablissementId");
  if (typeof etablissementId !== "string") return { error: "Entrée invalide" };
  const supabase = await createServerSupabase();
  if (!(await userId(supabase))) return { error: "Non authentifié" };
  const fam = await maFamilleId(supabase);
  if (!fam) return { error: "Aucune famille" };
  const { error } = await supabase.from("famille_restos").delete().eq("famille_id", fam.id).eq("etablissement_id", etablissementId);
  if (error) return { error: "Retrait échoué" };
  revalidatePath("/famille");
  return { ok: true as const };
}

export async function chercherEtablissements(query: string) {
  if (!query.trim()) return [];
  const supabase = await createServerSupabase();
  if (!(await userId(supabase))) return [];
  return getPlacesProvider().search(query);
}
```

- [ ] **Step 7: Vérifier typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS. *(Comportement runtime couvert par les e2e en Task 4.)*

- [ ] **Step 8: Commit**

```bash
git add src/features/famille/domain src/features/famille/data
git commit -m "feat(famille): schémas + data (créer/inviter/quitter/restos) + queries"
```

---

### Task 3: UI (page /famille + composants) + i18n + bouton fiche

**Files:**
- Modify: `messages/fr.json` (namespace `famille`)
- Create: `src/features/famille/ui/FamilleForm.tsx`
- Create: `src/features/famille/ui/InviteForm.tsx`
- Create: `src/features/famille/ui/MembresList.tsx`
- Create: `src/features/famille/ui/FamilleRestos.tsx`
- Create: `src/features/famille/ui/AjouterFamilleButton.tsx`
- Create: `src/app/[locale]/(app)/famille/page.tsx`
- Create: `src/app/[locale]/(app)/famille/error.tsx`
- Modify: `src/features/restos/ui/FicheResto.tsx` (bouton « Ajouter à ma famille »)

**Interfaces:**
- Consumes: actions/queries (Task 2) ; `getMaFamille`/`getFamilleRestos` ; `Link` de `@/lib/i18n/routing`.
- Produces : page `/famille`. `data-testid` : `famille-form`, `invite-form`, `membre-row`, `famille-resto-row`, `resto-search`, `ajouter-famille`.

- [ ] **Step 1: i18n**

Modify `messages/fr.json` — ajouter au niveau racine (après le bloc `"conciergerie": { ... }`, virgule de séparation) :
```json
  "famille": {
    "title": "Ma famille",
    "creer": "Créer une famille",
    "nom": "Nom de la famille",
    "membres": "Membres",
    "roleOwner": "propriétaire",
    "inviter": "Inviter",
    "inviteEmail": "E-mail de la personne",
    "quitter": "Quitter la famille",
    "retirer": "Retirer",
    "supprimer": "Supprimer la famille",
    "restos": "Restos du foyer",
    "rechercher": "Rechercher un resto",
    "rechercherBtn": "Rechercher",
    "ajouter": "Ajouter",
    "retirerResto": "Retirer",
    "ajouterFamille": "Ajouter à ma famille",
    "vide": "Aucun resto partagé pour l'instant.",
    "pasDeFamille": "Vous n'avez pas encore de famille.",
    "error": { "title": "Une erreur est survenue", "retry": "Réessayer" }
  }
```

- [ ] **Step 2: FamilleForm.tsx + InviteForm.tsx**

Create `src/features/famille/ui/FamilleForm.tsx` :
```tsx
"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { creerFamille } from "../data/actions";

export function FamilleForm() {
  const t = useTranslations("famille");
  const [state, action, pending] = useActionState(creerFamille, undefined);
  return (
    <form action={action} data-testid="famille-form" className="flex flex-col gap-2 max-w-md">
      <p>{t("pasDeFamille")}</p>
      <input name="nom" required placeholder={t("nom")} className="border p-2" />
      {state && "error" in state && state.error && <p role="alert" className="text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending} className="bg-black text-white p-2">{t("creer")}</button>
    </form>
  );
}
```

Create `src/features/famille/ui/InviteForm.tsx` :
```tsx
"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { inviterMembre } from "../data/actions";

export function InviteForm() {
  const t = useTranslations("famille");
  const [state, action, pending] = useActionState(inviterMembre, undefined);
  return (
    <form action={action} data-testid="invite-form" className="flex gap-2 items-center">
      <input name="email" type="email" required placeholder={t("inviteEmail")} className="border p-2 flex-1" />
      <button type="submit" disabled={pending} className="bg-black text-white p-2">{t("inviter")}</button>
      {state && "error" in state && state.error && <p role="alert" className="text-red-600">{state.error}</p>}
    </form>
  );
}
```

- [ ] **Step 3: MembresList.tsx**

Create `src/features/famille/ui/MembresList.tsx` :
```tsx
"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { retirerMembre, quitterFamille } from "../data/actions";

type Membre = { profile_id: string; role: string; display_name: string | null };

export function MembresList({ membres, isOwner, currentProfileId }: { membres: Membre[]; isOwner: boolean; currentProfileId: string }) {
  const t = useTranslations("famille");
  const [, retirer] = useActionState(retirerMembre, undefined);
  const [, quitter] = useActionState(quitterFamille, undefined);
  return (
    <ul className="flex flex-col gap-1">
      {membres.map((m) => (
        <li key={m.profile_id} data-testid="membre-row" className="flex items-center gap-2">
          <span>{m.display_name ?? m.profile_id} {m.role === "owner" ? `(${t("roleOwner")})` : ""}</span>
          {isOwner && m.role !== "owner" && (
            <form action={retirer}>
              <input type="hidden" name="profileId" value={m.profile_id} />
              <button type="submit" className="underline text-sm">{t("retirer")}</button>
            </form>
          )}
          {/* quitter : uniquement sur sa propre ligne (quitter_famille agit sur auth.uid) */}
          {!isOwner && m.role !== "owner" && m.profile_id === currentProfileId && (
            <form action={quitter}>
              <button type="submit" className="underline text-sm">{t("quitter")}</button>
            </form>
          )}
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 4: FamilleRestos.tsx + AjouterFamilleButton.tsx**

Create `src/features/famille/ui/FamilleRestos.tsx` :
```tsx
"use client";
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { retirerResto, ajouterRestoRecherche, chercherEtablissements } from "../data/actions";

type Etab = { nom: string; ville: string | null } | { nom: string; ville: string | null }[] | null;
type Resto = { etablissement_id: string; etablissement: Etab };
type Hit = { placeId: string; nom: string; adresse: string | null };

function nom(e: Etab): string {
  const x = Array.isArray(e) ? e[0] : e;
  return x?.nom ?? "";
}

export function FamilleRestos({ restos }: { restos: Resto[] }) {
  const t = useTranslations("famille");
  const [, retirer] = useActionState(retirerResto, undefined);
  const [, ajouter] = useActionState(ajouterRestoRecherche, undefined);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [selected, setSelected] = useState<Hit | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-1">
        {restos.length === 0 && <li>{t("vide")}</li>}
        {restos.map((r) => (
          <li key={r.etablissement_id} data-testid="famille-resto-row" className="flex items-center gap-2 border-b py-1">
            <span className="flex-1">{nom(r.etablissement)}</span>
            <form action={retirer}>
              <input type="hidden" name="etablissementId" value={r.etablissement_id} />
              <button type="submit" className="underline text-sm">{t("retirerResto")}</button>
            </form>
          </li>
        ))}
      </ul>
      <form action={ajouter} data-testid="resto-search" className="flex flex-col gap-1">
        <div className="flex gap-2">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("rechercher")} className="border p-2 flex-1" />
          <button type="button" onClick={async () => setHits(await chercherEtablissements(query))} className="border p-2">{t("rechercherBtn")}</button>
        </div>
        <ul className="flex flex-col gap-1">
          {hits.map((h) => (
            <li key={h.placeId}><button type="button" onClick={() => setSelected(h)} className="underline text-left">{h.nom}</button></li>
          ))}
        </ul>
        {selected && <input type="hidden" name="placeId" value={selected.placeId} />}
        <button type="submit" disabled={!selected} className="bg-black text-white p-2">{t("ajouter")}{selected ? ` : ${selected.nom}` : ""}</button>
      </form>
    </div>
  );
}
```

Create `src/features/famille/ui/AjouterFamilleButton.tsx` :
```tsx
"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { ajouterRestoFiche } from "../data/actions";

export function AjouterFamilleButton({ etablissementId }: { etablissementId: string }) {
  const t = useTranslations("famille");
  const [state, action, pending] = useActionState(ajouterRestoFiche, undefined);
  return (
    <form action={action}>
      <input type="hidden" name="etablissementId" value={etablissementId} />
      <button type="submit" disabled={pending} data-testid="ajouter-famille" className="underline">{t("ajouterFamille")}</button>
      {state && "error" in state && state.error && <p role="alert" className="text-red-600">{state.error}</p>}
    </form>
  );
}
```

- [ ] **Step 5: Page + error**

Create `src/app/[locale]/(app)/famille/page.tsx` :
```tsx
import { getTranslations } from "next-intl/server";
import { getMaFamille, getFamilleRestos } from "@/features/famille/data/queries";
import { FamilleForm } from "@/features/famille/ui/FamilleForm";
import { InviteForm } from "@/features/famille/ui/InviteForm";
import { MembresList } from "@/features/famille/ui/MembresList";
import { FamilleRestos } from "@/features/famille/ui/FamilleRestos";
import { createServerSupabase } from "@/lib/supabase/server";

export default async function FamillePage() {
  const t = await getTranslations("famille");
  const ma = await getMaFamille();
  if (!ma) {
    return <main className="p-6 flex flex-col gap-6"><h1 className="text-2xl font-bold">{t("title")}</h1><FamilleForm /></main>;
  }
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  const currentProfileId = auth.user?.id ?? "";
  const restos = await getFamilleRestos(ma.famille.id);
  return (
    <main className="p-6 flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{ma.famille.nom}</h1>
      <section>
        <h2 className="font-semibold">{t("membres")}</h2>
        <MembresList membres={ma.membres} isOwner={ma.isOwner} currentProfileId={currentProfileId} />
        {ma.isOwner && <InviteForm />}
      </section>
      <section>
        <h2 className="font-semibold">{t("restos")}</h2>
        <FamilleRestos restos={restos} />
      </section>
    </main>
  );
}
```

Create `src/app/[locale]/(app)/famille/error.tsx` :
```tsx
"use client";
import { useTranslations } from "next-intl";
export default function FamilleError({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations("famille.error");
  return (
    <main className="p-6">
      <p role="alert">{t("title")}</p>
      <button onClick={reset} className="underline">{t("retry")}</button>
    </main>
  );
}
```

Note : adapter `MembresList` pour accepter `currentProfileId: string` (cf. note Step 3) — signature `{ membres, isOwner, currentProfileId }` et condition du bouton quitter `!isOwner && m.role !== "owner" && m.profile_id === currentProfileId`.

- [ ] **Step 6: Bouton « Ajouter à ma famille » sur la fiche resto**

Modify `src/features/restos/ui/FicheResto.tsx` :
(a) ajouter les imports en tête :
```tsx
import { getMaFamille } from "@/features/famille/data/queries";
import { AjouterFamilleButton } from "@/features/famille/ui/AjouterFamilleButton";
```
(b) après la lecture `const isPremium = await getIsPremium();` (ajoutée en 6b), ajouter :
```tsx
  const maFamille = await getMaFamille();
```
(c) insérer une `<section>` juste avant la fermeture `</article>` (après la section conciergerie). Le bouton porte déjà son libellé i18n (`AjouterFamilleButton` utilise `t("ajouterFamille")`), donc pas de `<h2>` :
```tsx
      {maFamille && (
        <section>
          <AjouterFamilleButton etablissementId={etab.id} />
        </section>
      )}
```

- [ ] **Step 7: Vérifier build (typecheck + lint + unit)**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS (typecheck/lint sans erreur ; tous les tests unitaires verts).

- [ ] **Step 8: Commit**

```bash
git add messages/fr.json src/features/famille/ui src/app/\[locale\]/\(app\)/famille src/features/restos/ui/FicheResto.tsx
git commit -m "feat(famille): UI (page foyer, membres, restos partagés) + bouton fiche + i18n"
```

---

### Task 4: Seed (comptes dédiés) + e2e

**Files:**
- Modify: `supabase/seed.sql` (2 comptes dédiés famille ; aucune famille pré-créée)
- Create: `e2e/famille.spec.ts`

**Interfaces:**
- Consumes : `/fr/famille`, `/fr/restos/[id]`, `data-testid` de Task 3. Comptes dédiés : `famille1@vito.test` (id `77777777-7777-4777-8777-777777777777`), `famille2@vito.test` (id `88888888-8888-4888-8888-888888888888`). Mot de passe `password123`.

- [ ] **Step 1: Seed — 2 comptes dédiés (aucune famille pré-créée)**

Modify `supabase/seed.sql` — ajouter à la fin :
```sql
-- Comptes dédiés au Chantier 7a (famille). Aucune famille pré-créée (l'e2e les crée).
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, reauthentication_token, phone_change, phone_change_token)
values
  ('77777777-7777-4777-8777-777777777777', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'famille1@vito.test',
   crypt('password123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"display_name":"Famille Un","role":"client"}', now(), now(),
   '', '', '', '', '', '', '', ''),
  ('88888888-8888-4888-8888-888888888888', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'famille2@vito.test',
   crypt('password123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"display_name":"Famille Deux","role":"client"}', now(), now(),
   '', '', '', '', '', '', '', '');

insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at)
values
  (gen_random_uuid(), '77777777-7777-4777-8777-777777777777', '77777777-7777-4777-8777-777777777777',
   '{"sub":"77777777-7777-4777-8777-777777777777","email":"famille1@vito.test"}', 'email', now(), now()),
  (gen_random_uuid(), '88888888-8888-4888-8888-888888888888', '88888888-8888-4888-8888-888888888888',
   '{"sub":"88888888-8888-4888-8888-888888888888","email":"famille2@vito.test"}', 'email', now(), now());
```

- [ ] **Step 2: Appliquer**

Run: `supabase db reset`
Expected: applique migrations + seed sans erreur.

- [ ] **Step 3: Écrire l'e2e (un seul test, 2 contextes, isolé)**

Create `e2e/famille.spec.ts` :
```ts
import { test, expect, type Page } from "@playwright/test";

const BISTROT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

async function login(page: Page, email: string) {
  await page.goto("/fr/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill("password123");
  await page.getByRole("button", { name: "Connexion" }).click();
  await expect(page).toHaveURL(/\/fr\/restos/);
}

test("créer un foyer, inviter, partager un resto, vu par l'invité, et refus déjà-famille", async ({ browser }) => {
  // Contexte A : famille1 crée le foyer
  const ctxA = await browser.newContext();
  const pageA = await ctxA.newPage();
  await login(pageA, "famille1@vito.test");
  await pageA.goto("/fr/famille");
  await pageA.getByTestId("famille-form").locator('input[name="nom"]').fill("Foyer Démo");
  await pageA.getByTestId("famille-form").getByRole("button").click();
  await expect(pageA.getByRole("heading", { name: "Foyer Démo" })).toBeVisible();

  // A ajoute un resto via une fiche (resto seed pré-sélectionné)
  await pageA.goto(`/fr/restos/${BISTROT}`);
  await pageA.getByTestId("ajouter-famille").click();
  await expect(pageA.getByTestId("ajouter-famille")).toBeEnabled({ timeout: 10000 });

  // A invite famille2
  await pageA.goto("/fr/famille");
  await pageA.getByTestId("invite-form").locator('input[name="email"]').fill("famille2@vito.test");
  await pageA.getByTestId("invite-form").getByRole("button").click();
  await expect(pageA.getByTestId("membre-row")).toHaveCount(2);

  // Contexte B : famille2 voit le foyer + le resto partagé
  const ctxB = await browser.newContext();
  const pageB = await ctxB.newPage();
  await login(pageB, "famille2@vito.test");
  await pageB.goto("/fr/famille");
  await expect(pageB.getByRole("heading", { name: "Foyer Démo" })).toBeVisible();
  await expect(pageB.getByTestId("famille-resto-row")).toHaveCount(1);

  // A ré-invite famille2 (déjà membre) -> message « déjà dans une famille »
  await pageA.getByTestId("invite-form").locator('input[name="email"]').fill("famille2@vito.test");
  await pageA.getByTestId("invite-form").getByRole("button").click();
  await expect(pageA.getByTestId("invite-form").getByRole("alert")).toContainText("déjà");

  await ctxA.close();
  await ctxB.close();
});
```

- [ ] **Step 4: Lancer l'e2e famille**

Run: `npx playwright test e2e/famille.spec.ts --retries=0`
Expected: PASS (1 test).

- [ ] **Step 5: Suite complète (non-régression)**

Run: `npx playwright test --retries=0`
Expected: PASS (toute la suite + famille).

- [ ] **Step 6: Commit**

```bash
git add supabase/seed.sql e2e/famille.spec.ts
git commit -m "test(famille): comptes dédiés + e2e (foyer, invitation, resto partagé, déjà-famille)"
```

---

## Notes d'exécution

- **Ordre** : 1 (DB) → 2 (domain+data) → 3 (UI) → 4 (seed + e2e). Task 3 dépend de 2 ; Task 4 de tout.
- **Pas de `db push` prod** pendant l'implémentation (prod migrée à la clôture, comme C1–6b).
- **Signaux e2e déterministes** : attendre l'apparition des éléments (`membre-row`, `famille-resto-row`, l'`alert`) ou le ré-enable du bouton ; jamais `networkidle`.
- **Comptes e2e dédiés** (`famille1`/`famille2`) : la contrainte « une famille par utilisateur » interdit de réutiliser `client`/`agence` (qu'un autre test pourrait placer dans une famille). `db reset` AVANT la suite e2e complète (un seul reset).
- **`mapPlaceToEtablissement`** : appelé sans 2ᵉ argument → catégorie `resto` par défaut (le resto ajouté au foyer est bien un resto).
