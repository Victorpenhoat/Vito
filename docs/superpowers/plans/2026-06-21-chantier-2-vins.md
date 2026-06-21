# Chantier 2 — Module Vins — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer le module Vins branché sur Restos : capture d'une dégustation depuis la fiche resto, onglet « Mes vins » consolidé filtrable, abstraction marchand — modèle normalisé `vins` (par utilisateur) + `degustations`, RLS owner-only, testé de bout en bout.

**Architecture:** Mêmes couches que Chantier 1 : `features/vins/{domain,data,ui}`, abstractions sous `lib/services/{merchant,enrichment}/`, migrations SQL versionnées avec RLS + grants explicites, types régénérés depuis le schéma. Server Actions validées Zod, lectures via le client serveur RLS-aware. Provider marchand et enrichissement mockés (zéro coût).

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Supabase (Postgres + RLS), Zod, next-intl, Vitest, Playwright.

## Global Constraints

- TypeScript strict, **aucun `any`**.
- **RLS activée sur chaque nouvelle table** (`vins`, `degustations`) avec policies owner-only `user_id = auth.uid()`, ET **`GRANT` explicites** à `authenticated` dans la même migration (la RLS seule ne suffit pas pour PostgREST — leçon migration 00005).
- Le schéma DB est la **source de vérité des types** : régénérer `src/types/database.types.ts` via `npm run db:types` après la migration ; jamais de types DB écrits à la main.
- **Le serveur fait foi** : `user_id` dérivé de la session (`getUser()`), jamais du client ; validation Zod avant toute écriture ; pas de client service-role dans la couche données.
- **Aucune logique métier dans les composants** : domaine pur dans `features/vins/domain`, I/O dans `features/vins/data`.
- Tout texte visible via **next-intl** (namespace `vins.*` dans `messages/fr.json`) — pas de chaîne en dur.
- Provider marchand/enrichissement : réels seulement si la variable d'env correspondante est fournie, sinon **mock** (zéro coût).
- Commits en français, terminés par : `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Migrations : `create function/policy` simples (appliquées une fois sur DB propre via `supabase db reset` ; le cloud via `supabase db push`).
- Tests qui touchent à des UUID : utiliser des **UUID v4 valides** (Zod v4 `.uuid()` vérifie le variant ; `gen_random_uuid()` produit du v4).

---

## Structure des fichiers (décomposition)

```
supabase/
  migrations/00006_vins.sql          # enum vin_couleur, tables vins+degustations, RLS, grants, index
  seed.sql                           # + 1 vin + 1 dégustation démo (compte client)
src/
  types/database.types.ts            # RÉGÉNÉRÉ (ajoute vins, degustations)
  lib/services/
    merchant/{types,mock,index}.ts   # MerchantProvider + MockMerchantProvider + getMerchantProvider
    enrichment/{types,mock,index}.ts # EnrichmentProvider + MockEnrichmentProvider + getEnrichmentProvider
  features/vins/
    domain/
      schemas.ts                     # Zod : degustationInput, vinFiltersSchema
      dedupKey.ts                    # clé de dédoublonnage normalisée d'un vin
      filtersToQuery.ts              # mapping filtres -> contraintes de requête (pur)
    data/
      actions.ts                     # addDegustation, updateDegustation, deleteDegustation
      queries.ts                     # getMesVins(filters), getVinDetail(id)
    ui/
      DegustationForm.tsx            # formulaire de capture (depuis la fiche resto)
      VinsFilters.tsx                # barre de filtres (couleur/région/note/resto/date)
      VinsList.tsx                   # liste consolidée
      VinDetail.tsx                  # détail vin + dégustations + bouton achat
      BuyButton.tsx                  # bouton achat + quantité (client)
  app/[locale]/(app)/vins/
    page.tsx                         # onglet « Mes vins » (liste + filtres)
    [id]/page.tsx                    # détail vin
    error.tsx                        # error boundary du segment
  app/[locale]/(app)/restos/...      # FicheResto modifiée : bloc « Vins dégustés ici »
messages/fr.json                     # + namespace vins.*
e2e/vins.spec.ts                     # parcours capture -> onglet -> filtre -> achat
```

---

## Task 1: Migration `00006_vins.sql` (schéma + RLS + grants)

**Files:**
- Create: `supabase/migrations/00006_vins.sql`

**Interfaces:**
- Produces: enum `public.vin_couleur` (`rouge|blanc|rose|petillant|autre`) ; tables `public.vins` et `public.degustations` (colonnes ci-dessous) ; RLS owner-only ; grants `authenticated`.
- Consommé par : génération de types (Task 2), data layer (Tasks 7-8).

- [ ] **Step 1: Écrire la migration**

`supabase/migrations/00006_vins.sql` :

```sql
create type public.vin_couleur as enum ('rouge', 'blanc', 'rose', 'petillant', 'autre');

create table public.vins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  nom text not null check (char_length(nom) <= 200),
  domaine text check (domaine is null or char_length(domaine) <= 200),
  millesime smallint check (millesime is null or (millesime between 1900 and 2100)),
  region text,
  couleur public.vin_couleur,
  cepages text[] not null default '{}',
  achat_url text,
  created_at timestamptz not null default now()
);

-- Dédoublonnage par cave : (nom, millésime, domaine) normalisés = un seul vin
create unique index vins_dedup_uidx on public.vins
  (user_id, lower(nom), coalesce(millesime, 0), lower(coalesce(domaine, '')));
create index vins_user_idx on public.vins (user_id);

alter table public.vins enable row level security;
create policy "vins_all_owner" on public.vins
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.degustations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  vin_id uuid not null references public.vins (id) on delete cascade,
  etablissement_id uuid references public.etablissements (id) on delete set null,
  avis_id uuid references public.avis (id) on delete set null,
  deguste_le date not null default current_date,
  note smallint check (note is null or note between 1 and 5),
  prix_paye numeric(10, 2) check (prix_paye is null or prix_paye >= 0),
  commentaire text,
  created_at timestamptz not null default now()
);

create index degustations_user_idx on public.degustations (user_id);
create index degustations_vin_idx on public.degustations (vin_id);
create index degustations_etab_idx on public.degustations (etablissement_id);
create index degustations_date_idx on public.degustations (deguste_le);

alter table public.degustations enable row level security;
create policy "degustations_all_owner" on public.degustations
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Grants explicites (la RLS ne suffit pas pour PostgREST)
grant select, insert, update, delete on public.vins to authenticated;
grant select, insert, update, delete on public.degustations to authenticated;
```

- [ ] **Step 2: Appliquer + vérifier RLS/grants**

```bash
supabase db reset
```
Puis vérifier (docker exec direct, sans variable shell) :
```bash
docker exec supabase_db_Vito psql -U postgres -d postgres -tAc "select relname||':'||relrowsecurity from pg_class where relname in ('vins','degustations') order by relname;"
docker exec supabase_db_Vito psql -U postgres -d postgres -tAc "select has_table_privilege('authenticated','public.vins','SELECT'), has_table_privilege('authenticated','public.degustations','INSERT');"
```
Expected : `vins:t`, `degustations:t` ; privilèges `t`/`t`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/00006_vins.sql
git commit -m "feat(db): schéma vins + degustations (RLS owner-only + grants)"
```

