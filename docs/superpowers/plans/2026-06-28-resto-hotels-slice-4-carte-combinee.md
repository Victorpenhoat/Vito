# Slice 4 — Carte combinée — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Doter l'onglet Carte d'une carte combinée (favoris + recommandés) avec pins distincts (favori plein / recommandé contour), légende, filtre par tag (chips single-select) et comptage d'adresses.

**Architecture:** Domaine pur `mapFilters` (tags uniques + filtrage par tag). `PlacesMap` étendu (popup catégorie-aware + style pin contour pour les recommandés). Nouveau `PlacesMapCombined` (chips + légende + comptage) consommé par l'onglet Carte de `PlacesTabs`.

**Tech Stack:** Next 16 (App Router), React, TypeScript, next-intl 4, Leaflet/react-leaflet (ssr:false), Supabase, Tailwind v4, Vitest, Playwright.

Spec : `docs/superpowers/specs/2026-06-28-resto-hotels-slice-4-carte-combinee-design.md`.

## Global Constraints

- Pins : **favori = plein or** (`var(--gold)`), **recommandé (a_faire non-favori) = contour accent** (`var(--accent)`).
- Filtre par tag = **single-select** (« Tous » ou un tag).
- Filtres/légende/comptage **uniquement** dans la carte combinée (onglet Carte). La vue Carte de Favoris reste `PlacesMap` simple.
- Popup carte : lien **catégorie-aware** `/{locale}/{base}/{id}` (`base = categorie==="hotel" ? "hotels" : "restos"`) — corrige le lien codé en dur `/restos`.
- i18n **4 locales** `fr, en, it, es` parité. Aucune chaîne en dur. Aucun nouveau token (tokens maison : `bg-accent`, `border-line`, `text-muted`, `text-white`, `rounded-control`, `var(--gold)`, `var(--accent)`, `bg-surface`).
- Leaflet rendu `ssr:false` via `PlacesMapLazy`.
- **Aucune migration / pas de go-prod DB.** Filtre tag purement client sur données déjà autorisées (RLS owner-only inchangée).

---

### Task 1: Domaine pur — `mapFilters`

Tags uniques pour les chips + filtrage par tag. Pur, TDD.

**Files:**
- Create: `src/features/places/domain/mapFilters.ts`
- Test: `src/features/places/domain/mapFilters.test.ts`

**Interfaces:**
- Consumes: type `Place` de `./filterPlaces`.
- Produces (consommé par Task 3) :
  - `function tagsForMap(places: Place[]): { slug: string; label: string }[]`
  - `function filterByTag(places: Place[], slug: string | null): Place[]`

- [ ] **Step 1: Écrire le test (échouant)**

Créer `src/features/places/domain/mapFilters.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { tagsForMap, filterByTag } from "./mapFilters";
import type { Place } from "./filterPlaces";

const mk = (id: string, tags: { slug: string; label: string }[]): Place => ({
  id,
  statut: "a_faire",
  is_favorite: false,
  reco_source: null,
  etablissement: { id, nom: id, type: null, ville: null, arrondissement: null, categorie: "resto", photo_ref: null, lat: null, lng: null, place_id: null, rating: null, rating_count: null },
  tags: tags.map((t) => ({ ...t, color: null })),
});

describe("tagsForMap", () => {
  it("déduplique par slug et trie par label", () => {
    const places = [
      mk("a", [{ slug: "terrasse", label: "Terrasse" }, { slug: "business", label: "Business" }]),
      mk("b", [{ slug: "terrasse", label: "Terrasse" }]),
    ];
    expect(tagsForMap(places)).toEqual([
      { slug: "business", label: "Business" },
      { slug: "terrasse", label: "Terrasse" },
    ]);
  });
  it("liste vide si aucun tag", () => {
    expect(tagsForMap([mk("a", [])])).toEqual([]);
  });
});

describe("filterByTag", () => {
  const places = [
    mk("a", [{ slug: "terrasse", label: "Terrasse" }]),
    mk("b", []),
  ];
  it("slug null → toutes les places", () => {
    expect(filterByTag(places, null).map((p) => p.id)).toEqual(["a", "b"]);
  });
  it("slug donné → uniquement celles portant ce slug", () => {
    expect(filterByTag(places, "terrasse").map((p) => p.id)).toEqual(["a"]);
  });
});
```

- [ ] **Step 2: Lancer le test → échec**

Run: `npx vitest run src/features/places/domain/mapFilters.test.ts`
Expected: FAIL — `Failed to resolve import "./mapFilters"`.

- [ ] **Step 3: Implémenter `mapFilters.ts`**

Créer `src/features/places/domain/mapFilters.ts` :

