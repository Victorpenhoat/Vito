# Slice 2 — Restos « Le Carnet » (vignettes photo + onglets + fiche hero) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-skinner l'écran Restos au style Le Carnet — vignettes avec vraie photo (cache `photo_ref`), onglets Tous/Favoris/À tester/Visités, fiche resto en hero — sans casser l'e2e.

**Architecture:** Migration additive 00018 (`etablissements.photo_ref`/`photo_fetched_at`, RPC `upsert_etablissement` étendu, fonction `cache_etablissement_photo`). Remplissage à l'ajout + paresseux à la consultation de fiche (`PhotoCacheSync`). Vignettes/fiche consomment le ref caché via le proxy `/api/places/photo` (octets jamais persistés).

**Tech Stack:** Supabase (migration + RPC security-definer + RLS), Next.js 16 (Server Components/Actions), Tailwind v4, next-intl (fr/en/it/es), Playwright, Vitest.

## Global Constraints

- **Conformité ToS** : on ne cache que la **référence** photo (+ `photo_fetched_at`) ; les octets ne sont JAMAIS persistés (proxy streaming `/api/places/photo` inchangé). Réf > 30 jours = périmée → rafraîchie au sync paresseux.
- **Aucun appel Google par ligne de liste** : la liste lit `photo_ref` caché ; les appels `details()` restent ceux de l'ajout et de la fiche.
- **e2e** : tous les `data-testid` conservés (`places-tabs`, `tab-favoris`, `tab-a-tester`, `places-search`, `place-card`, `resto-photo`, `avis-form`, `tag-picker`, `tags-saved`). **Seule modification autorisée** : l'assertion de défaut d'onglet dans `places.spec.ts` (Favoris → **Tous**). Ne JAMAIS affaiblir un test pour masquer une régression.
- **Défaut d'onglet = Tous.** Onglets : Tous / Favoris (`is_favorite`) / À tester (`statut='a_faire'`) / Visités (`statut='visite'`).
- Fondations Slice 0/1 en place (`font-serif`, `text-faint`, `border-line`, `border-accent`, kit). Style éditorial (coins 3-4px).
- Parité i18n (4 locales) garantie par `messages-parity.test.ts`. Pas de chaîne en dur.
- **Prochaine migration = 00018.** Migration **additive + idempotente**, appliquée sur prod AVANT le merge.
- TS strict (`noUncheckedIndexedAccess`). `ref` est réservé par React → le composant de sync utilise la prop `photoRef`, jamais `ref`.
- Réf. spec : `docs/superpowers/specs/2026-06-25-carnet-slice-2-restos-design.md`.

---

### Task 1: Migration 00018 (cache photo) + seed + types

**Files:**
- Create: `supabase/migrations/00018_photo_cache.sql`
- Modify: `supabase/seed.sql`
- Modify: `src/types/database.types.ts` (régénéré)

**Interfaces:**
- Produces : colonnes `etablissements.photo_ref text` + `photo_fetched_at timestamptz` ; `upsert_etablissement(p jsonb)` écrit `photo_ref`/`photo_fetched_at` quand `p.photo_ref` fourni ; fonction `cache_etablissement_photo(p_etab uuid, p_ref text)` (security-definer, grant authenticated).

- [ ] **Step 1: Écrire la migration**

