# Slice 3 — Restructure IA (4 onglets + toggle de vue) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructurer les onglets lieux en IA cible **Favoris · Recommandés · Carte · Recherche** avec un toggle de vue Liste / Vignettes / Carte sur Favoris, et afficher « Conseillé par X » (`reco_source`) sur Recommandés.

**Architecture:** Données : `getPlaces()` remonte `reco_source` et exclut les items archivés. Domaine pur `placesTabsConfig` (sous-ensembles par onglet + vues autorisées). UI : `PlacesTabs` devient un orchestrateur de 4 onglets ; un `PlaceListPanel` réutilisable porte le filtre local + le toggle de vue + le rendu (liste/vignettes/carte) ; `PlaceCard` gagne une ligne « Conseillé par X ». Les onglets Carte et Recherche réutilisent `PlacesMap` et `PlaceSearch` existants (intérimaire ; enrichis en Slices 4/5).

**Tech Stack:** Next 16 (App Router), React, TypeScript, next-intl 4, Supabase, Tailwind v4, Vitest (jsdom + RTL), Playwright.

Spec : `docs/superpowers/specs/2026-06-27-resto-hotels-slice-3-restructure-ia-design.md`.

## Global Constraints

- IA = **Favoris · Recommandés · Carte · Recherche**. Retrait des onglets « Tous » et « Visités ».
- Toggle de vue **Liste / Vignettes / Carte sur Favoris seul** ; Recommandés en **Liste seule**.
- Onglet **Carte** = `PlacesMap` des favoris + recommandés combinés (dédup par `id`), sans filtres (Slice 4). Onglet **Recherche** = `PlaceSearch` existant (Slice 5).
- `reco_source` affiché en variant **liste** uniquement, via `Avatar` + `avatarColor`. Pas en vignette.
- i18n **4 locales** `fr, en, it, es` en **parité**. Aucune chaîne en dur. Aucun nouveau token.
- `Link` locale-aware via `@/lib/i18n/routing`.
- **Aucune migration / pas de go-prod DB.** RLS inchangée ; `getPlaces` ne fait que restreindre (`is_archived=false`).
- `statut='visite'` conservé en base (KPI dashboard) — seulement retiré de l'IA.

---

### Task 1: Data — `reco_source` + exclusion des archivés

Remonter `reco_source` jusqu'au type `Place`, l'inclure dans `getPlaces()`, et exclure `is_archived=true`. Corriger les 4 fabriques de test qui construisent un littéral `Place`.

**Files:**
- Modify: `src/features/places/domain/filterPlaces.ts:1-7` (type `Place`)
- Modify: `src/features/places/data/queries.ts:6-23` (select + filtre + mapping)
- Modify: `src/features/places/domain/filterPlaces.test.ts` (fabrique `P`)
- Modify: `src/features/places/domain/mapCenter.test.ts` (fabrique `place`)
- Modify: `src/features/restos/domain/splitSearch.test.ts` (fabrique `place`)
- Modify: `src/features/places/ui/PlaceCard.test.tsx` (fabrique `makePlace`)

**Interfaces:**
- Consumes: rien.
- Produces: `Place` porte `reco_source: string | null` (racine, à côté de `statut`/`is_favorite`), peuplé par `getPlaces()` ; `getPlaces()` exclut les items `is_archived`.

- [ ] **Step 1: Étendre le type `Place`**

Dans `src/features/places/domain/filterPlaces.ts`, remplacer la ligne 3 (`is_favorite: boolean;`) en ajoutant le champ juste après :

```ts
  is_favorite: boolean;
  reco_source: string | null;
```

- [ ] **Step 2: `getPlaces()` — select, filtre, mapping**

Dans `src/features/places/data/queries.ts` :

Remplacer le `select` (lignes 8-10) par (ajout de `reco_source` au niveau `liste_items`) :

```ts
    .select(
      "id, statut, is_favorite, reco_source, etablissement:etablissements!inner(id, nom, type, ville, arrondissement, categorie, photo_ref, lat, lng, place_id, rating, rating_count), tags:liste_item_tags(tag:tags(slug, label, color))"
    )
```

Ajouter le filtre `is_archived` juste après `.eq("etablissement.categorie", category)` (ligne 11) :

```ts
    .eq("etablissement.categorie", category)
    .eq("is_archived", false)
```

