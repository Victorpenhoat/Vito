# Slice Recherche externe priorisée (épic places) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformer la recherche d'ajout (`RestoSearch`) en recherche priorisée favoris → à tester → Google (dédoublonnés), ajout 1 clic, sans casser l'e2e ni migration.

**Architecture:** `place_id` ajouté à `getPlaces`/`Place` (dédoublonnage) ; helper pur `splitSearch` ; `RestoSearch` reçoit `places` et rend 3 sections (favoris/à tester en `owned-result` liens ; externes en `search-result` + bouton ajout inchangé).

**Tech Stack:** Next.js 16, next-intl (fr/en/it/es), Vitest, Playwright. Google Places via `searchPlaces` (existant).

## Global Constraints

- **Aucune migration** (`place_id` déjà sur `etablissements`). `searchPlaces`/`addResto` inchangés.
- **e2e `restos.spec.ts` vert SANS modification** : `add-resto-search`, `search-result` (sur les **externes** addables, avec bouton), `add-resto-error` conservés. Le 1er `search-result` reste un résultat externe addable.
- **Own-matches** (favoris/à tester) = testid `owned-result` (liens fiche), JAMAIS `search-result`.
- Réutilise `filterPlaces` (nom/ville/tag). Style Le Carnet (`rounded-control`, `SectionLabel`).
- Parité i18n (4 locales). Pas de chaîne en dur. TS strict.
- Réf. spec : `docs/superpowers/specs/2026-06-26-places-recherche-externe-design.md`.

---

### Task 1: place_id + splitSearch (TDD) + i18n

**Files:**
- Modify: `src/features/places/domain/filterPlaces.ts` (type `Place`)
- Modify: `src/features/places/data/queries.ts` (`getPlaces`)
- Create: `src/features/restos/domain/splitSearch.ts` + `splitSearch.test.ts`
- Modify: `messages/fr.json`, `messages/en.json`, `messages/it.json`, `messages/es.json`

**Interfaces:**
- Produces : `Place.etablissement.place_id: string | null` ; `getPlaces` le sélectionne ; `splitSearch(query: string, places: Place[], externals: PlaceSummary[]): { favoris: Place[]; aTester: Place[]; externes: PlaceSummary[] }` ; clés `restos.resFavoris/resATester/resExternes`.

- [ ] **Step 1: `place_id` dans le type `Place`**

In `src/features/places/domain/filterPlaces.ts`, add `place_id` to `etablissement`:
```ts
  etablissement: { id: string; nom: string; type: string | null; ville: string | null; arrondissement: string | null; categorie: "resto" | "hotel"; photo_ref: string | null; lat: number | null; lng: number | null; place_id: string | null };
```

- [ ] **Step 2: `place_id` dans `getPlaces`**

In `src/features/places/data/queries.ts`, add `place_id` to the embedded select:
```ts
      "id, statut, is_favorite, etablissement:etablissements!inner(id, nom, type, ville, arrondissement, categorie, photo_ref, lat, lng, place_id), tags:liste_item_tags(tag:tags(slug, label, color))"
```

- [ ] **Step 3: Test `splitSearch`**

Create `src/features/restos/domain/splitSearch.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { splitSearch } from "./splitSearch";
import type { Place } from "@/features/places/domain/filterPlaces";

const place = (over: Partial<Place> & { nom: string; place_id?: string | null }): Place => ({
  id: Math.random().toString(36),
  statut: over.statut ?? "a_faire",
  is_favorite: over.is_favorite ?? false,
  etablissement: { id: "e", nom: over.nom, type: null, ville: null, arrondissement: null, categorie: "resto", photo_ref: null, lat: null, lng: null, place_id: over.place_id ?? null },
  tags: [],
});

const ext = (placeId: string, nom: string) => ({ placeId, nom, adresse: null });

describe("splitSearch", () => {
  const places: Place[] = [
    place({ nom: "Bistrot Favori", is_favorite: true, place_id: "p_fav" }),
    place({ nom: "Bistrot ATester", statut: "a_faire", place_id: "p_test" }),
    place({ nom: "Bistrot Visite", statut: "visite", place_id: "p_vis" }),
  ];

  it("query vide → tout vide", () => {
    expect(splitSearch("", places, [ext("x", "X")])).toEqual({ favoris: [], aTester: [], externes: [] });
  });
  it("priorise favoris puis à tester (sans visités)", () => {
    const r = splitSearch("bistrot", places, []);
    expect(r.favoris.map((p) => p.etablissement.nom)).toEqual(["Bistrot Favori"]);
    expect(r.aTester.map((p) => p.etablissement.nom)).toEqual(["Bistrot ATester"]);
  });
  it("dédoublonne les externes déjà possédés (par place_id)", () => {
    const r = splitSearch("bistrot", places, [ext("p_fav", "Doublon"), ext("p_new", "Nouveau")]);
    expect(r.externes.map((e) => e.placeId)).toEqual(["p_new"]);
  });
});
```