Create `supabase/migrations/00018_photo_cache.sql`:
```sql
-- Cache de référence photo Google (octets jamais stockés ; conformité ToS via fraîcheur)
alter table public.etablissements
  add column if not exists photo_ref text,
  add column if not exists photo_fetched_at timestamptz;

-- upsert_etablissement étendu : écrit photo_ref + photo_fetched_at quand fourni.
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
begin
  if auth.uid() is null then
    raise exception 'authentification requise';
  end if;

  insert into public.etablissements
    (place_id, categorie, type, nom, adresse, ville, code_postal, arrondissement,
     lat, lng, telephone, website, price_level, source, enriched_at, photo_ref, photo_fetched_at)
  values (
    v_place_id,
    coalesce((p ->> 'categorie')::public.etablissement_categorie, 'resto'),
    p ->> 'type', p ->> 'nom', p ->> 'adresse', p ->> 'ville', p ->> 'code_postal', p ->> 'arrondissement',
    (p ->> 'lat')::double precision, (p ->> 'lng')::double precision,
    p ->> 'telephone', p ->> 'website', (p ->> 'price_level')::smallint,
    coalesce(p ->> 'source', 'places'),
    case when p ? 'enriched_at' then (p ->> 'enriched_at')::timestamptz else null end,
    v_photo_ref,
    case when v_photo_ref is not null then now() else null end
  )
  on conflict (place_id) do update set
    categorie = excluded.categorie, type = excluded.type, nom = excluded.nom,
    adresse = excluded.adresse, ville = excluded.ville, code_postal = excluded.code_postal,
    arrondissement = excluded.arrondissement, lat = excluded.lat, lng = excluded.lng,
    telephone = excluded.telephone, website = excluded.website, price_level = excluded.price_level,
    source = excluded.source, enriched_at = excluded.enriched_at,
    -- garde l'ancienne réf si la nouvelle est nulle ; horodate seulement sur nouvelle réf
    photo_ref = coalesce(excluded.photo_ref, public.etablissements.photo_ref),
    photo_fetched_at = case when excluded.photo_ref is not null then now() else public.etablissements.photo_fetched_at end
  returning id into v_id;

  return v_id;
end;
$$;
revoke execute on function public.upsert_etablissement(jsonb) from anon;
grant execute on function public.upsert_etablissement(jsonb) to authenticated;

-- Remplissage paresseux de la réf photo (référentiel système → écriture via fonction security-definer)
create or replace function public.cache_etablissement_photo(p_etab uuid, p_ref text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'authentification requise';
  end if;
  if nullif(p_ref, '') is null then
    return;
  end if;
  update public.etablissements
    set photo_ref = p_ref, photo_fetched_at = now()
    where id = p_etab;
end;
$$;
revoke execute on function public.cache_etablissement_photo(uuid, text) from anon;
grant execute on function public.cache_etablissement_photo(uuid, text) to authenticated;
```

- [ ] **Step 2: Seeder une réf photo sur le resto démo**

In `supabase/seed.sql`, the demo Bistrot insert (currently columns `... arrondissement, source`) — add `photo_ref` so the vignette shows a photo in dev/e2e. Replace:
```sql
insert into public.etablissements (id, place_id, categorie, type, nom, adresse, ville, code_postal, arrondissement, source)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'demo_place_1', 'resto', 'bistrot',
  'Le Bistrot Démo', '10 rue de Démo', 'Paris', '75017', '17e', 'seed');
```
with:
```sql
insert into public.etablissements (id, place_id, categorie, type, nom, adresse, ville, code_postal, arrondissement, source, photo_ref, photo_fetched_at)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'demo_place_1', 'resto', 'bistrot',
  'Le Bistrot Démo', '10 rue de Démo', 'Paris', '75017', '17e', 'seed', 'mock_photo_1', now());
```

- [ ] **Step 3: Appliquer + régénérer les types + vérifier**

Run: `supabase db reset`
Then: `supabase gen types typescript --local > src/types/database.types.ts 2>/dev/null`
Then verify:
```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "
select column_name from information_schema.columns where table_name='etablissements' and column_name in ('photo_ref','photo_fetched_at');
select proname from pg_proc where proname='cache_etablissement_photo';
"
```
Expected: 00001→00018 appliquées ; colonnes `photo_ref`+`photo_fetched_at` présentes ; fonction `cache_etablissement_photo` listée. (Si `psql` absent : `docker exec -i supabase_db_Vito psql -U postgres -d postgres -c "..."`.) Vérifier que `database.types.ts` contient bien `photo_ref` sur `etablissements`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/00018_photo_cache.sql supabase/seed.sql src/types/database.types.ts
git commit -m "feat(carnet): cache photo_ref (migration 00018 + RPC étendu + cache_etablissement_photo)"
```

---

### Task 2: Data — photo_ref dans le mapping, getPlaces et le type Place

**Files:**
- Modify: `src/features/restos/domain/mapPlaceToEtablissement.ts`
- Modify: `src/features/restos/domain/mapPlaceToEtablissement.test.ts`
- Modify: `src/features/places/domain/filterPlaces.ts` (type `Place`)
- Modify: `src/features/places/data/queries.ts` (`getPlaces`)

**Interfaces:**
- Consumes : colonnes de Task 1 ; `PlaceResult.photoRefs` (existant).
- Produces : `EtablissementInput` gagne `photo_ref: string | null` ; `Place.etablissement` gagne `photo_ref: string | null` ; `getPlaces` sélectionne `photo_ref`. (`getFiche` utilise déjà `select("*")` → aucun changement, `photo_ref`/`photo_fetched_at` arrivent automatiquement.)

- [ ] **Step 1: Mettre à jour le test de mapping (échec attendu)**

In `src/features/restos/domain/mapPlaceToEtablissement.test.ts`, add to the first test (after `expect(e.source)...`):
```ts
    expect(e.photo_ref).toBe("p");