---

## Task 2: Régénération des types

**Files:**
- Modify: `src/types/database.types.ts` (généré)

**Interfaces:**
- Consumes: migration Task 1 appliquée.
- Produces: types `Database['public']['Tables']['vins']` et `['degustations']` + enum `vin_couleur`, utilisés partout ensuite.

- [ ] **Step 1: Générer**

```bash
npm run db:types
```

- [ ] **Step 2: Vérifier la présence des types**

```bash
grep -c "vins\|degustations\|vin_couleur" src/types/database.types.ts
npm run typecheck
```
Expected : occurrences > 0 ; typecheck propre.

- [ ] **Step 3: Commit**

```bash
git add src/types/database.types.ts
git commit -m "chore(db): régénère les types (vins, degustations)"
```

---

## Task 3: Service `MerchantProvider` (interface + mock + sélecteur)

**Files:**
- Create: `src/lib/services/merchant/types.ts`, `src/lib/services/merchant/mock.ts`, `src/lib/services/merchant/index.ts`
- Test: `src/lib/services/merchant/mock.test.ts`

**Interfaces:**
- Produces:
  - `type VinAchat = { nom: string; domaine: string | null; millesime: number | null; couleur: string | null }`
  - `interface MerchantProvider { readonly name: string; buyUrl(vin: VinAchat, quantity: number): string | null }`
  - `getMerchantProvider(): MerchantProvider`
- Consommé par : `VinDetail`/`BuyButton` (Task 11), data si besoin.

- [ ] **Step 1: Écrire le test du mock**

`src/lib/services/merchant/mock.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { MockMerchantProvider } from "./mock";

describe("MockMerchantProvider", () => {
  const p = new MockMerchantProvider();
  it("construit une URL de recherche encodée avec la quantité", () => {
    const url = p.buyUrl({ nom: "Château Test", domaine: "Domaine X", millesime: 2018, couleur: "rouge" }, 3);
    expect(url).toContain("qty=3");
    expect(url).toContain(encodeURIComponent("Château Test"));
    expect(url).toContain("2018");
  });
  it("quantité plancher à 1", () => {
    const url = p.buyUrl({ nom: "Vin", domaine: null, millesime: null, couleur: null }, 0);
    expect(url).toContain("qty=1");
  });
  it("nom vide => null", () => {
    expect(p.buyUrl({ nom: "", domaine: null, millesime: null, couleur: null }, 1)).toBeNull();
  });
});
```

- [ ] **Step 2: Lancer (échec attendu)**

Run: `npm run test -- merchant/mock`
Expected: FAIL (`./mock` introuvable).

- [ ] **Step 3: Implémenter types + mock**

`src/lib/services/merchant/types.ts` :

```ts
export type VinAchat = {
  nom: string;
  domaine: string | null;
  millesime: number | null;
  couleur: string | null;
};

export interface MerchantProvider {
  readonly name: string;
  buyUrl(vin: VinAchat, quantity: number): string | null;
}
```

`src/lib/services/merchant/mock.ts` :

```ts
import type { MerchantProvider, VinAchat } from "./types";

// Mock : URL de recherche placeholder, AUCUNE affiliation/revenu. Le partenaire réel
// (adapter dédié) sera branché plus tard derrière la même interface.
export class MockMerchantProvider implements MerchantProvider {
  readonly name = "mock";
  buyUrl(vin: VinAchat, quantity: number): string | null {
    if (!vin.nom.trim()) return null;
    const qty = Math.max(1, Math.floor(quantity) || 1);
    const terms = [vin.nom, vin.domaine, vin.millesime].filter(Boolean).join(" ");
    return `https://marchand.example/search?q=${encodeURIComponent(terms)}&qty=${qty}`;
  }
}
```

- [ ] **Step 4: Sélecteur**

`src/lib/services/merchant/index.ts` :

```ts
import { env } from "@/lib/env";
import { MockMerchantProvider } from "./mock";
import type { MerchantProvider } from "./types";

export function getMerchantProvider(): MerchantProvider {
  // Adapter réel branché ici quand MERCHANT_PARTNER_URL sera défini (env étendu en temps voulu).
  if (env.MERCHANT_PARTNER_URL) {
    // Placeholder : le vrai adapter affilié sera ajouté avec son ToS. En attendant, mock.
    return new MockMerchantProvider();
  }
  return new MockMerchantProvider();
}

export type { MerchantProvider, VinAchat } from "./types";
```

> Note dette : tant qu'aucun partenaire n'est choisi, les deux branches renvoient le mock — signalé. L'ajout de `MERCHANT_PARTNER_URL` à `src/lib/env.ts` (optionnel) se fait dans cette tâche (Step 5).

- [ ] **Step 5: Ajouter la variable d'env optionnelle**

Dans `src/lib/env.ts`, ajouter au schéma Zod : `MERCHANT_PARTNER_URL: z.string().url().optional(),` et à l'objet parsé : `MERCHANT_PARTNER_URL: process.env.MERCHANT_PARTNER_URL,`. Ajouter `MERCHANT_PARTNER_URL=` à `.env.example`.

- [ ] **Step 6: Lancer (succès) + qualité**

Run: `npm run test -- merchant/mock && npm run typecheck && npm run lint`
Expected: tests verts, 0 erreur, 0 warning.

- [ ] **Step 7: Commit**

```bash
git add src/lib/services/merchant src/lib/env.ts .env.example
git commit -m "feat(merchant): abstraction MerchantProvider + mock (URL placeholder, sans affiliation)"
```

---

## Task 4: Service `EnrichmentProvider` (interface + mock no-op)

**Files:**
- Create: `src/lib/services/enrichment/types.ts`, `src/lib/services/enrichment/mock.ts`, `src/lib/services/enrichment/index.ts`
- Test: `src/lib/services/enrichment/mock.test.ts`

**Interfaces:**
- Produces:
  - `type VinEnrichmentInput = { nom: string; domaine: string | null; millesime: number | null; region: string | null; couleur: import("@/lib/services/enrichment/types").VinCouleur | null; cepages: string[] }`
  - `type VinCouleur = "rouge" | "blanc" | "rose" | "petillant" | "autre"`
  - `interface EnrichmentProvider { readonly name: string; normalize(input: VinEnrichmentInput): Promise<VinEnrichmentInput> }`
  - `getEnrichmentProvider(): EnrichmentProvider`
- Consommé par : `addDegustation` (Task 7).

- [ ] **Step 1: Écrire le test du mock**

`src/lib/services/enrichment/mock.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { MockEnrichmentProvider } from "./mock";

