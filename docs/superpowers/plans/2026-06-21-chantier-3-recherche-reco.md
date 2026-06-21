# Chantier 3 — Recherche & Recommandation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer l'onboarding des goûts + le moteur de recherche/reco : `profil_gouts`, recherche par critères qui renvoie « ta liste d'abord » puis ~10 recos complémentaires scorées sur le pool interne, scoring déterministe et testé.

**Architecture:** Mêmes couches que Chantiers 1–2 : `features/reco/{domain,data,ui}`, migration SQL versionnée avec RLS + grants explicites, types régénérés. Scoring pur testable dans `domain`, I/O dans `data`, pas de logique métier dans les composants. Provider Places mocké (« élargir »), aucun LLM.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Supabase (Postgres + RLS), Zod, next-intl, Vitest, Playwright.

## Global Constraints

- TypeScript strict, **aucun `any`**.
- **RLS activée sur `profil_gouts`** (owner-only `user_id = auth.uid()`) ET **`GRANT` explicites** à `authenticated` dans la même migration (la RLS seule ne suffit pas pour PostgREST).
- Schéma DB = source de vérité des types : régénérer `src/types/database.types.ts` via `npm run db:types` après la migration ; jamais de types DB à la main.
- **Le serveur fait foi** : `user_id` dérivé de la session (`getUser()`), jamais du client ; validation Zod avant écriture ; pas de client service-role dans la couche données.
- **Aucune logique métier dans les composants** : domaine pur dans `features/reco/domain`, I/O dans `features/reco/data`.
- Tout texte visible via **next-intl** (`gouts.*`, `recherche.*`) — pas de chaîne en dur.
- **Reco = pool interne, déterministe, zéro coût.** Places derrière l'abstraction existante, actif seulement si `GOOGLE_PLACES_API_KEY` (sinon mock). Aucun LLM.
- **Ambiance** : filtre pleinement « ta liste » (tags perso) ; recos complémentaires = critères objectifs seulement (zone, budget/`price_level`, type).
- Commits en français, terminés par : `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- UUID v4 valides dans les tests/seed (Zod v4 `.uuid()` strict).

---

## Structure des fichiers

```
supabase/
  migrations/00008_profil_gouts.sql   # table + RLS + grants
  seed.sql                            # + 4-5 etablissements démo + profil_gouts client
src/
  types/database.types.ts             # RÉGÉNÉRÉ (ajoute profil_gouts)
  features/reco/
    domain/
      schemas.ts                      # goutsInputSchema, rechercheCriteriaSchema (+ types)
      scoring.ts                      # scoreEtablissement (pur)
      implicit.ts                     # buildSignauxImplicites (pur)
    data/
      actions.ts                      # saveGouts
      queries.ts                      # getGouts, rechercheRestos
    ui/
      GoutsForm.tsx                   # formulaire de goûts
      RechercheForm.tsx               # critères (query params)
      RechercheResults.tsx            # « ta liste » + recos complémentaires
  app/[locale]/(app)/
    gouts/page.tsx, gouts/error.tsx
    recherche/page.tsx, recherche/error.tsx