```
(Le `place` de test a `photoRefs: ["p"]`.)

- [ ] **Step 2: Lancer le test → échec**

Run: `npm run test -- mapPlaceToEtablissement`
Expected: FAIL (`photo_ref` absent du retour).

- [ ] **Step 3: Ajouter `photo_ref` au mapping**

In `src/features/restos/domain/mapPlaceToEtablissement.ts` : add `photo_ref: string | null;` to the `EtablissementInput` type, and in the returned object add:
```ts
    photo_ref: p.photoRefs[0] ?? null,
```

- [ ] **Step 4: Lancer le test → succès**

Run: `npm run test -- mapPlaceToEtablissement`
Expected: PASS.

- [ ] **Step 5: Étendre le type `Place` + `getPlaces`**

In `src/features/places/domain/filterPlaces.ts`, add `photo_ref: string | null` to `etablissement`:
```ts
  etablissement: { id: string; nom: string; type: string | null; ville: string | null; arrondissement: string | null; categorie: "resto" | "hotel"; photo_ref: string | null };
```
In `src/features/places/data/queries.ts`, add `photo_ref` to the embedded select:
```ts
      "id, statut, is_favorite, etablissement:etablissements!inner(id, nom, type, ville, arrondissement, categorie, photo_ref), tags:liste_item_tags(tag:tags(slug, label, color))"
```
(Le mapping `as Place[]` reste valable.)

- [ ] **Step 6: Vérifier typecheck + lint + unit**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS (filterPlaces inchangé toujours vert ; mapping testé).

- [ ] **Step 7: Commit**

```bash
git add src/features/restos/domain/mapPlaceToEtablissement.ts src/features/restos/domain/mapPlaceToEtablissement.test.ts src/features/places/domain/filterPlaces.ts src/features/places/data/queries.ts
git commit -m "feat(carnet): photo_ref dans mapPlace, type Place et getPlaces"
```

---

### Task 3: Remplissage paresseux — action + composant `PhotoCacheSync`

**Files:**
- Modify: `src/features/restos/data/actions.ts` (action `cacheEtablissementPhoto`)
- Create: `src/features/restos/ui/PhotoCacheSync.tsx`

**Interfaces:**
- Consumes : RPC `cache_etablissement_photo` (Task 1).
- Produces : server action `cacheEtablissementPhoto(etabId: string, photoRef: string): Promise<void>` ; composant client `PhotoCacheSync({ etabId: string; photoRef: string })` (à monter uniquement quand un sync est nécessaire ; déclenche l'action une fois au montage).

- [ ] **Step 1: Ajouter l'action serveur**

In `src/features/restos/data/actions.ts` (fichier déjà `"use server"`), append:
```ts
export async function cacheEtablissementPhoto(etabId: string, photoRef: string) {
  if (!photoRef) return;
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;
  await supabase.rpc("cache_etablissement_photo", { p_etab: etabId, p_ref: photoRef });
}
```

- [ ] **Step 2: Créer `PhotoCacheSync.tsx`**

Create `src/features/restos/ui/PhotoCacheSync.tsx`:
```tsx
"use client";
import { useEffect, useRef } from "react";
import { cacheEtablissementPhoto } from "../data/actions";