Dans le `.map(...)`, ajouter `reco_source` (après `is_favorite: row.is_favorite,`) :

```ts
    is_favorite: row.is_favorite,
    reco_source: row.reco_source,
```

- [ ] **Step 3: Corriger les 4 fabriques de test**

Ajouter `reco_source: null` au niveau racine de l'objet `Place` retourné par chaque fabrique.

`src/features/places/domain/filterPlaces.test.ts` — la fabrique `P` commence par `id: nom, statut: "a_faire" as const, is_favorite: false,` → ajouter `reco_source: null,` après `is_favorite: false,`.

`src/features/places/domain/mapCenter.test.ts` — la fabrique `place` a `id: ..., statut: "a_faire", is_favorite: false,` → ajouter `reco_source: null,` après `is_favorite: false,`.

`src/features/restos/domain/splitSearch.test.ts` — la fabrique `place` a `is_favorite: over.is_favorite ?? false,` → ajouter `reco_source: null,` après cette ligne.

`src/features/places/ui/PlaceCard.test.tsx` — la fabrique `makePlace` a `id: "li1", statut: "a_faire", is_favorite: false,` → ajouter `reco_source: null,` après `is_favorite: false,`.

- [ ] **Step 4: Typecheck + suite verte**

Run: `npx tsc --noEmit && npm test`
Expected: PASS. Aucune erreur de type ; tous les tests existants verts.

- [ ] **Step 5: Commit**

```bash
git add src/features/places/domain/filterPlaces.ts src/features/places/data/queries.ts src/features/places/domain/filterPlaces.test.ts src/features/places/domain/mapCenter.test.ts src/features/restos/domain/splitSearch.test.ts src/features/places/ui/PlaceCard.test.tsx
git commit -m "feat(places): remonter reco_source + exclure is_archived dans getPlaces"
```

---

### Task 2: Domaine pur — `placesTabsConfig`

Sous-ensembles par onglet et vues autorisées. Pur, TDD.

**Files:**
- Create: `src/features/places/domain/placesTabsConfig.ts`
- Test: `src/features/places/domain/placesTabsConfig.test.ts`

**Interfaces:**
- Consumes: type `Place` de `./filterPlaces`.
- Produces (signatures exactes consommées par Task 4) :
  - `type PlacesTab = "favoris" | "recommandes" | "carte" | "recherche"`
  - `type PlaceView = "liste" | "vignettes" | "carte"`
  - `const TAB_VIEWS: Record<"favoris" | "recommandes", PlaceView[]>`
  - `function subsetForTab(places: Place[], tab: "favoris" | "recommandes"): Place[]`

- [ ] **Step 1: Écrire le test (échouant)**

Créer `src/features/places/domain/placesTabsConfig.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { subsetForTab, TAB_VIEWS } from "./placesTabsConfig";
import type { Place } from "./filterPlaces";

const mk = (over: Partial<Place>): Place => ({
  id: Math.random().toString(36),
  statut: "a_faire",
  is_favorite: false,
  reco_source: null,
  etablissement: { id: "e", nom: "X", type: null, ville: null, arrondissement: null, categorie: "resto", photo_ref: null, lat: null, lng: null, place_id: null, rating: null, rating_count: null },
  tags: [],
  ...over,
});

describe("subsetForTab", () => {
  const list = [
    mk({ id: "fav", is_favorite: true, statut: "visite" }),
    mk({ id: "todo", is_favorite: false, statut: "a_faire" }),
    mk({ id: "vis", is_favorite: false, statut: "visite" }),
  ];
  it("favoris → uniquement is_favorite", () => {
    expect(subsetForTab(list, "favoris").map((p) => p.id)).toEqual(["fav"]);
  });
  it("recommandes → uniquement statut a_faire", () => {
    expect(subsetForTab(list, "recommandes").map((p) => p.id)).toEqual(["todo"]);
  });
});

describe("TAB_VIEWS", () => {
  it("favoris a les 3 vues", () => expect(TAB_VIEWS.favoris).toEqual(["liste", "vignettes", "carte"]));
  it("recommandes en liste seule", () => expect(TAB_VIEWS.recommandes).toEqual(["liste"]));
});
```

- [ ] **Step 2: Lancer le test → échec**

Run: `npx vitest run src/features/places/domain/placesTabsConfig.test.ts`
Expected: FAIL — `Failed to resolve import "./placesTabsConfig"`.

