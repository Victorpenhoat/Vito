# Slice Hôtels (épic places) — onglet /hotels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter l'onglet Hôtels (`/hotels` liste+carte+recherche, `/hotels/[id]` fiche) en réutilisant l'infra générique places, sans migration ni casse e2e.

**Architecture:** Généraliser `RestoSearch` → `PlaceSearch` (paramétré par catégorie) ; `PlaceCard` lie selon la catégorie ; `FicheResto` devient category-aware ; `addHotel` ; routes `/hotels` + `/hotels/[id]` ; nav-config + i18n + seed hôtel. Front-only.

**Tech Stack:** Next.js 16, next-intl (fr/en/it/es), Supabase, Vitest, Playwright. Google Places via `searchPlaces`/`addResto`/`addHotel`.

## Global Constraints

- **Aucune migration, front-only** (le seed hôtel est local/e2e ; en prod /hotels est vide jusqu'au 1er ajout).
- **e2e existants verts SANS modification** : `restos.spec` (`add-resto-search`/`search-result`/flux `addResto` ; `place-card` resto lie `/restos/`), `places.spec`, etc.
- **Zéro duplication** : `RestoSearch` supprimé, remplacé par `PlaceSearch` générique (utilisé par Restos ET Hôtels).
- `PlaceCard` lie `/${categorie==="hotel"?"hotels":"restos"}/${id}`. `FicheResto` prop `category` défaut `"restaurant"`.
- Namespace i18n `places` pour `PlaceSearch`. Parité 4 locales. Pas de chaîne en dur. TS strict.
- Réf. spec : `docs/superpowers/specs/2026-06-26-places-hotels-design.md`.

---

### Task 1: i18n (déplacement + ajouts) + seed hôtel

**Files:**
- Modify: `messages/fr.json`, `messages/en.json`, `messages/it.json`, `messages/es.json`
- Modify: `supabase/seed.sql`

**Interfaces:**
- Produces : `places.search/add/resFavoris/resATester/resExternes` ; `nav.hotels` ; `hotels.title`. Retrait de `restos.search/add/resFavoris/resATester/resExternes`. Seed : un hôtel dans la liste du client.

- [ ] **Step 1: Déplacer les clés vers `places` + ajouter nav/hotels (4 locales)**

Dans chaque `messages/<loc>.json` :
- Sous `places`, AJOUTER (valeurs reprises des `restos.*` actuels) : `search`, `add`, `resFavoris`, `resATester`, `resExternes`.
  - fr : `"search":"Rechercher un établissement"`, `"add":"Ajouter"`, `"resFavoris":"Tes favoris"`, `"resATester":"À tester"`, `"resExternes":"Ajouter depuis Google"`
  - en : `"search":"Search a place"`, `"add":"Add"`, `"resFavoris":"Your favorites"`, `"resATester":"To try"`, `"resExternes":"Add from Google"`
  - it : `"search":"Cerca un locale"`, `"add":"Aggiungi"`, `"resFavoris":"I tuoi preferiti"`, `"resATester":"Da provare"`, `"resExternes":"Aggiungi da Google"`
  - es : `"search":"Buscar un lugar"`, `"add":"Añadir"`, `"resFavoris":"Tus favoritos"`, `"resATester":"Por probar"`, `"resExternes":"Añadir desde Google"`
- Sous `nav`, ajouter `hotels` : fr « Hôtels » · en « Hotels » · it « Hotel » · es « Hoteles ».
- Ajouter un namespace racine `hotels` avec `title` : fr « Mes hôtels » · en « My hotels » · it « I miei hotel » · es « Mis hoteles ».
- **Retirer** de `restos` : `resFavoris`, `resATester`, `resExternes`, `search`, `add` (orphelins après suppression de RestoSearch — vérifié : seul RestoSearch les utilisait).

- [ ] **Step 2: Seeder un hôtel dans la liste du client**

Dans `supabase/seed.sql`, après le bloc des établissements de démo, ajouter un hôtel + son `liste_items` :
```sql
-- Hôtel démo (catégorie hotel) + dans la liste du client (à tester)
insert into public.etablissements (id, place_id, categorie, type, nom, ville, code_postal, arrondissement, source, photo_ref, photo_fetched_at)
values ('11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'demo_hotel_1', 'hotel', 'hotel',
  'Hôtel Démo', 'Paris', '75001', '1er', 'seed', 'mock_photo_1', now());
insert into public.liste_items (user_id, etablissement_id, statut, is_favorite)
values ('11111111-1111-1111-1111-111111111111', '11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a_faire', false);
```

- [ ] **Step 3: Vérifier parité + db reset**

Run: `npm run test -- messages-parity && supabase db reset`
Expected: parité PASS ; `db reset` applique le seed (hôtel + liste_item) sans erreur.

- [ ] **Step 4: Commit**

```bash
git add messages/fr.json messages/en.json messages/it.json messages/es.json supabase/seed.sql
git commit -m "feat(places,hotels): i18n (places.search/add/res* + nav.hotels + hotels.title) + seed hôtel"
```

---

### Task 2: `PlaceSearch` générique + `addHotel` + `PlaceCard` + page Restos

**Files:**
- Create: `src/features/places/ui/PlaceSearch.tsx`
- Delete: `src/features/restos/ui/RestoSearch.tsx`
- Modify: `src/features/restos/data/actions.ts` (ajout `addHotel`)
- Modify: `src/features/places/ui/PlaceCard.tsx` (lien category-aware)
- Modify: `src/app/[locale]/(app)/restos/page.tsx` (utilise `PlaceSearch`)

**Interfaces:**
- Consumes : `splitSearch`, `searchPlaces`/`addResto`/`addHotel`, `Place`, clés `places.*`.
- Produces : `PlaceSearch({ places: Place[]; category: "resto" | "hotel" })` ; `addHotel(_prev, formData)`.

- [ ] **Step 1: Ajouter `addHotel` dans `actions.ts`**

In `src/features/restos/data/actions.ts`, after `addResto`, append:
```ts
export async function addHotel(_prev: unknown, formData: FormData) {
  const parsed = addRestoSchema.safeParse({ placeId: formData.get("placeId") });
  if (!parsed.success) return { error: "Place invalide" };
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Non authentifié" };
  const place = await getPlacesProvider().details(parsed.data.placeId);
  if (!place) return { error: "Établissement introuvable" };
  const input = mapPlaceToEtablissement(place, "hotel");
  const { data: etabId, error: rpcErr } = await supabase.rpc("upsert_etablissement", {
    p: { ...input, enriched_at: new Date().toISOString() },
  });
  if (rpcErr || !etabId) return { error: "Enregistrement échoué" };
  const { error: itemErr } = await supabase
    .from("liste_items")
    .upsert({ user_id: auth.user.id, etablissement_id: etabId }, { onConflict: "user_id,etablissement_id" });
  if (itemErr) return { error: "Ajout à la liste échoué" };
  revalidatePath("/hotels");
  return {};
}
```

- [ ] **Step 2: Créer `PlaceSearch.tsx` (généralise RestoSearch)**

Create `src/features/places/ui/PlaceSearch.tsx`:
```tsx
"use client";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { searchPlaces, addResto, addHotel } from "@/features/restos/data/actions";
import { splitSearch } from "@/features/restos/domain/splitSearch";
import type { Place } from "../domain/filterPlaces";
import type { PlaceSummary } from "@/lib/services/places/types";
import { Link } from "@/lib/i18n/routing";
import { Button } from "@/features/shared/ui/Button";
import { SectionLabel } from "@/features/shared/ui/SectionLabel";

export function PlaceSearch({ places, category }: { places: Place[]; category: "resto" | "hotel" }) {
  const t = useTranslations("places");
  const [q, setQ] = useState("");
  const [externals, setExternals] = useState<PlaceSummary[]>([]);
  const [addError, setAddError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const base = category === "hotel" ? "hotels" : "restos";
  const addAction = category === "hotel" ? addHotel : addResto;
  const { favoris, aTester, externes } = splitSearch(q, places, externals);

  const ownedRow = (p: Place) => (
    <li key={p.id} data-testid="owned-result" className="border-b border-line-soft py-2">
      <Link href={`/${base}/${p.etablissement.id}`} className="text-accent hover:underline">
        {p.etablissement.nom}
        {p.etablissement.ville ? <span className="text-muted"> · {p.etablissement.ville}</span> : null}
      </Link>
    </li>
  );

  return (
    <div className="flex flex-col gap-3">
      <input
        data-testid={`add-${category === "hotel" ? "hotel" : "resto"}-search`}
        placeholder={t("search")}
        value={q}
        className="rounded-control border border-line bg-surface px-3 py-2 text-sm outline-none focus:outline-2 focus:outline-accent"
        onChange={(e) => { const v = e.target.value; setQ(v); start(async () => setExternals(await searchPlaces(v))); }}
      />
      {addError && <p role="alert" className="text-sm text-red-600" data-testid="add-resto-error">{addError}</p>}
      {favoris.length > 0 && (
        <section><SectionLabel>{t("resFavoris")}</SectionLabel><ul>{favoris.map(ownedRow)}</ul></section>
      )}
      {aTester.length > 0 && (
        <section><SectionLabel>{t("resATester")}</SectionLabel><ul>{aTester.map(ownedRow)}</ul></section>
      )}
      {externes.length > 0 && (
        <section>
          <SectionLabel>{t("resExternes")}</SectionLabel>
          <ul>
            {externes.map((r) => (
              <li key={r.placeId} data-testid="search-result" className="flex justify-between border-b border-line-soft py-2">
                <span>{r.nom}{r.adresse ? ` — ${r.adresse}` : ""}</span>
                <form action={(fd) => start(async () => {
                  const res = await addAction(undefined, fd);
                  if (res?.error) { setAddError(res.error); }
                  else { setAddError(null); setExternals([]); setQ(""); }
                })}>
                  <input type="hidden" name="placeId" value={r.placeId} />
                  <Button type="submit" variant="ghost" pending={pending}>{t("add")}</Button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 3: `PlaceCard` — lien category-aware**

In `src/features/places/ui/PlaceCard.tsx`, replace the hardcoded `/restos/` link. Add near the top of the component body:
```tsx
  const base = etablissement.categorie === "hotel" ? "hotels" : "restos";
```
and change the `<Link href={`/restos/${etablissement.id}`} ...>` to `<Link href={`/${base}/${etablissement.id}`} ...>`.

- [ ] **Step 4: Remplacer `RestoSearch` par `PlaceSearch` dans la page Restos + supprimer RestoSearch**

In `src/app/[locale]/(app)/restos/page.tsx`: replace the `RestoSearch` import with `import { PlaceSearch } from "@/features/places/ui/PlaceSearch";` and `<RestoSearch places={places} />` with `<PlaceSearch places={places} category="resto" />`.
Then delete the old file: `git rm src/features/restos/ui/RestoSearch.tsx`.

- [ ] **Step 5: Vérifier typecheck + lint + unit**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS (aucune référence restante à `RestoSearch`).

- [ ] **Step 6: Commit**

```bash
git add src/features/places/ui/PlaceSearch.tsx src/features/restos/data/actions.ts src/features/places/ui/PlaceCard.tsx "src/app/[locale]/(app)/restos/page.tsx"
git rm src/features/restos/ui/RestoSearch.tsx
git commit -m "feat(places,hotels): PlaceSearch générique + addHotel + PlaceCard lien category-aware"
```

---

### Task 3: nav + FicheResto category-aware + routes /hotels

**Files:**
- Modify: `src/features/shell/nav-config.ts` (entrée + NavKey `hotels`)
- Modify: `src/features/shell/ui/NavGroups.tsx` (icône `Hotel`)
- Modify: `src/features/restos/ui/FicheResto.tsx` (prop `category`)
- Create: `src/app/[locale]/(app)/hotels/page.tsx`
- Create: `src/app/[locale]/(app)/hotels/[id]/page.tsx`

**Interfaces:**
- Consumes : `PlaceSearch`/`PlacesTabs`/`getPlaces` (génériques), `FicheResto` (avec `category`), `getTagsForCategory`.

- [ ] **Step 1: nav-config — entrée `hotels`**

In `src/features/shell/nav-config.ts`: add `"hotels"` to `NavKey` union, and insert `{ key: "hotels", href: "/hotels", group: "carnet" }` right after the `restos` entry in `NAV_ITEMS`. `BOTTOM_KEYS` and `filterNav`/`groupNav` unchanged.

- [ ] **Step 2: NavGroups — icône Hôtels**

In `src/features/shell/ui/NavGroups.tsx`: import `Hotel` from `lucide-react` (add to the existing import) and add `hotels: Hotel,` to the `NAV_ICONS` record.

- [ ] **Step 3: `FicheResto` category-aware**

In `src/features/restos/ui/FicheResto.tsx`: change the signature and the tags call:
```tsx
export async function FicheResto({ etablissementId, category = "restaurant" }: { etablissementId: string; category?: "restaurant" | "hotel" }) {
```
and replace `getTagsForCategory("restaurant")` with `getTagsForCategory(category)`. Nothing else changes.

- [ ] **Step 4: Page `/hotels`**

Create `src/app/[locale]/(app)/hotels/page.tsx`:
```tsx
import { getTranslations } from "next-intl/server";
import { PlaceSearch } from "@/features/places/ui/PlaceSearch";
import { PageHeader } from "@/features/shared/ui/PageHeader";
import { PlacesTabs } from "@/features/places/ui/PlacesTabs";
import { getPlaces } from "@/features/places/data/queries";

export default async function HotelsPage() {
  const t = await getTranslations("hotels");
  const places = await getPlaces("hotel");
  return (
    <main className="flex flex-col gap-6 p-4 md:p-8">
      <PageHeader title={t("title")} />
      <PlaceSearch places={places} category="hotel" />
      <PlacesTabs category="hotel" places={places} />
    </main>
  );
}
```

- [ ] **Step 5: Route fiche `/hotels/[id]` (cloner le pattern de `/restos/[id]`)**

D'abord lire `src/app/[locale]/(app)/restos/[id]/page.tsx` pour reproduire sa structure exacte (params async, wrapper). Create `src/app/[locale]/(app)/hotels/[id]/page.tsx` à l'identique mais en passant `category="hotel"` à `FicheResto` :
```tsx
import { FicheResto } from "@/features/restos/ui/FicheResto";

export default async function HotelFichePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="p-4 md:p-8">
      <FicheResto etablissementId={id} category="hotel" />
    </main>
  );
}
```
(Adapter le wrapper `<main>`/imports à ce que fait réellement `/restos/[id]/page.tsx` ; le point clé est `category="hotel"`.)

- [ ] **Step 6: Vérifier typecheck + lint + unit + build**

Run: `npm run typecheck && npm run lint && npm run test && npm run build`
Expected: PASS (route /hotels + /hotels/[id] compilent ; nav-config typé).

- [ ] **Step 7: Commit**

```bash
git add src/features/shell/nav-config.ts src/features/shell/ui/NavGroups.tsx src/features/restos/ui/FicheResto.tsx "src/app/[locale]/(app)/hotels/page.tsx" "src/app/[locale]/(app)/hotels/[id]/page.tsx"
git commit -m "feat(places,hotels): nav Hôtels + FicheResto category-aware + routes /hotels(+[id])"
```

---

### Task 4: e2e Hôtels (+ exclusion) + non-régression complète

**Files:**
- Create: `e2e/hotels.spec.ts`

**Interfaces:**
- Consumes : tout ce qui précède ; seed hôtel (Task 1).

- [ ] **Step 1: Écrire `e2e/hotels.spec.ts`**

Create `e2e/hotels.spec.ts`:
```ts
import { test, expect, type Page } from "@playwright/test";

