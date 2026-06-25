# Slice 2 — Sous-onglets Favoris/À tester + recherche interne Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructurer la page Restos en sous-onglets Favoris/À tester avec recherche interne instantanée, via des composants génériques (`features/places`) paramétrés par catégorie, réutilisables pour les Hôtels.

**Architecture:** `getPlaces(category)` charge la liste perso (avec tags) ; un composant client `PlacesTabs` gère l'onglet (favoris=is_favorite / à tester=statut a_faire) + le filtre client instantané (`filterPlaces`, pur/testé) ; `PlaceCard` rend chaque adresse. La page restos consomme `<PlacesTabs category="resto" />`.

**Tech Stack:** Next.js 16, Supabase (RLS), next-intl, kit `@/features/shared/ui`, Vitest, Playwright.

## Global Constraints

- Réutiliser le kit (`Card`/`Badge`) + les tokens. Pas de logique métier hors data/domain.
- RLS owner sur `liste_items` ; pas de migration, pas d'action modifiée.
- Composants **génériques** paramétrés par `categorie` (pas de duplication resto/hôtel).
- Aucune chaîne en dur — namespace **`places`** (générique), 4 locales.
- `data-testid` : `places-tabs`, `tab-favoris`, `tab-a-tester`, `places-search`, `place-card`.
- Gate par task indiqué.

---

### Task 1: i18n `places` + données `getPlaces` + `filterPlaces` (TDD)

**Files:**
- Modify: `messages/fr.json`, `en.json`, `it.json`, `es.json` (namespace `places`)
- Create: `src/features/places/data/queries.ts`
- Create: `src/features/places/domain/filterPlaces.ts` + `filterPlaces.test.ts`

**Interfaces:**
- Produces : `getPlaces(category: "resto"|"hotel"): Promise<Place[]>` ; `type Place = { id; statut; is_favorite; etablissement: { id; nom; type; ville; arrondissement; categorie }; tags: { slug; label; color: string|null }[] }` ; `filterPlaces(places: Place[], query: string): Place[]`.

- [ ] **Step 1: i18n `places` (4 locales)**

Add a root `places` namespace to each `messages/<loc>.json`:
- fr: `{ "favoris": "Favoris", "aTester": "À tester", "searchPlaceholder": "Rechercher dans mes adresses…", "empty": "Aucune adresse ici pour l'instant" }`
- en: `{ "favoris": "Favourites", "aTester": "To try", "searchPlaceholder": "Search my places…", "empty": "Nothing here yet" }`
- it: `{ "favoris": "Preferiti", "aTester": "Da provare", "searchPlaceholder": "Cerca nei miei indirizzi…", "empty": "Ancora niente qui" }`
- es: `{ "favoris": "Favoritos", "aTester": "Para probar", "searchPlaceholder": "Buscar en mis sitios…", "empty": "Nada aquí por ahora" }`
(JSON valide.)

- [ ] **Step 2: Test `filterPlaces` (échec)**

Create `src/features/places/domain/filterPlaces.test.ts` :
```ts
import { describe, it, expect } from "vitest";
import { filterPlaces } from "./filterPlaces";

const P = (nom: string, ville: string | null, tags: string[] = []) => ({
  id: nom, statut: "a_faire" as const, is_favorite: false,
  etablissement: { id: nom, nom, type: null, ville, arrondissement: null, categorie: "resto" as const },
  tags: tags.map((label) => ({ slug: label, label, color: null })),
});

describe("filterPlaces", () => {
  const list = [P("Le Comptoir", "Paris", ["terrasse"]), P("Septime", "Lyon", ["gastronomique"])];
  it("query vide → tout", () => expect(filterPlaces(list, "")).toHaveLength(2));
  it("matche le nom (insensible casse)", () => expect(filterPlaces(list, "comptoir").map((p) => p.id)).toEqual(["Le Comptoir"]));
  it("matche la ville", () => expect(filterPlaces(list, "lyon").map((p) => p.id)).toEqual(["Septime"]));
  it("matche un tag", () => expect(filterPlaces(list, "gastro").map((p) => p.id)).toEqual(["Septime"]));
  it("accents ignorés", () => expect(filterPlaces([P("Crêperie", "Brest")], "creperie")).toHaveLength(1));
});
```