- [ ] **Step 4: Lancer → échec** — Run: `npm run test -- splitSearch` → FAIL.

- [ ] **Step 5: Implémenter `splitSearch.ts`**

Create `src/features/restos/domain/splitSearch.ts`:
```ts
import { filterPlaces, type Place } from "@/features/places/domain/filterPlaces";
import type { PlaceSummary } from "@/lib/services/places/types";

export function splitSearch(
  query: string,
  places: Place[],
  externals: PlaceSummary[],
): { favoris: Place[]; aTester: Place[]; externes: PlaceSummary[] } {
  if (!query.trim()) return { favoris: [], aTester: [], externes: [] };
  const matched = filterPlaces(places, query);
  const favoris = matched.filter((p) => p.is_favorite);
  const aTester = matched.filter((p) => !p.is_favorite && p.statut === "a_faire");
  const ownedPlaceIds = new Set(places.map((p) => p.etablissement.place_id).filter((x): x is string => !!x));
  const externes = externals.filter((e) => !ownedPlaceIds.has(e.placeId));
  return { favoris, aTester, externes };
}
```

- [ ] **Step 6: Lancer → succès** — Run: `npm run test -- splitSearch` → PASS.

- [ ] **Step 7: i18n (4 locales)**

Sous `restos` de chaque locale :
- fr : `"resFavoris":"Tes favoris"`, `"resATester":"À tester"`, `"resExternes":"Ajouter depuis Google"`
- en : `"resFavoris":"Your favorites"`, `"resATester":"To try"`, `"resExternes":"Add from Google"`
- it : `"resFavoris":"I tuoi preferiti"`, `"resATester":"Da provare"`, `"resExternes":"Aggiungi da Google"`
- es : `"resFavoris":"Tus favoritos"`, `"resATester":"Por probar"`, `"resExternes":"Añadir desde Google"`

- [ ] **Step 8: Vérifier**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS (splitSearch vert ; parité i18n verte ; types `place_id` OK ; `filterPlaces.test`/`mapCenter` éventuellement à compléter avec `place_id` dans les fixtures si TS l'exige — si c'est le cas, ajouter `place_id: null`).

- [ ] **Step 9: Commit**

```bash
git add src/features/places/domain/filterPlaces.ts src/features/places/data/queries.ts src/features/restos/domain/splitSearch.ts src/features/restos/domain/splitSearch.test.ts messages/fr.json messages/en.json messages/it.json messages/es.json
git commit -m "feat(places,recherche): place_id dans getPlaces + splitSearch (priorisé) + i18n"
```
(Si des fixtures de tests existants — `filterPlaces.test.ts`, `mapCenter.test.ts` — ont dû recevoir `place_id: null`, les inclure dans le commit.)

---

### Task 2: `RestoSearch` priorisé + page Restos

**Files:**
- Modify: `src/features/restos/ui/RestoSearch.tsx`
- Modify: `src/app/[locale]/(app)/restos/page.tsx`

**Interfaces:**
- Consumes : `splitSearch`, `Place`, `searchPlaces`/`addResto` (inchangés), `filterPlaces`, kit, clés `restos.resFavoris/resATester/resExternes`/`search`/`add`.
- Produces : `RestoSearch({ places })`.

- [ ] **Step 1: Réécrire `RestoSearch.tsx`**

