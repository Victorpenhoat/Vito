# Slice 5 — Recherche « Découverte » — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformer l'onglet Recherche en écran de découverte : champ + submit, recherches récentes (localStorage), « Explorer par envie » (chips cuisine), résultats Ajouter/Ajouté.

**Architecture:** Domaine pur `discovery` (envies, markOwned, ops sur récentes). Nouveau composant client `PlaceDiscovery` (remplace `PlaceSearch`). Suppression de `PlaceSearch` + `splitSearch` devenus morts. e2e nouvel écran + adaptation des specs voisins (flux d'ajout passe en submit).

**Tech Stack:** Next 16 (App Router), React, TypeScript, next-intl 4, Supabase, Tailwind v4, Vitest, Playwright. Recherche Google mockée en test.

Spec : `docs/superpowers/specs/2026-06-28-resto-hotels-slice-5-recherche-decouverte-design.md`.

## Global Constraints

- Recherches récentes = **localStorage** (clé `vito.recents.{category}`), client-only. Pas de DB.
- Résultats **légers** : nom + adresse + Ajouter/Ajouté. Pas de rating/vignette (`searchPlaces` ne renvoie que `{placeId, nom, adresse}`).
- Déclenchement par **submit** (Entrée/bouton) ; le submit enregistre la recherche récente.
- Résultats déjà possédés → badge **« Ajouté »** (visibles, non masqués).
- « Explorer par envie » = **resto** (4 cuisines) ; **hôtel = `[]`** (Slice 7).
- i18n **4 locales** parité. Aucune chaîne en dur. Aucun nouveau token (tokens proven : `bg-accent`, `border-line`, `border-line-soft`, `bg-surface`, `text-ink`, `text-muted`, `text-faint`, `text-danger`, `bg-badge`, `rounded-control`, `rounded-card`).
- `searchPlaces` reste auth-gated. `addResto`/`addHotel` inchangés. **Aucune migration / pas de go-prod DB.**

---

### Task 1: Domaine pur — `discovery`

Envies par catégorie + `markOwned` + ops récentes. Pur, TDD.

**Files:**
- Create: `src/features/places/domain/discovery.ts`
- Test: `src/features/places/domain/discovery.test.ts`

**Interfaces:**
- Consumes: types `Place` (`./filterPlaces`), `PlaceSummary` (`@/lib/services/places/types`).
- Produces (consommé par Task 2) :
  - `type Envie = { emoji: string; labelKey: string; query: string }`
  - `function searchEnvies(category: "resto" | "hotel"): Envie[]`
  - `function markOwned(results: PlaceSummary[], places: Place[]): { result: PlaceSummary; owned: boolean }[]`
  - `function addRecent(list: string[], query: string, max?: number): string[]`
  - `function removeRecent(list: string[], query: string): string[]`

- [ ] **Step 1: Écrire le test (échouant)**

Créer `src/features/places/domain/discovery.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { searchEnvies, markOwned, addRecent, removeRecent } from "./discovery";
import type { Place } from "./filterPlaces";
import type { PlaceSummary } from "@/lib/services/places/types";

const place = (placeId: string | null): Place => ({
  id: placeId ?? "x",
  statut: "a_faire",
  is_favorite: false,
  reco_source: null,
  etablissement: { id: "e", nom: "X", type: null, ville: null, arrondissement: null, categorie: "resto", photo_ref: null, lat: null, lng: null, place_id: placeId, rating: null, rating_count: null },
  tags: [],
});
const sum = (placeId: string, nom: string): PlaceSummary => ({ placeId, nom, adresse: null });

describe("searchEnvies", () => {
  it("resto → 4 envies avec query non vide", () => {
    const e = searchEnvies("resto");
    expect(e).toHaveLength(4);
    expect(e.every((x) => x.query.trim().length > 0 && x.labelKey.length > 0)).toBe(true);
  });
  it("hotel → vide (Slice 7)", () => expect(searchEnvies("hotel")).toEqual([]));
});

describe("markOwned", () => {
  it("marque possédé par place_id, ordre préservé", () => {
    const places = [place("p1")];
    const res = markOwned([sum("p1", "A"), sum("p2", "B")], places);
    expect(res.map((r) => [r.result.placeId, r.owned])).toEqual([["p1", true], ["p2", false]]);
  });
});

describe("addRecent", () => {
  it("ajoute en tête", () => expect(addRecent(["a"], "b")).toEqual(["b", "a"]));
  it("déduplique et remonte en tête", () => expect(addRecent(["a", "b"], "b")).toEqual(["b", "a"]));
  it("plafonne à max", () => expect(addRecent(["a", "b", "c"], "d", 3)).toEqual(["d", "a", "b"]));
  it("requête vide → inchangé", () => expect(addRecent(["a"], "  ")).toEqual(["a"]));
});

describe("removeRecent", () => {
  it("retire l'entrée", () => expect(removeRecent(["a", "b"], "a")).toEqual(["b"]));
  it("absente → inchangé", () => expect(removeRecent(["a"], "z")).toEqual(["a"]));
});
```

- [ ] **Step 2: Lancer le test → échec**

Run: `npx vitest run src/features/places/domain/discovery.test.ts`
Expected: FAIL — `Failed to resolve import "./discovery"`.

- [ ] **Step 3: Implémenter `discovery.ts`**

Créer `src/features/places/domain/discovery.ts` :

```ts
import type { Place } from "./filterPlaces";
import type { PlaceSummary } from "@/lib/services/places/types";

export type Envie = { emoji: string; labelKey: string; query: string };

/** « Explorer par envie » par catégorie. resto = cuisines ; hotel = [] (Slice 7). */
export function searchEnvies(category: "resto" | "hotel"): Envie[] {
  if (category === "hotel") return [];
  return [
    { emoji: "🍷", labelKey: "envieCaveAManger", query: "cave à manger" },
    { emoji: "🐟", labelKey: "envieFruitsDeMer", query: "fruits de mer" },
    { emoji: "🍝", labelKey: "envieItalien", query: "italien" },
    { emoji: "☕", labelKey: "envieBrunch", query: "brunch" },
  ];
}

/** Annote chaque résultat externe selon qu'il est déjà possédé (par place_id). Ordre préservé. */
export function markOwned(
  results: PlaceSummary[],
  places: Place[],
): { result: PlaceSummary; owned: boolean }[] {
  const ownedIds = new Set(
    places.map((p) => p.etablissement.place_id).filter((x): x is string => !!x),
  );
  return results.map((result) => ({ result, owned: ownedIds.has(result.placeId) }));
}

/** Ajoute une recherche en tête (dédupliquée, casse-insensible), plafonnée à max. */
export function addRecent(list: string[], query: string, max = 5): string[] {
  const term = query.trim();
  if (!term) return list;
  const rest = list.filter((r) => r.toLowerCase() !== term.toLowerCase());
  return [term, ...rest].slice(0, max);
}

/** Retire une recherche récente (correspondance exacte). */
export function removeRecent(list: string[], query: string): string[] {
  return list.filter((r) => r !== query);
}
```

- [ ] **Step 4: Lancer le test → succès**

Run: `npx vitest run src/features/places/domain/discovery.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/places/domain/discovery.ts src/features/places/domain/discovery.test.ts
git commit -m "feat(places): domaine pur discovery (searchEnvies + markOwned + recents)"
```

---

### Task 2: `PlaceDiscovery` + i18n + branchement + suppression de `PlaceSearch`/`splitSearch`

Nouveau composant de découverte, branché sur l'onglet Recherche ; suppression des fichiers devenus morts. Doit atterrir ensemble (dépendances de compilation). Comportement couvert par l'e2e (Task 3) ; logique pure déjà testée (Task 1).

**Files:**
- Create: `src/features/places/ui/PlaceDiscovery.tsx`
- Delete: `src/features/places/ui/PlaceSearch.tsx`
- Delete: `src/features/restos/domain/splitSearch.ts`, `src/features/restos/domain/splitSearch.test.ts`
- Modify: `src/features/places/ui/PlacesTabs.tsx`
- Modify: `messages/fr.json`, `messages/en.json`, `messages/it.json`, `messages/es.json`

**Interfaces:**
- Consumes: `searchEnvies`, `markOwned`, `addRecent`, `removeRecent` (Task 1) ; `searchPlaces`, `addResto`, `addHotel` (actions existantes) ; `Button`, `SectionLabel`.
- Produces: `PlaceDiscovery` émet `add-{resto|hotel}-search` (input), `search-submit`, `search-clear`, `recents`/`recent-item`, `envies`/`envie-{labelKey}`, `search-result`, `result-added`.

- [ ] **Step 1: Ajouter/retirer les clés i18n (4 locales)**

Dans le namespace `places` de chaque fichier : **ajouter** ces clés et **retirer** `search`, `resFavoris`, `resATester`, `resExternes`. Conserver `add`. Garder le JSON valide.

`messages/fr.json` — ajouter :
```json
    "rechercher": "Rechercher",
    "recherchesRecentes": "Recherches récentes",
    "explorerEnvie": "Explorer par envie",
    "ajoute": "Ajouté",
    "searchDecouvertePlaceholder": "Nom, cuisine, ville…",
    "retirerRecherche": "Retirer cette recherche",
    "envieCaveAManger": "Cave à manger",
    "envieFruitsDeMer": "Fruits de mer",
    "envieItalien": "Italien",
    "envieBrunch": "Brunch",
```
`messages/en.json` — ajouter : `"rechercher": "Search", "recherchesRecentes": "Recent searches", "explorerEnvie": "Explore by mood", "ajoute": "Added", "searchDecouvertePlaceholder": "Name, cuisine, city…", "retirerRecherche": "Remove this search", "envieCaveAManger": "Wine bar", "envieFruitsDeMer": "Seafood", "envieItalien": "Italian", "envieBrunch": "Brunch",`
`messages/it.json` — ajouter : `"rechercher": "Cerca", "recherchesRecentes": "Ricerche recenti", "explorerEnvie": "Esplora per voglia", "ajoute": "Aggiunto", "searchDecouvertePlaceholder": "Nome, cucina, città…", "retirerRecherche": "Rimuovi questa ricerca", "envieCaveAManger": "Enoteca con cucina", "envieFruitsDeMer": "Frutti di mare", "envieItalien": "Italiano", "envieBrunch": "Brunch",`
`messages/es.json` — ajouter : `"rechercher": "Buscar", "recherchesRecentes": "Búsquedas recientes", "explorerEnvie": "Explorar por antojo", "ajoute": "Añadido", "searchDecouvertePlaceholder": "Nombre, cocina, ciudad…", "retirerRecherche": "Quitar esta búsqueda", "envieCaveAManger": "Bar de vinos", "envieFruitsDeMer": "Marisco", "envieItalien": "Italiano", "envieBrunch": "Brunch",`

Dans les 4 fichiers, **supprimer** les lignes `"search": …`, `"resFavoris": …`, `"resATester": …`, `"resExternes": …`.

- [ ] **Step 2: Créer `PlaceDiscovery.tsx`**

Créer `src/features/places/ui/PlaceDiscovery.tsx` :

```tsx
"use client";
import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { searchPlaces, addResto, addHotel } from "@/features/restos/data/actions";
import type { Place } from "../domain/filterPlaces";
import type { PlaceSummary } from "@/lib/services/places/types";
import { searchEnvies, markOwned, addRecent, removeRecent } from "../domain/discovery";
import { Button } from "@/features/shared/ui/Button";
import { SectionLabel } from "@/features/shared/ui/SectionLabel";

export function PlaceDiscovery({ places, category }: { places: Place[]; category: "resto" | "hotel" }) {
  const t = useTranslations("places");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PlaceSummary[]>([]);
  const [searched, setSearched] = useState(false);
  const [recents, setRecents] = useState<string[]>([]);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [addError, setAddError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const storageKey = `vito.recents.${category}`;
  const addAction = category === "hotel" ? addHotel : addResto;
  const envies = searchEnvies(category);
  const testidBase = category === "hotel" ? "hotel" : "resto";

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setRecents(JSON.parse(raw) as string[]);
    } catch {
      /* localStorage indisponible : on ignore */
    }
  }, [storageKey]);

  const persistRecents = (next: string[]) => {
    setRecents(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const runSearch = (query: string) => {
    const term = query.trim();
    if (!term) return;
    setQ(query);
    setSearched(true);
    persistRecents(addRecent(recents, term));
    start(async () => setResults(await searchPlaces(term)));
  };

  const clear = () => {
    setQ("");
    setResults([]);
    setSearched(false);
    setAddError(null);
  };

  const owned = markOwned(results, places);

  return (
    <div className="flex flex-col gap-4">
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); runSearch(q); }}>
        <input
          data-testid={`add-${testidBase}-search`}
          placeholder={t("searchDecouvertePlaceholder")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="flex-1 rounded-control border border-line bg-surface px-3 py-2 text-sm outline-none focus:outline-2 focus:outline-accent"
        />
        {searched && (
          <Button type="button" variant="ghost" data-testid="search-clear" onClick={clear}>✕</Button>
        )}
        <Button type="submit" data-testid="search-submit" pending={pending}>{t("rechercher")}</Button>
      </form>

      {addError && <p role="alert" className="text-sm text-danger">{addError}</p>}

      {!searched && (
        <>
          {recents.length > 0 && (
            <section data-testid="recents">
              <SectionLabel>{t("recherchesRecentes")}</SectionLabel>
              <ul className="flex flex-col">
                {recents.map((r) => (
                  <li key={r} data-testid="recent-item" className="flex items-center gap-2 border-b border-line-soft py-2">
                    <button type="button" className="flex-1 text-left text-sm text-ink" onClick={() => runSearch(r)}>{r}</button>
                    <button type="button" aria-label={t("retirerRecherche")} className="px-1 text-faint" onClick={() => persistRecents(removeRecent(recents, r))}>✕</button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {envies.length > 0 && (
            <section data-testid="envies">
              <SectionLabel>{t("explorerEnvie")}</SectionLabel>
              <div className="grid grid-cols-2 gap-2.5">
                {envies.map((e) => (
                  <button
                    key={e.labelKey}
                    type="button"
                    data-testid={`envie-${e.labelKey}`}
                    onClick={() => runSearch(e.query)}
                    className="flex items-center gap-2 rounded-card border border-line bg-surface px-3.5 py-3.5 text-left text-sm text-ink"
                  >
                    <span className="text-base">{e.emoji}</span>
                    {t(e.labelKey)}
                  </button>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {searched && results.length > 0 && (
        <ul className="flex flex-col">
          {owned.map(({ result, owned: isOwned }) => {
            const added = isOwned || addedIds.has(result.placeId);
            return (
              <li key={result.placeId} data-testid="search-result" className="flex items-center justify-between gap-3 border-b border-line-soft py-3">
                <span className="min-w-0">
                  <span className="font-serif text-base text-ink">{result.nom}</span>
                  {result.adresse ? <span className="text-sm text-muted"> · {result.adresse}</span> : null}
                </span>
                {added ? (
                  <span data-testid="result-added" className="shrink-0 rounded-full bg-badge px-3 py-1 text-xs font-semibold text-ink">{t("ajoute")}</span>
                ) : (
                  <form action={(fd) => start(async () => {
                    const res = await addAction(undefined, fd);
                    if (res?.error) setAddError(res.error);
                    else { setAddError(null); setAddedIds((s) => new Set(s).add(result.placeId)); }
                  })}>
                    <input type="hidden" name="placeId" value={result.placeId} />
                    <Button type="submit" variant="ghost" pending={pending}>{t("add")}</Button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {searched && !pending && results.length === 0 && (
        <p className="text-sm text-muted">{t("empty")}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Brancher dans `PlacesTabs.tsx`**

Dans `src/features/places/ui/PlacesTabs.tsx`, remplacer l'import :
```tsx
import { PlaceSearch } from "./PlaceSearch";
```
par :
```tsx
import { PlaceDiscovery } from "./PlaceDiscovery";
```
Et remplacer la ligne du panneau Recherche :
```tsx
      {tab === "recherche" && <PlaceSearch places={places} category={category} />}
```
par :
```tsx
      {tab === "recherche" && <PlaceDiscovery places={places} category={category} />}
```

- [ ] **Step 4: Supprimer les fichiers morts**

```bash
git rm src/features/places/ui/PlaceSearch.tsx src/features/restos/domain/splitSearch.ts src/features/restos/domain/splitSearch.test.ts
```

- [ ] **Step 5: Typecheck + suite complète**

Run: `npx tsc --noEmit && npm test`
Expected: PASS. Plus aucune référence à `PlaceSearch`/`splitSearch`/clés retirées. (L'e2e n'est pas exécuté ici.)

- [ ] **Step 6: Commit**

```bash
git add src/features/places/ui/PlaceDiscovery.tsx src/features/places/ui/PlacesTabs.tsx messages/fr.json messages/en.json messages/it.json messages/es.json
git commit -m "feat(places): écran Recherche découverte (PlaceDiscovery) + suppression PlaceSearch/splitSearch"
```

---

### Task 3: e2e — découverte + adaptation des specs voisins

Tester le nouvel écran (sans ajouter d'état partagé en `places.spec`) et adapter `restos.spec`/`hotels.spec` au flux submit.

**Files:**
- Modify: `e2e/places.spec.ts`
- Modify: `e2e/restos.spec.ts`
- Modify: `e2e/hotels.spec.ts`

**Interfaces:**
- Consumes: `PlaceDiscovery` (Task 2). Pas de seed (la recherche utilise le provider mock).
- Produces: rien (test terminal).

- [ ] **Step 1: Ajouter le test découverte dans `places.spec.ts`**

> Note : ce test n'**ajoute** aucun lieu (sinon il fausserait le comptage de l'onglet Carte de la Slice 4 — état DB partagé). Le flux Ajouter→Ajouté est couvert par `restos.spec`.

Ajouter à la fin de `e2e/places.spec.ts` :

```ts
test("onglet Recherche : découverte (envies, submit, récentes)", async ({ page }) => {
  await login(page);
  await page.getByTestId("tab-recherche").click();
  // état initial : chips d'envie rendues
  await expect(page.getByTestId("envies")).toBeVisible();
  await expect(page.getByTestId("envie-envieItalien")).toBeVisible();
  // submit "bistrot" → résultats
  await page.getByTestId("add-resto-search").fill("bistrot");
  await page.getByTestId("search-submit").click();
  await expect(page.getByTestId("search-result").first()).toBeVisible();
  // revenir à la découverte → la recherche récente est enregistrée
  await page.getByTestId("search-clear").click();
  await expect(page.getByTestId("recents")).toContainText("bistrot");
  // re-cliquer la récente relance la recherche
  await page.getByTestId("recent-item").first().click();
  await expect(page.getByTestId("search-result").first()).toBeVisible();
});
```

- [ ] **Step 2: Adapter `restos.spec.ts` au submit**

Le flux d'ajout n'affiche plus de résultats « au fil de la frappe » ; il faut soumettre. Dans le test « ajouter un resto via recherche… », après le `fill("bistrot")` et **avant** l'assertion `search-result`, insérer le submit. Remplacer :

```ts
  await page.getByTestId("add-resto-search").fill("bistrot");
  await expect(page.getByTestId("search-result").first()).toBeVisible();
```
par :
```ts
  await page.getByTestId("add-resto-search").fill("bistrot");
  await page.getByTestId("search-submit").click();
  await expect(page.getByTestId("search-result").first()).toBeVisible();
```

(Le reste du test — clic sur le bouton Ajouter de la 1ʳᵉ ligne, puis onglet Recommandés — reste inchangé.)

- [ ] **Step 3: Adapter `hotels.spec.ts` au submit**

Dans le test « ajouter un hôtel via la recherche externe », remplacer :

```ts
  await page.getByTestId("add-hotel-search").fill("hôtel");
  await expect(page.getByTestId("search-result").first()).toBeVisible();
```
par :
```ts
  await page.getByTestId("add-hotel-search").fill("hôtel");
  await page.getByTestId("search-submit").click();
  await expect(page.getByTestId("search-result").first()).toBeVisible();
```

(Le reste — clic Ajouter, puis `tab-recommandes` — reste inchangé.)

- [ ] **Step 4: Lancer les e2e impactés**

Run: `npx playwright test e2e/places.spec.ts e2e/restos.spec.ts e2e/hotels.spec.ts`
Expected: PASS (les 3 fichiers, existants + nouveau test découverte).

- [ ] **Step 5: Commit**

```bash
git add e2e/places.spec.ts e2e/restos.spec.ts e2e/hotels.spec.ts
git commit -m "test(places): e2e Recherche découverte + flux d'ajout en submit (restos/hotels)"
```

---

## Self-Review

**Spec coverage :**
- §1 Domaine `discovery` (searchEnvies + markOwned + addRecent/removeRecent) → Task 1. ✅
- §2 `PlaceDiscovery` (submit, recents localStorage, envies, résultats Ajouter/Ajouté) → Task 2. ✅
- §3 Nettoyage (suppr. PlaceSearch + splitSearch + 4 clés mortes) → Task 2. ✅
- §4 `PlacesTabs` (Recherche → PlaceDiscovery) → Task 2. ✅
- §5 i18n (ajouts + retraits, parité 4 locales) → Task 2. ✅
- §6 Tests (domaine TDD, e2e + adaptation voisins) → Tasks 1, 3. ✅
- §Sécurité (searchPlaces auth-gated, localStorage client, pas de migration) → respecté. ✅
- Hors périmètre (rating/vignette résultats, recents multi-appareils, envies hôtel, prix/similaires) → non implémenté. ✅

**Placeholder scan :** aucun TBD/TODO ; code complet à chaque étape.

**Type consistency :** `searchEnvies`/`markOwned`/`addRecent`/`removeRecent` (Task 1) consommés avec les mêmes signatures dans `PlaceDiscovery` (Task 2). `PlaceSummary`/`Place` cohérents. testids alignés composant ↔ e2e : `add-{resto,hotel}-search`, `search-submit`, `search-clear`, `recents`, `recent-item`, `envies`, `envie-envieItalien`, `search-result`, `result-added`.

**Gap connu (assumé) :** `PlaceDiscovery` n'a pas de test composant (il appelle des server actions `searchPlaces`/`addResto`, non exécutables sous jsdom) ; sa logique pure est testée (Task 1) et son interaction en e2e (Task 3) — conforme à la convention du repo. `places.spec` ne fait **aucun ajout** (évite de polluer le comptage Carte de la Slice 4) ; le flux Ajouter→Ajouté est couvert par `restos.spec`. Les specs voisins sont adaptés au submit dans la même slice (anticipation du risque cross-cutting vu en Slice 3).