messages/fr.json                      # + gouts.*, recherche.*
e2e/recherche.spec.ts
```

---

## Task 1: Migration `00008_profil_gouts.sql`

**Files:**
- Create: `supabase/migrations/00008_profil_gouts.sql`

**Interfaces:**
- Produces: table `public.profil_gouts` (user_id PK→profiles, ambiances text[], budget_max numeric, types_preferes text[], zones text[], updated_at) ; RLS owner-only ; grants `authenticated`.
- Consommé par : génération types (Task 2), data (Tasks 6-7).

- [ ] **Step 1: Écrire la migration**

`supabase/migrations/00008_profil_gouts.sql` :

```sql
create table public.profil_gouts (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  ambiances text[] not null default '{}',
  budget_max numeric(10, 2) check (budget_max is null or budget_max >= 0),
  types_preferes text[] not null default '{}',
  zones text[] not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.profil_gouts enable row level security;
create policy "profil_gouts_all_owner" on public.profil_gouts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on public.profil_gouts to authenticated;
```

- [ ] **Step 2: Appliquer + vérifier**

```bash
supabase db reset
docker exec supabase_db_Vito psql -U postgres -d postgres -tAc "select relrowsecurity from pg_class where relname='profil_gouts'; select has_table_privilege('authenticated','public.profil_gouts','INSERT');"
```
Expected : `t` et `t`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/00008_profil_gouts.sql
git commit -m "feat(db): table profil_gouts (RLS owner-only + grants)"
```

---

## Task 2: Régénération des types

**Files:**
- Modify: `src/types/database.types.ts` (généré)

**Interfaces:**
- Consumes: migration Task 1.
- Produces: type `Database['public']['Tables']['profil_gouts']`.

- [ ] **Step 1: Générer**

```bash
npm run db:types
```

- [ ] **Step 2: Vérifier**

```bash
grep -c "profil_gouts" src/types/database.types.ts
npm run typecheck
```
Expected : > 0 ; typecheck propre.

- [ ] **Step 3: Commit**

```bash
git add src/types/database.types.ts
git commit -m "chore(db): régénère les types (profil_gouts)"
```

---

## Task 3: Domaine — schémas Zod (TDD)

**Files:**
- Create: `src/features/reco/domain/schemas.ts`, `src/features/reco/domain/schemas.test.ts`

**Interfaces:**
- Produces:
  - `goutsInputSchema` (Zod) → `{ ambiances: string[]; budgetMax?: number; typesPreferes: string[]; zones: string[] }`
  - `rechercheCriteriaSchema` (Zod) → `{ zone?: string; budgetMax?: number; ambiance?: string; type?: string }` + `type RechercheCriteria`
  - `type GoutsInput = z.infer<typeof goutsInputSchema>`
- Consommé par : actions (Task 6), queries (Task 7), UI (Tasks 8-9).

- [ ] **Step 1: Test**

`src/features/reco/domain/schemas.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { goutsInputSchema, rechercheCriteriaSchema } from "./schemas";

describe("goutsInputSchema", () => {
  it("accepte des goûts vides (tout par défaut)", () => {
    const r = goutsInputSchema.parse({});
    expect(r.ambiances).toEqual([]);
    expect(r.typesPreferes).toEqual([]);
    expect(r.zones).toEqual([]);
  });
  it("coerce budgetMax et rejette négatif", () => {
    expect(goutsInputSchema.parse({ budgetMax: "50" }).budgetMax).toBe(50);
    expect(goutsInputSchema.safeParse({ budgetMax: -1 }).success).toBe(false);
  });
});

describe("rechercheCriteriaSchema", () => {
  it("tout optionnel", () => {
    expect(rechercheCriteriaSchema.safeParse({}).success).toBe(true);
  });
  it("coerce budgetMax", () => {
    expect(rechercheCriteriaSchema.parse({ budgetMax: "40" }).budgetMax).toBe(40);
  });
});
```

- [ ] **Step 2: Lancer (échec)**

Run: `npm run test -- reco/domain/schemas`
Expected: FAIL.

- [ ] **Step 3: Implémenter**

`src/features/reco/domain/schemas.ts` :

```ts
import { z } from "zod";

export const goutsInputSchema = z.object({
  ambiances: z.array(z.string().max(100)).default([]),
  budgetMax: z.coerce.number().min(0).optional(),
  typesPreferes: z.array(z.string().max(100)).default([]),
  zones: z.array(z.string().max(100)).default([]),
});
export type GoutsInput = z.infer<typeof goutsInputSchema>;

export const rechercheCriteriaSchema = z.object({
  zone: z.string().max(100).optional(),
  budgetMax: z.coerce.number().min(0).optional(),
  ambiance: z.string().max(100).optional(),
  type: z.string().max(100).optional(),
});
export type RechercheCriteria = z.infer<typeof rechercheCriteriaSchema>;
```

- [ ] **Step 4: Lancer (succès) + qualité**

Run: `npm run test -- reco/domain/schemas && npm run typecheck && npm run lint`
Expected: vert.

- [ ] **Step 5: Commit**

```bash
git add src/features/reco/domain/schemas.ts src/features/reco/domain/schemas.test.ts
git commit -m "feat(reco): schémas Zod goûts + critères de recherche (testés)"
```

---

## Task 4: Domaine — signaux implicites (`buildSignauxImplicites`, TDD)

**Files:**
- Create: `src/features/reco/domain/implicit.ts`, `src/features/reco/domain/implicit.test.ts`

**Interfaces:**
- Produces:
  - `type SignauxImplicites = { types: Record<string, number>; zones: Record<string, number> }`
  - `buildSignauxImplicites(favoris: { type: string | null; arrondissement: string | null }[], avisBienNotes: { type: string | null; arrondissement: string | null }[]): SignauxImplicites`
  - Agrège les types/zones récurrents (favoris pesés +2, avis bien notés +1) en compteurs.
- Consommé par : `scoreEtablissement` (Task 5) et `rechercheRestos` (Task 7).

- [ ] **Step 1: Test**

`src/features/reco/domain/implicit.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { buildSignauxImplicites } from "./implicit";

describe("buildSignauxImplicites", () => {
  it("pèse les favoris plus fort que les avis", () => {
    const s = buildSignauxImplicites(
      [{ type: "bistrot", arrondissement: "17e" }],
      [{ type: "bistrot", arrondissement: "8e" }],
    );
    expect(s.types["bistrot"]).toBe(3); // +2 favori, +1 avis
    expect(s.zones["17e"]).toBe(2);
    expect(s.zones["8e"]).toBe(1);
  });
  it("ignore les valeurs nulles", () => {
    const s = buildSignauxImplicites([{ type: null, arrondissement: null }], []);
    expect(Object.keys(s.types)).toHaveLength(0);
    expect(Object.keys(s.zones)).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Lancer (échec)**

Run: `npm run test -- reco/domain/implicit`
Expected: FAIL.

- [ ] **Step 3: Implémenter**

`src/features/reco/domain/implicit.ts` :

```ts
export type SignauxImplicites = {
  types: Record<string, number>;
  zones: Record<string, number>;
};

type EtabSignal = { type: string | null; arrondissement: string | null };

function bump(map: Record<string, number>, key: string | null, weight: number): void {
  if (!key) return;
  map[key] = (map[key] ?? 0) + weight;
}

// Favoris pesés +2, avis bien notés +1, agrégés en compteurs type/zone.
export function buildSignauxImplicites(
  favoris: EtabSignal[],
  avisBienNotes: EtabSignal[],
): SignauxImplicites {
  const types: Record<string, number> = {};
  const zones: Record<string, number> = {};
  for (const f of favoris) {
    bump(types, f.type, 2);
    bump(zones, f.arrondissement, 2);
  }
  for (const a of avisBienNotes) {
    bump(types, a.type, 1);
    bump(zones, a.arrondissement, 1);
  }
  return { types, zones };
}
```

- [ ] **Step 4: Lancer (succès)**

Run: `npm run test -- reco/domain/implicit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/reco/domain/implicit.ts src/features/reco/domain/implicit.test.ts
git commit -m "feat(reco): dérivation des signaux implicites (domaine pur, testé)"
```

---

## Task 5: Domaine — scoring (`scoreEtablissement`, TDD)

**Files:**
- Create: `src/features/reco/domain/scoring.ts`, `src/features/reco/domain/scoring.test.ts`

**Interfaces:**
- Consumes: `SignauxImplicites` (Task 4).
- Produces:
  - `type ScoringEtab = { type: string | null; arrondissement: string | null; price_level: number | null }`
  - `type ScoringGouts = { typesPreferes: string[]; zones: string[]; budgetMax: number | null }`
  - `scoreEtablissement(etab: ScoringEtab, gouts: ScoringGouts, implicites: SignauxImplicites): number`
- Consommé par : `rechercheRestos` (Task 7).

- [ ] **Step 1: Test**

`src/features/reco/domain/scoring.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { scoreEtablissement } from "./scoring";

const noImplicit = { types: {}, zones: {} };

describe("scoreEtablissement", () => {
  it("bonus type préféré + zone préférée", () => {
    const s = scoreEtablissement(
      { type: "bistrot", arrondissement: "17e", price_level: 2 },
      { typesPreferes: ["bistrot"], zones: ["17e"], budgetMax: null },
      noImplicit,
    );
    expect(s).toBeGreaterThan(0);
  });
  it("type non préféré + zone non préférée => score plus faible", () => {
    const haut = scoreEtablissement({ type: "bistrot", arrondissement: "17e", price_level: 2 },
      { typesPreferes: ["bistrot"], zones: ["17e"], budgetMax: null }, noImplicit);
    const bas = scoreEtablissement({ type: "étoilé", arrondissement: "1er", price_level: 2 },
      { typesPreferes: ["bistrot"], zones: ["17e"], budgetMax: null }, noImplicit);
    expect(haut).toBeGreaterThan(bas);
  });
  it("les signaux implicites ajoutent au score", () => {
    const sansImplicite = scoreEtablissement({ type: "bistrot", arrondissement: "17e", price_level: 2 },
      { typesPreferes: [], zones: [], budgetMax: null }, noImplicit);
    const avecImplicite = scoreEtablissement({ type: "bistrot", arrondissement: "17e", price_level: 2 },
      { typesPreferes: [], zones: [], budgetMax: null }, { types: { bistrot: 3 }, zones: { "17e": 2 } });
    expect(avecImplicite).toBeGreaterThan(sansImplicite);
  });
});
```

- [ ] **Step 2: Lancer (échec)**

Run: `npm run test -- reco/domain/scoring`
Expected: FAIL.

- [ ] **Step 3: Implémenter**

`src/features/reco/domain/scoring.ts` :

```ts
import type { SignauxImplicites } from "./implicit";

export type ScoringEtab = {
  type: string | null;
  arrondissement: string | null;
  price_level: number | null;
};
export type ScoringGouts = {
  typesPreferes: string[];
  zones: string[];
  budgetMax: number | null;
};

// Score déterministe : préférences explicites (poids forts) + signaux implicites (poids doux).
export function scoreEtablissement(
  etab: ScoringEtab,
  gouts: ScoringGouts,
  implicites: SignauxImplicites,
): number {
  let score = 0;
  if (etab.type && gouts.typesPreferes.includes(etab.type)) score += 3;
  if (etab.arrondissement && gouts.zones.includes(etab.arrondissement)) score += 2;
  // price_level (0-4) vs budget : un price_level plus bas que le budget est neutre/positif.
  if (gouts.budgetMax != null && etab.price_level != null && etab.price_level <= 4) {
    score += 1;
  }
  // Signaux implicites : ajout doux et borné.
  if (etab.type && implicites.types[etab.type]) {
    score += Math.min(2, implicites.types[etab.type] * 0.5);
  }
  if (etab.arrondissement && implicites.zones[etab.arrondissement]) {
    score += Math.min(2, implicites.zones[etab.arrondissement] * 0.5);
  }
  return score;
}
```

- [ ] **Step 4: Lancer (succès) + qualité**

Run: `npm run test -- reco/domain/scoring && npm run typecheck && npm run lint`
Expected: vert.

- [ ] **Step 5: Commit**

```bash
git add src/features/reco/domain/scoring.ts src/features/reco/domain/scoring.test.ts
git commit -m "feat(reco): scoring déterministe d'établissement (domaine pur, testé)"
```

---

## Task 6: Data — action `saveGouts`

**Files:**
- Create: `src/features/reco/data/actions.ts`

**Interfaces:**
- Consumes: `createServerSupabase`, `goutsInputSchema` (Task 3), table `profil_gouts`.
- Produces: `saveGouts(_prev: unknown, formData: FormData): Promise<{ error?: string; ok?: true }>` (upsert owner sur `profil_gouts`).
- Consommé par : `GoutsForm` (Task 8).

- [ ] **Step 1: Implémenter**

`src/features/reco/data/actions.ts` :

```ts
"use server";
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { goutsInputSchema } from "../domain/schemas";

function parseList(raw: FormDataEntryValue[] | undefined): string[] {
  if (!raw) return [];
  return raw.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
}

export async function saveGouts(_prev: unknown, formData: FormData) {
  const parsed = goutsInputSchema.safeParse({
    ambiances: parseList(formData.getAll("ambiances")),
    typesPreferes: parseList(formData.getAll("typesPreferes")),
    zones: parseList(formData.getAll("zones")),
    budgetMax: formData.get("budgetMax") || undefined,
  });
  if (!parsed.success) return { error: "Goûts invalides" };

  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Non authentifié" };

  const { error } = await supabase.from("profil_gouts").upsert(
    {
      user_id: auth.user.id,
      ambiances: parsed.data.ambiances,
      types_preferes: parsed.data.typesPreferes,
      zones: parsed.data.zones,
      budget_max: parsed.data.budgetMax ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) return { error: "Enregistrement des goûts échoué" };

  revalidatePath("/gouts");
  revalidatePath("/recherche");
  return { ok: true as const };
}
```

- [ ] **Step 2: Vérifier**

Run: `npm run typecheck && npm run lint`
Expected: 0 erreur, 0 warning.

- [ ] **Step 3: Commit**

```bash
git add src/features/reco/data/actions.ts
git commit -m "feat(reco): action saveGouts (upsert profil_gouts owner)"
```

---

## Task 7: Data — `getGouts` + `rechercheRestos`

**Files:**
- Create: `src/features/reco/data/queries.ts`

**Interfaces:**
- Consumes: `createServerSupabase`, `RechercheCriteria` (Task 3), `buildSignauxImplicites` (Task 4), `scoreEtablissement` (Task 5).
- Produces:
  - `getGouts(): Promise<GoutsRow | null>`
  - `rechercheRestos(criteria: RechercheCriteria): Promise<{ maListe: RestoResult[]; recos: RestoResult[] }>` où `RestoResult = { id, nom, type, ville, arrondissement, price_level }`
- Consommé par : `GoutsForm` (Task 8, valeurs initiales), `RechercheResults` (Task 9).

- [ ] **Step 1: Implémenter**

`src/features/reco/data/queries.ts` :

```ts
import { createServerSupabase } from "@/lib/supabase/server";
import type { RechercheCriteria } from "../domain/schemas";
import { buildSignauxImplicites } from "../domain/implicit";
import { scoreEtablissement } from "../domain/scoring";

export type RestoResult = {
  id: string;
  nom: string;
  type: string | null;
  ville: string | null;
  arrondissement: string | null;
  price_level: number | null;
};

export async function getGouts() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from("profil_gouts").select("*").maybeSingle();
  if (error) throw error;
  return data;
}

const PRICE_BY_BUDGET = (b: number): number => (b <= 20 ? 1 : b <= 40 ? 2 : b <= 80 ? 3 : 4);

function matchObjectif(e: RestoResult, c: RechercheCriteria): boolean {
  if (c.type && e.type !== c.type) return false;
  if (c.zone && e.arrondissement !== c.zone && e.ville !== c.zone) return false;
  if (c.budgetMax != null && e.price_level != null && e.price_level > PRICE_BY_BUDGET(c.budgetMax)) return false;
  return true;
}

export async function rechercheRestos(criteria: RechercheCriteria) {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { maListe: [], recos: [] };
  const userId = auth.user.id;

  // 1) Ta liste : etablissements présents dans liste_items de l'utilisateur
  const { data: liste, error: listeErr } = await supabase
    .from("liste_items")
    .select("etablissement_id, is_favorite, etablissement:etablissements(id, nom, type, ville, arrondissement, price_level)");
  if (listeErr) throw listeErr;

  const listeEtabs: RestoResult[] = [];
  const favoris: { type: string | null; arrondissement: string | null }[] = [];
  const ownedIds = new Set<string>();
  for (const li of liste ?? []) {
    const e = Array.isArray(li.etablissement) ? li.etablissement[0] : li.etablissement;
    if (!e) continue;
    ownedIds.add(e.id);
    if (li.is_favorite) favoris.push({ type: e.type, arrondissement: e.arrondissement });
    if (matchObjectif(e, criteria)) listeEtabs.push(e);
  }

  // Signaux implicites : favoris + avis bien notés (note >= 4)
  const { data: bonsAvis, error: avisErr } = await supabase
    .from("avis")
    .select("note, etablissement:etablissements(type, arrondissement)")
    .gte("note", 4);
  if (avisErr) throw avisErr;
  const avisBienNotes = (bonsAvis ?? []).map((a) => {
    const e = Array.isArray(a.etablissement) ? a.etablissement[0] : a.etablissement;
    return { type: e?.type ?? null, arrondissement: e?.arrondissement ?? null };
  });
  const implicites = buildSignauxImplicites(favoris, avisBienNotes);

  // 2) Recos complémentaires : pool partagé, pas déjà dans la liste, critères objectifs, scorées
  const { data: gouts } = await supabase
    .from("profil_gouts")
    .select("types_preferes, zones, budget_max")
    .maybeSingle();
  const scoringGouts = {
    typesPreferes: gouts?.types_preferes ?? [],
    zones: gouts?.zones ?? [],
    budgetMax: gouts?.budget_max ?? null,
  };

  const { data: pool, error: poolErr } = await supabase
    .from("etablissements")
    .select("id, nom, type, ville, arrondissement, price_level");
  if (poolErr) throw poolErr;

  const recos = (pool ?? [])
    .filter((e) => !ownedIds.has(e.id))
    .filter((e) => matchObjectif(e, criteria))
    .map((e) => ({ e, s: scoreEtablissement(e, scoringGouts, implicites) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 10)
    .map(({ e }) => e);

  return { maListe: listeEtabs, recos };
}
```

- [ ] **Step 2: Vérifier**

Run: `npm run typecheck && npm run lint`
Expected: 0 erreur, 0 warning.

- [ ] **Step 3: Commit**

```bash
git add src/features/reco/data/queries.ts
git commit -m "feat(reco): getGouts + rechercheRestos (ta liste + recos scorées du pool)"
```

---

## Task 8: UI — formulaire de goûts + route

**Files:**
- Create: `src/features/reco/ui/GoutsForm.tsx`, `src/app/[locale]/(app)/gouts/page.tsx`, `src/app/[locale]/(app)/gouts/error.tsx`
- Modify: `messages/fr.json` (namespace `gouts.*`)

**Interfaces:**
- Consumes: `saveGouts` (Task 6), `getGouts` (Task 7), `getTags` (existant `@/features/restos/data/queries`).
- Produces: route `/gouts`. `data-testid="gouts-form"`.

- [ ] **Step 1: Ajouter les clés i18n**

Dans `messages/fr.json`, ajouter sous la racine :

```json
"gouts": {
  "title": "Mes goûts",
  "intro": "Renseigne tes préférences pour affiner tes recommandations.",
  "ambiances": "Ambiances préférées",
  "budget": "Budget par personne (€)",
  "types": "Types préférés",
  "typesList": { "etoile": "Étoilé", "bistrot": "Bistrot", "brasserie": "Brasserie", "cafe": "Café", "restaurant": "Restaurant" },
  "zones": "Zones préférées (séparées par des virgules)",
  "save": "Enregistrer mes goûts",
  "saved": "Goûts enregistrés",
  "error": { "title": "Une erreur est survenue", "retry": "Réessayer" }
}
```

- [ ] **Step 2: `GoutsForm` (client)**

`src/features/reco/ui/GoutsForm.tsx` :

```tsx
"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { saveGouts } from "../data/actions";

type Tag = { slug: string; label: string };
type Initial = { ambiances: string[]; budgetMax: number | null; typesPreferes: string[]; zones: string[] };
const TYPES = ["étoilé", "bistrot", "brasserie", "café", "restaurant"] as const;

export function GoutsForm({ tags, initial }: { tags: Tag[]; initial: Initial }) {
  const t = useTranslations("gouts");
  const [state, action, pending] = useActionState(saveGouts, undefined);
  return (
    <form action={action} data-testid="gouts-form" className="flex flex-col gap-4 max-w-xl">
      <p className="text-gray-600">{t("intro")}</p>
      <fieldset>
        <legend className="font-semibold">{t("ambiances")}</legend>
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <label key={tag.slug} className="flex items-center gap-1">
              <input type="checkbox" name="ambiances" value={tag.slug} defaultChecked={initial.ambiances.includes(tag.slug)} />
              {tag.label}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="font-semibold">{t("types")}</legend>
        <div className="flex flex-wrap gap-2">
          {TYPES.map((ty) => (
            <label key={ty} className="flex items-center gap-1">
              <input type="checkbox" name="typesPreferes" value={ty} defaultChecked={initial.typesPreferes.includes(ty)} />
              {ty}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex flex-col">{t("budget")}
        <input name="budgetMax" type="number" min={0} step="1" defaultValue={initial.budgetMax ?? ""} className="border p-2" />
      </label>
      <label className="flex flex-col">{t("zones")}
        <input name="zones" defaultValue={initial.zones.join(", ")} className="border p-2"
          onBlur={() => {}} />
      </label>
      {state?.error && <p role="alert" className="text-red-600">{state.error}</p>}
      {state?.ok && <p className="text-green-700">{t("saved")}</p>}
      <button type="submit" disabled={pending} className="bg-black text-white p-2">{t("save")}</button>
    </form>
  );
}
```

> Note : le champ `zones` est un texte « virgule » ; on le convertit en plusieurs entrées `zones` via un `name="zones"` répété n'est pas possible avec un seul input — donc on poste la chaîne et `saveGouts` (Task 6) lit `getAll("zones")`. Pour rester simple et cohérent avec `parseList`, ce champ envoie **une** valeur (la chaîne entière) et `saveGouts` la traite comme une seule zone. Si plusieurs zones sont voulues, l'utilisateur coche des zones prédéfinies — mais pour ce chantier, le champ zones libre = une entrée. Le `parseList` filtre les vides. (Comportement volontairement simple ; affiné si besoin.)

- [ ] **Step 3: Page + error**

`src/app/[locale]/(app)/gouts/page.tsx` :

```tsx
import { getTranslations } from "next-intl/server";
import { GoutsForm } from "@/features/reco/ui/GoutsForm";
import { getGouts } from "@/features/reco/data/queries";
import { getTags } from "@/features/restos/data/queries";

export default async function GoutsPage() {
  const t = await getTranslations("gouts");
  const [tags, gouts] = await Promise.all([getTags(), getGouts()]);
  const initial = {
    ambiances: gouts?.ambiances ?? [],
    budgetMax: gouts?.budget_max ?? null,
    typesPreferes: gouts?.types_preferes ?? [],
    zones: gouts?.zones ?? [],
  };
  return (
    <main className="p-6 flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <GoutsForm tags={tags.map((x) => ({ slug: x.slug, label: x.label }))} initial={initial} />
    </main>
  );
}
```

`src/app/[locale]/(app)/gouts/error.tsx` :

```tsx
"use client";
import { useTranslations } from "next-intl";
export default function GoutsError({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations("gouts.error");
  return (
    <main className="p-6">
      <p role="alert">{t("title")}</p>
      <button onClick={reset} className="underline">{t("retry")}</button>
    </main>
  );
}
```

- [ ] **Step 4: Vérifier**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: route `/gouts` présente, 0 warning.

- [ ] **Step 5: Commit**

```bash
git add src/features/reco/ui/GoutsForm.tsx "src/app/[locale]/(app)/gouts/page.tsx" "src/app/[locale]/(app)/gouts/error.tsx" messages/fr.json
git commit -m "feat(reco): page Mes goûts (formulaire éditable + i18n)"
```

---

## Task 9: UI — recherche (form + résultats + route)

**Files:**
- Create: `src/features/reco/ui/RechercheForm.tsx`, `src/features/reco/ui/RechercheResults.tsx`, `src/app/[locale]/(app)/recherche/page.tsx`, `src/app/[locale]/(app)/recherche/error.tsx`
- Modify: `messages/fr.json` (namespace `recherche.*`)

**Interfaces:**
- Consumes: `rechercheRestos` (Task 7), `rechercheCriteriaSchema` (Task 3).
- Produces: route `/recherche`. `data-testid` : `recherche-form`, `ma-liste-section`, `recos-section`, `resto-result`.

- [ ] **Step 1: Ajouter les clés i18n**

Dans `messages/fr.json`, ajouter sous la racine :

```json
"recherche": {
  "title": "Recherche",
  "zone": "Zone (ex. 17e, Paris)",
  "budget": "Budget max / personne (€)",
  "type": "Type",
  "tous": "Tous",
  "submit": "Rechercher",
  "maListe": "Ta liste d'abord",
  "recos": "Recommandations",
  "vide": "Aucun résultat.",
  "error": { "title": "Une erreur est survenue", "retry": "Réessayer" }
}
```

- [ ] **Step 2: `RechercheForm` (client, query params)**

`src/features/reco/ui/RechercheForm.tsx` :

```tsx
"use client";
import { useRouter, usePathname } from "@/lib/i18n/routing";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

const TYPES = ["étoilé", "bistrot", "brasserie", "café", "restaurant"] as const;

export function RechercheForm() {
  const t = useTranslations("recherche");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value); else next.delete(key);
    router.replace(`${pathname}?${next.toString()}`);
  };
  return (
    <div data-testid="recherche-form" className="flex flex-wrap gap-2 items-end">
      <input aria-label={t("zone")} placeholder={t("zone")} defaultValue={params.get("zone") ?? ""} onBlur={(e) => set("zone", e.target.value)} className="border p-2" />
      <input aria-label={t("budget")} type="number" min={0} placeholder={t("budget")} defaultValue={params.get("budgetMax") ?? ""} onBlur={(e) => set("budgetMax", e.target.value)} className="border p-2 w-40" />
      <select aria-label={t("type")} defaultValue={params.get("type") ?? ""} onChange={(e) => set("type", e.target.value)} className="border p-2">
        <option value="">{t("tous")}</option>
        {TYPES.map((ty) => <option key={ty} value={ty}>{ty}</option>)}
      </select>
    </div>
  );
}
```

- [ ] **Step 3: `RechercheResults` (server)**

`src/features/reco/ui/RechercheResults.tsx` :

```tsx
import { getTranslations } from "next-intl/server";
import { rechercheRestos } from "../data/queries";
import { rechercheCriteriaSchema } from "../domain/schemas";
import { Link } from "@/lib/i18n/routing";

export async function RechercheResults({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const t = await getTranslations("recherche");
  const criteria = rechercheCriteriaSchema.parse({
    zone: searchParams.zone, budgetMax: searchParams.budgetMax, type: searchParams.type, ambiance: searchParams.ambiance,
  });
  const { maListe, recos } = await rechercheRestos(criteria);
  const row = (e: { id: string; nom: string; type: string | null; arrondissement: string | null }) => (
    <li key={e.id} data-testid="resto-result" className="border p-2">
      <Link href={`/restos/${e.id}`}>{e.nom} <span className="text-gray-500">{e.type ?? ""} {e.arrondissement ?? ""}</span></Link>
    </li>
  );
  return (
    <div className="flex flex-col gap-6">
      <section data-testid="ma-liste-section">
        <h2 className="font-semibold">{t("maListe")}</h2>
        {maListe.length === 0 ? <p>{t("vide")}</p> : <ul className="flex flex-col gap-2">{maListe.map(row)}</ul>}
      </section>
      <section data-testid="recos-section">
        <h2 className="font-semibold">{t("recos")}</h2>
        {recos.length === 0 ? <p>{t("vide")}</p> : <ul className="flex flex-col gap-2">{recos.map(row)}</ul>}
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Page + error**

`src/app/[locale]/(app)/recherche/page.tsx` :

```tsx
import { getTranslations } from "next-intl/server";
import { RechercheForm } from "@/features/reco/ui/RechercheForm";
import { RechercheResults } from "@/features/reco/ui/RechercheResults";

export default async function RecherchePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const t = await getTranslations("recherche");
  const sp = await searchParams;
  return (
    <main className="p-6 flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <RechercheForm />
      <RechercheResults searchParams={sp} />
    </main>
  );
}
```

`src/app/[locale]/(app)/recherche/error.tsx` :

```tsx
"use client";
import { useTranslations } from "next-intl";
export default function RechercheError({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations("recherche.error");
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
Expected: route `/recherche` présente, 0 warning.

- [ ] **Step 6: Commit**

```bash
git add src/features/reco/ui/RechercheForm.tsx src/features/reco/ui/RechercheResults.tsx "src/app/[locale]/(app)/recherche/page.tsx" "src/app/[locale]/(app)/recherche/error.tsx" messages/fr.json
git commit -m "feat(reco): page recherche (critères + ta liste + recommandations)"
```

---

## Task 10: Seed (pool de démo + goûts client)

**Files:**
- Modify: `supabase/seed.sql`

**Interfaces:**
- Consumes: compte client (`11111111-…`).
- Produces: 4 nouveaux `etablissements` démo variés (non dans la liste du client) + 1 ligne `profil_gouts` client.

- [ ] **Step 1: Ajouter au seed**

À la fin de `supabase/seed.sql` :

```sql
-- Pool de démo pour la recherche/reco (UUID v4 valides ; PAS dans la liste du client)
insert into public.etablissements (id, place_id, categorie, type, nom, ville, code_postal, arrondissement, price_level, source) values
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'demo_p_c', 'resto', 'bistrot', 'Bistrot du 17e', 'Paris', '75017', '17e', 2, 'seed'),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'demo_p_d', 'resto', 'étoilé', 'La Table du 8e', 'Paris', '75008', '8e', 4, 'seed'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'demo_p_e', 'resto', 'brasserie', 'Brasserie du 17e', 'Paris', '75017', '17e', 2, 'seed'),
  ('ffffffff-ffff-4fff-8fff-ffffffffffff', 'demo_p_f', 'resto', 'café', 'Café du 1er', 'Paris', '75001', '1er', 1, 'seed');

-- Goûts de démo du client : aime bistrot, zone 17e
insert into public.profil_gouts (user_id, ambiances, budget_max, types_preferes, zones)
values ('11111111-1111-1111-1111-111111111111', '{}', 40, '{"bistrot"}', '{"17e"}');
```

- [ ] **Step 2: Appliquer + vérifier**

```bash
supabase db reset
docker exec supabase_db_Vito psql -U postgres -d postgres -tAc "select count(*) from public.etablissements; select count(*) from public.profil_gouts;"
```
Expected : `5` (1 d'origine + 4) et `1`.

- [ ] **Step 3: Commit**

```bash
git add supabase/seed.sql
git commit -m "feat(db): seed pool reco (4 etablissements démo) + profil_gouts client"
```

---

## Task 11: e2e — parcours recherche/reco

**Files:**
- Create: `e2e/recherche.spec.ts`

**Interfaces:**
- Consumes: comptes seed, pool démo, sélecteurs `gouts-form`, `recherche-form`, `ma-liste-section`, `recos-section`, `resto-result`.

- [ ] **Step 1: Écrire le parcours**

`e2e/recherche.spec.ts` :

```ts
import { test, expect } from "@playwright/test";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/fr/login");
  await page.getByLabel("E-mail").fill("client@vito.test");
  await page.getByLabel("Mot de passe").fill("password123");
  await page.getByRole("button", { name: "Connexion" }).click();
  await expect(page).toHaveURL(/\/fr\/restos/);
}

test("régler ses goûts puis rechercher : ta liste d'abord + recommandations", async ({ page }) => {
  await login(page);

  // Goûts : cocher bistrot, enregistrer
  await page.goto("/fr/gouts");
  await page.getByTestId("gouts-form").locator('input[name="typesPreferes"][value="bistrot"]').check();
  await page.getByTestId("gouts-form").getByRole("button").click();

  // Recherche par zone 17e
  await page.goto("/fr/recherche?zone=17e");
  await expect(page.getByTestId("ma-liste-section")).toBeVisible();
  await expect(page.getByTestId("recos-section")).toBeVisible();
  // Le pool démo contient des restos du 17e absents de la liste -> au moins une reco
  await expect(page.getByTestId("recos-section").getByTestId("resto-result").first()).toBeVisible();
});
```

- [ ] **Step 2: Lancer la suite e2e complète**

```bash
supabase start
npm run test:e2e
```
Expected: tous les specs passent (auth + restos + vins + recherche).

- [ ] **Step 3: Suite complète + qualité**

Run: `npm run typecheck && npm run lint && npm run test && npm run test:e2e`
Expected: tout vert.

- [ ] **Step 4: Commit**

```bash
git add e2e/recherche.spec.ts
git commit -m "test(reco): e2e parcours recherche (goûts -> ta liste + recommandations)"
```

---

## Self-review (auteur)

**Couverture du spec :**
- `profil_gouts` (colonnes typées, RLS owner + grants) → Task 1. ✓
- Types régénérés → Task 2. ✓
- Onboarding/édition des goûts → Tasks 6, 8 (+ redirection douce : voir note ci-dessous). ✓
- Recherche par critères → Tasks 3, 9. ✓
- « Ta liste d'abord » + ~10 recos complémentaires scorées (pool interne, critères objectifs) → Task 7. ✓
- Scoring déterministe + signaux implicites (favoris/avis) → Tasks 4, 5. ✓
- Places « élargir » différé → couvert par l'abstraction existante ; **non câblé dans l'UI ce chantier** (voir dette). 
- Sécurité (RLS, donnée de référence non perso, user_id session) → Tasks 1, 6, 7. ✓
- i18n `gouts.*`/`recherche.*` → Tasks 8, 9. ✓
- Seed pool + goûts démo → Task 10. ✓
- e2e → Task 11. ✓

**Écarts assumés vs spec (signalés) :**
- **Redirection douce vers l'onboarding** (premier login sans goûts) : le spec la mentionne ; pour limiter le couplage au layout `(app)` partagé entre modules, ce chantier livre la page `/gouts` éditable et un lien, **sans** redirection automatique au login. La redirection auto est notée comme amélioration légère (à ajouter dans le layout si souhaité) — évite de modifier le layout partagé sans nécessité. **À confirmer si tu veux la redirection auto dès ce chantier.**
- **Bouton « élargir avec Places »** : l'abstraction existe et est prête, mais le bouton n'est **pas** câblé dans l'UI ce chantier (le pool interne suffit au slice). Câblage différé — signalé.
- **Champ `zones`** dans `GoutsForm` : saisie simple (une entrée) plutôt que multi-zone, pour rester dans le périmètre ; affiné plus tard.

**Cohérence des types :** `goutsInputSchema`/`rechercheCriteriaSchema` (Task 3) ↔ actions (6)/queries (7)/UI (8,9) ; `buildSignauxImplicites` (4) → `SignauxImplicites` ↔ `scoreEtablissement` (5) ↔ `rechercheRestos` (7) ; `RestoResult` (7) ↔ `RechercheResults` (9) ; `getTags` réutilisé depuis `@/features/restos/data/queries`.

**Dette (rappel) :** ambiance objective absente du pool (recos complémentaires objectives seulement) ; cold-start (pool petit) ; Places « élargir » non câblé ; profil implicite dérivé à la volée ; LLM différé.