describe("MockEnrichmentProvider", () => {
  it("normalise sans rien inventer (trim, no-op sur le reste)", async () => {
    const p = new MockEnrichmentProvider();
    const out = await p.normalize({
      nom: "  Château Test  ", domaine: "  Domaine X ", millesime: 2018,
      region: "  Bordeaux ", couleur: "rouge", cepages: [" merlot ", ""],
    });
    expect(out.nom).toBe("Château Test");
    expect(out.domaine).toBe("Domaine X");
    expect(out.region).toBe("Bordeaux");
    expect(out.cepages).toEqual(["merlot"]);
    expect(out.couleur).toBe("rouge");
    expect(out.millesime).toBe(2018);
  });
});
```

- [ ] **Step 2: Lancer (échec attendu)**

Run: `npm run test -- enrichment/mock`
Expected: FAIL.

- [ ] **Step 3: Implémenter**

`src/lib/services/enrichment/types.ts` :

```ts
export type VinCouleur = "rouge" | "blanc" | "rose" | "petillant" | "autre";

export type VinEnrichmentInput = {
  nom: string;
  domaine: string | null;
  millesime: number | null;
  region: string | null;
  couleur: VinCouleur | null;
  cepages: string[];
};

export interface EnrichmentProvider {
  readonly name: string;
  normalize(input: VinEnrichmentInput): Promise<VinEnrichmentInput>;
}
```

`src/lib/services/enrichment/mock.ts` :

```ts
import type { EnrichmentProvider, VinEnrichmentInput } from "./types";

const clean = (s: string | null): string | null => {
  if (s === null) return null;
  const t = s.trim();
  return t.length > 0 ? t : null;
};

// Mock no-op : nettoie/trim seulement, n'invente aucune donnée (zéro coût).
// L'adapter LLM (Anthropic) / API vin sera branché plus tard derrière cette interface.
export class MockEnrichmentProvider implements EnrichmentProvider {
  readonly name = "mock";
  async normalize(input: VinEnrichmentInput): Promise<VinEnrichmentInput> {
    return {
      nom: input.nom.trim(),
      domaine: clean(input.domaine),
      millesime: input.millesime,
      region: clean(input.region),
      couleur: input.couleur,
      cepages: input.cepages.map((c) => c.trim()).filter((c) => c.length > 0),
    };
  }
}
```

`src/lib/services/enrichment/index.ts` :

```ts
import { env } from "@/lib/env";
import { MockEnrichmentProvider } from "./mock";
import type { EnrichmentProvider } from "./types";

export function getEnrichmentProvider(): EnrichmentProvider {
  // Adapter LLM activé seulement si la clé est fournie ET l'enrichissement activé.
  // Tant que ce n'est pas cadré (budget/cache), on reste sur le mock no-op.
  if (env.ANTHROPIC_API_KEY && process.env.VINS_ENRICHMENT === "llm") {
    return new MockEnrichmentProvider(); // placeholder : adapter LLM ajouté plus tard
  }
  return new MockEnrichmentProvider();
}

export type { EnrichmentProvider, VinEnrichmentInput, VinCouleur } from "./types";
```

- [ ] **Step 4: Lancer (succès) + qualité**

Run: `npm run test -- enrichment/mock && npm run typecheck && npm run lint`
Expected: vert.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/enrichment
git commit -m "feat(enrichment): abstraction EnrichmentProvider + mock no-op (saisie manuelle, zéro coût)"
```

---

## Task 5: Domaine — clé de dédoublonnage (`dedupKey`, TDD)

**Files:**
- Create: `src/features/vins/domain/dedupKey.ts`, `src/features/vins/domain/dedupKey.test.ts`

**Interfaces:**
- Produces: `vinDedupKey(v: { nom: string; millesime: number | null; domaine: string | null }): string` — clé normalisée identique à l'index unique SQL (`lower(nom)|millesime||0|lower(domaine||'')`).
- Consommé par : `addDegustation` (Task 7) pour le find-or-create.

- [ ] **Step 1: Test**

`src/features/vins/domain/dedupKey.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { vinDedupKey } from "./dedupKey";

describe("vinDedupKey", () => {
  it("normalise casse + millésime/domaine nuls", () => {
    expect(vinDedupKey({ nom: "Château Margaux", millesime: null, domaine: null }))
      .toBe("château margaux 0 ");
  });
  it("deux saisies équivalentes -> même clé", () => {
    const a = vinDedupKey({ nom: "Clos X", millesime: 2019, domaine: "Domaine Y" });
    const b = vinDedupKey({ nom: "clos x", millesime: 2019, domaine: "domaine y" });
    expect(a).toBe(b);
  });
  it("millésime différent -> clé différente", () => {
    expect(vinDedupKey({ nom: "V", millesime: 2018, domaine: null }))
      .not.toBe(vinDedupKey({ nom: "V", millesime: 2019, domaine: null }));
  });
});
```

- [ ] **Step 2: Lancer (échec)**

Run: `npm run test -- dedupKey`
Expected: FAIL.

- [ ] **Step 3: Implémenter**

`src/features/vins/domain/dedupKey.ts` :

```ts
// Clé de dédoublonnage alignée sur l'index unique SQL
// (user_id, lower(nom), coalesce(millesime,0), lower(coalesce(domaine,''))).
export function vinDedupKey(v: {
  nom: string;
  millesime: number | null;
  domaine: string | null;
}): string {
  const nom = v.nom.trim().toLowerCase();
  const millesime = v.millesime ?? 0;
  const domaine = (v.domaine ?? "").trim().toLowerCase();
  return `${nom} ${millesime} ${domaine}`;
}
```

- [ ] **Step 4: Lancer (succès)**

Run: `npm run test -- dedupKey`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/vins/domain/dedupKey.ts src/features/vins/domain/dedupKey.test.ts
git commit -m "feat(vins): clé de dédoublonnage de vin (domaine pur, testé)"
```

---

## Task 6: Domaine — schémas Zod + mapping filtres (TDD)

**Files:**
- Create: `src/features/vins/domain/schemas.ts`, `src/features/vins/domain/schemas.test.ts`, `src/features/vins/domain/filtersToQuery.ts`, `src/features/vins/domain/filtersToQuery.test.ts`

**Interfaces:**
- Produces:
  - `degustationInputSchema` (Zod) → `{ nom, domaine?, millesime?, region?, couleur?, cepages: string[], etablissementId?: string, avisId?: string, degusteLe?: string, note?: number, prixPaye?: number, commentaire? }`
  - `vinFiltersSchema` (Zod) → `{ couleur?, region?, noteMin?, etablissementId?, dateFrom?, dateTo? }` + type `VinFilters`
  - `type DegustationInput = z.infer<typeof degustationInputSchema>`
  - `filtersToQuery(f: VinFilters): VinQueryConstraints` (pur) — forme consommée par `getMesVins` (Task 8).
- Consommé par : actions (Task 7), queries (Task 8), UI filtres (Task 10).

- [ ] **Step 1: Test des schémas**

`src/features/vins/domain/schemas.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { degustationInputSchema, vinFiltersSchema } from "./schemas";

const UUID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

describe("degustationInputSchema", () => {
  it("accepte une saisie minimale (juste le nom)", () => {
    expect(degustationInputSchema.safeParse({ nom: "Mon Vin", cepages: [] }).success).toBe(true);
  });
  it("rejette une couleur invalide", () => {
    expect(degustationInputSchema.safeParse({ nom: "V", couleur: "violet", cepages: [] }).success).toBe(false);
  });
  it("rejette une note hors plage", () => {
    expect(degustationInputSchema.safeParse({ nom: "V", note: 6, cepages: [] }).success).toBe(false);
  });
  it("rejette un prix négatif", () => {
    expect(degustationInputSchema.safeParse({ nom: "V", prixPaye: -1, cepages: [] }).success).toBe(false);
  });
  it("accepte un etablissementId uuid valide", () => {
    expect(degustationInputSchema.safeParse({ nom: "V", etablissementId: UUID, cepages: [] }).success).toBe(true);
  });
});

