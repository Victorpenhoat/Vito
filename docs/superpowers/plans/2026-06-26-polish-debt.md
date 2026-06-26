# Slice Polish — dette transverse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Solder la dette transverse (arrondis éditoriaux, token couleur d'erreur, dé-dup addResto/addHotel, dates localisées) sans changer le comportement.

**Architecture:** Sweeps `className` mécaniques (arrondis, erreur) + token `--danger` + extraction `addPlace` + helper pur `formatDay`/`formatRange`. Aucune logique métier, e2e = filet.

**Tech Stack:** Next.js 16, Tailwind v4, next-intl, Intl.DateTimeFormat, Vitest, Playwright.

## Global Constraints

- **Aucune migration, aucun changement de comportement.** e2e/unit verts (testids/textes/flux inchangés).
- Arrondis : `rounded-xl`/`rounded-lg` → `rounded-control` dans les composants UI (jamais `globals.css`).
- Erreur : token `--danger` (clair `#B3261E`, sombre `#F2998E`) + `@theme --color-danger` ; `text-red-600` → `text-danger`.
- `addResto`/`addHotel` gardent leur signature `(_prev, formData)` (appelants inchangés).
- `formatDay(iso, locale)` / `formatRange(start, end, locale)` purs et testés ; locale via `getLocale()` (server) / `useLocale()` (client).
- macOS : `sed -i ''` (BSD sed).
- Réf. spec : `docs/superpowers/specs/2026-06-26-polish-debt-design.md`.

---

### Task 1: Token `--danger` + sweep `text-red-600` → `text-danger`

**Files:**
- Modify: `src/app/globals.css`
- Modify: tous les fichiers contenant `text-red-600` (sweep)

- [ ] **Step 1: Ajouter le token `--danger`**

In `src/app/globals.css`: in the `:root,[data-theme="dark"]` block add `--danger: #F2998E;`; in `[data-theme="light"]` add `--danger: #B3261E;`; in `@theme` add `--color-danger: var(--danger);`.

- [ ] **Step 2: Sweep `text-red-600` → `text-danger`**

Run: `grep -rl "text-red-600" src/ | xargs sed -i '' 's/text-red-600/text-danger/g'`
Then verify zero remaining: `grep -rl "text-red-600" src/ || echo "OK aucun"`.

- [ ] **Step 3: Vérifier**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(polish): token --danger + remplace text-red-600 par text-danger"
```

---

### Task 2: Sweep arrondis `rounded-xl`/`rounded-lg` → `rounded-control`

**Files:**
- Modify: tous les composants UI avec `rounded-xl`/`rounded-lg` (sweep)

- [ ] **Step 1: Sweep**

Run:
```bash
grep -rl "rounded-xl\|rounded-lg" src/ | grep -v globals.css | xargs sed -i '' -e 's/rounded-xl/rounded-control/g' -e 's/rounded-lg/rounded-control/g'
```
Then verify zero remaining (hors globals.css) : `grep -rn "rounded-xl\|rounded-lg" src/ | grep -v globals.css || echo "OK aucun"`.

- [ ] **Step 2: Vérifier**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(polish): arrondis éditoriaux (rounded-xl/lg → rounded-control)"
```

---

### Task 3: Dé-duplication `addResto`/`addHotel` → `addPlace`

**Files:**
- Modify: `src/features/restos/data/actions.ts`

- [ ] **Step 1: Extraire `addPlace` + wrappers**

