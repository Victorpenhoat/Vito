# Resto+Hôtels Slice 1 — Migration 00020 + enrichissement rating — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Poser la fondation data de l'épic Resto+Hôtels : colonnes `reco_source`/`is_archived`/`archived_at` (liste_items) + `rating`/`rating_count` (etablissements), et remplir `rating` depuis Google à l'enrichissement.

**Architecture:** Migration additive + chaîne d'enrichissement `PlaceResult.rating` → `mapPlaceToEtablissement` → `upsert_etablissement(p jsonb)`. Aucun écran (affichage en Slice 2).

**Tech Stack:** Supabase (Postgres + RLS, RPC security definer), TypeScript strict, Vitest, Playwright, Google Places (mock en test).

## Global Constraints

- Migration **additive + idempotente** (`add column if not exists`), RLS inchangée, `upsert_etablissement` reste `security definer` + `set search_path=''` + garde `auth.uid()`.
- **Google Places mocké en test** (`getPlacesProvider` → mock sans clé). Secrets server-only. Tests RLS jamais contre la prod.
- TS strict, `lint` 0 warning, aucune chaîne en dur. Prochaine migration = **00020**. Types régénérés.
- **Prod** : migration 00020 additive, appliquée **avant le merge** UNIQUEMENT sur autorisation explicite du PO (« autorise la migration prod 00020 »).
- Réf. spec : `docs/superpowers/specs/2026-06-27-resto-hotels-slice-1-migration-rating-design.md`.

---

### Task 1: `PlaceResult.rating` + providers Google/mock

**Files:**
- Modify: `src/lib/services/places/types.ts`
- Modify: `src/lib/services/places/google.ts`
- Modify: `src/lib/services/places/mock.ts`
- Test: `src/lib/services/places/mock.test.ts`

**Interfaces:**
- Produces: `PlaceResult.rating: number | null`, `PlaceResult.ratingCount: number | null`.

- [ ] **Step 1: Étendre le type**

Dans `src/lib/services/places/types.ts`, ajouter à `PlaceResult` (après `priceLevel`) :
```ts
  rating: number | null;
  ratingCount: number | null;
```

- [ ] **Step 2: Test mock (échoue)**

Dans `src/lib/services/places/mock.test.ts`, ajouter (ou compléter le test `details`) :
```ts
it("details renvoie un rating numérique 0-5 + ratingCount", async () => {
  const r = await new MockPlacesProvider().details("mock_bistrot_1");
  expect(r).not.toBeNull();
  expect(typeof r!.rating).toBe("number");
  expect(r!.rating).toBeGreaterThanOrEqual(0);
  expect(r!.rating).toBeLessThanOrEqual(5);
  expect(typeof r!.ratingCount).toBe("number");
});
```
Run: `npm run test -- places/mock` → FAIL (rating absent).

- [ ] **Step 3: Mock provider**

Dans `src/lib/services/places/mock.ts`, ajouter `rating` + `ratingCount` à CHAQUE objet `PlaceResult`
renvoyé par `details(...)` (valeurs déterministes, ex. resto `rating: 4.6, ratingCount: 320` ; hôtels
`rating: 4.5, ratingCount: 210`). Si `details` construit les résultats depuis une table interne,
ajouter les deux champs partout pour que le type compile.

Run: `npm run test -- places/mock` → PASS.

- [ ] **Step 4: Google provider**