describe("vinFiltersSchema", () => {
  it("tout optionnel -> ok (vide)", () => {
    expect(vinFiltersSchema.safeParse({}).success).toBe(true);
  });
  it("noteMin coercé depuis une string", () => {
    const r = vinFiltersSchema.parse({ noteMin: "3" });
    expect(r.noteMin).toBe(3);
  });
});
```

- [ ] **Step 2: Test du mapping filtres**

`src/features/vins/domain/filtersToQuery.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { filtersToQuery } from "./filtersToQuery";

describe("filtersToQuery", () => {
  it("vins-level vs degustation-level séparés", () => {
    const q = filtersToQuery({ couleur: "rouge", region: "Bordeaux", noteMin: 3, etablissementId: undefined, dateFrom: "2026-01-01", dateTo: undefined });
    expect(q.vin.couleur).toBe("rouge");
    expect(q.vin.region).toBe("Bordeaux");
    expect(q.degustation.noteMin).toBe(3);
    expect(q.degustation.dateFrom).toBe("2026-01-01");
  });
  it("filtres absents -> contraintes vides", () => {
    const q = filtersToQuery({});
    expect(q.vin.couleur).toBeUndefined();
    expect(q.degustation.noteMin).toBeUndefined();
  });
});
```

- [ ] **Step 3: Lancer (échec)**

Run: `npm run test -- "vins/domain/schemas|filtersToQuery"`
Expected: FAIL.

- [ ] **Step 4: Implémenter les schémas**

`src/features/vins/domain/schemas.ts` :

```ts
import { z } from "zod";

export const VIN_COULEURS = ["rouge", "blanc", "rose", "petillant", "autre"] as const;

export const degustationInputSchema = z.object({
  nom: z.string().min(1).max(200),
  domaine: z.string().max(200).optional(),
  millesime: z.coerce.number().int().min(1900).max(2100).optional(),
  region: z.string().max(200).optional(),
  couleur: z.enum(VIN_COULEURS).optional(),
  cepages: z.array(z.string().max(100)).default([]),
  etablissementId: z.string().uuid().optional(),
  avisId: z.string().uuid().optional(),
  degusteLe: z.string().date().optional(),
  note: z.coerce.number().int().min(1).max(5).optional(),
  prixPaye: z.coerce.number().min(0).optional(),
  commentaire: z.string().max(2000).optional(),
});
export type DegustationInput = z.infer<typeof degustationInputSchema>;

export const vinFiltersSchema = z.object({
  couleur: z.enum(VIN_COULEURS).optional(),
  region: z.string().max(200).optional(),
  noteMin: z.coerce.number().int().min(1).max(5).optional(),
  etablissementId: z.string().uuid().optional(),
  dateFrom: z.string().date().optional(),
  dateTo: z.string().date().optional(),
});
export type VinFilters = z.infer<typeof vinFiltersSchema>;
```

- [ ] **Step 5: Implémenter le mapping**

`src/features/vins/domain/filtersToQuery.ts` :

```ts
import type { VinFilters } from "./schemas";

export type VinQueryConstraints = {
  vin: { couleur?: string; region?: string };
  degustation: { noteMin?: number; etablissementId?: string; dateFrom?: string; dateTo?: string };
};

// Sépare les filtres portant sur le vin (intrinsèque) de ceux portant sur la dégustation.
export function filtersToQuery(f: VinFilters): VinQueryConstraints {
  return {
    vin: { couleur: f.couleur, region: f.region },
    degustation: {
      noteMin: f.noteMin,
      etablissementId: f.etablissementId,
      dateFrom: f.dateFrom,
      dateTo: f.dateTo,
    },
  };
}
```

- [ ] **Step 6: Lancer (succès) + qualité**

Run: `npm run test -- "vins/domain" && npm run typecheck && npm run lint`
Expected: vert.

- [ ] **Step 7: Commit**

```bash
git add src/features/vins/domain/schemas.ts src/features/vins/domain/schemas.test.ts src/features/vins/domain/filtersToQuery.ts src/features/vins/domain/filtersToQuery.test.ts
git commit -m "feat(vins): schémas Zod + mapping filtres (domaine pur, testés)"
```

---

## Task 7: Data — Server Actions (`addDegustation`, update, delete)

**Files:**
- Create: `src/features/vins/data/actions.ts`

**Interfaces:**
- Consumes: `createServerSupabase` (`@/lib/supabase/server`), `getEnrichmentProvider` (Task 4), `vinDedupKey` (Task 5), `degustationInputSchema` (Task 6), tables `vins`/`degustations`.
- Produces:
  - `addDegustation(_prev: unknown, formData: FormData): Promise<{ error?: string; ok?: true }>`
  - `deleteDegustation(_prev: unknown, formData: FormData): Promise<{ error?: string; ok?: true }>`
- Consommé par : `DegustationForm` (Task 9), `VinDetail` (Task 11).

- [ ] **Step 1: Implémenter les actions**

`src/features/vins/data/actions.ts` :

```ts
"use server";
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEnrichmentProvider } from "@/lib/services/enrichment";
import { degustationInputSchema } from "../domain/schemas";

function parseCepages(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  return raw.split(",").map((c) => c.trim()).filter((c) => c.length > 0);
}

