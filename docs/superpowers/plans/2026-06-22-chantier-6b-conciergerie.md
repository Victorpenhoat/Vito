# Conciergerie (demandes de réservation) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Service premium de conciergerie : un client premium soumet une demande de réservation structurée (resto/hôtel) que le staff (agence/admin) traite (statut + réponse).

**Architecture:** `features/conciergerie/{domain,data,ui}`. Demandes dans une table type-discriminée `conciergerie_demandes` ; gating premium **enforced en RLS** (`with check is_premium(auth.uid())`), staff via `is_concierge()` (claim JWT). Resto pré-sélectionné depuis sa fiche ; hôtel recherché via l'abstraction Places (mock étendu) puis `upsert_etablissement`. Logique pure testée (calcul de durée, schémas Zod).

**Tech Stack:** Next.js 16 (App Router, Server Actions), TypeScript strict, Supabase (Postgres + RLS), Zod, next-intl, Vitest, Playwright.

## Global Constraints

- Next.js 16 non-standard : consulter `node_modules/next/dist/docs/` avant une API Next inconnue.
- TypeScript strict avec `noUncheckedIndexedAccess`.
- RLS **et** grants explicites à `authenticated` sur chaque table.
- **Gating premium infalsifiable** : policy `insert` avec `with check (user_id = auth.uid() and public.is_premium(auth.uid()))`. Le check côté action n'est que pour l'UX.
- **Staff = `agence`/`admin`** via `is_concierge()` (lit `auth.jwt() ->> 'user_role'`). Statut/réponse modifiables par le staff uniquement.
- `user_id`/`repondu_par` dérivés de la session, jamais du client.
- Helpers `security definer set search_path = ''`. Migration suivante = `00012_conciergerie.sql`.
- Feature `src/features/conciergerie/`, route `/conciergerie`, namespace i18n `conciergerie.*`. Aucune chaîne UI en dur. UUID seed = v4 valides.
- Réutilise `is_premium` (00011), `upsert_etablissement` (00003), l'abstraction Places, `getIsPremium` (6a), `getSessionRole` (RBAC).

---

### Task 1: Migration `00012_conciergerie.sql`

**Files:**
- Create: `supabase/migrations/00012_conciergerie.sql`

**Interfaces:**
- Produces : enums `conciergerie_type`/`conciergerie_statut` ; table `public.conciergerie_demandes` ; fonction `public.is_concierge() returns boolean` ; RLS (select own/staff, insert premium+own, update staff, delete own/staff) + grants.

- [ ] **Step 1: Écrire la migration**

Create `supabase/migrations/00012_conciergerie.sql` :

```sql
create type public.conciergerie_type as enum ('resto', 'hotel');
create type public.conciergerie_statut as enum ('nouvelle', 'en_cours', 'confirmee', 'refusee');

create table public.conciergerie_demandes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type public.conciergerie_type not null,
  etablissement_id uuid not null references public.etablissements (id) on delete restrict,
  statut public.conciergerie_statut not null default 'nouvelle',
  avec_enfants boolean not null default false,
  nb_enfants integer not null default 0 check (nb_enfants >= 0),
  commentaire text check (commentaire is null or char_length(commentaire) <= 2000),
  date_resa date,
  heure_resa time,
  nombre_convives integer check (nombre_convives is null or nombre_convives > 0),
  chaise_haute boolean,
  occasion text check (occasion is null or occasion in ('amis','famille','anniversaire','autre')),
  date_debut date,
  nombre_nuits integer check (nombre_nuits is null or nombre_nuits > 0),
  sejour_type text check (sejour_type is null or sejour_type in ('loisirs','pro')),
  enfants_ages integer[],
  reponse text check (reponse is null or char_length(reponse) <= 2000),
  repondu_par uuid references public.profiles (id) on delete set null,
  repondu_le timestamptz,
  created_at timestamptz not null default now(),
  check (type <> 'resto' or (date_resa is not null and heure_resa is not null and nombre_convives is not null)),
  check (type <> 'hotel' or (date_debut is not null and nombre_nuits is not null))
);

create index conciergerie_demandes_user_idx on public.conciergerie_demandes (user_id);
create index conciergerie_demandes_statut_idx on public.conciergerie_demandes (statut);

-- Staff concierge (agence/admin) via claim JWT
create function public.is_concierge() returns boolean
  language sql security definer set search_path = '' stable as $$
  select coalesce(auth.jwt() ->> 'user_role', '') in ('agence', 'admin');
$$;

alter table public.conciergerie_demandes enable row level security;

create policy "conciergerie_select" on public.conciergerie_demandes for select
  using (user_id = auth.uid() or public.is_concierge());

create policy "conciergerie_insert" on public.conciergerie_demandes for insert
  with check (user_id = auth.uid() and public.is_premium(auth.uid()));

create policy "conciergerie_update" on public.conciergerie_demandes for update
  using (public.is_concierge()) with check (public.is_concierge());

create policy "conciergerie_delete" on public.conciergerie_demandes for delete
  using (user_id = auth.uid() or public.is_concierge());

grant select, insert, update, delete on public.conciergerie_demandes to authenticated;

revoke execute on function public.is_concierge() from anon, public;
grant execute on function public.is_concierge() to authenticated;
```

- [ ] **Step 2: Appliquer**

Run: `supabase db reset`
Expected: applique 00001→00012 + seed sans erreur.

- [ ] **Step 3: Vérifier structure**

