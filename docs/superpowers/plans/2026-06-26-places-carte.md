# Slice Carte (épic places) — vue carte react-leaflet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter une vue Carte (react-leaflet + OSM) à l'écran Restos via une bascule Liste/Carte, sans migration ni casse e2e.

**Architecture:** Dépendance `react-leaflet`/`leaflet` ; `lat`/`lng` ajoutés à `getPlaces`/`Place` ; helper pur `mapCenter` ; composant `PlacesMap` client-only (`dynamic ssr:false`) avec marqueurs `divIcon` + tuiles OSM ; `PlacesTabs` gagne une bascule Liste/Carte (défaut Liste).

**Tech Stack:** Next.js 16 (React 19), react-leaflet v5+, leaflet, Tailwind v4, next-intl (fr/en/it/es), Vitest, Playwright.

## Global Constraints

- **Aucune migration** (`lat`/`lng` déjà sur `etablissements`). Aucune action serveur/RLS modifiée.
- **e2e verts SANS modification** sauf un AJOUT dans `places.spec` (bascule Carte → `places-map`). Défaut de vue = **Liste** → `place-card` visibles → specs places/restos/vins inchangées. Ne jamais affaiblir un test.
- **Leaflet client-only** : `PlacesMap` est `"use client"`, monté via `next/dynamic(..., { ssr: false })` depuis `PlacesTabs`. CSS `leaflet/dist/leaflet.css` importé dans `PlacesMap`. Marqueur = `L.divIcon` (pas d'icône image).
- Tuiles **OSM** (`https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`) + attribution. Aucune clé d'API. Aucune CSP à modifier.
- Style Le Carnet (`rounded-card`, `border-line`, tokens). Pas de chaîne en dur (parité i18n 4 locales).
- TS strict (`noUncheckedIndexedAccess`).
- Réf. spec : `docs/superpowers/specs/2026-06-26-places-carte-design.md`.

---

### Task 1: Dépendances + données (lat/lng) + mapCenter (TDD) + i18n

**Files:**
- Modify: `package.json` (+ lockfile)
- Modify: `src/features/places/domain/filterPlaces.ts` (type `Place`)
- Modify: `src/features/places/data/queries.ts` (`getPlaces`)
- Create: `src/features/places/domain/mapCenter.ts` + `mapCenter.test.ts`
- Modify: `messages/fr.json`, `messages/en.json`, `messages/it.json`, `messages/es.json`

**Interfaces:**
- Produces : `react-leaflet`/`leaflet`/`@types/leaflet` installés ; `Place.etablissement` gagne `lat: number|null; lng: number|null` ; `getPlaces` les sélectionne ; `mapCenter(places): { lat: number; lng: number }` ; clés `places.vueListe/vueCarte/sansLocalisation`.

- [ ] **Step 1: Installer les dépendances**

Run: `npm install react-leaflet leaflet && npm install -D @types/leaflet`
Expected: install OK (react-leaflet v5+ compatible React 19). `package.json` + lockfile modifiés.

- [ ] **Step 2: Étendre le type `Place`**

In `src/features/places/domain/filterPlaces.ts`, add `lat`/`lng` to `etablissement`:
```ts
  etablissement: { id: string; nom: string; type: string | null; ville: string | null; arrondissement: string | null; categorie: "resto" | "hotel"; photo_ref: string | null; lat: number | null; lng: number | null };
```

- [ ] **Step 3: Sélectionner `lat`/`lng` dans `getPlaces`**

In `src/features/places/data/queries.ts`, add `lat, lng` to the embedded select:
```ts
      "id, statut, is_favorite, etablissement:etablissements!inner(id, nom, type, ville, arrondissement, categorie, photo_ref, lat, lng), tags:liste_item_tags(tag:tags(slug, label, color))"
```
(Le `as Place[]` reste valable.)

- [ ] **Step 4: Test `mapCenter`**

Create `src/features/places/domain/mapCenter.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { mapCenter } from "./mapCenter";
import type { Place } from "./filterPlaces";

const place = (lat: number | null, lng: number | null): Place => ({
  id: Math.random().toString(36), statut: "a_faire", is_favorite: false,
  etablissement: { id: "x", nom: "X", type: null, ville: null, arrondissement: null, categorie: "resto", photo_ref: null, lat, lng },
  tags: [],
});

describe("mapCenter", () => {
  it("moyenne les coordonnées valides", () => {
    const c = mapCenter([place(48, 2), place(50, 4)]);
    expect(c.lat).toBeCloseTo(49);
    expect(c.lng).toBeCloseTo(3);
  });
  it("ignore les coords nulles", () => {
    const c = mapCenter([place(48, 2), place(null, null)]);
    expect(c.lat).toBeCloseTo(48);
    expect(c.lng).toBeCloseTo(2);
  });
  it("défaut Paris si aucune coord", () => {
    const c = mapCenter([place(null, null)]);
    expect(c.lat).toBeCloseTo(48.8566);
    expect(c.lng).toBeCloseTo(2.3522);
  });
});
```

- [ ] **Step 5: Lancer → échec** — Run: `npm run test -- mapCenter` → FAIL (module absent).

- [ ] **Step 6: Implémenter `mapCenter.ts`**

Create `src/features/places/domain/mapCenter.ts`:
```ts
import type { Place } from "./filterPlaces";

const PARIS = { lat: 48.8566, lng: 2.3522 };

export function mapCenter(places: Place[]): { lat: number; lng: number } {
  const coords = places
    .map((p) => p.etablissement)
    .filter((e): e is typeof e & { lat: number; lng: number } => e.lat != null && e.lng != null);
  if (coords.length === 0) return PARIS;
  const lat = coords.reduce((s, e) => s + e.lat, 0) / coords.length;
  const lng = coords.reduce((s, e) => s + e.lng, 0) / coords.length;
  return { lat, lng };
}
```

- [ ] **Step 7: Lancer → succès** — Run: `npm run test -- mapCenter` → PASS.

- [ ] **Step 8: i18n (4 locales)**

Sous `places` de chaque locale :
- fr : `"vueListe":"Liste"`, `"vueCarte":"Carte"`, `"sansLocalisation":"{n} sans localisation"`
- en : `"vueListe":"List"`, `"vueCarte":"Map"`, `"sansLocalisation":"{n} without location"`
- it : `"vueListe":"Elenco"`, `"vueCarte":"Mappa"`, `"sansLocalisation":"{n} senza posizione"`
- es : `"vueListe":"Lista"`, `"vueCarte":"Mapa"`, `"sansLocalisation":"{n} sin ubicación"`

- [ ] **Step 9: Vérifier**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS (mapCenter vert ; parité i18n verte ; types `lat`/`lng` OK).

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json src/features/places/domain/filterPlaces.ts src/features/places/data/queries.ts src/features/places/domain/mapCenter.ts src/features/places/domain/mapCenter.test.ts messages/fr.json messages/en.json messages/it.json messages/es.json
git commit -m "feat(places,carte): deps react-leaflet + lat/lng dans getPlaces + mapCenter + i18n"
```

---

### Task 2: `PlacesMap` + bascule Liste/Carte dans `PlacesTabs`

**Files:**
- Create: `src/features/places/ui/PlacesMap.tsx`
- Modify: `src/features/places/ui/PlacesTabs.tsx`

**Interfaces:**
- Consumes : `Place` (avec lat/lng), `mapCenter`, react-leaflet/leaflet, clés `places.vueListe/vueCarte/sansLocalisation`.
- Produces : `PlacesMap({ places, locale })` (client) ; `PlacesTabs` avec état `view` (défaut `"liste"`) + testids `view-liste`/`view-carte`, `places-map` (dans `PlacesMap`).

- [ ] **Step 1: Créer `PlacesMap.tsx`**

Create `src/features/places/ui/PlacesMap.tsx`:
```tsx
"use client";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { useTranslations } from "next-intl";
import { mapCenter } from "../domain/mapCenter";
import type { Place } from "../domain/filterPlaces";

function pin(favorite: boolean): L.DivIcon {
  // Couleurs via tokens CSS (le marqueur est dans le document → les variables s'appliquent).
  const color = favorite ? "var(--gold)" : "var(--accent)";
  return L.divIcon({
    className: "",
    html: `<span style="display:block;width:14px;height:14px;border-radius:9999px;background:${color};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4)"></span>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

export function PlacesMap({ places, locale }: { places: Place[]; locale: string }) {
  const t = useTranslations("places");
  const withCoords = places.filter((p) => p.etablissement.lat != null && p.etablissement.lng != null);
  const sansLoc = places.length - withCoords.length;
  const center = mapCenter(places);
  return (
    <div className="flex flex-col gap-2">
      <div data-testid="places-map" className="overflow-hidden rounded-card border border-line">
        <MapContainer center={[center.lat, center.lng]} zoom={12} scrollWheelZoom className="h-[60vh] w-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {withCoords.map((p) => (
            <Marker key={p.id} position={[p.etablissement.lat as number, p.etablissement.lng as number]} icon={pin(p.is_favorite)}>
              <Popup>
                <a href={`/${locale}/restos/${p.etablissement.id}`} className="font-semibold text-accent">{p.etablissement.nom}</a>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
      {sansLoc > 0 && <p className="text-sm text-muted">{t("sansLocalisation", { n: sansLoc })}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Bascule Liste/Carte dans `PlacesTabs.tsx`**

Replace `src/features/places/ui/PlacesTabs.tsx` with (ajoute l'état `view` + import dynamique + boutons ; conserve onglets/recherche/place-card) :
```tsx
"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations, useLocale } from "next-intl";
import { filterPlaces, type Place } from "../domain/filterPlaces";
import { PlaceCard } from "./PlaceCard";

const PlacesMap = dynamic(() => import("./PlacesMap").then((m) => m.PlacesMap), { ssr: false });

type Tab = "tous" | "favoris" | "a_tester" | "visites";
type View = "liste" | "carte";

export function PlacesTabs({ category: _category, places }: { category: "resto" | "hotel"; places: Place[] }) {
  const t = useTranslations("places");
  const locale = useLocale();
  const [tab, setTab] = useState<Tab>("tous");
  const [view, setView] = useState<View>("liste");
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
  const views: { key: View; testid: string; label: string }[] = [
    { key: "liste", testid: "view-liste", label: t("vueListe") },
    { key: "carte", testid: "view-carte", label: t("vueCarte") },
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
      <div className="flex items-center gap-3">
        <input
          data-testid="places-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="flex-1 rounded-control border border-line bg-surface px-3 py-2 text-sm outline-none focus:outline-2 focus:outline-accent"
        />
        <div className="flex gap-1 rounded-control border border-line p-0.5">
          {views.map((v) => {
            const active = view === v.key;
            return (
              <button
                key={v.key}
                type="button"
                data-testid={v.testid}
                aria-pressed={active}
                onClick={() => setView(v.key)}
                className={`rounded-[2px] px-3 py-1 text-sm ${active ? "bg-accent text-white" : "text-muted"}`}
              >
                {v.label}
              </button>
            );
          })}
        </div>
      </div>
      {view === "carte" ? (
        <PlacesMap places={shown} locale={locale} />
      ) : shown.length === 0 ? (
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

- [ ] **Step 3: Vérifier typecheck + lint + unit**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS.

- [ ] **Step 4: Vérifier le build (SSR ne casse pas avec leaflet)**

Run: `npm run build`
Expected: PASS (le `dynamic(ssr:false)` exclut `PlacesMap` du rendu serveur ; aucune erreur `window is not defined`).

- [ ] **Step 5: Commit**

```bash
git add src/features/places/ui/PlacesMap.tsx src/features/places/ui/PlacesTabs.tsx
git commit -m "feat(places,carte): PlacesMap (react-leaflet OSM) + bascule Liste/Carte"
```

---

### Task 3: e2e (bascule Carte) + non-régression complète

**Files:**
- Modify: `e2e/places.spec.ts`

- [ ] **Step 1: Ajouter un test de bascule Carte dans `places.spec.ts`**

Append a test (le défaut reste Liste ; on bascule et on vérifie le conteneur carte, sans dépendre des tuiles réseau) :
```ts
test("la bascule Carte affiche la carte", async ({ page }) => {
  await login(page);
  await page.getByTestId("view-carte").click();
  await expect(page.getByTestId("places-map")).toBeVisible();
});
```
(Réutilise le helper `login` du fichier. Ne modifie aucun test existant.)

- [ ] **Step 2: Suite e2e complète + build**

Run: `supabase db reset && npx playwright test --retries=0 && npm run build`
Expected: suite complète **verte** (specs existants inchangés ; nouveau test Carte vert) + build OK. Un seul `db reset` avant. Si un spec existant casse, corriger le composant, pas le test. Retry une fois si le webServer échoue.

- [ ] **Step 3: Commit**

```bash
git add e2e/places.spec.ts
git commit -m "test(places,carte): bascule Carte + non-régression"
```

---

## Notes d'exécution

- **Ordre** : T1 (deps+data+helper+i18n) → T2 (PlacesMap+toggle) → T3 (e2e+build).
- **Prod** : aucune migration. Au « go prod » : merge → Vercel redéploie `main`.
- **Filet** : défaut de vue = Liste → place-cards visibles → specs existants verts. `PlacesMap` n'est jamais rendu côté serveur (`ssr:false`). Si le build échoue sur `window`/leaflet, vérifier que l'import de `PlacesMap` est bien dynamique `ssr:false` et que `leaflet` n'est importé QUE dans `PlacesMap.tsx`.