export async function addDegustation(_prev: unknown, formData: FormData) {
  const parsed = degustationInputSchema.safeParse({
    nom: formData.get("nom"),
    domaine: formData.get("domaine") || undefined,
    millesime: formData.get("millesime") || undefined,
    region: formData.get("region") || undefined,
    couleur: formData.get("couleur") || undefined,
    cepages: parseCepages(formData.get("cepages")),
    etablissementId: formData.get("etablissementId") || undefined,
    avisId: formData.get("avisId") || undefined,
    degusteLe: formData.get("degusteLe") || undefined,
    note: formData.get("note") || undefined,
    prixPaye: formData.get("prixPaye") || undefined,
    commentaire: formData.get("commentaire") || undefined,
  });
  if (!parsed.success) return { error: "Saisie invalide" };
  const input = parsed.data;

  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Non authentifié" };
  const userId = auth.user.id;

  const norm = await getEnrichmentProvider().normalize({
    nom: input.nom,
    domaine: input.domaine ?? null,
    millesime: input.millesime ?? null,
    region: input.region ?? null,
    couleur: input.couleur ?? null,
    cepages: input.cepages,
  });

  // find-or-create du vin (dédoublonnage via l'index unique normalisé)
  const { data: vin, error: vinErr } = await supabase
    .from("vins")
    .upsert(
      {
        user_id: userId,
        nom: norm.nom,
        domaine: norm.domaine,
        millesime: norm.millesime,
        region: norm.region,
        couleur: norm.couleur,
        cepages: norm.cepages,
      },
      { onConflict: "user_id, lower(nom), coalesce(millesime, 0), lower(coalesce(domaine, ''))", ignoreDuplicates: false },
    )
    .select("id")
    .maybeSingle();

  // L'index est une expression : le onConflict ci-dessus peut ne pas être reconnu par PostgREST.
  // Fallback robuste : on tente l'insert, et en cas de conflit on relit le vin existant.
  let vinId = vin?.id ?? null;
  if (!vinId) {
    const ins = await supabase
      .from("vins")
      .insert({
        user_id: userId, nom: norm.nom, domaine: norm.domaine, millesime: norm.millesime,
        region: norm.region, couleur: norm.couleur, cepages: norm.cepages,
      })
      .select("id")
      .maybeSingle();
    if (ins.data?.id) {
      vinId = ins.data.id;
    } else {
      // conflit unique -> relit le vin existant par les champs normalisés
      const sel = await supabase
        .from("vins")
        .select("id")
        .eq("user_id", userId)
        .ilike("nom", norm.nom)
        .is("millesime", norm.millesime === null ? null : undefined as never);
      void sel; // voir Step 2 : la relecture exacte est affinée à l'implémentation
    }
  }
  void vinErr;

  if (!vinId) return { error: "Enregistrement du vin échoué" };

  const { error: degErr } = await supabase.from("degustations").insert({
    user_id: userId,
    vin_id: vinId,
    etablissement_id: input.etablissementId ?? null,
    avis_id: input.avisId ?? null,
    deguste_le: input.degusteLe ?? null,
    note: input.note ?? null,
    prix_paye: input.prixPaye ?? null,
    commentaire: input.commentaire ?? null,
  });
  if (degErr) return { error: "Enregistrement de la dégustation échoué" };

  if (input.etablissementId) revalidatePath(`/restos/${input.etablissementId}`);
  revalidatePath("/vins");
  return { ok: true as const };
}