Run:
```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "
select count(*) as t from pg_tables where schemaname='public' and tablename='conciergerie_demandes';
select count(*) as f from pg_proc where proname='is_concierge';
select count(*) as p from pg_policies where tablename='conciergerie_demandes';
"
```
Expected: `t = 1` ; `f = 1` ; `p = 4`.
(Si `psql` absent du PATH : `docker exec -i supabase_db_Vito psql -U postgres -d postgres -c "..."`.)

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/00012_conciergerie.sql
git commit -m "feat(conciergerie): migration 00012 (demandes, is_concierge, RLS premium/staff)"
```

---

### Task 2: Support hôtels (Places mock + mapping)

**Files:**
- Modify: `src/lib/services/places/mock.ts` (ajout de 2 hôtels de démo)
- Modify: `src/features/restos/domain/mapPlaceToEtablissement.ts` (param `categorie`)
- Create: `src/features/conciergerie/domain/hotelMapping.test.ts`

**Interfaces:**
- Consumes: `getPlacesProvider`, `PlaceResult`/`PlaceSummary`.
- Produces: le mock renvoie des hôtels (`types` incluant `"hotel"`) ; `mapPlaceToEtablissement(p, categorie?: "resto" | "hotel")` — défaut `"resto"` (compat), `"hotel"` → `categorie='hotel'`, `type='hotel'`.

- [ ] **Step 1: Écrire le test (échec attendu)**

Create `src/features/conciergerie/domain/hotelMapping.test.ts` :
```ts
import { describe, it, expect } from "vitest";
import { MockPlacesProvider } from "@/lib/services/places/mock";
import { mapPlaceToEtablissement } from "@/features/restos/domain/mapPlaceToEtablissement";

describe("recherche d'hôtels (mock Places)", () => {
  it("la recherche 'hotel' renvoie des hôtels de démo", async () => {
    const res = await new MockPlacesProvider().search("hotel");
    expect(res.length).toBeGreaterThanOrEqual(2);
  });
});

describe("mapPlaceToEtablissement avec catégorie", () => {
  it("catégorie hotel force categorie/type = hotel", async () => {
    const place = await new MockPlacesProvider().details("mock_hotel_1");
    expect(place).not.toBeNull();
    const m = mapPlaceToEtablissement(place!, "hotel");
    expect(m.categorie).toBe("hotel");
    expect(m.type).toBe("hotel");
  });
  it("défaut = resto (compat existant)", async () => {
    const place = await new MockPlacesProvider().details("mock_bistrot_1");
    const m = mapPlaceToEtablissement(place!);
    expect(m.categorie).toBe("resto");
  });
});
```

- [ ] **Step 2: Lancer (échec)**

Run: `npx vitest run src/features/conciergerie/domain/hotelMapping.test.ts`
Expected: FAIL (`mock_hotel_1` introuvable / arité du mapping).

- [ ] **Step 3: Ajouter les hôtels au mock**

Modify `src/lib/services/places/mock.ts` — ajouter ces deux entrées à la fin du tableau `FIXTURES` (après `mock_etoile_1`, avant le `]`) :
```ts
  {
    placeId: "mock_hotel_1",
    nom: "Hôtel des Voyageurs",
    adresse: "5 place de la Gare",
    ville: "Lyon",
    codePostal: "69002",
    lat: 45.76,
    lng: 4.83,
    telephone: "+33 4 78 00 00 00",
    website: "https://hotel-voyageurs.fr",
    priceLevel: 3,
    types: ["lodging", "hotel"],
    photoRefs: ["mock_photo_h1"],
  },
  {
    placeId: "mock_hotel_2",
    nom: "Grand Hôtel Riviera",
    adresse: "10 promenade des Anglais",
    ville: "Nice",
    codePostal: "06000",
    lat: 43.69,
    lng: 7.26,
    telephone: "+33 4 93 00 00 00",
    website: "https://grand-hotel-riviera.fr",
    priceLevel: 4,
    types: ["lodging", "hotel"],
    photoRefs: ["mock_photo_h2"],
  },
```
(La recherche `"hotel"` matche via `types` → renvoie les deux ; les restos ne matchent pas `"hotel"`.)

- [ ] **Step 4: Ajouter le param `categorie` au mapping**

Modify `src/features/restos/domain/mapPlaceToEtablissement.ts` — remplacer la signature et les deux champs `categorie`/`type` :
```ts
export function mapPlaceToEtablissement(p: PlaceResult, categorie: "resto" | "hotel" = "resto"): EtablissementInput {
  return {
    place_id: p.placeId,
    categorie,
    type: categorie === "hotel" ? "hotel" : classifyFallback(p.types, p.priceLevel),
    nom: p.nom,
    adresse: p.adresse,
    ville: p.ville,
    code_postal: p.codePostal,
    arrondissement: arrondissementParisien(p.codePostal, p.ville),
    lat: p.lat,
    lng: p.lng,
    telephone: p.telephone,
    website: p.website,
    price_level: p.priceLevel,
    source: "places",
  };
}
```
(Le reste du fichier — imports, `arrondissementParisien`, type `EtablissementInput` — inchangé. Le défaut `"resto"` garde le comportement de `addResto`.)

- [ ] **Step 5: Lancer (succès) + non-régression restos**

Run: `npx vitest run src/features/conciergerie/domain/hotelMapping.test.ts src/features/restos/`
Expected: PASS (nouveaux tests + tests restos existants verts).

- [ ] **Step 6: Commit**

```bash
git add src/lib/services/places/mock.ts src/features/restos/domain/mapPlaceToEtablissement.ts src/features/conciergerie/domain/hotelMapping.test.ts
git commit -m "feat(conciergerie): hôtels de démo (mock Places) + mapPlaceToEtablissement(categorie)"
```

---

### Task 3: Domain (durée + schémas)

**Files:**
- Create: `src/features/conciergerie/domain/duree.ts` + `duree.test.ts`
- Create: `src/features/conciergerie/domain/schemas.ts` + `schemas.test.ts`

**Interfaces:**
- Produces:
  - `dureeFromNuits(dateDebut: string, nombreNuits: number): string` (date de fin `YYYY-MM-DD`).
  - `OCCASIONS`, `SEJOUR_TYPES`, `CONCIERGERIE_STATUTS` (const tuples).
  - `demandeRestoSchema`, `demandeHotelSchema`, `reponseSchema`.

- [ ] **Step 1: Écrire les tests (échec attendu)**

Create `src/features/conciergerie/domain/duree.test.ts` :
```ts
import { describe, it, expect } from "vitest";
import { dureeFromNuits } from "./duree";