In `src/features/restos/data/actions.ts`, replace the bodies of `addResto` and `addHotel` by an internal `addPlace` helper + thin wrappers (signatures inchangées) :
```ts
async function addPlace(category: "resto" | "hotel", formData: FormData) {
  const parsed = addRestoSchema.safeParse({ placeId: formData.get("placeId") });
  if (!parsed.success) return { error: "Place invalide" };
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Non authentifié" };
  const place = await getPlacesProvider().details(parsed.data.placeId);
  if (!place) return { error: "Établissement introuvable" };
  const input = mapPlaceToEtablissement(place, category);
  const { data: etabId, error: rpcErr } = await supabase.rpc("upsert_etablissement", {
    p: { ...input, enriched_at: new Date().toISOString() },
  });
  if (rpcErr || !etabId) return { error: "Enregistrement échoué" };
  const { error: itemErr } = await supabase
    .from("liste_items")
    .upsert({ user_id: auth.user.id, etablissement_id: etabId }, { onConflict: "user_id,etablissement_id" });
  if (itemErr) return { error: "Ajout à la liste échoué" };
  revalidatePath(category === "hotel" ? "/hotels" : "/restos");
  return {};
}

export async function addResto(_prev: unknown, formData: FormData) {
  return addPlace("resto", formData);
}

export async function addHotel(_prev: unknown, formData: FormData) {
  return addPlace("hotel", formData);
}
```
(Les imports `addRestoSchema`/`createServerSupabase`/`getPlacesProvider`/`mapPlaceToEtablissement`/`revalidatePath` restent. `PlaceSearch` continue d'importer `addResto`/`addHotel` — inchangé.)

- [ ] **Step 2: Vérifier typecheck + lint + unit**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS.

- [ ] **Step 3: e2e ajout (non-régression ciblée)**

Run: `supabase db reset && npx playwright test e2e/restos.spec.ts e2e/hotels.spec.ts --retries=0`
Expected: PASS (ajout resto + ajout hôtel via `addResto`/`addHotel` → `addPlace`). Retry une fois si le webServer échoue.

- [ ] **Step 4: Commit**

```bash
git add src/features/restos/data/actions.ts
git commit -m "refactor(polish): extraction addPlace(category) — addResto/addHotel wrappers"
```

---

### Task 4: Dates localisées — helper `formatDay`/`formatRange` (TDD) + application

**Files:**
- Create: `src/lib/format/date.ts` + `date.test.ts`
- Modify: `src/features/depenses/ui/DepensesList.tsx`, `src/features/voyages/ui/VoyageDetail.tsx`, `src/features/voyages/ui/VoyageCard.tsx`, `src/features/voyages/ui/VoyageFeatured.tsx`, `src/features/voyages/ui/VoyagesList.tsx`, `src/features/vins/ui/VinDetail.tsx`, `src/app/[locale]/(app)/abonnement/page.tsx`

**Interfaces:**
- Produces : `formatDay(iso: string | null, locale: string): string` ; `formatRange(start: string | null, end: string | null, locale: string): string`.

- [ ] **Step 1: Test du helper**

Create `src/lib/format/date.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { formatDay, formatRange } from "./date";

describe("formatDay", () => {
  it("nul → vide", () => expect(formatDay(null, "fr-FR")).toBe(""));
  it("ISO → contient le jour", () => expect(formatDay("2026-09-12", "fr-FR")).toContain("12"));
});
describe("formatRange", () => {
  it("deux bornes → jointes par tiret", () => {
    const r = formatRange("2026-09-12", "2026-09-18", "fr-FR");
    expect(r).toContain("12");
    expect(r).toContain("18");
    expect(r).toContain(" – ");
  });
  it("une seule borne → pas de tiret", () => {
    expect(formatRange("2026-09-12", null, "fr-FR")).not.toContain(" – ");
  });
  it("aucune borne → vide", () => expect(formatRange(null, null, "fr-FR")).toBe(""));
});
```

- [ ] **Step 2: Lancer → échec** — Run: `npm run test -- format/date` → FAIL.

- [ ] **Step 3: Implémenter `date.ts`**

Create `src/lib/format/date.ts`:
```ts
export function formatDay(iso: string | null, locale: string): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}

export function formatRange(start: string | null, end: string | null, locale: string): string {
  return [formatDay(start, locale), formatDay(end, locale)].filter(Boolean).join(" – ");
}
```

- [ ] **Step 4: Lancer → succès** — Run: `npm run test -- format/date` → PASS.

- [ ] **Step 5: Appliquer dans `DepensesList` (client)**

In `src/features/depenses/ui/DepensesList.tsx`: add `import { useLocale } from "next-intl";` and `import { formatDay } from "@/lib/format/date";`. Inside the component add `const locale = useLocale();`. Replace `{d.date ? ` · ${d.date}` : ""}` with `{d.date ? ` · ${formatDay(d.date, locale)}` : ""}`.

- [ ] **Step 6: Appliquer dans les composants Voyages**

- `VoyageDetail.tsx` (server) : add `import { getLocale } from "next-intl/server";` and `import { formatRange } from "@/lib/format/date";`. Add `const locale = await getLocale();`. Replace `const dates = [voyage.date_debut, voyage.date_fin].filter(Boolean).join(" → ");` with `const dates = formatRange(voyage.date_debut, voyage.date_fin, locale);`. Replace the reservation date span content `{[r.date_debut, r.date_fin].filter(Boolean).join(" → ")}` with `{formatRange(r.date_debut, r.date_fin, locale)}` (and adjust its guard to `{(r.date_debut || r.date_fin) && (...)}` — unchanged).
- `VoyageFeatured.tsx` (server) : add the same imports + `const locale = await getLocale();`; replace `const dates = [...].join(" → ")` with `formatRange(voyage.date_debut, voyage.date_fin, locale)`.
- `VoyageCard.tsx` (sync) : add prop `locale: string` to the signature `{ voyage, statutLabel, locale }: { voyage: Voyage; statutLabel: string; locale: string }`; `import { formatRange } from "@/lib/format/date";`; replace `const dates = [...].join(" → ")` with `formatRange(voyage.date_debut, voyage.date_fin, locale)`.
- `VoyagesList.tsx` (server) : add `import { getLocale } from "next-intl/server";`; `const locale = await getLocale();`; pass `locale={locale}` to each `<VoyageCard ... />`.

- [ ] **Step 7: Appliquer dans `VinDetail` (server) + `abonnement/page` (server)**

- `VinDetail.tsx` : add `import { getLocale } from "next-intl/server";` + `import { formatDay } from "@/lib/format/date";`; `const locale = await getLocale();`; replace the degustation date display `{d.deguste_le}` (or `<span ...>{d.deguste_le}</span>`) with `{formatDay(d.deguste_le, locale)}`.
- `abonnement/page.tsx` : add `import { getLocale } from "next-intl/server";` + `import { formatDay } from "@/lib/format/date";`; `const locale = await getLocale();`; replace `const periodEnd = sub?.current_period_end ? new Date(sub.current_period_end).toLocaleDateString("fr-FR") : "";` with `const periodEnd = formatDay(sub?.current_period_end ?? null, locale);`.

- [ ] **Step 8: Vérifier typecheck + lint + unit**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/lib/format/date.ts src/lib/format/date.test.ts src/features/depenses/ui/DepensesList.tsx src/features/voyages/ui/VoyageDetail.tsx src/features/voyages/ui/VoyageCard.tsx src/features/voyages/ui/VoyageFeatured.tsx src/features/voyages/ui/VoyagesList.tsx src/features/vins/ui/VinDetail.tsx "src/app/[locale]/(app)/abonnement/page.tsx"
git commit -m "feat(polish): dates localisées (formatDay/formatRange) — dépenses/voyages/vins/abonnement"
```

---

### Task 5: Non-régression complète + build

- [ ] **Step 1: Suite e2e complète + build**

Run: `supabase db reset && npx playwright test --retries=0 && npm run build`
Expected: suite complète **verte sans modifier les specs** + build OK. Un seul `db reset` avant. (Flake connu `liste_items`/anon → relancer une fois.) Retry une fois si le webServer échoue.

- [ ] **Step 2: Commit (si correctifs)**

```bash
git add -A && git commit -m "fix(polish): correctifs non-régression" # seulement si nécessaire
```

---

## Notes d'exécution

- **Ordre** : T1 (token+erreur) → T2 (arrondis) → T3 (addPlace) → T4 (dates) → T5 (non-régression).
- **Prod** : aucune migration. Au « go prod » : merge → Vercel redéploie.
- **Filet** : sweeps mécaniques + token + refactor + helper — aucun testid/texte/flux ne change. Si un e2e casse, réparer le composant, jamais le test.
