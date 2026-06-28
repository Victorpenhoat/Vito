# Slice 7 — Onglet Hôtels paramétré — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Achever la paramétrisation hôtel : « Explorer par envie » hôtel + barre de filtre par ambiance (tag) sur la liste hôtel. Score /10 et IA déjà génériques.

**Architecture:** Domaine pur — `searchEnvies("hotel")` peuplé + drapeau `categoryConfig.hotel.listTagFilter`. `PlaceListPanel` gagne une barre de filtre par tag (réutilise `tagsForMap`/`filterByTag` de la Slice 4) activée par catégorie. Pas de migration ; classe étoiles coupée.

**Tech Stack:** Next 16 (App Router), React, TypeScript, next-intl 4, Supabase, Tailwind v4, Vitest, Playwright.

Spec : `docs/superpowers/specs/2026-06-28-resto-hotels-slice-7-onglet-hotels-design.md`.

## Global Constraints

- **Classe étoiles coupée** (pas de source) — `showStarClass` reste `false`, aucune migration.
- Filtre ambiance = **single-select** (`Tous` + tags présents), affiché **seulement si `categoryConfig[category].listTagFilter`** (hôtel `true`, resto `false`). Réutilise `tagsForMap`/`filterByTag`.
- Hotel envies définies dans `searchEnvies("hotel")`.
- i18n **4 locales** parité (`envieBordDeMer`/`envieSpa`/`envieBoutique`/`enviePiscine`) ; `tagTous` réutilisé. Aucune chaîne en dur, aucun nouveau token.
- **Tags existants seulement** (pas de nouveaux tags, pas de migration).
- **Vérif pré-push** : `npm run lint && npx tsc --noEmit && npm test`. Re-checker `gh pr checks` avant merge (flakes famille connus → re-run).

---

### Task 1: Domaine pur — envies hôtel + `listTagFilter`

Deux ajouts purs avec mise à jour des tests existants (TDD).

**Files:**
- Modify: `src/features/places/domain/discovery.ts`
- Modify: `src/features/places/domain/discovery.test.ts`
- Modify: `src/features/places/domain/categoryConfig.ts`
- Modify: `src/features/places/domain/categoryConfig.test.ts`

**Interfaces:**
- Consumes: rien de nouveau.
- Produces (consommés par Task 2) : `searchEnvies("hotel")` → 4 `Envie` ; `categoryConfig[c].listTagFilter: boolean`.

- [ ] **Step 1: Mettre à jour les tests (RED)**

`src/features/places/domain/discovery.test.ts` — remplacer la ligne :
```ts
  it("hotel → vide (Slice 7)", () => expect(searchEnvies("hotel")).toEqual([]));
```
par :
```ts
  it("hotel → 4 envies (query/labelKey non vides)", () => {
    const e = searchEnvies("hotel");
    expect(e).toHaveLength(4);
    expect(e.every((x) => x.query.trim().length > 0 && x.labelKey.length > 0)).toBe(true);
  });
```

`src/features/places/domain/categoryConfig.test.ts` — ajouter dans le `describe("categoryConfig", …)` un nouveau cas :
```ts
  it("listTagFilter : resto false, hôtel true", () => {
    expect(categoryConfig.resto.listTagFilter).toBe(false);
    expect(categoryConfig.hotel.listTagFilter).toBe(true);
  });
```

- [ ] **Step 2: Lancer → échec**

Run: `npx vitest run src/features/places/domain/discovery.test.ts src/features/places/domain/categoryConfig.test.ts`
Expected: FAIL (hotel envies vides ; `listTagFilter` undefined).

- [ ] **Step 3: Implémenter**