describe("dureeFromNuits", () => {
  it("ajoute les nuits", () => expect(dureeFromNuits("2026-09-12", 3)).toBe("2026-09-15"));
  it("gère le passage de mois", () => expect(dureeFromNuits("2026-09-29", 3)).toBe("2026-10-02"));
});
```

Create `src/features/conciergerie/domain/schemas.test.ts` :
```ts
import { describe, it, expect } from "vitest";
import { demandeRestoSchema, demandeHotelSchema, reponseSchema } from "./schemas";

const UUID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

describe("demandeRestoSchema", () => {
  it("accepte une demande resto valide", () => {
    expect(demandeRestoSchema.safeParse({
      etablissementId: UUID, dateResa: "2026-09-12", heureResa: "20:30",
      nombreConvives: "4", occasion: "famille", avecEnfants: true, nbEnfants: "2", chaiseHaute: true,
    }).success).toBe(true);
  });
  it("rejette convives <= 0 et occasion invalide", () => {
    expect(demandeRestoSchema.safeParse({ etablissementId: UUID, dateResa: "2026-09-12", heureResa: "20:30", nombreConvives: "0", occasion: "famille" }).success).toBe(false);
    expect(demandeRestoSchema.safeParse({ etablissementId: UUID, dateResa: "2026-09-12", heureResa: "20:30", nombreConvives: "2", occasion: "boulot" }).success).toBe(false);
  });
});

describe("demandeHotelSchema", () => {
  it("accepte une demande hôtel valide", () => {
    expect(demandeHotelSchema.safeParse({ placeId: "mock_hotel_1", dateDebut: "2026-09-12", nombreNuits: "3", sejourType: "loisirs" }).success).toBe(true);
  });
  it("rejette nuits <= 0 et sejourType invalide", () => {
    expect(demandeHotelSchema.safeParse({ placeId: "x", dateDebut: "2026-09-12", nombreNuits: "0", sejourType: "loisirs" }).success).toBe(false);
    expect(demandeHotelSchema.safeParse({ placeId: "x", dateDebut: "2026-09-12", nombreNuits: "3", sejourType: "vacances" }).success).toBe(false);
  });
});