```ts
import type { Place } from "./filterPlaces";

/** Tags uniques (dédupliqués par slug), triés par label, présents sur l'ensemble des places. */
export function tagsForMap(places: Place[]): { slug: string; label: string }[] {
  const seen = new Map<string, string>();
  for (const p of places) {
    for (const t of p.tags) {
      if (!seen.has(t.slug)) seen.set(t.slug, t.label);
    }
  }
  return Array.from(seen, ([slug, label]) => ({ slug, label })).sort((a, b) => a.label.localeCompare(b.label));
}

/** Filtre par tag. slug null → toutes les places ; sinon celles portant ce slug. */
export function filterByTag(places: Place[], slug: string | null): Place[] {
  if (slug === null) return places;
  return places.filter((p) => p.tags.some((t) => t.slug === slug));
}
```

- [ ] **Step 4: Lancer le test → succès**

Run: `npx vitest run src/features/places/domain/mapFilters.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/places/domain/mapFilters.ts src/features/places/domain/mapFilters.test.ts
git commit -m "feat(places): domaine pur mapFilters (tagsForMap + filterByTag)"
```

---

### Task 2: `PlacesMap` — popup catégorie-aware + pin contour

Corriger le lien de popup et différencier le style des pins recommandés. Pas de test unitaire (Leaflet/jsdom) ; vérifié par tsc + suite existante, comportement couvert par l'e2e (Task 4).

**Files:**
- Modify: `src/features/places/ui/PlacesMap.tsx`

**Interfaces:**
- Consumes: rien de nouveau.
- Produces: pins favori (plein or) vs non-favori (contour accent) ; popup lie `/{locale}/{base}/{id}`.

- [ ] **Step 1: Remplacer la fonction `pin`**

Dans `src/features/places/ui/PlacesMap.tsx`, remplacer la fonction `pin` (lignes 9-18) par :

```tsx
function pin(favorite: boolean): L.DivIcon {
  // Favori = disque plein or ; recommandé (non favori) = disque contour accent. Couleurs via tokens CSS.
  const html = favorite
    ? `<span style="display:block;width:14px;height:14px;border-radius:9999px;background:var(--gold);border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4)"></span>`
    : `<span style="display:block;width:14px;height:14px;border-radius:9999px;background:#fff;border:2px solid var(--accent);box-shadow:0 1px 3px rgba(0,0,0,.4)"></span>`;
  return L.divIcon({ className: "", html, iconSize: [14, 14], iconAnchor: [7, 7] });
}
```

- [ ] **Step 2: Rendre le popup catégorie-aware**

Remplacer le bloc `{withCoords.map((p) => ( … ))}` (lignes 33-39) par :

```tsx
          {withCoords.map((p) => {
            const base = p.etablissement.categorie === "hotel" ? "hotels" : "restos";
            return (
              <Marker key={p.id} position={[p.etablissement.lat as number, p.etablissement.lng as number]} icon={pin(p.is_favorite)}>
                <Popup>
                  <a href={`/${locale}/${base}/${p.etablissement.id}`} className="font-semibold text-accent">{p.etablissement.nom}</a>
                </Popup>
              </Marker>
            );
          })}
```

- [ ] **Step 3: Typecheck + suite verte**

Run: `npx tsc --noEmit && npm test`
Expected: PASS (aucune régression ; pas de nouveau test ici).

- [ ] **Step 4: Commit**

```bash
git add src/features/places/ui/PlacesMap.tsx
git commit -m "fix(places): popup carte catégorie-aware + pin contour pour les recommandés"
```

---

### Task 3: `PlacesMapCombined` + i18n + branchement onglet Carte

Composant enrichi (chips + légende + comptage) consommé par l'onglet Carte. Comportement couvert par l'e2e (Task 4) ; logique de filtrage déjà testée en Task 1.

**Files:**
- Create: `src/features/places/ui/PlacesMapCombined.tsx`
- Modify: `src/features/places/ui/PlacesTabs.tsx`
- Modify: `messages/fr.json`, `messages/en.json`, `messages/it.json`, `messages/es.json`

**Interfaces:**
- Consumes: `tagsForMap`, `filterByTag` (Task 1) ; `PlacesMapLazy` ; `Place`.
- Produces: `PlacesMapCombined` émet `map-tag-filter`, `map-tag-tous`, `map-tag-{slug}`, `map-legend`, `map-count`.

- [ ] **Step 1: Ajouter les clés i18n (4 locales)**

Dans le namespace `places`, ajouter :
- `messages/fr.json` : `"tagTous": "Tous", "adressesCount": "{n} adresses",`
- `messages/en.json` : `"tagTous": "All", "adressesCount": "{n} places",`
- `messages/it.json` : `"tagTous": "Tutti", "adressesCount": "{n} indirizzi",`
- `messages/es.json` : `"tagTous": "Todos", "adressesCount": "{n} direcciones",`