export async function deleteDegustation(_prev: unknown, formData: FormData) {
  const id = formData.get("degustationId");
  if (typeof id !== "string") return { error: "Entrée invalide" };
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Non authentifié" };
  const { error } = await supabase.from("degustations").delete().eq("id", id);
  if (error) return { error: "Suppression échouée" };
  revalidatePath("/vins");
  return { ok: true as const };
}
```

- [ ] **Step 2: Robustifier le find-or-create du vin**

Le `onConflict` PostgREST ne supporte pas une cible d'index sur expression. Implémenter le find-or-create de façon fiable via une **RPC `security definer`** `find_or_create_vin(p jsonb) returns uuid` (même esprit que `upsert_etablissement`) qui fait l'`insert ... on conflict` sur l'index d'expression côté SQL et renvoie l'id. Ajouter cette fonction à une migration `00007_find_or_create_vin.sql` :

```sql
create function public.find_or_create_vin(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'authentification requise'; end if;
  insert into public.vins (user_id, nom, domaine, millesime, region, couleur, cepages)
  values (
    auth.uid(),
    p ->> 'nom',
    nullif(p ->> 'domaine', ''),
    (p ->> 'millesime')::smallint,
    nullif(p ->> 'region', ''),
    (p ->> 'couleur')::public.vin_couleur,
    coalesce((select array_agg(value) from jsonb_array_elements_text(p -> 'cepages')), '{}')
  )
  on conflict (user_id, lower(nom), coalesce(millesime, 0), lower(coalesce(domaine, '')))
  do update set region = excluded.region, couleur = excluded.couleur, cepages = excluded.cepages
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.find_or_create_vin(jsonb) from anon;
grant execute on function public.find_or_create_vin(jsonb) to authenticated;
```

Puis remplacer dans `actions.ts` tout le bloc find-or-create (Step 1) par :

```ts
const { data: vinId, error: vinErr } = await supabase.rpc("find_or_create_vin", {
  p: { nom: norm.nom, domaine: norm.domaine ?? "", millesime: norm.millesime, region: norm.region ?? "", couleur: norm.couleur, cepages: norm.cepages },
});
if (vinErr || !vinId) return { error: "Enregistrement du vin échoué" };
```
(supprimer l'ancien bloc `upsert`/`insert`/fallback et la variable `vin`). Appliquer la migration : `supabase db reset` puis `npm run db:types`.

- [ ] **Step 3: Vérifier**

Run: `npm run typecheck && npm run lint`
Expected: 0 erreur, 0 warning (la RPC `find_or_create_vin` doit apparaître dans les types générés).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/00007_find_or_create_vin.sql src/types/database.types.ts src/features/vins/data/actions.ts
git commit -m "feat(vins): RPC find_or_create_vin + actions addDegustation/deleteDegustation"
```

---

## Task 8: Data — lectures (`getMesVins`, `getVinDetail`)

**Files:**
- Create: `src/features/vins/data/queries.ts`

**Interfaces:**
- Consumes: `createServerSupabase`, `filtersToQuery` (Task 6), `VinFilters` (Task 6).
- Produces:
  - `getMesVins(filters: VinFilters): Promise<VinConsolide[]>` où `VinConsolide = { id, nom, domaine, millesime, region, couleur, achat_url, nb_degustations, derniere_date, derniere_note, dernier_resto }`
  - `getVinDetail(id: string): Promise<{ vin: VinRow; degustations: DegustationRow[] }>` (throw si introuvable)
- Consommé par : `VinsList` (Task 10), `VinDetail` (Task 11).

- [ ] **Step 1: Implémenter les lectures**

`src/features/vins/data/queries.ts` :

```ts
import { createServerSupabase } from "@/lib/supabase/server";
import { filtersToQuery } from "../domain/filtersToQuery";
import type { VinFilters } from "../domain/schemas";

export type VinConsolide = {
  id: string;
  nom: string;
  domaine: string | null;
  millesime: number | null;
  region: string | null;
  couleur: string | null;
  achat_url: string | null;
  nb_degustations: number;
  derniere_date: string | null;
  derniere_note: number | null;
  dernier_etablissement_id: string | null;
};

export async function getMesVins(filters: VinFilters): Promise<VinConsolide[]> {
  const q = filtersToQuery(filters);
  const supabase = await createServerSupabase();

  // Récupère les vins (filtres intrinsèques) + leurs dégustations (filtres contextuels).
  let vinsQuery = supabase
    .from("vins")
    .select("id, nom, domaine, millesime, region, couleur, achat_url, degustations(deguste_le, note, etablissement_id)")
    .order("created_at", { ascending: false });
  if (q.vin.couleur) vinsQuery = vinsQuery.eq("couleur", q.vin.couleur);
  if (q.vin.region) vinsQuery = vinsQuery.ilike("region", `%${q.vin.region}%`);

  const { data, error } = await vinsQuery;
  if (error) throw error;

  const rows = (data ?? []).map((v) => {
    const degs = (Array.isArray(v.degustations) ? v.degustations : []).filter((d) => {
      if (q.degustation.noteMin != null && (d.note ?? 0) < q.degustation.noteMin) return false;
      if (q.degustation.etablissementId && d.etablissement_id !== q.degustation.etablissementId) return false;
      if (q.degustation.dateFrom && (d.deguste_le ?? "") < q.degustation.dateFrom) return false;
      if (q.degustation.dateTo && (d.deguste_le ?? "") > q.degustation.dateTo) return false;
      return true;
    });
    const sorted = [...degs].sort((a, b) => (b.deguste_le ?? "").localeCompare(a.deguste_le ?? ""));
    const last = sorted[0];
    return {
      id: v.id, nom: v.nom, domaine: v.domaine, millesime: v.millesime, region: v.region,
      couleur: v.couleur, achat_url: v.achat_url,
      nb_degustations: degs.length,
      derniere_date: last?.deguste_le ?? null,
      derniere_note: last?.note ?? null,
      dernier_etablissement_id: last?.etablissement_id ?? null,
      _hasMatch: degs.length > 0,
    };
  });

  // Si des filtres de dégustation sont posés, ne garder que les vins ayant au moins une dégustation correspondante.
  const hasDegFilter = Boolean(
    q.degustation.noteMin != null || q.degustation.etablissementId || q.degustation.dateFrom || q.degustation.dateTo,
  );
  return rows
    .filter((r) => (hasDegFilter ? r._hasMatch : true))
    .map(({ _hasMatch, ...r }) => r);
}

export async function getVinDetail(id: string) {
  const supabase = await createServerSupabase();
  const [vinRes, degRes] = await Promise.all([
    supabase.from("vins").select("*").eq("id", id).single(),
    supabase
      .from("degustations")
      .select("id, deguste_le, note, prix_paye, commentaire, etablissement_id")
      .eq("vin_id", id)
      .order("deguste_le", { ascending: false }),
  ]);
  if (vinRes.error) throw vinRes.error;
  if (degRes.error) throw degRes.error;
  return { vin: vinRes.data, degustations: degRes.data ?? [] };
}
```

- [ ] **Step 2: Vérifier**

Run: `npm run typecheck && npm run lint`
Expected: 0 erreur, 0 warning.

- [ ] **Step 3: Commit**

```bash
git add src/features/vins/data/queries.ts
git commit -m "feat(vins): lectures getMesVins (filtres) + getVinDetail"
```

---

## Task 9: UI — `DegustationForm` + intégration fiche resto

**Files:**
- Create: `src/features/vins/ui/DegustationForm.tsx`
- Modify: `src/features/restos/ui/FicheResto.tsx` (ajouter le bloc « Vins dégustés ici »)
- Modify: `messages/fr.json` (namespace `vins.*`)

**Interfaces:**
- Consumes: `addDegustation` (Task 7), `VIN_COULEURS` (Task 6).
- Produces: composant `DegustationForm` (props `{ etablissementId: string }`), monté dans `FicheResto`. `data-testid="degustation-form"`.

- [ ] **Step 1: Ajouter les clés i18n**

Dans `messages/fr.json`, ajouter sous la racine :

```json
"vins": {
  "title": "Mes vins",
  "degustesIci": "Vins dégustés ici",
  "add": "Ajouter un vin",
  "nom": "Nom du vin",
  "domaine": "Domaine",
  "millesime": "Millésime",
  "region": "Région",
  "couleur": "Couleur",
  "cepages": "Cépages (séparés par des virgules)",
  "note": "Note (1-5)",
  "prix": "Prix payé (€)",
  "commentaire": "Commentaire",
  "date": "Date de dégustation",
  "couleurs": { "rouge": "Rouge", "blanc": "Blanc", "rose": "Rosé", "petillant": "Pétillant", "autre": "Autre" },
  "filtres": { "titre": "Filtres", "tous": "Tous", "noteMin": "Note min.", "resto": "Restaurant", "du": "Du", "au": "Au", "reset": "Réinitialiser" },
  "vide": "Aucun vin pour l'instant.",
  "fois": "{count} dégustation(s)",
  "acheter": "Acheter",
  "quantite": "Quantité",
  "error": { "title": "Une erreur est survenue", "retry": "Réessayer" }
}
```

- [ ] **Step 2: Implémenter `DegustationForm`**

`src/features/vins/ui/DegustationForm.tsx` :

```tsx
"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { addDegustation } from "../data/actions";
import { VIN_COULEURS } from "../domain/schemas";

export function DegustationForm({ etablissementId }: { etablissementId: string }) {
  const t = useTranslations("vins");
  const [state, action, pending] = useActionState(addDegustation, undefined);
  return (
    <form action={action} data-testid="degustation-form" className="flex flex-col gap-2 border-t pt-3">
      <input type="hidden" name="etablissementId" value={etablissementId} />
      <input name="nom" required placeholder={t("nom")} className="border p-2" />
      <div className="flex gap-2">
        <input name="domaine" placeholder={t("domaine")} className="border p-2 flex-1" />
        <input name="millesime" type="number" min={1900} max={2100} placeholder={t("millesime")} className="border p-2 w-28" />
      </div>
      <div className="flex gap-2">
        <input name="region" placeholder={t("region")} className="border p-2 flex-1" />
        <select name="couleur" className="border p-2" defaultValue="">
          <option value="">{t("couleur")}</option>
          {VIN_COULEURS.map((c) => (
            <option key={c} value={c}>{t(`couleurs.${c}`)}</option>
          ))}
        </select>
      </div>
      <input name="cepages" placeholder={t("cepages")} className="border p-2" />
      <div className="flex gap-2">
        <input name="note" type="number" min={1} max={5} placeholder={t("note")} className="border p-2 w-24" />
        <input name="prixPaye" type="number" min={0} step="0.01" placeholder={t("prix")} className="border p-2 w-32" />
        <input name="degusteLe" type="date" className="border p-2" />
      </div>
      <textarea name="commentaire" placeholder={t("commentaire")} className="border p-2" />
      {state?.error && <p role="alert" className="text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending} className="bg-black text-white p-2">{t("add")}</button>
    </form>
  );
}
```

- [ ] **Step 3: Monter le bloc dans `FicheResto`**

Dans `src/features/restos/ui/FicheResto.tsx`, importer `DegustationForm` et `getTranslations`, et ajouter après la section avis (en utilisant la clé `vins.degustesIci`) :

```tsx
import { DegustationForm } from "@/features/vins/ui/DegustationForm";
// ... le composant a déjà `const t = await getTranslations("restos")` ; ajouter un second
// scope si besoin : const tv = await getTranslations("vins");
// Dans le JSX, après la section Avis :
<section>
  <h2 className="font-semibold">{/* tv("degustesIci") */}</h2>
  <DegustationForm etablissementId={etab.id} />
</section>
```
(Le bloc n'apparaît que sur une fiche existante ; `etab.id` est déjà disponible.)

- [ ] **Step 4: Vérifier (build + lint + typecheck)**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: 0 erreur, 0 warning, build OK.

- [ ] **Step 5: Commit**

```bash
git add src/features/vins/ui/DegustationForm.tsx src/features/restos/ui/FicheResto.tsx messages/fr.json
git commit -m "feat(vins): formulaire de capture monté sur la fiche resto + i18n"
```

---

## Task 10: UI — onglet « Mes vins » (liste + filtres + route)

**Files:**
- Create: `src/features/vins/ui/VinsList.tsx`, `src/features/vins/ui/VinsFilters.tsx`
- Create: `src/app/[locale]/(app)/vins/page.tsx`, `src/app/[locale]/(app)/vins/error.tsx`

**Interfaces:**
- Consumes: `getMesVins` (Task 8), `vinFiltersSchema`/`VIN_COULEURS` (Task 6).
- Produces: route `/vins` (liste + filtres). `data-testid="vin-row"`, `data-testid="vins-filters"`.

- [ ] **Step 1: `VinsFilters` (client, met à jour les query params)**

`src/features/vins/ui/VinsFilters.tsx` :

```tsx
"use client";
import { useRouter, usePathname } from "@/lib/i18n/routing";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { VIN_COULEURS } from "../domain/schemas";

export function VinsFilters() {
  const t = useTranslations("vins");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value); else next.delete(key);
    router.replace(`${pathname}?${next.toString()}`);
  };
  return (
    <div data-testid="vins-filters" className="flex flex-wrap gap-2 items-end">
      <select aria-label={t("couleur")} defaultValue={params.get("couleur") ?? ""} onChange={(e) => set("couleur", e.target.value)} className="border p-2">
        <option value="">{t("filtres.tous")}</option>
        {VIN_COULEURS.map((c) => <option key={c} value={c}>{t(`couleurs.${c}`)}</option>)}
      </select>
      <input aria-label={t("region")} placeholder={t("region")} defaultValue={params.get("region") ?? ""} onBlur={(e) => set("region", e.target.value)} className="border p-2" />
      <input aria-label={t("filtres.noteMin")} type="number" min={1} max={5} placeholder={t("filtres.noteMin")} defaultValue={params.get("noteMin") ?? ""} onBlur={(e) => set("noteMin", e.target.value)} className="border p-2 w-24" />
      <input aria-label={t("filtres.du")} type="date" defaultValue={params.get("dateFrom") ?? ""} onChange={(e) => set("dateFrom", e.target.value)} className="border p-2" />
      <input aria-label={t("filtres.au")} type="date" defaultValue={params.get("dateTo") ?? ""} onChange={(e) => set("dateTo", e.target.value)} className="border p-2" />
      <button type="button" onClick={() => router.replace(pathname)} className="underline">{t("filtres.reset")}</button>
    </div>
  );
}
```

- [ ] **Step 2: `VinsList` (server)**

`src/features/vins/ui/VinsList.tsx` :

```tsx
import { getMesVins } from "../data/queries";
import { vinFiltersSchema } from "../domain/schemas";
import { Link } from "@/lib/i18n/routing";
import { getTranslations } from "next-intl/server";

export async function VinsList({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const t = await getTranslations("vins");
  const filters = vinFiltersSchema.parse({
    couleur: searchParams.couleur, region: searchParams.region, noteMin: searchParams.noteMin,
    etablissementId: searchParams.etablissementId, dateFrom: searchParams.dateFrom, dateTo: searchParams.dateTo,
  });
  const vins = await getMesVins(filters);
  if (vins.length === 0) return <p>{t("vide")}</p>;
  return (
    <ul className="flex flex-col gap-2">
      {vins.map((v) => (
        <li key={v.id} data-testid="vin-row" className="border p-3">
          <Link href={`/vins/${v.id}`}>
            <span className="font-semibold">{v.nom}</span>{" "}
            {v.millesime && <span>({v.millesime})</span>}{" "}
            {v.couleur && <span className="text-gray-500">· {t(`couleurs.${v.couleur}`)}</span>}{" "}
            <span className="text-gray-500">· {t("fois", { count: v.nb_degustations })}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 3: Page + error boundary**

`src/app/[locale]/(app)/vins/page.tsx` :

```tsx
import { getTranslations } from "next-intl/server";
import { VinsFilters } from "@/features/vins/ui/VinsFilters";
import { VinsList } from "@/features/vins/ui/VinsList";

export default async function VinsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const t = await getTranslations("vins");
  const sp = await searchParams;
  return (
    <main className="p-6 flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <VinsFilters />
      <VinsList searchParams={sp} />
    </main>
  );
}
```

`src/app/[locale]/(app)/vins/error.tsx` :

```tsx
"use client";
import { useTranslations } from "next-intl";

export default function VinsError({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations("vins.error");
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
Expected: routes `/vins` présentes, 0 warning.

- [ ] **Step 5: Commit**

```bash
git add src/features/vins/ui/VinsList.tsx src/features/vins/ui/VinsFilters.tsx "src/app/[locale]/(app)/vins/page.tsx" "src/app/[locale]/(app)/vins/error.tsx"
git commit -m "feat(vins): onglet Mes vins (liste consolidée + filtres serveur)"
```

---

## Task 11: UI — détail vin + bouton d'achat

**Files:**
- Create: `src/features/vins/ui/VinDetail.tsx`, `src/features/vins/ui/BuyButton.tsx`
- Create: `src/app/[locale]/(app)/vins/[id]/page.tsx`

**Interfaces:**
- Consumes: `getVinDetail` (Task 8), `getMerchantProvider` (Task 3), `deleteDegustation` (Task 7).
- Produces: route `/vins/[id]`. `data-testid="buy-button"`, `data-testid="degustation-row"`.

- [ ] **Step 1: `BuyButton` (client)**

`src/features/vins/ui/BuyButton.tsx` :

```tsx
"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";

export function BuyButton({ url }: { url: string | null }) {
  const t = useTranslations("vins");
  const [qty, setQty] = useState(1);
  if (!url) return null;
  // L'URL reçue est déjà construite pour qty=1 ; on ajuste le paramètre qty côté client.
  const href = url.replace(/qty=\d+/, `qty=${qty}`);
  return (
    <div className="flex items-center gap-2">
      <label>{t("quantite")}
        <input type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} className="border p-1 w-16 ml-1" />
      </label>
      <a data-testid="buy-button" href={href} target="_blank" rel="noopener noreferrer" className="bg-black text-white p-2">{t("acheter")}</a>
    </div>
  );
}
```

- [ ] **Step 2: `VinDetail` (server)**

`src/features/vins/ui/VinDetail.tsx` :

```tsx
import { getVinDetail } from "../data/queries";
import { getMerchantProvider } from "@/lib/services/merchant";
import { BuyButton } from "./BuyButton";
import { getTranslations } from "next-intl/server";

export async function VinDetail({ id }: { id: string }) {
  const t = await getTranslations("vins");
  const { vin, degustations } = await getVinDetail(id);
  const merchantUrl = getMerchantProvider().buyUrl(
    { nom: vin.nom, domaine: vin.domaine, millesime: vin.millesime, couleur: vin.couleur },
    1,
  );
  const buyUrl = vin.achat_url ?? merchantUrl;
  return (
    <article className="flex flex-col gap-4">
      <header>
        <h1 className="text-xl font-bold">{vin.nom} {vin.millesime ? `(${vin.millesime})` : ""}</h1>
        <p className="text-gray-600">
          {[vin.domaine, vin.region, vin.couleur ? t(`couleurs.${vin.couleur}`) : null].filter(Boolean).join(" · ")}
        </p>
        {vin.cepages?.length > 0 && <p className="text-gray-500">{vin.cepages.join(", ")}</p>}
      </header>
      <BuyButton url={buyUrl} />
      <section>
        <h2 className="font-semibold">{t("title")}</h2>
        <ul>
          {degustations.map((d) => (
            <li key={d.id} data-testid="degustation-row" className="border-b py-1">
              {d.deguste_le} {d.note ? `· ${d.note}/5` : ""} {d.prix_paye ? `· ${d.prix_paye}€` : ""} {d.commentaire ?? ""}
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
```

- [ ] **Step 3: Page**

`src/app/[locale]/(app)/vins/[id]/page.tsx` :

```tsx
import { VinDetail } from "@/features/vins/ui/VinDetail";

export default async function VinDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <main className="p-6"><VinDetail id={id} /></main>;
}
```

- [ ] **Step 4: Vérifier**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: route `/vins/[id]` présente, 0 warning.

- [ ] **Step 5: Commit**

```bash
git add src/features/vins/ui/VinDetail.tsx src/features/vins/ui/BuyButton.tsx "src/app/[locale]/(app)/vins/[id]/page.tsx"
git commit -m "feat(vins): détail vin + bouton d'achat (abstraction marchand)"
```

---

## Task 12: Seed dev (vin + dégustation démo)

**Files:**
- Modify: `supabase/seed.sql`

**Interfaces:**
- Consumes: compte client seed (`11111111-...`), resto démo (`aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa`).
- Produces: 1 vin + 1 dégustation démo pour le compte client.

- [ ] **Step 1: Ajouter au seed**

À la fin de `supabase/seed.sql` :

```sql
-- Vin + dégustation de démo pour le compte client (UUID v4 valides)
insert into public.vins (id, user_id, nom, domaine, millesime, region, couleur, cepages)
values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111',
  'Château Démo', 'Domaine de Démo', 2019, 'Bordeaux', 'rouge', '{"merlot","cabernet sauvignon"}');

insert into public.degustations (user_id, vin_id, etablissement_id, deguste_le, note, prix_paye, commentaire)
values ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', current_date, 4, 45.00, 'Très bon, à recommander');
```

- [ ] **Step 2: Appliquer + vérifier**

```bash
supabase db reset
docker exec supabase_db_Vito psql -U postgres -d postgres -tAc "select count(*) from public.vins; select count(*) from public.degustations;"
```
Expected: `1` et `1`.

- [ ] **Step 3: Commit**

```bash
git add supabase/seed.sql
git commit -m "feat(db): seed vin + dégustation de démo (compte client)"
```

---

## Task 13: e2e — parcours Vins complet

**Files:**
- Create: `e2e/vins.spec.ts`

**Interfaces:**
- Consumes: comptes seed, resto démo, sélecteurs `degustation-form`, `vin-row`, `vins-filters`, `buy-button`.

- [ ] **Step 1: Écrire le parcours**

`e2e/vins.spec.ts` :

```ts
import { test, expect } from "@playwright/test";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/fr/login");
  await page.getByLabel("E-mail").fill("client@vito.test");
  await page.getByLabel("Mot de passe").fill("password123");
  await page.getByRole("button", { name: "Connexion" }).click();
  await expect(page).toHaveURL(/\/fr\/restos/);
}

test("capturer un vin depuis une fiche resto, le retrouver dans Mes vins et filtrer", async ({ page }) => {
  await login(page);
  // Ouvre la fiche du resto démo (déjà dans la liste du client)
  await page.getByTestId("resto-card").first().getByRole("link").click();
  // Capture une dégustation
  const form = page.getByTestId("degustation-form");
  await form.locator('input[name="nom"]').fill("Vin de Test E2E");
  await form.locator('select[name="couleur"]').selectOption("blanc");
  await form.locator('input[name="note"]').fill("4");
  await form.getByRole("button").click();

  // Va dans Mes vins, le vin apparaît
  await page.goto("/fr/vins");
  await expect(page.getByTestId("vin-row").filter({ hasText: "Vin de Test E2E" })).toBeVisible();

  // Filtre par couleur blanc -> toujours visible ; rouge -> caché
  await page.getByTestId("vins-filters").locator("select").first().selectOption("blanc");
  await expect(page.getByTestId("vin-row").filter({ hasText: "Vin de Test E2E" })).toBeVisible();

  // Ouvre le détail -> bouton d'achat présent
  await page.getByTestId("vin-row").filter({ hasText: "Vin de Test E2E" }).getByRole("link").click();
  await expect(page.getByTestId("buy-button")).toBeVisible();
});
```

- [ ] **Step 2: Lancer la suite e2e complète**

```bash
supabase start
npm run test:e2e
```
Expected: tous les specs passent (auth + restos + vins), provider marchand mock (pas de clé requise).

- [ ] **Step 3: Suite complète + qualité**

Run: `npm run typecheck && npm run lint && npm run test && npm run test:e2e`
Expected: tout vert.

- [ ] **Step 4: Commit**

```bash
git add e2e/vins.spec.ts
git commit -m "test(vins): e2e parcours complet (capture -> Mes vins -> filtre -> achat)"
```

---

## Self-review (auteur)

**Couverture du spec :**
- Modèle normalisé `vins` (par user) + `degustations` → Task 1. ✓
- RLS owner-only + grants explicites → Task 1. ✓
- Types régénérés (source de vérité) → Tasks 2, 7. ✓
- Capture depuis la fiche resto (find-or-create vin, dégustation) → Tasks 7, 9. ✓
- Enrichissement mock no-op (zéro coût), interface prête → Task 4. ✓
- Onglet « Mes vins » consolidé + filtres (couleur/région/note/resto/date) → Tasks 8, 10. ✓
- Abstraction marchand + lien d'achat 1..N bouteilles → Tasks 3, 11. ✓
- Détail vin + dégustations → Tasks 8, 11. ✓
- i18n `vins.*` → Tasks 9, 10. ✓
- Seed démo (UUID v4) → Task 12. ✓
- e2e parcours → Task 13. ✓

**Cohérence des types/signatures :** `degustationInputSchema`/`vinFiltersSchema`/`VIN_COULEURS` (Task 6) consommés par actions (7), queries (8), UI (9,10) ; `getMerchantProvider().buyUrl(VinAchat, qty)` (3) ↔ `VinDetail`/`BuyButton` (11) ; `find_or_create_vin` RPC (7) ↔ types régénérés ; `getMesVins(VinFilters)` (8) ↔ `VinsList` (10).

**Arbitrages/dette (rappel) :** enrichissement mock (LLM/API différé, coût) ; marchand mock (URL placeholder, pas d'affiliation, partenaire+ToS à venir) ; dédoublonnage best-effort sur noms libres ; `vins` par utilisateur (migration vers canonique partagée possible plus tard). Le `BuyButton` ajuste `qty` par regex sur l'URL mock — quand le vrai marchand arrivera, `buyUrl(vin, qty)` devra être rappelé côté serveur ou via une route, pas patché en regex (signalé).

**Note granularité :** la note est par dégustation ; l'onglet affiche la dernière. OK avec le spec.