describe("reponseSchema", () => {
  it("statut valide requis", () => {
    expect(reponseSchema.safeParse({ demandeId: UUID, statut: "confirmee", reponse: "ok" }).success).toBe(true);
    expect(reponseSchema.safeParse({ demandeId: UUID, statut: "annulee" }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Lancer (échec)**

Run: `npx vitest run src/features/conciergerie/domain/duree.test.ts src/features/conciergerie/domain/schemas.test.ts`
Expected: FAIL (modules introuvables).

- [ ] **Step 3: Implémenter duree.ts + schemas.ts**

Create `src/features/conciergerie/domain/duree.ts` :
```ts
// Date de fin = dateDebut (YYYY-MM-DD) + nombreNuits jours, en UTC (déterministe).
export function dureeFromNuits(dateDebut: string, nombreNuits: number): string {
  const d = new Date(`${dateDebut}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + nombreNuits);
  return d.toISOString().slice(0, 10);
}
```

Create `src/features/conciergerie/domain/schemas.ts` :
```ts
import { z } from "zod";

export const OCCASIONS = ["amis", "famille", "anniversaire", "autre"] as const;
export const SEJOUR_TYPES = ["loisirs", "pro"] as const;
export const CONCIERGERIE_STATUTS = ["nouvelle", "en_cours", "confirmee", "refusee"] as const;

export const demandeRestoSchema = z.object({
  etablissementId: z.string().uuid(),
  dateResa: z.string().date(),
  heureResa: z.string().regex(/^\d{2}:\d{2}$/, "Heure invalide"),
  nombreConvives: z.coerce.number().int().positive(),
  avecEnfants: z.boolean().optional().default(false),
  nbEnfants: z.coerce.number().int().min(0).optional().default(0),
  chaiseHaute: z.boolean().optional().default(false),
  occasion: z.enum(OCCASIONS),
  commentaire: z.string().max(2000).optional(),
});
export type DemandeRestoInput = z.infer<typeof demandeRestoSchema>;

export const demandeHotelSchema = z.object({
  placeId: z.string().min(1),
  dateDebut: z.string().date(),
  nombreNuits: z.coerce.number().int().positive(),
  sejourType: z.enum(SEJOUR_TYPES),
  avecEnfants: z.boolean().optional().default(false),
  nbEnfants: z.coerce.number().int().min(0).optional().default(0),
  enfantsAges: z.array(z.coerce.number().int().min(0)).optional(),
  commentaire: z.string().max(2000).optional(),
});
export type DemandeHotelInput = z.infer<typeof demandeHotelSchema>;

export const reponseSchema = z.object({
  demandeId: z.string().uuid(),
  statut: z.enum(CONCIERGERIE_STATUTS),
  reponse: z.string().max(2000).optional(),
});
export type ReponseInput = z.infer<typeof reponseSchema>;
```

- [ ] **Step 4: Lancer (succès)**

Run: `npx vitest run src/features/conciergerie/domain/`
Expected: PASS (duree 2 + schemas 5 + hotelMapping 3 = 10 tests dans le dossier).

- [ ] **Step 5: Commit**

```bash
git add src/features/conciergerie/domain/duree.ts src/features/conciergerie/domain/duree.test.ts src/features/conciergerie/domain/schemas.ts src/features/conciergerie/domain/schemas.test.ts
git commit -m "feat(conciergerie): domain (dureeFromNuits + schémas resto/hôtel/réponse) TDD"
```

---

### Task 4: Data (actions + queries)

**Files:**
- Create: `src/features/conciergerie/data/queries.ts`
- Create: `src/features/conciergerie/data/actions.ts`

**Interfaces:**
- Consumes: `createServerSupabase` ; `getPlacesProvider` ; `mapPlaceToEtablissement` ; les schémas (Task 3) ; `getIsPremium` de `@/features/abonnement/data/queries` ; `revalidatePath`.
- Produces:
  - `getMesDemandes()`, `getInboxConciergerie()`, `getDemande(id)`.
  - actions `creerDemandeResto`, `creerDemandeHotel`, `repondreDemande`, `supprimerDemande` (`(_prev, formData)` → `{ ok } | { error } | { limit }`), `chercherHotels(query: string)` → `{ placeId; nom; adresse: string|null }[]`.

- [ ] **Step 1: Implémenter queries.ts**

Create `src/features/conciergerie/data/queries.ts` :
```ts
import { createServerSupabase } from "@/lib/supabase/server";

const SELECT = "id, type, statut, etablissement_id, date_resa, heure_resa, nombre_convives, occasion, avec_enfants, nb_enfants, chaise_haute, date_debut, nombre_nuits, sejour_type, enfants_ages, commentaire, reponse, repondu_le, created_at, user_id, etablissement:etablissements(nom, ville)";

export async function getMesDemandes() {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];
  const { data, error } = await supabase
    .from("conciergerie_demandes")
    .select(SELECT)
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getInboxConciergerie() {
  const supabase = await createServerSupabase();
  // RLS : un membre du staff (is_concierge) voit toutes les demandes ; sinon seulement les siennes.
  const { data, error } = await supabase
    .from("conciergerie_demandes")
    .select(SELECT)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getDemande(id: string) {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from("conciergerie_demandes").select(SELECT).eq("id", id).single();
  if (error) throw error;
  return data;
}
```

- [ ] **Step 2: Implémenter actions.ts**

Create `src/features/conciergerie/data/actions.ts` :
```ts
"use server";
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { getPlacesProvider } from "@/lib/services/places";
import { mapPlaceToEtablissement } from "@/features/restos/domain/mapPlaceToEtablissement";
import { getIsPremium } from "@/features/abonnement/data/queries";
import { demandeRestoSchema, demandeHotelSchema, reponseSchema } from "../domain/schemas";

async function userId(supabase: Awaited<ReturnType<typeof createServerSupabase>>) {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function chercherHotels(query: string) {
  if (!query.trim()) return [];
  const supabase = await createServerSupabase();
  if (!(await userId(supabase)) || !(await getIsPremium())) return [];
  return getPlacesProvider().search(query);
}

export async function creerDemandeResto(_prev: unknown, formData: FormData) {
  const parsed = demandeRestoSchema.safeParse({
    etablissementId: formData.get("etablissementId"),
    dateResa: formData.get("dateResa"),
    heureResa: formData.get("heureResa"),
    nombreConvives: formData.get("nombreConvives"),
    avecEnfants: formData.get("avecEnfants") === "on",
    nbEnfants: formData.get("nbEnfants") || 0,
    chaiseHaute: formData.get("chaiseHaute") === "on",
    occasion: formData.get("occasion"),
    commentaire: formData.get("commentaire") || undefined,
  });
  if (!parsed.success) return { error: "Demande invalide" };
  const supabase = await createServerSupabase();
  const uid = await userId(supabase);
  if (!uid) return { error: "Non authentifié" };
  if (!(await getIsPremium())) return { error: "Réservé aux abonnés Premium", limit: true as const };
  const d = parsed.data;
  const { error } = await supabase.from("conciergerie_demandes").insert({
    user_id: uid, type: "resto", etablissement_id: d.etablissementId,
    date_resa: d.dateResa, heure_resa: d.heureResa, nombre_convives: d.nombreConvives,
    avec_enfants: d.avecEnfants, nb_enfants: d.nbEnfants, chaise_haute: d.chaiseHaute,
    occasion: d.occasion, commentaire: d.commentaire ?? null,
  });
  if (error) return { error: "Création échouée" };
  revalidatePath("/conciergerie");
  return { ok: true as const };
}

export async function creerDemandeHotel(_prev: unknown, formData: FormData) {
  const parsed = demandeHotelSchema.safeParse({
    placeId: formData.get("placeId"),
    dateDebut: formData.get("dateDebut"),
    nombreNuits: formData.get("nombreNuits"),
    sejourType: formData.get("sejourType"),
    avecEnfants: formData.get("avecEnfants") === "on",
    nbEnfants: formData.get("nbEnfants") || 0,
    enfantsAges: formData.getAll("enfantsAges"),
    commentaire: formData.get("commentaire") || undefined,
  });
  if (!parsed.success) return { error: "Demande invalide" };
  const supabase = await createServerSupabase();
  const uid = await userId(supabase);
  if (!uid) return { error: "Non authentifié" };
  if (!(await getIsPremium())) return { error: "Réservé aux abonnés Premium", limit: true as const };
  const d = parsed.data;
  // Résout l'hôtel sélectionné -> établissement (categorie hotel)
  const place = await getPlacesProvider().details(d.placeId);
  if (!place) return { error: "Hôtel introuvable" };
  const input = mapPlaceToEtablissement(place, "hotel");
  const { data: etabId, error: rpcErr } = await supabase.rpc("upsert_etablissement", { p: { ...input, enriched_at: new Date().toISOString() } });
  if (rpcErr || !etabId) return { error: "Enregistrement de l'hôtel échoué" };
  const { error } = await supabase.from("conciergerie_demandes").insert({
    user_id: uid, type: "hotel", etablissement_id: etabId,
    date_debut: d.dateDebut, nombre_nuits: d.nombreNuits, sejour_type: d.sejourType,
    avec_enfants: d.avecEnfants, nb_enfants: d.nbEnfants, enfants_ages: d.enfantsAges ?? null,
    commentaire: d.commentaire ?? null,
  });
  if (error) return { error: "Création échouée" };
  revalidatePath("/conciergerie");
  return { ok: true as const };
}

export async function repondreDemande(_prev: unknown, formData: FormData) {
  const parsed = reponseSchema.safeParse({
    demandeId: formData.get("demandeId"),
    statut: formData.get("statut"),
    reponse: formData.get("reponse") || undefined,
  });
  if (!parsed.success) return { error: "Réponse invalide" };
  const supabase = await createServerSupabase();
  const uid = await userId(supabase);
  if (!uid) return { error: "Non authentifié" };
  // RLS update = staff-only ; .select() détecte 0 ligne (non staff)
  const { data, error } = await supabase
    .from("conciergerie_demandes")
    .update({ statut: parsed.data.statut, reponse: parsed.data.reponse ?? null, repondu_par: uid, repondu_le: new Date().toISOString() })
    .eq("id", parsed.data.demandeId)
    .select("id")
    .maybeSingle();
  if (error) return { error: "Réponse échouée" };
  if (!data) return { error: "Action réservée au concierge" };
  revalidatePath("/conciergerie");
  return { ok: true as const };
}

export async function supprimerDemande(_prev: unknown, formData: FormData) {
  const id = formData.get("demandeId");
  if (typeof id !== "string") return { error: "Entrée invalide" };
  const supabase = await createServerSupabase();
  if (!(await userId(supabase))) return { error: "Non authentifié" };
  const { data, error } = await supabase.from("conciergerie_demandes").delete().eq("id", id).select("id").maybeSingle();
  if (error) return { error: "Suppression échouée" };
  if (!data) return { error: "Suppression non autorisée" };
  revalidatePath("/conciergerie");
  return { ok: true as const };
}
```

- [ ] **Step 3: Vérifier typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS. *(Comportement runtime couvert par les e2e en Task 6.)*

- [ ] **Step 4: Commit**

```bash
git add src/features/conciergerie/data
git commit -m "feat(conciergerie): actions (créer/répondre/supprimer/chercher hôtels) + queries"
```

---

### Task 5: UI + i18n + intégration fiche resto

**Files:**
- Modify: `messages/fr.json` (namespace `conciergerie`)
- Create: `src/features/conciergerie/ui/DemandeRestoForm.tsx`
- Create: `src/features/conciergerie/ui/DemandeHotelForm.tsx`
- Create: `src/features/conciergerie/ui/DemandesList.tsx`
- Create: `src/features/conciergerie/ui/ConciergeInbox.tsx`
- Create: `src/features/conciergerie/ui/ReponseForm.tsx`
- Create: `src/app/[locale]/(app)/conciergerie/page.tsx`
- Create: `src/app/[locale]/(app)/conciergerie/error.tsx`
- Modify: `src/features/restos/ui/FicheResto.tsx` (bouton conciergerie gaté premium)

**Interfaces:**
- Consumes: actions/queries (Task 4) ; `getIsPremium` ; `getSessionRole` de `@/lib/rbac/guards` ; `Link` de `@/lib/i18n/routing` ; `dureeFromNuits` (affichage). 
- Produces : page `/conciergerie` ; `data-testid` : `demande-resto-form`, `demande-hotel-form`, `hotel-search`, `demande-row`, `demande-statut`, `concierge-inbox`, `reponse-form`, `conciergerie-premium-cta`.

- [ ] **Step 1: i18n**

Modify `messages/fr.json` — ajouter au niveau racine (après le bloc `"abonnement": { ... }`, virgule de séparation) :
```json
  "conciergerie": {
    "title": "Conciergerie",
    "demander": "Demander une réservation",
    "premiumRequis": "Service réservé aux abonnés Premium.",
    "passerPremium": "Passer Premium",
    "types": { "resto": "Restaurant", "hotel": "Hôtel" },
    "statuts": { "nouvelle": "Nouvelle", "en_cours": "En cours", "confirmee": "Confirmée", "refusee": "Refusée" },
    "occasions": { "amis": "Amis", "famille": "Famille", "anniversaire": "Anniversaire", "autre": "Autre" },
    "sejours": { "loisirs": "Loisirs", "pro": "Professionnel" },
    "date": "Date",
    "heure": "Heure",
    "convives": "Nombre de convives",
    "occasion": "Occasion",
    "avecEnfants": "Avec enfants",
    "nbEnfants": "Nombre d'enfants",
    "chaiseHaute": "Chaise haute",
    "dateDebut": "Date de début",
    "nuits": "Nombre de nuits",
    "sejour": "Type de séjour",
    "enfantsAges": "Âges des enfants (séparés par des virgules)",
    "commentaire": "Commentaire",
    "envoyer": "Envoyer la demande",
    "chercherHotel": "Rechercher un hôtel",
    "rechercher": "Rechercher",
    "selectionne": "Sélectionné",
    "mesDemandes": "Mes demandes",
    "inbox": "Demandes à traiter",
    "reponse": "Réponse",
    "repondre": "Répondre",
    "statut": "Statut",
    "supprimer": "Supprimer",
    "vide": "Aucune demande pour l'instant.",
    "error": { "title": "Une erreur est survenue", "retry": "Réessayer" }
  }
```

- [ ] **Step 2: DemandeRestoForm.tsx**

Create `src/features/conciergerie/ui/DemandeRestoForm.tsx` :
```tsx
"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { creerDemandeResto } from "../data/actions";
import { OCCASIONS } from "../domain/schemas";

export function DemandeRestoForm({ etablissementId }: { etablissementId: string }) {
  const t = useTranslations("conciergerie");
  const [state, action, pending] = useActionState(creerDemandeResto, undefined);
  return (
    <form action={action} data-testid="demande-resto-form" className="flex flex-col gap-2 max-w-md border-t pt-3">
      <input type="hidden" name="etablissementId" value={etablissementId} />
      <div className="flex gap-2">
        <input name="dateResa" type="date" required aria-label={t("date")} className="border p-2" />
        <input name="heureResa" type="time" required aria-label={t("heure")} className="border p-2" />
      </div>
      <input name="nombreConvives" type="number" min={1} required placeholder={t("convives")} className="border p-2" />
      <select name="occasion" aria-label={t("occasion")} className="border p-2" defaultValue="amis">
        {OCCASIONS.map((o) => <option key={o} value={o}>{t(`occasions.${o}`)}</option>)}
      </select>
      <label className="flex items-center gap-2"><input type="checkbox" name="avecEnfants" /> {t("avecEnfants")}</label>
      <input name="nbEnfants" type="number" min={0} placeholder={t("nbEnfants")} className="border p-2" />
      <label className="flex items-center gap-2"><input type="checkbox" name="chaiseHaute" /> {t("chaiseHaute")}</label>
      <textarea name="commentaire" placeholder={t("commentaire")} className="border p-2" />
      {state && "error" in state && state.error && <p role="alert" className="text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending} className="bg-black text-white p-2">{t("envoyer")}</button>
    </form>
  );
}
```

- [ ] **Step 3: DemandeHotelForm.tsx**

Create `src/features/conciergerie/ui/DemandeHotelForm.tsx` :
```tsx
"use client";
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { creerDemandeHotel, chercherHotels } from "../data/actions";
import { SEJOUR_TYPES } from "../domain/schemas";

type Hit = { placeId: string; nom: string; adresse: string | null };

export function DemandeHotelForm() {
  const t = useTranslations("conciergerie");
  const [state, action, pending] = useActionState(creerDemandeHotel, undefined);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [selected, setSelected] = useState<Hit | null>(null);
  return (
    <form action={action} data-testid="demande-hotel-form" className="flex flex-col gap-2 max-w-md border-t pt-3">
      <div data-testid="hotel-search" className="flex flex-col gap-1">
        <div className="flex gap-2">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("chercherHotel")} className="border p-2 flex-1" />
          <button type="button" onClick={async () => setHits(await chercherHotels(query))} className="border p-2">{t("rechercher")}</button>
        </div>
        <ul className="flex flex-col gap-1">
          {hits.map((h) => (
            <li key={h.placeId}>
              <button type="button" onClick={() => setSelected(h)} className="underline text-left">{h.nom}</button>
            </li>
          ))}
        </ul>
        {selected && <p className="text-sm">{t("selectionne")} : {selected.nom}</p>}
        {selected && <input type="hidden" name="placeId" value={selected.placeId} />}
      </div>
      <div className="flex gap-2">
        <input name="dateDebut" type="date" required aria-label={t("dateDebut")} className="border p-2" />
        <input name="nombreNuits" type="number" min={1} required placeholder={t("nuits")} className="border p-2" />
      </div>
      <select name="sejourType" aria-label={t("sejour")} className="border p-2" defaultValue="loisirs">
        {SEJOUR_TYPES.map((s) => <option key={s} value={s}>{t(`sejours.${s}`)}</option>)}
      </select>
      <label className="flex items-center gap-2"><input type="checkbox" name="avecEnfants" /> {t("avecEnfants")}</label>
      <textarea name="commentaire" placeholder={t("commentaire")} className="border p-2" />
      {state && "error" in state && state.error && <p role="alert" className="text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending || !selected} className="bg-black text-white p-2">{t("envoyer")}</button>
    </form>
  );
}
```

- [ ] **Step 4: DemandesList.tsx + ReponseForm.tsx + ConciergeInbox.tsx**

Create `src/features/conciergerie/ui/DemandesList.tsx` :
```tsx
import { getTranslations } from "next-intl/server";
import { dureeFromNuits } from "../domain/duree";

type Etab = { nom: string; ville: string | null } | { nom: string; ville: string | null }[] | null;
type Demande = {
  id: string; type: string; statut: string; reponse: string | null;
  date_debut: string | null; nombre_nuits: number | null; commentaire: string | null;
  etablissement: Etab;
};

function etabNom(e: Etab): string {
  const x = Array.isArray(e) ? e[0] : e;
  return x?.nom ?? "";
}

export async function DemandesList({ demandes }: { demandes: Demande[] }) {
  const t = await getTranslations("conciergerie");
  if (demandes.length === 0) return <p>{t("vide")}</p>;
  return (
    <ul className="flex flex-col gap-2">
      {demandes.map((d) => (
        <li key={d.id} data-testid="demande-row" className="border p-3">
          <span className="font-medium">{t(`types.${d.type}`)}</span> — {etabNom(d.etablissement)}{" "}
          · <span data-testid="demande-statut">{t(`statuts.${d.statut}`)}</span>
          {d.type === "hotel" && d.date_debut && d.nombre_nuits !== null && (
            <span className="text-sm text-gray-600"> · {d.date_debut} → {dureeFromNuits(d.date_debut, d.nombre_nuits)}</span>
          )}
          {d.commentaire && <p className="text-sm text-gray-700">{d.commentaire}</p>}
          {d.reponse && <p className="text-sm text-gray-700">{t("reponse")} : {d.reponse}</p>}
        </li>
      ))}
    </ul>
  );
}
```

Create `src/features/conciergerie/ui/ReponseForm.tsx` :
```tsx
"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { repondreDemande } from "../data/actions";
import { CONCIERGERIE_STATUTS } from "../domain/schemas";

export function ReponseForm({ demandeId }: { demandeId: string }) {
  const t = useTranslations("conciergerie");
  const [state, action, pending] = useActionState(repondreDemande, undefined);
  return (
    <form action={action} data-testid="reponse-form" className="flex flex-col gap-2 border-t pt-2">
      <input type="hidden" name="demandeId" value={demandeId} />
      <select name="statut" aria-label={t("statut")} className="border p-2" defaultValue="confirmee">
        {CONCIERGERIE_STATUTS.map((s) => <option key={s} value={s}>{t(`statuts.${s}`)}</option>)}
      </select>
      <textarea name="reponse" placeholder={t("reponse")} className="border p-2" />
      {state && "error" in state && state.error && <p role="alert" className="text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending} className="bg-black text-white p-2">{t("repondre")}</button>
    </form>
  );
}
```

Create `src/features/conciergerie/ui/ConciergeInbox.tsx` :
```tsx
import { getTranslations } from "next-intl/server";
import { ReponseForm } from "./ReponseForm";

type Etab = { nom: string; ville: string | null } | { nom: string; ville: string | null }[] | null;
type Demande = { id: string; type: string; statut: string; commentaire: string | null; etablissement: Etab };

function etabNom(e: Etab): string {
  const x = Array.isArray(e) ? e[0] : e;
  return x?.nom ?? "";
}

export async function ConciergeInbox({ demandes }: { demandes: Demande[] }) {
  const t = await getTranslations("conciergerie");
  if (demandes.length === 0) return <p>{t("vide")}</p>;
  return (
    <ul className="flex flex-col gap-3" data-testid="concierge-inbox">
      {demandes.map((d) => (
        <li key={d.id} data-testid="demande-row" className="border p-3">
          <p><span className="font-medium">{t(`types.${d.type}`)}</span> — {etabNom(d.etablissement)} · <span data-testid="demande-statut">{t(`statuts.${d.statut}`)}</span></p>
          {d.commentaire && <p className="text-sm text-gray-700">{d.commentaire}</p>}
          <ReponseForm demandeId={d.id} />
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 5: Page + error**

Create `src/app/[locale]/(app)/conciergerie/page.tsx` :
```tsx
import { getTranslations } from "next-intl/server";
import { getSessionRole } from "@/lib/rbac/guards";
import { getMesDemandes, getInboxConciergerie } from "@/features/conciergerie/data/queries";
import { DemandesList } from "@/features/conciergerie/ui/DemandesList";
import { DemandeHotelForm } from "@/features/conciergerie/ui/DemandeHotelForm";
import { ConciergeInbox } from "@/features/conciergerie/ui/ConciergeInbox";

export default async function ConciergeriePage() {
  const t = await getTranslations("conciergerie");
  const role = await getSessionRole();
  const isStaff = role === "agence" || role === "admin";
  if (isStaff) {
    const demandes = await getInboxConciergerie();
    return (
      <main className="p-6 flex flex-col gap-6">
        <h1 className="text-2xl font-bold">{t("inbox")}</h1>
        <ConciergeInbox demandes={demandes} />
      </main>
    );
  }
  const demandes = await getMesDemandes();
  return (
    <main className="p-6 flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <section>
        <h2 className="font-semibold">{t("mesDemandes")}</h2>
        <DemandesList demandes={demandes} />
      </section>
      <section>
        <h2 className="font-semibold">{t("types.hotel")}</h2>
        <DemandeHotelForm />
      </section>
    </main>
  );
}
```

Create `src/app/[locale]/(app)/conciergerie/error.tsx` :
```tsx
"use client";
import { useTranslations } from "next-intl";
export default function ConciergerieError({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations("conciergerie.error");
  return (
    <main className="p-6">
      <p role="alert">{t("title")}</p>
      <button onClick={reset} className="underline">{t("retry")}</button>
    </main>
  );
}
```

- [ ] **Step 6: Intégration fiche resto (bouton gaté premium)**

Modify `src/features/restos/ui/FicheResto.tsx` :
(a) ajouter les imports en tête :
```tsx
import { getIsPremium } from "@/features/abonnement/data/queries";
import { DemandeRestoForm } from "@/features/conciergerie/ui/DemandeRestoForm";
import { Link } from "@/lib/i18n/routing";
```
(b) le composant a déjà `const t = await getTranslations("restos");`. Ajouter, après le bloc `const [{ etab, ... }, tags] = await Promise.all([...]);` et le `if (!etab) return ...`, une lecture du statut premium :
```tsx
  const tc = await getTranslations("conciergerie");
  const isPremium = await getIsPremium();
```
(c) insérer une nouvelle `<section>` juste avant la fermeture `</article>` :
```tsx
      <section>
        <h2 className="font-semibold">{tc("demander")}</h2>
        {isPremium ? (
          <DemandeRestoForm etablissementId={etab.id} />
        ) : (
          <p data-testid="conciergerie-premium-cta">
            {tc("premiumRequis")}{" "}
            <Link href="/abonnement" className="underline">{tc("passerPremium")}</Link>
          </p>
        )}
      </section>
```

- [ ] **Step 7: Vérifier build (typecheck + lint + unit)**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS (typecheck/lint sans erreur ; tous les tests unitaires verts).

- [ ] **Step 8: Commit**

```bash
git add messages/fr.json src/features/conciergerie/ui src/app/\[locale\]/\(app\)/conciergerie src/features/restos/ui/FicheResto.tsx
git commit -m "feat(conciergerie): UI (formulaires, inbox, page) + bouton gaté sur la fiche resto + i18n"
```

---

### Task 6: Seed + e2e

**Files:**
- Modify: `supabase/seed.sql` (une demande resto démo du compte premium)
- Create: `e2e/conciergerie.spec.ts`

**Interfaces:**
- Consumes : `/fr/conciergerie`, `/fr/restos/[id]`, `data-testid` de Task 5. Comptes : `premium@vito.test` (premium, id `55555555-5555-4555-8555-555555555555`), `agence@vito.test` (staff, id `22222222-2222-2222-2222-222222222222`), `free@vito.test` (Free, id `44444444-4444-4444-8444-444444444444`). Resto seed : `Le Bistrot Démo` (id `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa`). Mot de passe `password123`.

- [ ] **Step 1: Seed — demande resto démo (premium)**

Modify `supabase/seed.sql` — ajouter à la fin :
```sql
-- Conciergerie : une demande resto démo du compte premium (statut nouvelle, commentaire stable)
insert into public.conciergerie_demandes (user_id, type, etablissement_id, statut, date_resa, heure_resa, nombre_convives, occasion, commentaire)
values ('55555555-5555-4555-8555-555555555555', 'resto', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'nouvelle', '2026-10-10', '20:00', 2, 'amis', 'Demande démo conciergerie');
```

- [ ] **Step 2: Appliquer**

Run: `supabase db reset`
Expected: applique migrations + seed sans erreur.

- [ ] **Step 3: Écrire les e2e**

Create `e2e/conciergerie.spec.ts` :
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

test("premium crée une demande resto depuis une fiche et la retrouve", async ({ page }) => {
  await login(page, "premium@vito.test");
  await page.goto(`/fr/restos/${BISTROT}`);

  // Le formulaire conciergerie est visible (premium)
  const form = page.getByTestId("demande-resto-form");
  await expect(form).toBeVisible();
  const tag = `E2E-${Date.now()}`;
  await form.locator('input[name="dateResa"]').fill("2026-11-20");
  await form.locator('input[name="heureResa"]').fill("19:30");
  await form.locator('input[name="nombreConvives"]').fill("3");
  await form.locator('textarea[name="commentaire"]').fill(tag);
  await form.getByRole("button").click();

  // La demande créée (commentaire unique) apparaît dans /conciergerie (vue client), statut Nouvelle
  await page.goto("/fr/conciergerie");
  const row = page.getByTestId("demande-row").filter({ hasText: tag });
  await expect(row).toBeVisible();
  await expect(row.getByTestId("demande-statut")).toHaveText("Nouvelle");
});

test("le staff traite la demande démo du seed (statut + réponse)", async ({ page }) => {
  await login(page, "agence@vito.test");
  await page.goto("/fr/conciergerie");

  // Inbox staff : cibler la demande démo du seed
  const row = page.getByTestId("demande-row").filter({ hasText: "Demande démo conciergerie" });
  await expect(row).toBeVisible();
  await row.getByTestId("reponse-form").locator('select[name="statut"]').selectOption("confirmee");
  await row.getByTestId("reponse-form").locator('textarea[name="reponse"]').fill("Réservé, table confirmée");
  await row.getByTestId("reponse-form").getByRole("button").click();

  // La ligne reflète le nouveau statut
  await expect(
    page.getByTestId("demande-row").filter({ hasText: "Demande démo conciergerie" }).getByTestId("demande-statut"),
  ).toHaveText("Confirmée");
});

test("un compte Free voit le CTA premium, pas le formulaire", async ({ page }) => {
  await login(page, "free@vito.test");
  await page.goto(`/fr/restos/${BISTROT}`);
  await expect(page.getByTestId("conciergerie-premium-cta")).toBeVisible();
  await expect(page.getByTestId("demande-resto-form")).toHaveCount(0);
});
```

- [ ] **Step 4: Lancer les e2e conciergerie**

Run: `npx playwright test e2e/conciergerie.spec.ts --retries=0`
Expected: PASS (3 tests).

- [ ] **Step 5: Suite complète (non-régression)**

Run: `npx playwright test --retries=0`
Expected: PASS (toute la suite + conciergerie).

- [ ] **Step 6: Commit**

```bash
git add supabase/seed.sql e2e/conciergerie.spec.ts
git commit -m "test(conciergerie): seed demande démo + e2e (création premium, traitement staff, CTA Free)"
```

---

## Notes d'exécution

- **Ordre** : 1 (DB) → 2 (Places hôtels) → 3 (domain) → 4 (data) → 5 (UI) → 6 (seed + e2e). Task 4 dépend de 2+3 ; Task 5 de 4 ; Task 6 de tout.
- **Pas de `db push` prod** pendant l'implémentation (prod migrée à la clôture, comme C1–6a).
- **Signaux e2e déterministes** : attendre `demande-row` / `demande-statut` / `conciergerie-premium-cta` ; jamais `networkidle`.
- **Comptes e2e** : premium/agence/free dédiés ; ne pas réutiliser `client` (cohérence avec 6a et la limite voyages).
- **Vérif gate** : faire `supabase db reset` AVANT de lancer la suite e2e complète (un seul reset, pas de run partiel d'abord) pour éviter la pollution d'état (leçon 6a).