- [ ] **Step 3: Lancer (échec)** — `npx vitest run src/features/places/domain/filterPlaces.test.ts` → FAIL.

- [ ] **Step 4: Implémenter `filterPlaces.ts`**

Create `src/features/places/domain/filterPlaces.ts` :
```ts
export type Place = {
  id: string;
  statut: "a_faire" | "visite";
  is_favorite: boolean;
  etablissement: { id: string; nom: string; type: string | null; ville: string | null; arrondissement: string | null; categorie: "resto" | "hotel" };
  tags: { slug: string; label: string; color: string | null }[];
};

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function filterPlaces(places: Place[], query: string): Place[] {
  const q = norm(query.trim());
  if (!q) return places;
  return places.filter((p) => {
    const hay = [p.etablissement.nom, p.etablissement.ville ?? "", ...p.tags.map((t) => t.label)].map(norm).join(" ");
    return hay.includes(q);
  });
}
```

- [ ] **Step 5: Lancer (succès)** — `npx vitest run src/features/places/domain/filterPlaces.test.ts` → PASS (5).

- [ ] **Step 6: `getPlaces`**

Create `src/features/places/data/queries.ts` :
```ts
import { createServerSupabase } from "@/lib/supabase/server";
import type { Place } from "../domain/filterPlaces";

export async function getPlaces(category: "resto" | "hotel"): Promise<Place[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("liste_items")
    .select(
      "id, statut, is_favorite, etablissement:etablissements!inner(id, nom, type, ville, arrondissement, categorie), tags:liste_item_tags(tag:tags(slug, label, color))"
    )
    .eq("etablissement.categorie", category)
    .order("added_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    statut: row.statut,
    is_favorite: row.is_favorite,
    etablissement: Array.isArray(row.etablissement) ? row.etablissement[0] : row.etablissement,
    tags: (row.tags ?? []).map((t) => (Array.isArray(t.tag) ? t.tag[0] : t.tag)).filter(Boolean),
  })) as Place[];
}
```
**Note implémenteur** : vérifier la syntaxe du filtre sur ressource embarquée (`.eq("etablissement.categorie", …)` vs `.eq("etablissements.categorie", …)`) contre `database.types`/un essai `db reset` ; ajuster l'aplatissement embed selon les types réels (objet vs tableau). Le typecheck doit passer (`noUncheckedIndexedAccess`).

- [ ] **Step 7: Vérifier** — `npm run typecheck && npm run lint && npm run test` → PASS.

- [ ] **Step 8: Commit**

```bash
git add messages/ src/features/places/
git commit -m "feat(places): getPlaces(category) + filterPlaces (testé) + i18n places"
```

---

### Task 2: UI générique `PlacesTabs` + `PlaceCard` + intégration page restos

**Files:**
- Create: `src/features/places/ui/PlacesTabs.tsx`, `src/features/places/ui/PlaceCard.tsx`
- Modify: `src/app/[locale]/(app)/restos/page.tsx`
- (Optionnel) Delete: `src/features/restos/ui/RestoList.tsx` (remplacé) — seulement si plus aucun import.

**Interfaces:**
- Consumes : `getPlaces`/`filterPlaces`/`Place` (Task 1) ; kit `Card`/`Badge` ; `Link` (`@/lib/i18n/routing`).

- [ ] **Step 1: `PlaceCard` (présentational)**

Create `src/features/places/ui/PlaceCard.tsx` : `Card` du kit avec lien `/restos/{etablissement.id}`
(slice 6 paramétrera la route par catégorie), nom en `text-ink`, `type · ville` en `text-muted`, étoile
si `is_favorite`, et les tags en pastilles colorées (`color` ou fallback). `data-testid="place-card"`.
Aucune logique métier.

- [ ] **Step 2: `PlacesTabs` (client)**