Replace `src/features/restos/ui/RestoSearch.tsx` with:
```tsx
"use client";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { searchPlaces, addResto } from "../data/actions";
import { splitSearch } from "../domain/splitSearch";
import type { Place } from "@/features/places/domain/filterPlaces";
import type { PlaceSummary } from "@/lib/services/places/types";
import { Link } from "@/lib/i18n/routing";
import { Button } from "@/features/shared/ui/Button";
import { SectionLabel } from "@/features/shared/ui/SectionLabel";

export function RestoSearch({ places }: { places: Place[] }) {
  const t = useTranslations("restos");
  const [q, setQ] = useState("");
  const [externals, setExternals] = useState<PlaceSummary[]>([]);
  const [addError, setAddError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const { favoris, aTester, externes } = splitSearch(q, places, externals);

  const ownedRow = (p: Place) => (
    <li key={p.id} data-testid="owned-result" className="border-b border-line-soft py-2">
      <Link href={`/restos/${p.etablissement.id}`} className="text-accent hover:underline">
        {p.etablissement.nom}
        {p.etablissement.ville ? <span className="text-muted"> · {p.etablissement.ville}</span> : null}
      </Link>
    </li>
  );

  return (
    <div className="flex flex-col gap-3">
      <input
        data-testid="add-resto-search"
        placeholder={t("search")}
        value={q}
        className="rounded-control border border-line bg-surface px-3 py-2 text-sm outline-none focus:outline-2 focus:outline-accent"
        onChange={(e) => {
          const v = e.target.value;
          setQ(v);
          start(async () => setExternals(await searchPlaces(v)));
        }}
      />
      {addError && (
        <p role="alert" className="text-sm text-red-600" data-testid="add-resto-error">{addError}</p>
      )}

      {favoris.length > 0 && (
        <section>
          <SectionLabel>{t("resFavoris")}</SectionLabel>
          <ul>{favoris.map(ownedRow)}</ul>
        </section>
      )}
      {aTester.length > 0 && (
        <section>
          <SectionLabel>{t("resATester")}</SectionLabel>
          <ul>{aTester.map(ownedRow)}</ul>
        </section>
      )}
      {externes.length > 0 && (
        <section>
          <SectionLabel>{t("resExternes")}</SectionLabel>
          <ul>
            {externes.map((r) => (
              <li key={r.placeId} data-testid="search-result" className="flex justify-between border-b border-line-soft py-2">
                <span>{r.nom}{r.adresse ? ` — ${r.adresse}` : ""}</span>
                <form
                  action={(fd) =>
                    start(async () => {
                      const res = await addResto(undefined, fd);
                      if (res?.error) {
                        setAddError(res.error);
                      } else {
                        setAddError(null);
                        setExternals([]);
                        setQ("");
                      }
                    })
                  }
                >
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

- [ ] **Step 2: Passer `places` à `RestoSearch` dans `restos/page.tsx`**

In `src/app/[locale]/(app)/restos/page.tsx`, fetch once and pass to both:
```tsx
export default async function RestosPage() {
  const t = await getTranslations("restos");
  const places = await getPlaces("resto");
  return (
    <main className="flex flex-col gap-6 p-4 md:p-8">
      <PageHeader title={t("title")} />
      <GoutsBanner />
      <RestoSearch places={places} />
      <PlacesTabs category="resto" places={places} />
    </main>
  );
}
```
(Conserver les imports `RestoSearch`/`GoutsBanner`/`PageHeader`/`PlacesTabs`/`getPlaces`.)

- [ ] **Step 3: Vérifier typecheck + lint + unit**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS.

- [ ] **Step 4: e2e restos (non-régression ciblée)**

Run: `supabase db reset && npx playwright test e2e/restos.spec.ts --retries=0`
Expected: PASS sans modifier le spec (taper « bistrot » → 1er `search-result` externe → bouton → « Le Bistrot du Coin » ajouté → onglet À tester ; fiche/avis). Retry une fois si le webServer échoue.

- [ ] **Step 5: Commit**

```bash
git add src/features/restos/ui/RestoSearch.tsx "src/app/[locale]/(app)/restos/page.tsx"
git commit -m "feat(places,recherche): RestoSearch priorisé (favoris/à tester/externes)"
```

---

### Task 3: Non-régression complète + build

- [ ] **Step 1: Suite e2e complète + build**

Run: `supabase db reset && npx playwright test --retries=0 && npm run build`
Expected: suite complète **verte sans modifier les specs** + build OK. Un seul `db reset` avant. Si un spec autre que restos casse, corriger le composant, pas le test. (Si le flake connu `liste_items`/anon survient sur abonnement, relancer une fois — voir mémoire `vito-e2e-flake-liste-items`.) Retry une fois si le webServer échoue.

- [ ] **Step 2: Commit (si correctifs)**

```bash
git add -A && git commit -m "fix(places,recherche): correctifs non-régression" # seulement si nécessaire
```

---

## Notes d'exécution

- **Ordre** : T1 (place_id+splitSearch+i18n) → T2 (RestoSearch+page) → T3 (non-régression).
- **Prod** : aucune migration. Au « go prod » : merge → Vercel redéploie `main`.
- **Filet** : les **externes** seuls portent `search-result` + bouton (le 1er reste addable → e2e). Les own-matches sont des liens `owned-result`. `addResto`/`searchPlaces` inchangés.