// Rendu uniquement quand le cache doit être (re)rempli ; déclenche l'écriture une seule fois.
export function PhotoCacheSync({ etabId, photoRef }: { etabId: string; photoRef: string }) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !photoRef) return;
    done.current = true;
    void cacheEtablissementPhoto(etabId, photoRef);
  }, [etabId, photoRef]);
  return null;
}
```

- [ ] **Step 3: Vérifier typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/restos/data/actions.ts src/features/restos/ui/PhotoCacheSync.tsx
git commit -m "feat(carnet): remplissage paresseux du cache photo (action + PhotoCacheSync)"
```

---

### Task 4: UI liste — i18n + PlacesTabs (4 onglets, défaut Tous) + PlaceCard vignette

**Files:**
- Modify: `messages/fr.json`, `messages/en.json`, `messages/it.json`, `messages/es.json`
- Modify: `src/features/places/ui/PlacesTabs.tsx`
- Modify: `src/features/places/ui/PlaceCard.tsx`

**Interfaces:**
- Consumes : `Place` (avec `etablissement.photo_ref`, Task 2), `filterPlaces`, clés `places.*`.
- Produces : `PlacesTabs` à 4 onglets (testids `tab-tous`/`tab-favoris`/`tab-a-tester`/`tab-visites`, défaut `tous`) ; `PlaceCard` en vignette photo.

- [ ] **Step 1: i18n — `places.tous` et `places.visites`**

Sous l'objet `places` de chaque locale, ajouter `tous` et `visites` :
- fr : `"tous": "Tous"`, `"visites": "Visités"`
- en : `"tous": "All"`, `"visites": "Visited"`
- it : `"tous": "Tutti"`, `"visites": "Visitati"`
- es : `"tous": "Todos"`, `"visites": "Visitados"`

- [ ] **Step 2: Vérifier la parité**

Run: `npm run test -- messages-parity`
Expected: PASS.

- [ ] **Step 3: Réécrire `PlacesTabs.tsx` (4 onglets + compteurs + défaut Tous)**

Replace `src/features/places/ui/PlacesTabs.tsx` with:
```tsx
"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { filterPlaces, type Place } from "../domain/filterPlaces";
import { PlaceCard } from "./PlaceCard";

type Tab = "tous" | "favoris" | "a_tester" | "visites";

export function PlacesTabs({ category: _category, places }: { category: "resto" | "hotel"; places: Place[] }) {
  const t = useTranslations("places");
  const [tab, setTab] = useState<Tab>("tous");
  const [q, setQ] = useState("");

  const subset = (k: Tab) =>
    k === "favoris" ? places.filter((p) => p.is_favorite)
    : k === "a_tester" ? places.filter((p) => p.statut === "a_faire")
    : k === "visites" ? places.filter((p) => p.statut === "visite")
    : places;

  const tabs: { key: Tab; testid: string; label: string }[] = [
    { key: "tous", testid: "tab-tous", label: t("tous") },
    { key: "favoris", testid: "tab-favoris", label: t("favoris") },
    { key: "a_tester", testid: "tab-a-tester", label: t("aTester") },
    { key: "visites", testid: "tab-visites", label: t("visites") },
  ];

  const shown = filterPlaces(subset(tab), q);

  return (
    <div data-testid="places-tabs" className="flex flex-col gap-4">
      <div className="flex gap-6 border-b border-line" role="tablist">
        {tabs.map((it) => {
          const active = tab === it.key;
          return (
            <button
              key={it.key}
              type="button"
              role="tab"
              data-testid={it.testid}
              aria-selected={active}
              onClick={() => setTab(it.key)}
              className={`-mb-px border-b-2 pb-3 text-sm ${active ? "border-ink font-semibold text-ink" : "border-transparent text-muted"}`}
            >
              {it.label} <span className="text-faint">· {subset(it.key).length}</span>
            </button>
          );
        })}
      </div>
      <input
        data-testid="places-search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t("searchPlaceholder")}
        className="rounded-control border border-line bg-surface px-3 py-2 text-sm outline-none focus:outline-2 focus:outline-accent"
      />
      {shown.length === 0 ? (
        <p className="text-sm text-muted">{t("empty")}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {shown.map((p) => (
            <PlaceCard key={p.id} place={p} />
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Réécrire `PlaceCard.tsx` (vignette photo)**

Replace `src/features/places/ui/PlaceCard.tsx` with:
```tsx
import { Link } from "@/lib/i18n/routing";
import { Badge } from "@/features/shared/ui/Badge";
import type { Place } from "../domain/filterPlaces";