- [ ] **Step 3: Implémenter `placesTabsConfig.ts`**

Créer `src/features/places/domain/placesTabsConfig.ts` :

```ts
import type { Place } from "./filterPlaces";

export type PlacesTab = "favoris" | "recommandes" | "carte" | "recherche";
export type PlaceView = "liste" | "vignettes" | "carte";

export const TAB_VIEWS: Record<"favoris" | "recommandes", PlaceView[]> = {
  favoris: ["liste", "vignettes", "carte"],
  recommandes: ["liste"],
};

/** Items d'un onglet de liste. favoris = coups de cœur ; recommandes = à tester (statut a_faire). */
export function subsetForTab(places: Place[], tab: "favoris" | "recommandes"): Place[] {
  return tab === "favoris"
    ? places.filter((p) => p.is_favorite)
    : places.filter((p) => p.statut === "a_faire");
}
```

- [ ] **Step 4: Lancer le test → succès**

Run: `npx vitest run src/features/places/domain/placesTabsConfig.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/places/domain/placesTabsConfig.ts src/features/places/domain/placesTabsConfig.test.ts
git commit -m "feat(places): domaine pur placesTabsConfig (subsetForTab + TAB_VIEWS)"
```

---

### Task 3: `PlaceCard` — ligne « Conseillé par X » + i18n

Afficher `reco_source` en variant liste, via `Avatar` + `avatarColor`. Test composant.

**Files:**
- Modify: `src/features/places/ui/PlaceCard.tsx`
- Modify: `src/features/places/ui/PlaceCard.test.tsx`
- Modify: `messages/fr.json`, `messages/en.json`, `messages/it.json`, `messages/es.json` (clé `conseilléPar`)

**Interfaces:**
- Consumes: `place.reco_source` (Task 1) ; `Avatar`, `avatarColor`.
- Produces: en variant liste, `PlaceCard` émet `data-testid="place-reco"` quand `reco_source` est non vide.

- [ ] **Step 1: Ajouter la clé `conseilléPar` aux 4 locales**

Dans le namespace `places`, ajouter (placement libre dans le bloc) :
- `messages/fr.json` : `"conseilléPar": "Conseillé par {name}",`
- `messages/en.json` : `"conseilléPar": "Recommended by {name}",`
- `messages/it.json` : `"conseilléPar": "Consigliato da {name}",`
- `messages/es.json` : `"conseilléPar": "Recomendado por {name}",`

- [ ] **Step 2: Étendre le test composant (échouant)**

Dans `src/features/places/ui/PlaceCard.test.tsx` :

Ajouter `conseilléPar` aux messages inline. Remplacer :

```tsx
const messages = { places: { noteSur10: "/10" } };
```

par :

```tsx
const messages = { places: { noteSur10: "/10", "conseilléPar": "Conseillé par {name}" } };
```

Modifier la fabrique `makePlace` pour accepter un `reco_source` racine. Remplacer la signature et l'objet :

```tsx
const makePlace = (over: Partial<Place["etablissement"]> = {}, tags: Place["tags"] = [], reco_source: string | null = null): Place => ({
  id: "li1",
  statut: "a_faire",
  is_favorite: false,
  reco_source,
  etablissement: {
    id: "e1", nom: "Le Bistrot Démo", type: null, ville: "Paris", arrondissement: null,
    categorie: "resto", photo_ref: null, lat: null, lng: null, place_id: null,
    rating: 4.6, rating_count: 320, ...over,
  },
  tags,
});
```

Ajouter ce bloc de tests à la fin du fichier (avant la dernière `});` de fermeture du fichier, comme nouveau `describe`) :

```tsx
describe("PlaceCard — conseillé par (reco_source)", () => {
  it("liste : affiche « Conseillé par X » quand reco_source présent", () => {
    renderCard(makePlace({}, [], "Camille"));
    expect(screen.getByTestId("place-reco")).toHaveTextContent("Conseillé par Camille");
  });
  it("liste : pas de bloc reco quand reco_source null", () => {
    renderCard(makePlace({}, [], null));
    expect(screen.queryByTestId("place-reco")).toBeNull();
  });
  it("vignette : jamais de bloc reco", () => {
    renderCard(makePlace({}, [], "Camille"), "vignette");
    expect(screen.queryByTestId("place-reco")).toBeNull();
  });
});
```