- [ ] **Step 2: Créer `PlacesMapCombined.tsx`**

Créer `src/features/places/ui/PlacesMapCombined.tsx` :

```tsx
"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import type { Place } from "../domain/filterPlaces";
import { tagsForMap, filterByTag } from "../domain/mapFilters";
import { PlacesMapLazy } from "./PlacesMapLazy";

export function PlacesMapCombined({ places, locale }: { places: Place[]; locale: string }) {
  const t = useTranslations("places");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const tags = tagsForMap(places);
  const filtered = filterByTag(places, selectedTag);

  const chipCls = (active: boolean) =>
    `whitespace-nowrap rounded-control border px-3 py-1 text-xs ${active ? "border-transparent bg-accent text-white" : "border-line text-muted"}`;

  return (
    <div className="flex flex-col gap-3">
      <div data-testid="map-tag-filter" className="flex flex-wrap gap-2">
        <button
          type="button"
          data-testid="map-tag-tous"
          aria-pressed={selectedTag === null}
          onClick={() => setSelectedTag(null)}
          className={chipCls(selectedTag === null)}
        >
          {t("tagTous")}
        </button>
        {tags.map((tag) => (
          <button
            key={tag.slug}
            type="button"
            data-testid={`map-tag-${tag.slug}`}
            aria-pressed={selectedTag === tag.slug}
            onClick={() => setSelectedTag(tag.slug)}
            className={chipCls(selectedTag === tag.slug)}
          >
            {tag.label}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between gap-3 text-xs text-muted">
        <div data-testid="map-legend" className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full border-2 border-white" style={{ backgroundColor: "var(--gold)" }} />
            {t("favoris")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full border-2 bg-surface" style={{ borderColor: "var(--accent)" }} />
            {t("recommandes")}
          </span>
        </div>
        <span data-testid="map-count">{t("adressesCount", { n: filtered.length })}</span>
      </div>
      <PlacesMapLazy places={filtered} locale={locale} />
    </div>
  );
}
```

- [ ] **Step 3: Brancher l'onglet Carte dans `PlacesTabs.tsx`**

Dans `src/features/places/ui/PlacesTabs.tsx` :

Remplacer l'import de `PlacesMapLazy` par `PlacesMapCombined` (PlacesTabs n'utilise plus directement `PlacesMapLazy` — il reste utilisé par `PlaceListPanel`). Remplacer la ligne :

```tsx
import { PlacesMapLazy } from "./PlacesMapLazy";
```

par :

```tsx
import { PlacesMapCombined } from "./PlacesMapCombined";
```

Et remplacer la ligne du panneau Carte :

```tsx
      {tab === "carte" && <PlacesMapLazy places={cartePlaces} locale={locale} />}
```

par :

```tsx
      {tab === "carte" && <PlacesMapCombined places={cartePlaces} locale={locale} />}
```

- [ ] **Step 4: Typecheck + suite complète**

Run: `npx tsc --noEmit && npm test`
Expected: PASS. (Les tests unitaires/composant existants restent verts ; l'e2e n'est pas exécuté ici.)

- [ ] **Step 5: Commit**

```bash
git add src/features/places/ui/PlacesMapCombined.tsx src/features/places/ui/PlacesTabs.tsx messages/fr.json messages/en.json messages/it.json messages/es.json
git commit -m "feat(places): carte combinée (PlacesMapCombined) — légende, filtre tag, comptage"
```

---

### Task 4: e2e — onglet Carte + seed (coords + tag + 2e resto)

Doter le seed de coordonnées et d'un tag, ajouter un 2e resto sans tag (pour que le filtre fasse varier le comptage 2 → 1), et tester l'onglet Carte.

**Files:**
- Modify: `supabase/seed.sql`
- Modify: `e2e/places.spec.ts`

**Interfaces:**
- Consumes: carte combinée (Task 3), `PlacesMap` étendu (Task 2).
- Produces: rien (test terminal).

- [ ] **Step 1: Éditer le seed**

Dans `supabase/seed.sql` :

(a) Ajouter `lat, lng` à l'établissement « Le Bistrot Démo ». Remplacer son insert par :

```sql
insert into public.etablissements (id, place_id, categorie, type, nom, adresse, ville, code_postal, arrondissement, source, photo_ref, photo_fetched_at, rating, lat, lng)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'demo_place_1', 'resto', 'bistrot',
  'Le Bistrot Démo', '10 rue de Démo', 'Paris', '75017', '17e', 'seed', 'mock_photo_1', now(), 4.6, 48.8841, 2.3219);
```