export function PlaceCard({ place }: { place: Place }) {
  const { etablissement, tags, is_favorite } = place;
  const subtitle = [etablissement.type, etablissement.ville].filter(Boolean).join(" · ");
  const photoUrl = etablissement.photo_ref
    ? `/api/places/photo?ref=${encodeURIComponent(etablissement.photo_ref)}&w=800`
    : null;
  const initial = etablissement.nom.charAt(0).toUpperCase();

  return (
    <li data-testid="place-card">
      <Link
        href={`/restos/${etablissement.id}`}
        className="block overflow-hidden rounded-card border border-line bg-surface"
      >
        <div className="relative h-40 bg-[linear-gradient(135deg,var(--hero-from),var(--hero-to))]">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt={etablissement.nom} className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center font-serif text-4xl text-faint">{initial}</span>
          )}
          {is_favorite && (
            <span aria-label="favori" className="absolute right-3 top-3 text-lg text-gold drop-shadow">★</span>
          )}
        </div>
        <div className="flex flex-col gap-1 p-4">
          {etablissement.type && (
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">{etablissement.type}</span>
          )}
          <span className="font-serif text-xl font-medium text-ink">{etablissement.nom}</span>
          {subtitle && <span className="text-sm text-muted">{etablissement.ville}</span>}
          {tags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {tags.map((tag) => (
                <Badge key={tag.slug} style={tag.color ? { backgroundColor: tag.color } : undefined} className={tag.color ? "text-white" : ""}>
                  {tag.label}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </Link>
    </li>
  );
}
```

- [ ] **Step 5: Vérifier typecheck + lint + unit**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS (parité i18n incluse).

- [ ] **Step 6: Commit**

```bash
git add messages/fr.json messages/en.json messages/it.json messages/es.json src/features/places/ui/PlacesTabs.tsx src/features/places/ui/PlaceCard.tsx
git commit -m "feat(carnet): Restos liste — 4 onglets (défaut Tous) + vignettes photo"
```

---

### Task 5: Fiche resto en hero photo + sync paresseux

**Files:**
- Modify: `src/features/restos/ui/FicheResto.tsx`

**Interfaces:**
- Consumes : `getFiche` (renvoie `etab.photo_ref`/`etab.photo_fetched_at` via `select("*")`) ; `PhotoCacheSync` (Task 3) ; proxy `/api/places/photo`.

- [ ] **Step 1: Remplacer l'en-tête + la rangée de photos par un hero**

In `src/features/restos/ui/FicheResto.tsx`:
- Add import: `import { PhotoCacheSync } from "./PhotoCacheSync";`
- After `photoRefs` is computed, add the sync decision:
```tsx
  const heroRef = photoRefs[0] ?? null;
  const STALE_MS = 30 * 24 * 60 * 60 * 1000;
  const fetchedAt = etab.photo_fetched_at ? new Date(etab.photo_fetched_at).getTime() : 0;
  const shouldSync = heroRef !== null && (heroRef !== etab.photo_ref || Date.now() - fetchedAt > STALE_MS);
```
- Replace the current header + photo block:
```tsx
      <header>
        <h1 className="text-xl font-bold text-ink">{etab.nom}</h1>
        <p className="text-muted">{etab.type} — {etab.adresse} {etab.arrondissement ?? ""}</p>
        {etab.telephone && <p>{etab.telephone}</p>}
      </header>
      {photoRefs.length > 0 && (
        <div className="flex gap-2 overflow-x-auto">
          {photoRefs.map((ref) => (
            <Image
              key={ref}
              src={`/api/places/photo?ref=${encodeURIComponent(ref)}&w=400`}
              alt={etab.nom}
              width={400}
              height={267}
              className="rounded object-cover"
              data-testid="resto-photo"
            />
          ))}
        </div>
      )}
```
with:
```tsx
      <div className="relative overflow-hidden rounded-card bg-[linear-gradient(135deg,var(--hero-from),var(--hero-to))]">
        {heroRef && (
          <Image
            src={`/api/places/photo?ref=${encodeURIComponent(heroRef)}&w=1200`}
            alt={etab.nom}
            width={1200}
            height={420}
            className="h-56 w-full object-cover md:h-72"
            data-testid="resto-photo"
          />
        )}
        <div className={`${heroRef ? "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent text-white" : "text-ink"} p-5`}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-90">
            {[etab.type, etab.arrondissement ?? etab.ville].filter(Boolean).join(" · ")}
          </div>
          <h1 className="font-serif text-3xl font-medium md:text-4xl">{etab.nom}</h1>
          {etab.telephone && <p className="mt-1 text-sm opacity-90">{etab.telephone}</p>}
        </div>
      </div>
      {shouldSync && heroRef && <PhotoCacheSync etabId={etab.id} photoRef={heroRef} />}
```
(Le reste de la fiche — `FavoriteToggle`, `TagPicker`, avis, vins, conciergerie, voyage — reste inchangé. Garder l'import `Image`.)

- [ ] **Step 2: Vérifier typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 3: e2e fiche (non-régression ciblée)**

Run: `supabase db reset && npx playwright test e2e/restos.spec.ts --retries=0`
Expected: PASS sans modifier le spec (`resto-photo` visible sur la fiche d'un resto mock ; `avis-form`/`tag-picker`/`tags-saved` conservés ; ajout via `tab-a-tester`). Retry une fois si le webServer échoue.

- [ ] **Step 4: Commit**

```bash
git add src/features/restos/ui/FicheResto.tsx
git commit -m "feat(carnet): fiche resto en hero photo + sync paresseux du cache"
```

---

### Task 6: e2e (défaut Tous) + non-régression complète + build

**Files:**
- Modify: `e2e/places.spec.ts`

**Interfaces:**
- Consumes : tout ce qui précède.

- [ ] **Step 1: Mettre à jour l'assertion de défaut dans `places.spec.ts`**

Le défaut d'onglet est désormais **Tous** (changement de comportement validé). Dans `e2e/places.spec.ts`, remplacer le test « onglet Favoris est actif par défaut » par une assertion sur Tous (le seed = 1 resto « Le Bistrot Démo », favori + a_faire → Tous=1) :
```ts
test("onglet Tous est actif par défaut et contient le resto seedé", async ({ page }) => {
  await login(page);
  await expect(page.getByTestId("tab-tous")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("place-card")).toHaveCount(1);
  await expect(page.getByTestId("place-card").first()).toContainText("Bistrot");
});
```
Ne PAS toucher les autres tests (`tab-a-tester`, recherche) — ils restent valides (clic explicite sur l'onglet ; le resto seedé est a_faire). C'est une mise à jour du comportement attendu, pas un affaiblissement.

- [ ] **Step 2: Suite e2e complète + build**

Run: `supabase db reset && npx playwright test --retries=0 && npm run build`
Expected: suite complète **verte** + build OK. Un seul `db reset` avant. Si un spec autre que `places.spec` casse, corriger le composant (testid/flux), **pas** le test. Retry une fois si le webServer échoue.

- [ ] **Step 3: Commit**

```bash
git add e2e/places.spec.ts
git commit -m "test(carnet): défaut d'onglet Tous (places.spec) + non-régression Slice 2"
```

---

## Notes d'exécution

- **Ordre** : T1 (migration+seed+types) → T2 (data) → T3 (action+composant) → T4 (liste : i18n+onglets+vignette) → T5 (fiche hero) → T6 (e2e+build).
- **Prod** : appliquer la migration 00018 sur Resto_Hotels **avant** le merge (au « go prod »), puis merge → Vercel redéploie.
- **Filet** : si un e2e autre que `places.spec` casse, c'est un testid/flux modifié par inadvertance → réparer le composant, jamais le test.
- `Date.now()` est utilisé dans `FicheResto` (Server Component) pour la fraîcheur — c'est du code applicatif normal (rien à voir avec les restrictions des scripts d'orchestration).