- [ ] **Step 3: Lancer le test → échec**

Run: `npx vitest run src/features/places/ui/PlaceCard.test.tsx`
Expected: FAIL — `place-reco` introuvable.

- [ ] **Step 4: Implémenter la ligne reco dans `PlaceCard.tsx`**

Ajouter les imports (après la ligne 4 `import { Badge } …`) :

```tsx
import { Avatar } from "@/features/shared/ui/Avatar";
import { avatarColor } from "@/features/famille/domain/avatarColor";
```

Après le bloc `const chips = …` (ligne 49, avant `if (variant === "vignette")`), ajouter :

```tsx
  const reco = place.reco_source ? (
    <span data-testid="place-reco" className="inline-flex items-center gap-2 text-xs text-muted">
      <Avatar name={place.reco_source} size="sm" color={avatarColor(place.reco_source)} />
      {t("conseilléPar", { name: place.reco_source })}
    </span>
  ) : null;
```

Dans le **variant liste** (le `return` final), insérer `{reco}` entre la ligne sous-titre et le bloc note/chips. Remplacer :

```tsx
          {subtitle && <span className="text-sm text-muted">{etablissement.ville}</span>}
          {(note || chips) && (
```

par :

```tsx
          {subtitle && <span className="text-sm text-muted">{etablissement.ville}</span>}
          {reco}
          {(note || chips) && (
```

(Le variant vignette n'utilise pas `reco` — ne pas l'y ajouter.)

- [ ] **Step 5: Lancer le test → succès**

Run: `npx vitest run src/features/places/ui/PlaceCard.test.tsx`
Expected: PASS (note + chips + reco : liste affiche, null masque, vignette jamais).

- [ ] **Step 6: Typecheck + suite complète**

Run: `npx tsc --noEmit && npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/places/ui/PlaceCard.tsx src/features/places/ui/PlaceCard.test.tsx messages/fr.json messages/en.json messages/it.json messages/es.json
git commit -m "feat(places): PlaceCard affiche « Conseillé par X » (reco_source) en variant liste"
```

---

### Task 4: `PlaceListPanel` + `PlacesTabs` réécrit + pages + i18n

Restructure UI complète : panneau réutilisable, orchestrateur 4 onglets, retrait du `PlaceSearch` autonome des pages, i18n. Doit atterrir ensemble (dépendances de compilation).

**Files:**
- Create: `src/features/places/ui/PlacesMapLazy.tsx`
- Create: `src/features/places/ui/PlaceListPanel.tsx`
- Modify (réécriture): `src/features/places/ui/PlacesTabs.tsx`
- Modify: `src/app/[locale]/(app)/restos/page.tsx`
- Modify: `src/app/[locale]/(app)/hotels/page.tsx`
- Modify: `messages/fr.json`, `messages/en.json`, `messages/it.json`, `messages/es.json`

**Interfaces:**
- Consumes: `TAB_VIEWS`, `subsetForTab`, `PlacesTab`, `PlaceView` (Task 2) ; `PlaceCard` variant (Slice 2) ; `PlacesMap`, `PlaceSearch` existants.
- Produces: `PlacesTabs` rend 4 onglets (`tab-favoris`/`tab-recommandes`/`tab-carte`/`tab-recherche`) ; `PlaceListPanel` émet `places-search` (filtre local) + `view-{liste|vignettes|carte}` (toggle si >1 vue).

- [ ] **Step 1: Créer `PlacesMapLazy.tsx`**

Créer `src/features/places/ui/PlacesMapLazy.tsx` (import dynamique partagé, `ssr:false`) :

```tsx
"use client";
import dynamic from "next/dynamic";

export const PlacesMapLazy = dynamic(() => import("./PlacesMap").then((m) => m.PlacesMap), { ssr: false });
```

- [ ] **Step 2: Créer `PlaceListPanel.tsx`**

Créer `src/features/places/ui/PlaceListPanel.tsx` :