`src/features/places/domain/discovery.ts` — remplacer la fonction `searchEnvies` par :
```ts
export function searchEnvies(category: "resto" | "hotel"): Envie[] {
  if (category === "hotel") {
    return [
      { emoji: "🏖️", labelKey: "envieBordDeMer", query: "bord de mer" },
      { emoji: "💆", labelKey: "envieSpa", query: "spa" },
      { emoji: "🏨", labelKey: "envieBoutique", query: "hôtel boutique" },
      { emoji: "🏊", labelKey: "enviePiscine", query: "piscine" },
    ];
  }
  return [
    { emoji: "🍷", labelKey: "envieCaveAManger", query: "cave à manger" },
    { emoji: "🐟", labelKey: "envieFruitsDeMer", query: "fruits de mer" },
    { emoji: "🍝", labelKey: "envieItalien", query: "italien" },
    { emoji: "☕", labelKey: "envieBrunch", query: "brunch" },
  ];
}
```

`src/features/places/domain/categoryConfig.ts` :
- Dans le type `CategoryConfig`, ajouter après `showStarClass: boolean;` :
```ts
  /** Affiche une barre de filtre par tag (ambiance) sur la liste. */
  listTagFilter: boolean;
```
- Dans `categoryConfig`, ajouter `listTagFilter` aux deux entrées :
```ts
  resto: { notationKind: "stars", maxChipsListe: 2, maxChipsVignette: 1, descriptor: "cuisine", showStarClass: false, listTagFilter: false },
  hotel: { notationKind: "score", maxChipsListe: 2, maxChipsVignette: 1, descriptor: "ambiance", showStarClass: false, listTagFilter: true },
```

- [ ] **Step 4: Lancer → succès + suite + lint**

Run: `npm run lint && npx tsc --noEmit && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/places/domain/discovery.ts src/features/places/domain/discovery.test.ts src/features/places/domain/categoryConfig.ts src/features/places/domain/categoryConfig.test.ts
git commit -m "feat(places): envies hôtel + categoryConfig.listTagFilter (TDD)"
```

---

### Task 2: UI — barre de filtre ambiance (`PlaceListPanel`) + `PlacesTabs` + i18n

**Files:**
- Modify: `src/features/places/ui/PlaceListPanel.tsx`
- Modify: `src/features/places/ui/PlacesTabs.tsx`
- Modify: `messages/fr.json`, `messages/en.json`, `messages/it.json`, `messages/es.json`

**Interfaces:**
- Consumes: `categoryConfig`, `tagsForMap`, `filterByTag` (domaine) ; `searchEnvies("hotel")` rendu par `PlaceDiscovery` existant (déjà branché, rien à modifier côté Recherche).
- Produces: testids `list-tag-filter`, `list-tag-tous`, `list-tag-{slug}` ; `PlaceListPanel` prend `category`.

- [ ] **Step 1: i18n — labels d'envie hôtel (4 locales)**

Ajouter au namespace `places` :
- `messages/fr.json` : `"envieBordDeMer": "Bord de mer", "envieSpa": "Spa", "envieBoutique": "Hôtel boutique", "enviePiscine": "Piscine",`
- `messages/en.json` : `"envieBordDeMer": "Seaside", "envieSpa": "Spa", "envieBoutique": "Boutique hotel", "enviePiscine": "Pool",`
- `messages/it.json` : `"envieBordDeMer": "Sul mare", "envieSpa": "Spa", "envieBoutique": "Hotel boutique", "enviePiscine": "Piscina",`
- `messages/es.json` : `"envieBordDeMer": "Junto al mar", "envieSpa": "Spa", "envieBoutique": "Hotel boutique", "enviePiscine": "Piscina",`

Garder le JSON valide.

- [ ] **Step 2: `PlaceListPanel` — prop `category` + barre de filtre tag**

Remplacer **tout** le contenu de `src/features/places/ui/PlaceListPanel.tsx` par :