Dans `src/lib/services/places/google.ts`, méthode `details()` : remplir
`rating: typeof data.rating === "number" ? data.rating : null` et
`ratingCount: data.userRatingCount ?? data.user_ratings_total ?? null` (selon les champs réellement
mappés dans le fichier — l'implémenteur adapte au parsing existant ; `null` si absent). Ne pas changer
la signature.

- [ ] **Step 5: typecheck + lint + test + commit**

Run: `npm run typecheck && npm run lint && npm run test -- places`
Expected: PASS.
```bash
git add src/lib/services/places/types.ts src/lib/services/places/google.ts src/lib/services/places/mock.ts src/lib/services/places/mock.test.ts
git commit -m "feat(places): PlaceResult.rating/ratingCount (Google + mock)"
```

---

### Task 2: `mapPlaceToEtablissement` — rating

**Files:**
- Modify: `src/features/restos/domain/mapPlaceToEtablissement.ts`
- Test: `src/features/restos/domain/mapPlaceToEtablissement.test.ts` (créer si absent)

**Interfaces:**
- Consumes: `PlaceResult.rating`/`ratingCount` (Task 1).
- Produces: `EtablissementInput.rating: number | null`, `EtablissementInput.rating_count: number | null`.

- [ ] **Step 1: Test (échoue)**

Dans le test de `mapPlaceToEtablissement` (créer le fichier s'il n'existe pas, sur le modèle des autres
tests domaine), ajouter un cas vérifiant que le rating est mappé :
```ts
import { mapPlaceToEtablissement } from "./mapPlaceToEtablissement";
import type { PlaceResult } from "@/lib/services/places/types";

const base: PlaceResult = {
  placeId: "p1", nom: "Le Test", adresse: null, ville: "Paris", codePostal: "75011",
  lat: 48.8, lng: 2.3, telephone: null, website: null, priceLevel: 2, types: ["restaurant"],
  photoRefs: [], rating: 4.6, ratingCount: 320,
};

it("mappe rating et rating_count", () => {
  const e = mapPlaceToEtablissement(base, "resto");
  expect(e.rating).toBe(4.6);
  expect(e.rating_count).toBe(320);
});
```
Run: `npm run test -- mapPlaceToEtablissement` → FAIL (champs absents de `EtablissementInput`).

- [ ] **Step 2: Implémenter**

Dans `EtablissementInput` (même fichier) ajouter `rating: number | null;` et `rating_count: number | null;`.
Dans `mapPlaceToEtablissement(...)`, ajouter au retour : `rating: p.rating,` et `rating_count: p.ratingCount,`.

Run: `npm run test -- mapPlaceToEtablissement` → PASS.

- [ ] **Step 3: typecheck + lint + test + commit**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS.
```bash
git add src/features/restos/domain/mapPlaceToEtablissement.ts src/features/restos/domain/mapPlaceToEtablissement.test.ts
git commit -m "feat(restos): mapPlaceToEtablissement mappe rating/rating_count"
```

---

### Task 3: Migration 00020 + `upsert_etablissement` + types

**Files:**
- Create: `supabase/migrations/00020_resto_rating_archive.sql`
- Modify: `src/types/database.types.ts` (régénéré)

- [ ] **Step 1: Écrire la migration**

Create `supabase/migrations/00020_resto_rating_archive.sql` :

```sql
-- liste_items : source de reco + archivage (orthogonaux statut/favori)
alter table public.liste_items add column if not exists reco_source text;
alter table public.liste_items add column if not exists is_archived boolean not null default false;
alter table public.liste_items add column if not exists archived_at timestamptz;

-- etablissements : note Google (stockée à l'enrichissement)
alter table public.etablissements add column if not exists rating numeric(2,1)
  check (rating is null or (rating >= 0 and rating <= 5));
alter table public.etablissements add column if not exists rating_count integer
  check (rating_count is null or rating_count >= 0);

-- upsert_etablissement : version 00018 + rating/rating_count
create or replace function public.upsert_etablissement(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_place_id text := nullif(p ->> 'place_id', '');
  v_photo_ref text := nullif(p ->> 'photo_ref', '');
  v_rating numeric(2,1) := nullif(p ->> 'rating', '')::numeric;
  v_rating_count integer := nullif(p ->> 'rating_count', '')::integer;
begin
  if auth.uid() is null then
    raise exception 'authentification requise';
  end if;

  insert into public.etablissements
    (place_id, categorie, type, nom, adresse, ville, code_postal, arrondissement,
     lat, lng, telephone, website, price_level, source, enriched_at, photo_ref, photo_fetched_at,
     rating, rating_count)
  values (
    v_place_id,
    coalesce((p ->> 'categorie')::public.etablissement_categorie, 'resto'),
    p ->> 'type', p ->> 'nom', p ->> 'adresse', p ->> 'ville', p ->> 'code_postal', p ->> 'arrondissement',
    (p ->> 'lat')::double precision, (p ->> 'lng')::double precision,
    p ->> 'telephone', p ->> 'website', (p ->> 'price_level')::smallint,
    coalesce(p ->> 'source', 'places'),
    case when p ? 'enriched_at' then (p ->> 'enriched_at')::timestamptz else null end,
    v_photo_ref,
    case when v_photo_ref is not null then now() else null end,
    v_rating,
    v_rating_count
  )
  on conflict (place_id) do update set
    categorie = excluded.categorie, type = excluded.type, nom = excluded.nom,
    adresse = excluded.adresse, ville = excluded.ville, code_postal = excluded.code_postal,
    arrondissement = excluded.arrondissement, lat = excluded.lat, lng = excluded.lng,
    telephone = excluded.telephone, website = excluded.website, price_level = excluded.price_level,
    source = excluded.source, enriched_at = excluded.enriched_at,
    photo_ref = coalesce(excluded.photo_ref, public.etablissements.photo_ref),
    photo_fetched_at = case when excluded.photo_ref is not null then now() else public.etablissements.photo_fetched_at end,
    rating = coalesce(excluded.rating, public.etablissements.rating),
    rating_count = coalesce(excluded.rating_count, public.etablissements.rating_count)
  returning id into v_id;

  return v_id;
end;
$$;
```

- [ ] **Step 2: Appliquer + régénérer les types + vérifier**

Run: `supabase db reset`
Then: `supabase gen types typescript --local > src/types/database.types.ts 2>/dev/null`
Then verify (psql, sinon `docker exec -i supabase_db_Vito psql -U postgres -d postgres -c "..."`):
```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "
select column_name from information_schema.columns where table_name='liste_items' and column_name in ('reco_source','is_archived','archived_at');
select column_name from information_schema.columns where table_name='etablissements' and column_name in ('rating','rating_count');
"
```
Expected: 00001→00020 appliquées ; les 3 colonnes `liste_items` + 2 colonnes `etablissements` présentes. `database.types.ts` contient `rating`/`reco_source`/`is_archived`.

- [ ] **Step 3: typecheck + lint + test**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS (types régénérés compilent).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/00020_resto_rating_archive.sql src/types/database.types.ts
git commit -m "feat(resto-hotels): migration 00020 — reco_source/is_archived (liste_items) + rating (etablissements) + upsert"
```

---

### Task 4: Non-régression + build

**Files:** aucun (vérification).

- [ ] **Step 1: e2e complète + build (un seul reset)**

Run: `supabase db reset && npx playwright test --retries=0 && npm run build`
Expected: suite e2e **verte** (l'ajout de resto via recherche stocke maintenant le rating, non affiché — aucune régression) + build OK sans warning. (Flake connu `liste_items`/anon → relancer le fichier une fois.)

- [ ] **Step 2: Commit (si correctifs)**

```bash
git add -A && git commit -m "fix(resto-hotels): correctifs non-régression Slice 1" # seulement si nécessaire
```

---

## Notes d'exécution

- **Prod** : migration 00020 **additive**, à appliquer sur Resto_Hotels **avant le merge** — **UNIQUEMENT** sur autorisation explicite du PO (le contrôleur s'arrête avant `supabase db push` et demande « autorise la migration prod 00020 »).
- **Filet** : aucune table existante cassée ; `reco_source`/`is_archived` sans écran (Slices 3/6) ; rating stocké, affiché en Slice 2. e2e inchangé.
- La branche `restos-hotels-refonte` porte aussi le setup d'épic (directive + 3 maquettes) → la 1ʳᵉ PR couvre setup + Slice 1.