```tsx
"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { filterPlaces, type Place } from "../domain/filterPlaces";
import type { PlaceView } from "../domain/placesTabsConfig";
import { PlaceCard } from "./PlaceCard";
import { PlacesMapLazy } from "./PlacesMapLazy";

export function PlaceListPanel({
  places,
  views,
  locale,
}: {
  places: Place[];
  views: PlaceView[];
  locale: string;
}) {
  const t = useTranslations("places");
  const [q, setQ] = useState("");
  const [view, setView] = useState<PlaceView>(views[0]!);
  const shown = filterPlaces(places, q);
  const viewLabel: Record<PlaceView, string> = {
    liste: t("vueListe"),
    vignettes: t("vueVignettes"),
    carte: t("vueCarte"),
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <input
          data-testid="places-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("filtrerPlaceholder")}
          className="flex-1 rounded-control border border-line bg-surface px-3 py-2 text-sm outline-none focus:outline-2 focus:outline-accent"
        />
        {views.length > 1 && (
          <div className="flex gap-1 rounded-control border border-line p-0.5">
            {views.map((v) => (
              <button
                key={v}
                type="button"
                data-testid={`view-${v}`}
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={`rounded-[2px] px-3 py-1 text-sm ${view === v ? "bg-accent text-white" : "text-muted"}`}
              >
                {viewLabel[v]}
              </button>
            ))}
          </div>
        )}
      </div>
      {view === "carte" ? (
        <PlacesMapLazy places={shown} locale={locale} />
      ) : shown.length === 0 ? (
        <p className="text-sm text-muted">{t("empty")}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {shown.map((p) => (
            <PlaceCard key={p.id} place={p} variant={view === "vignettes" ? "vignette" : "liste"} />
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Réécrire `PlacesTabs.tsx`**

Remplacer **tout** le contenu de `src/features/places/ui/PlacesTabs.tsx` par :

```tsx
"use client";
import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { type Place } from "../domain/filterPlaces";
import { TAB_VIEWS, subsetForTab, type PlacesTab } from "../domain/placesTabsConfig";
import { PlaceListPanel } from "./PlaceListPanel";
import { PlaceSearch } from "./PlaceSearch";
import { PlacesMapLazy } from "./PlacesMapLazy";

export function PlacesTabs({ category, places }: { category: "resto" | "hotel"; places: Place[] }) {
  const t = useTranslations("places");
  const locale = useLocale();
  const [tab, setTab] = useState<PlacesTab>("favoris");

  const favoris = subsetForTab(places, "favoris");
  const recommandes = subsetForTab(places, "recommandes");
  // Carte combinée intérimaire : union favoris + recommandés, dédupliquée par id.
  const cartePlaces = Array.from(new Map([...favoris, ...recommandes].map((p) => [p.id, p])).values());

  const tabs: { key: PlacesTab; testid: string; label: string; count?: number }[] = [
    { key: "favoris", testid: "tab-favoris", label: t("favoris"), count: favoris.length },
    { key: "recommandes", testid: "tab-recommandes", label: t("recommandes"), count: recommandes.length },
    { key: "carte", testid: "tab-carte", label: t("carte") },
    { key: "recherche", testid: "tab-recherche", label: t("recherche") },
  ];

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
              {it.label}
              {it.count !== undefined && <span className="text-faint"> · {it.count}</span>}
            </button>
          );
        })}
      </div>
      {tab === "favoris" && <PlaceListPanel places={favoris} views={TAB_VIEWS.favoris} locale={locale} />}
      {tab === "recommandes" && <PlaceListPanel places={recommandes} views={TAB_VIEWS.recommandes} locale={locale} />}
      {tab === "carte" && <PlacesMapLazy places={cartePlaces} locale={locale} />}
      {tab === "recherche" && <PlaceSearch places={places} category={category} />}
    </div>
  );
}
```

- [ ] **Step 4: Retirer `PlaceSearch` autonome des pages**

`src/app/[locale]/(app)/restos/page.tsx` : supprimer l'import `PlaceSearch` (ligne 2) et la ligne `<PlaceSearch places={places} category="resto" />`. Résultat du `return` :

```tsx
    <main className="flex flex-col gap-6 p-4 md:p-8">
      <PageHeader title={t("title")} />
      <GoutsBanner />
      <PlacesTabs category="resto" places={places} />
    </main>
```

`src/app/[locale]/(app)/hotels/page.tsx` : supprimer l'import `PlaceSearch` et la ligne `<PlaceSearch places={places} category="hotel" />`. Résultat du `return` :

```tsx
    <main className="flex flex-col gap-6 p-4 md:p-8">
      <PageHeader title={t("title")} />
      <PlacesTabs category="hotel" places={places} />
    </main>