```tsx
"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { filterPlaces, type Place } from "../domain/filterPlaces";
import type { PlaceView } from "../domain/placesTabsConfig";
import { categoryConfig } from "../domain/categoryConfig";
import { tagsForMap, filterByTag } from "../domain/mapFilters";
import { PlaceCard } from "./PlaceCard";
import { PlacesMapLazy } from "./PlacesMapLazy";

export function PlaceListPanel({
  places,
  views,
  locale,
  category,
}: {
  places: Place[];
  views: PlaceView[];
  locale: string;
  category: "resto" | "hotel";
}) {
  const t = useTranslations("places");
  const [q, setQ] = useState("");
  const [view, setView] = useState<PlaceView>(views[0]!);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const showTagFilter = categoryConfig[category].listTagFilter;
  const tags = showTagFilter ? tagsForMap(places) : [];
  const shown = filterByTag(filterPlaces(places, q), selectedTag);
  const viewLabel: Record<PlaceView, string> = {
    liste: t("vueListe"),
    vignettes: t("vueVignettes"),
    carte: t("vueCarte"),
  };
  const chipCls = (active: boolean) =>
    `whitespace-nowrap rounded-control border px-3 py-1 text-xs ${active ? "border-transparent bg-accent text-white" : "border-line text-muted"}`;

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
      {showTagFilter && tags.length > 0 && (
        <div data-testid="list-tag-filter" className="flex flex-wrap gap-2">
          <button
            type="button"
            data-testid="list-tag-tous"
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
              data-testid={`list-tag-${tag.slug}`}
              aria-pressed={selectedTag === tag.slug}
              onClick={() => setSelectedTag(tag.slug)}
              className={chipCls(selectedTag === tag.slug)}
            >
              {tag.label}
            </button>
          ))}
        </div>
      )}
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

- [ ] **Step 3: `PlacesTabs` — passer `category`**

Dans `src/features/places/ui/PlacesTabs.tsx`, ajouter `category={category}` aux deux appels :
```tsx
      {tab === "favoris" && <PlaceListPanel places={favoris} views={TAB_VIEWS.favoris} locale={locale} category={category} />}
      {tab === "recommandes" && <PlaceListPanel places={recommandes} views={TAB_VIEWS.recommandes} locale={locale} category={category} />}