async function login(page: Page) {
  await page.goto("/fr/login");
  await page.getByLabel("E-mail").fill("client@vito.test");
  await page.getByLabel("Mot de passe").fill("password123");
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/fr\/accueil/);
}

test("l'onglet Hôtels montre l'hôtel seedé", async ({ page }) => {
  await login(page);
  await page.goto("/fr/hotels");
  await expect(page.getByTestId("places-tabs")).toBeVisible();
  await expect(page.getByTestId("place-card").filter({ hasText: "Hôtel Démo" }).first()).toBeVisible();
});

test("l'hôtel n'apparaît PAS dans Restos (getPlaces resto exclut les hôtels)", async ({ page }) => {
  await login(page);
  await page.goto("/fr/restos");
  await expect(page.getByTestId("places-tabs")).toBeVisible();
  await expect(page.getByTestId("place-card").filter({ hasText: "Hôtel Démo" })).toHaveCount(0);
});

test("ajouter un hôtel via la recherche externe", async ({ page }) => {
  await login(page);
  await page.goto("/fr/hotels");
  await page.getByTestId("add-hotel-search").fill("hôtel");
  await expect(page.getByTestId("search-result").first()).toBeVisible();
  await page.getByTestId("search-result").first().getByRole("button").click();
  await page.getByTestId("tab-a-tester").click();
  await expect(page.getByTestId("place-card").first()).toBeVisible();
});
```
(Le mock renvoie des hôtels pour « hôtel » : `mock_hotel_1`/`mock_hotel_2`.)

- [ ] **Step 2: Suite e2e complète + build**

Run: `supabase db reset && npx playwright test --retries=0 && npm run build`
Expected: suite complète **verte** (hotels.spec + specs existants inchangés) + build OK. Un seul `db reset`. Si `restos.spec` casse, corriger le composant, pas le test. (Flake connu `liste_items`/anon → relancer une fois, cf. mémoire.) Retry une fois si le webServer échoue.

- [ ] **Step 3: Commit**

```bash
git add e2e/hotels.spec.ts
git commit -m "test(places,hotels): onglet Hôtels + exclusion côté Restos + ajout"
```

---

## Notes d'exécution

- **Ordre** : T1 (i18n+seed) → T2 (PlaceSearch+addHotel+PlaceCard+page Restos) → T3 (nav+fiche+routes) → T4 (e2e+build).
- **Prod** : aucune migration ; /hotels vide en prod jusqu'au 1er ajout (le seed est local). Au « go prod » : merge → Vercel redéploie.
- **Filet** : `PlaceSearch category="resto"` garde `add-resto-search`/`search-result`/le flux `addResto` → `restos.spec` vert. `place-card` resto lie toujours `/restos/`. Si un e2e casse, réparer le composant, jamais le test.
- **Fin de l'épic places** après cette slice.