```

- [ ] **Step 5: i18n — ajouts + retraits (4 locales, parité)**

Dans le namespace `places` de chaque fichier : **ajouter** les nouvelles clés et **supprimer** les clés mortes `tous`, `aTester`, `visites`, `searchPlaceholder`.

`messages/fr.json` — ajouter :
```json
    "recommandes": "Recommandés",
    "carte": "Carte",
    "recherche": "Recherche",
    "vueVignettes": "Vignettes",
    "filtrerPlaceholder": "Rechercher dans cette liste…",
```
`messages/en.json` — ajouter : `"recommandes": "Recommended", "carte": "Map", "recherche": "Search", "vueVignettes": "Tiles", "filtrerPlaceholder": "Search this list…",`
`messages/it.json` — ajouter : `"recommandes": "Consigliati", "carte": "Mappa", "recherche": "Cerca", "vueVignettes": "Riquadri", "filtrerPlaceholder": "Cerca in questo elenco…",`
`messages/es.json` — ajouter : `"recommandes": "Recomendados", "carte": "Mapa", "recherche": "Buscar", "vueVignettes": "Mosaicos", "filtrerPlaceholder": "Buscar en esta lista…",`

Dans les 4 fichiers, **supprimer** les lignes `"tous": ...`, `"aTester": ...`, `"visites": ...`, `"searchPlaceholder": ...`. Garder le JSON valide (virgules).

- [ ] **Step 6: Typecheck + suite complète**

Run: `npx tsc --noEmit && npm test`
Expected: PASS. Les tests unitaires/composant existants restent verts (`PlaceCard.test.tsx`, domaine). Note : l'e2e n'est pas exécuté ici (Task 5).

- [ ] **Step 7: Commit**

```bash
git add src/features/places/ui/PlacesMapLazy.tsx src/features/places/ui/PlaceListPanel.tsx src/features/places/ui/PlacesTabs.tsx "src/app/[locale]/(app)/restos/page.tsx" "src/app/[locale]/(app)/hotels/page.tsx" messages/fr.json messages/en.json messages/it.json messages/es.json
git commit -m "feat(places): restructure IA en 4 onglets + PlaceListPanel (toggle Liste/Vignettes/Carte)"
```

---

### Task 5: e2e — nouvelle IA + seed `reco_source`

Réécrire l'e2e pour la nouvelle IA et doter un item d'un `reco_source`.

**Files:**
- Modify: `supabase/seed.sql` (liste_item resto du client)
- Modify (réécriture): `e2e/places.spec.ts`

**Interfaces:**
- Consumes: nouvelle IA (Task 4), `place-reco` (Task 3), `reco_source` remonté (Task 1).
- Produces: rien (test terminal).

- [ ] **Step 1: Ajouter `reco_source` au seed du resto client**

Dans `supabase/seed.sql`, remplacer l'insert `liste_items` du client (le resto « Le Bistrot Démo », actuellement) :

```sql
insert into public.liste_items (user_id, etablissement_id, statut, is_favorite)
values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a_faire', true);
```

par (ajout colonne + valeur `reco_source`) :

```sql
insert into public.liste_items (user_id, etablissement_id, statut, is_favorite, reco_source)
values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a_faire', true, 'Camille');
```

- [ ] **Step 2: Réappliquer le seed local**

Run: `npx supabase db reset`
Expected: rechargement sans erreur.

- [ ] **Step 3: Réécrire `e2e/places.spec.ts`**

Remplacer **tout** le contenu de `e2e/places.spec.ts` par :

```ts
import { test, expect } from "@playwright/test";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/fr/login");
  await page.getByLabel("E-mail").fill("client@vito.test");
  await page.getByLabel("Mot de passe").fill("password123");
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/fr\/accueil/);
  await page.goto("/fr/restos");
}

// Seed: client@vito.test a 1 resto "Le Bistrot Démo" (is_favorite=true, statut='a_faire',
// reco_source='Camille', rating=4.6) → présent dans Favoris ET Recommandés.

test("les 4 onglets sont visibles, Favoris actif par défaut", async ({ page }) => {
  await login(page);
  await expect(page.getByTestId("places-tabs")).toBeVisible();
  for (const id of ["tab-favoris", "tab-recommandes", "tab-carte", "tab-recherche"]) {
    await expect(page.getByTestId(id)).toBeVisible();
  }
  await expect(page.getByTestId("tab-favoris")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("place-card")).toHaveCount(1);
});