Create `src/features/places/ui/PlacesTabs.tsx` :
```tsx
"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { filterPlaces, type Place } from "../domain/filterPlaces";
import { PlaceCard } from "./PlaceCard";

export function PlacesTabs({ places }: { category: "resto" | "hotel"; places: Place[] }) {
  const t = useTranslations("places");
  const [tab, setTab] = useState<"favoris" | "a_tester">("favoris");
  const [q, setQ] = useState("");
  const base = tab === "favoris" ? places.filter((p) => p.is_favorite) : places.filter((p) => p.statut === "a_faire");
  const shown = filterPlaces(base, q);
  const tabCls = (active: boolean) => `flex-1 rounded-lg py-2 text-sm font-semibold ${active ? "bg-surface text-ink shadow-sm" : "text-muted"}`;
  return (
    <div data-testid="places-tabs" className="flex flex-col gap-3">
      <div className="flex gap-1 rounded-xl bg-canvas p-1" role="tablist">
        <button type="button" role="tab" data-testid="tab-favoris" aria-selected={tab === "favoris"} onClick={() => setTab("favoris")} className={tabCls(tab === "favoris")}>{t("favoris")}</button>
        <button type="button" role="tab" data-testid="tab-a-tester" aria-selected={tab === "a_tester"} onClick={() => setTab("a_tester")} className={tabCls(tab === "a_tester")}>{t("aTester")}</button>
      </div>
      <input data-testid="places-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchPlaceholder")} className="rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:outline-2 focus:outline-accent" />
      {shown.length === 0 ? (
        <p className="text-sm text-muted">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-2">{shown.map((p) => <PlaceCard key={p.id} place={p} />)}</ul>
      )}
    </div>
  );
}
```
(`category` est en prop pour la généricité/future route ; non utilisé visuellement ici.)

- [ ] **Step 3: Intégrer dans la page restos**

In `src/app/[locale]/(app)/restos/page.tsx` : remplacer `<RestoList />` par
`<PlacesTabs category="resto" places={await getPlaces("resto")} />` (imports adéquats). Garder
`PageHeader`/`GoutsBanner`/`RestoSearch`. Si `RestoList` n'est plus importé nulle part, le supprimer
(`git rm`), sinon le laisser.

- [ ] **Step 4: Vérifier** — `npm run typecheck && npm run lint && npm run test` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/places/ui/ "src/app/[locale]/(app)/restos/page.tsx"
git commit -m "feat(places): sous-onglets Favoris/À tester génériques + recherche interne (page restos)"
```

---

### Task 3: e2e + non-régression

**Files:**
- Create: `e2e/places.spec.ts` ; Modify si besoin : `e2e/restos.spec.ts`

- [ ] **Step 1: e2e**

Create `e2e/places.spec.ts` : login `client@vito.test` → `/fr/restos` → `places-tabs` visible ; onglet
Favoris par défaut ; cliquer `tab-a-tester` montre la liste « à tester » (le resto seedé `client@` a 1
resto en liste — vérifier l'onglet où il apparaît selon le seed : favori → reste Favoris) ; taper dans
`places-search` un terme présent → la `place-card` reste, un terme absent → liste vide (`place-card`
count 0). Déterministe (testids/`toHaveCount`), pas de `networkidle`.

**Important** : `restos.spec.ts` existant attend peut-être l'ancienne liste (`resto-card`). Le nouveau
rendu utilise `place-card`. Si un test restos visait `resto-card` dans la liste principale, l'adapter à
`place-card` (et au bon onglet) — désambiguïsation, jamais affaiblissement. Le parcours d'ajout
(`RestoSearch`, `search-result`) et la fiche restent inchangés.

- [ ] **Step 2: e2e ciblé + suite complète**

Run:
```bash
supabase db reset && npx playwright test e2e/places.spec.ts e2e/restos.spec.ts --retries=0
supabase db reset && npx playwright test --retries=0
```
Expected: verts. Diagnostiquer/corriger les specs restos impactés (sélecteur de liste). Retry une fois si webServer KO.

- [ ] **Step 3: Commit**

```bash
git add e2e/
git commit -m "test(places): e2e sous-onglets + recherche interne (+ adaptation restos si besoin)"
```

---

## Notes d'exécution

- **Ordre** : T1 (data+i18n+filterPlaces) → T2 (UI+page) → T3 (e2e).
- **Pas de migration** → « prod » = merge → Vercel (pas de go-prod DB).
- Composants 100% génériques (`category` en prop) → la slice 6 Hôtels les réutilisera tels quels.
- Le seed : `client@vito.test` a 1 resto en liste (favori) → l'onglet Favoris est non vide ; adapter les
  assertions e2e au seed réel.