```

- [ ] **Step 4: Lint + typecheck + suite**

Run: `npm run lint && npx tsc --noEmit && npm test`
Expected: PASS. (Resto : `listTagFilter=false` → aucune barre, comportement inchangé.)

- [ ] **Step 5: Commit**

```bash
git add src/features/places/ui/PlaceListPanel.tsx src/features/places/ui/PlacesTabs.tsx messages/fr.json messages/en.json messages/it.json messages/es.json
git commit -m "feat(places): barre de filtre ambiance sur la liste hôtel (PlaceListPanel) + i18n envies hôtel"
```

---

### Task 3: e2e hôtel + seed (tag ambiance, sans migration)

**Files:**
- Modify: `supabase/seed.sql`
- Modify: `e2e/hotels.spec.ts`

**Interfaces:**
- Consumes: envies hôtel (Task 1), barre de filtre (Task 2).
- Produces: rien (test terminal).

- [ ] **Step 1: Seed — taguer l'Hôtel Démo (spa) + 2e hôtel sans tag**

Dans `supabase/seed.sql`, remplacer l'insert du `liste_items` de l'Hôtel Démo :
```sql
insert into public.liste_items (user_id, etablissement_id, statut, is_favorite)
values ('11111111-1111-1111-1111-111111111111', '11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a_faire', false);
```
par (id explicite pour pouvoir taguer) :
```sql
insert into public.liste_items (id, user_id, etablissement_id, statut, is_favorite)
values ('11111111-aaaa-4aaa-8aaa-bbbbbbbb0001', '11111111-1111-1111-1111-111111111111', '11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a_faire', false);
-- Tag ambiance « Spa » (tag hôtel existant, 00017) lié à l'Hôtel Démo
insert into public.liste_item_tags (liste_item_id, tag_id)
select '11111111-aaaa-4aaa-8aaa-bbbbbbbb0001', id from public.tags where slug = 'spa';
-- 2e hôtel sans tag (pour que le filtre ambiance fasse varier le nombre)
insert into public.etablissements (id, place_id, categorie, type, nom, ville, code_postal, arrondissement, source)
values ('22222222-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'demo_hotel_2', 'hotel', 'hotel', 'Hôtel Démo 2', 'Paris', '75002', '2e', 'seed');
insert into public.liste_items (user_id, etablissement_id, statut, is_favorite)
values ('11111111-1111-1111-1111-111111111111', '22222222-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a_faire', false);
```

- [ ] **Step 2: Réappliquer le seed local**

Run: `npx supabase db reset`
Expected: rechargement sans erreur.

- [ ] **Step 3: Ajouter les tests e2e**

Dans `e2e/hotels.spec.ts`, ajouter à la fin :
```ts
test("onglet Recherche hôtel : chips « Explorer par envie »", async ({ page }) => {
  await login(page);
  await page.goto("/fr/hotels");
  await page.getByTestId("tab-recherche").click();
  await expect(page.getByTestId("envies")).toBeVisible();
  await expect(page.getByTestId("envie-envieSpa")).toBeVisible();
});

test("liste hôtel : filtre par ambiance (Spa)", async ({ page }) => {
  await login(page);
  await page.goto("/fr/hotels");
  await page.getByTestId("tab-recommandes").click();
  await expect(page.getByTestId("list-tag-filter")).toBeVisible();
  // 2 hôtels recommandés seedés (Hôtel Démo [spa] + Hôtel Démo 2 [sans tag])
  await expect(page.getByTestId("place-card")).toHaveCount(2);
  // filtrer par Spa → seul l'Hôtel Démo
  await page.getByTestId("list-tag-spa").click();
  await expect(page.getByTestId("place-card")).toHaveCount(1);
  // retour Tous → 2
  await page.getByTestId("list-tag-tous").click();
  await expect(page.getByTestId("place-card")).toHaveCount(2);
});
```

- [ ] **Step 4: Lancer l'e2e hôtels**

Run: `npx playwright test e2e/hotels.spec.ts`
Expected: PASS (les 3 tests existants + les 2 nouveaux). Les tests existants filtrent par `hasText:"Hôtel Démo"` (matche l'Hôtel Démo via `.first()`) → inchangés par le 2e hôtel.

- [ ] **Step 5: Commit**

```bash
git add supabase/seed.sql e2e/hotels.spec.ts
git commit -m "test(hotels): e2e envies hôtel + filtre ambiance + seed (tag spa, 2e hôtel)"
```

---

## Self-Review

**Spec coverage :**
- §1 Domaine (`searchEnvies("hotel")` + `categoryConfig.listTagFilter`) → Task 1. ✅
- §2 UI `PlaceListPanel` barre de filtre + `PlacesTabs` category → Task 2. ✅
- §4 i18n (4 labels d'envie, parité) → Task 2. ✅
- §Tests (domaine TDD, e2e + seed sans migration) → Tasks 1, 3. ✅
- §Décisions (classe étoiles coupée = `showStarClass` inchangé ; tags existants = tag `spa`) → respecté. ✅
- §Sécurité (lecture seule, filtre client, pas de migration) → respecté. ✅
- Hors périmètre (classe étoiles, nouveaux tags) → non implémenté. ✅

**Placeholder scan :** aucun TBD/TODO ; code complet à chaque étape.

**Type consistency :** `searchEnvies`/`categoryConfig.listTagFilter` (Task 1) consommés par `PlaceListPanel`/`PlaceDiscovery` (Task 2). `PlaceListPanel` prend désormais `category` (passé par `PlacesTabs`). `tagsForMap`/`filterByTag` (Slice 4) réutilisés. testids alignés UI ↔ e2e : `list-tag-filter`, `list-tag-tous`, `list-tag-spa`, `envies`, `envie-envieSpa`, `place-card`, `tab-recommandes`, `tab-recherche`.

**Gap connu (assumé) :** le filtre ambiance s'applique aussi à l'onglet Recommandés hôtel (pas seulement Favoris) — cohérent (les deux sont des `PlaceListPanel` hôtel) ; l'e2e le teste sur Recommandés (où l'Hôtel Démo est `a_faire`). `PlaceListPanel` n'a pas de test composant (server-bundled + Leaflet) ; logique pure testée (Task 1) + e2e (Task 3), conforme à la convention. Le 2e hôtel seedé (sans coords, sans tag) ne casse pas les e2e existants (filtrage par `hasText` + `.first()`).