test("Favoris : note affichée + toggle 3 vues (Vignettes puis Carte)", async ({ page }) => {
  await login(page);
  await expect(page.getByTestId("place-note").first()).toContainText("4,6");
  await expect(page.getByTestId("view-liste")).toBeVisible();
  await expect(page.getByTestId("view-vignettes")).toBeVisible();
  await page.getByTestId("view-vignettes").click();
  await expect(page.getByTestId("place-card-vignette")).toHaveCount(1);
  await page.getByTestId("view-carte").click();
  await expect(page.getByTestId("places-map")).toBeVisible();
});

test("Recommandés : pas de toggle, « Conseillé par X » visible", async ({ page }) => {
  await login(page);
  await page.getByTestId("tab-recommandes").click();
  await expect(page.getByTestId("view-vignettes")).toHaveCount(0);
  await expect(page.getByTestId("place-reco")).toContainText("Camille");
});

test("filtre local d'un onglet filtre les place-cards", async ({ page }) => {
  await login(page);
  await page.getByTestId("places-search").fill("bistrot");
  await expect(page.getByTestId("place-card")).toHaveCount(1);
  await page.getByTestId("places-search").fill("xyzabsent999");
  await expect(page.getByTestId("place-card")).toHaveCount(0);
});

test("onglet Recherche affiche le PlaceSearch", async ({ page }) => {
  await login(page);
  await page.getByTestId("tab-recherche").click();
  await expect(page.getByTestId("add-resto-search")).toBeVisible();
});
```

- [ ] **Step 4: Lancer l'e2e places**

Run: `npx playwright test e2e/places.spec.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add supabase/seed.sql e2e/places.spec.ts
git commit -m "test(places): e2e nouvelle IA (4 onglets + toggle + conseillé par) + seed reco_source"
```

---

## Self-Review

**Spec coverage :**
- §1 Data (reco_source + is_archived) → Task 1. ✅
- §2 Domaine `placesTabsConfig` (subsetForTab + TAB_VIEWS) → Task 2. ✅
- §3 `PlaceListPanel` (filtre local + toggle conditionnel + rendu) → Task 4. ✅
- §4 `PlacesTabs` 4 onglets (Favoris/Recommandés liste-panel ; Carte=union dédup ; Recherche=PlaceSearch) → Task 4. ✅
- §5 `PlaceCard` « Conseillé par X » → Task 3. ✅
- §6 Pages (retrait PlaceSearch autonome) → Task 4. ✅
- §7 i18n (ajouts + retrait clés mortes, parité) → Tasks 3 (conseilléPar) + 4 (le reste). ✅
- §Tests (domaine TDD, composant, e2e) → Tasks 2, 3, 5. ✅
- §Sécurité (lecture seule, is_archived restreint, pas de migration) → respecté. ✅
- Hors périmètre (carte combinée Slice 4, recherche Slice 5, archivage Slice 6, redesign Slice 9) → non implémenté. ✅

**Placeholder scan :** aucun TBD/TODO ; code complet à chaque étape.

**Type consistency :** `PlaceView`/`PlacesTab`/`TAB_VIEWS`/`subsetForTab` (Task 2) consommés avec les mêmes signatures dans `PlaceListPanel` et `PlacesTabs` (Task 4). `Place.reco_source: string | null` (Task 1) lu par `PlaceCard` (Task 3) et `subsetForTab`. testids cohérents entre composants et e2e : `tab-favoris`/`tab-recommandes`/`tab-carte`/`tab-recherche`, `view-liste`/`view-vignettes`/`view-carte`, `places-search`, `place-card`, `place-card-vignette`, `place-note`, `place-reco`, `places-map`, `add-resto-search`.

**Gap connu (assumé) :** l'onglet Carte (carte combinée) et l'onglet Recherche sont intentionnellement intérimaires (PlacesMap/PlaceSearch existants) ; leurs versions enrichies (pins distincts + filtres ; écran découverte) sont Slices 4 et 5. `PlaceListPanel` (glue fine sur composants déjà testés) n'a pas de test composant dédié : son intégration est couverte par l'e2e (Task 5), conforme à la convention du repo (domaine unitaire + e2e).