(b) Donner un `id` explicite au liste_item du Bistrot (pour pouvoir le taguer). Remplacer son insert par :

```sql
insert into public.liste_items (id, user_id, etablissement_id, statut, is_favorite, reco_source)
values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a_faire', true, 'Camille');
```

(c) Lier le tag système « Terrasse » au liste_item du Bistrot. Ajouter juste après l'insert (b) :

```sql
insert into public.liste_item_tags (liste_item_id, tag_id)
select 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', id from public.tags where slug = 'terrasse';
```

(d) Ajouter un 2e resto « Le Comptoir Démo » (recommandé, non favori, avec coords, **sans tag**). Ajouter juste après le bloc (c) :

```sql
insert into public.etablissements (id, place_id, categorie, type, nom, ville, code_postal, arrondissement, source, lat, lng)
values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'demo_place_2', 'resto', 'bistrot', 'Le Comptoir Démo', 'Paris', '75001', '1er', 'seed', 48.8566, 2.3522);
insert into public.liste_items (user_id, etablissement_id, statut, is_favorite)
values ('11111111-1111-1111-1111-111111111111', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'a_faire', false);
```

- [ ] **Step 2: Réappliquer le seed local**

Run: `npx supabase db reset`
Expected: rechargement sans erreur (20 migrations + seed).

- [ ] **Step 3: Ajouter le test e2e Carte**

Dans `e2e/places.spec.ts`, ajouter à la fin du fichier :

```ts
test("onglet Carte : carte combinée — légende, filtre tag, comptage", async ({ page }) => {
  await login(page);
  await page.getByTestId("tab-carte").click();
  await expect(page.getByTestId("places-map")).toBeVisible();
  await expect(page.getByTestId("map-legend")).toBeVisible();
  await expect(page.getByTestId("map-tag-filter")).toBeVisible();
  // 2 adresses resto (Bistrot favori + Comptoir recommandé)
  await expect(page.getByTestId("map-count")).toContainText("2");
  // filtrer par « Terrasse » → seul le Bistrot
  await page.getByTestId("map-tag-terrasse").click();
  await expect(page.getByTestId("map-count")).toContainText("1");
  // retour « Tous »
  await page.getByTestId("map-tag-tous").click();
  await expect(page.getByTestId("map-count")).toContainText("2");
});
```

- [ ] **Step 4: Lancer l'e2e places (vérifier non-régression de l'IA)**

Run: `npx playwright test e2e/places.spec.ts`
Expected: PASS (les tests existants + le nouveau). Le 2e resto ne casse pas les comptes existants : Favoris reste 1 (seul le Bistrot est favori) ; Recommandés contient 2 cartes mais un seul `place-reco` (Bistrot).

- [ ] **Step 5: Commit**

```bash
git add supabase/seed.sql e2e/places.spec.ts
git commit -m "test(places): e2e onglet Carte combinée + seed (coords, tag terrasse, 2e resto)"
```

---

## Self-Review

**Spec coverage :**
- §1 Domaine `mapFilters` (tagsForMap + filterByTag) → Task 1. ✅
- §2 `PlacesMap` (popup catégorie-aware + pin contour) → Task 2. ✅
- §3 `PlacesMapCombined` (chips single-select + légende + comptage) → Task 3. ✅
- §4 `PlacesTabs` (onglet Carte → PlacesMapCombined) → Task 3. ✅
- §5 i18n (`tagTous`, `adressesCount`, parité 4 locales) → Task 3. ✅
- §Tests (domaine TDD, e2e + seed) → Tasks 1, 4. ✅
- §Sécurité (lecture seule, filtre client, pas de migration) → respecté. ✅
- Hors périmètre (géoloc, clustering, multi-select, Slices 5-9) → non implémenté. ✅

**Placeholder scan :** aucun TBD/TODO ; code complet à chaque étape.

**Type consistency :** `tagsForMap`/`filterByTag` (Task 1) consommés avec les mêmes signatures dans `PlacesMapCombined` (Task 3). `Place` (avec `reco_source`, `etablissement.lat/lng`, `tags`) cohérent. testids alignés composant ↔ e2e : `map-tag-filter`, `map-tag-tous`, `map-tag-terrasse`, `map-legend`, `map-count`, `places-map`, `tab-carte`.

**Gap connu (assumé) :** `PlacesMapCombined` n'a pas de test composant dédié (le rendu intègre `PlacesMapLazy`/Leaflet, peu fiable sous jsdom) ; sa logique de filtrage est testée en pur (Task 1) et son interaction (chips → comptage) en e2e (Task 4) — conforme à la convention du repo. Le seed ajoute un 2e resto vérifié sans impact sur les comptes des tests existants (Favoris=1, Recommandés place-reco unique).
