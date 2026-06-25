# Slice 4 — Recherche « Le Carnet » Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-skinner l'écran Recherche au style Le Carnet (en-tête éditorial, form à pastilles de type, deux sections de résultats en lignes avec miniature) sans casser l'e2e ni la logique de scoring.

**Architecture:** Recherche par critères conservée (`rechercheRestos` : zone/budget/type → ta liste + recos scorées). On ajoute `photo_ref` au résultat pour les miniatures, on re-skinne `RechercheForm` (type en pastilles), `RechercheResults` (deux sections, lignes miniature) et la page (eyebrow). Aucune migration.

**Tech Stack:** Next.js 16 (Server Components + searchParams), Tailwind v4, next-intl (fr/en/it/es), Vitest, Playwright.

## Global Constraints

- **Recherche par critères** (pas de texte libre ; recherche Google = épic places Slice 5, différée). Scoring/matching (`scoreEtablissement`/`matchObjectif`) **non modifiés**.
- **e2e `recherche.spec.ts` vert SANS modification** : préserver `recherche-form`, `ma-liste-section`, `recos-section`, `resto-result` ; **structure deux sections** conservée. Le parcours règle les goûts via `gouts-form` et passe `?zone=17e` — il ne touche pas aux champs internes du form.
- Fondations Slices 0-3 (`font-serif`, `text-faint`, `text-muted`, `border-line`, `border-line-soft`, `rounded-control`, tokens `--hero-from/--hero-to`, kit `PageHeader`/`SectionLabel`).
- Parité i18n (4 locales) garantie par `messages-parity.test.ts`. Pas de chaîne en dur.
- **Aucune migration.** TS strict (`noUncheckedIndexedAccess`).
- Réf. spec : `docs/superpowers/specs/2026-06-25-carnet-slice-4-recherche-design.md`.

---

### Task 1: Données — `photo_ref` dans `rechercheRestos` + i18n eyebrow

**Files:**
- Modify: `src/features/reco/data/queries.ts`
- Modify: `messages/fr.json`, `messages/en.json`, `messages/it.json`, `messages/es.json`

**Interfaces:**
- Produces : `RestoResult` gagne `photo_ref: string | null` ; `rechercheRestos` renvoie ce champ pour `maListe` et `recos`. Clé `recherche.eyebrow`.

- [ ] **Step 1: Ajouter `photo_ref` au type `RestoResult`**

In `src/features/reco/data/queries.ts`, add to the `RestoResult` type:
```ts
  photo_ref: string | null;
```

- [ ] **Step 2: Sélectionner `photo_ref` dans les deux requêtes**

In the same file, add `photo_ref` to both `etablissements` selects:
- liste embed (the `.select("etablissement_id, is_favorite, etablissement:etablissements(...)")`) →
  `etablissement:etablissements(id, nom, type, ville, arrondissement, price_level, photo_ref)`
- pool (`.from("etablissements").select("id, nom, type, ville, arrondissement, price_level")`) →
  `.select("id, nom, type, ville, arrondissement, price_level, photo_ref")`

(Le `matchObjectif`/scoring ne lit pas `photo_ref` → inchangé. Les objets `e` poussés dans
`listeEtabs`/`recos` portent désormais `photo_ref`.)

- [ ] **Step 3: Ajouter `recherche.eyebrow` (4 locales)**

Sous l'objet `recherche` de chaque locale, ajouter :
- fr : `"eyebrow": "Explorer"` · en : `"eyebrow": "Explore"` · it : `"eyebrow": "Esplora"` · es : `"eyebrow": "Explorar"`

- [ ] **Step 4: Vérifier**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS (scoring/implicit inchangés ; parité i18n verte avec `recherche.eyebrow`).

- [ ] **Step 5: Commit**

```bash
git add src/features/reco/data/queries.ts messages/fr.json messages/en.json messages/it.json messages/es.json
git commit -m "feat(carnet,recherche): photo_ref dans rechercheRestos + i18n eyebrow"
```

---

### Task 2: `RechercheForm` (type en pastilles) + page (eyebrow)

**Files:**
- Modify: `src/features/reco/ui/RechercheForm.tsx`
- Modify: `src/app/[locale]/(app)/recherche/page.tsx`

**Interfaces:**
- Consumes : clés `recherche.zone/budget/type/tous/eyebrow/title`.
- Produces : `RechercheForm` re-skinné (pastilles de type), page avec eyebrow. `data-testid="recherche-form"` conservé.

- [ ] **Step 1: Réécrire `RechercheForm.tsx`**

Replace `src/features/reco/ui/RechercheForm.tsx` with:
```tsx
"use client";
import { useRouter, usePathname } from "@/lib/i18n/routing";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

const TYPES = ["étoilé", "bistrot", "brasserie", "café", "restaurant"] as const;
const inputCls = "rounded-control border border-line bg-surface px-3 py-2 text-sm outline-none focus:outline-2 focus:outline-accent";

export function RechercheForm() {
  const t = useTranslations("recherche");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}?${next.toString()}`);
  };
  const currentType = params.get("type") ?? "";
  const typeTabs = [{ key: "", label: t("tous") }, ...TYPES.map((ty) => ({ key: ty, label: ty }))];
  return (
    <div data-testid="recherche-form" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <input aria-label={t("zone")} placeholder={t("zone")} defaultValue={params.get("zone") ?? ""} onBlur={(e) => set("zone", e.target.value)} className={inputCls} />
        <input aria-label={t("budget")} type="number" min={0} placeholder={t("budget")} defaultValue={params.get("budgetMax") ?? ""} onBlur={(e) => set("budgetMax", e.target.value)} className={`${inputCls} w-44`} />
      </div>
      <div className="flex flex-wrap gap-2">
        {typeTabs.map((it) => {
          const active = currentType === it.key;
          return (
            <button
              key={it.key || "tous"}
              type="button"
              onClick={() => set("type", it.key)}
              aria-pressed={active}
              className={`rounded-full border px-3 py-1 text-sm ${active ? "border-accent bg-accent-50 text-ink" : "border-line text-muted hover:bg-surface-hover"}`}
            >
              {it.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Recomposer `recherche/page.tsx` (eyebrow + spacing)**

Replace `src/app/[locale]/(app)/recherche/page.tsx` with:
```tsx
import { getTranslations } from "next-intl/server";
import { RechercheForm } from "@/features/reco/ui/RechercheForm";
import { RechercheResults } from "@/features/reco/ui/RechercheResults";
import { PageHeader } from "@/features/shared/ui/PageHeader";

export default async function RecherchePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const t = await getTranslations("recherche");
  const sp = await searchParams;
  return (
    <main className="flex flex-col gap-6 p-4 md:p-8">
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} />
      <RechercheForm />
      <RechercheResults searchParams={sp} />
    </main>
  );
}
```

- [ ] **Step 3: Vérifier**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/reco/ui/RechercheForm.tsx "src/app/[locale]/(app)/recherche/page.tsx"
git commit -m "feat(carnet,recherche): form à pastilles de type + en-tête éditorial"
```

---

### Task 3: `RechercheResults` — sections + lignes avec miniature

**Files:**
- Modify: `src/features/reco/ui/RechercheResults.tsx`

**Interfaces:**
- Consumes : `rechercheRestos` (renvoie `photo_ref`, Task 1), `SectionLabel`, clés `recherche.maListe/recos/vide`.

- [ ] **Step 1: Réécrire `RechercheResults.tsx`**

Replace `src/features/reco/ui/RechercheResults.tsx` with:
```tsx
import { getTranslations } from "next-intl/server";
import { rechercheRestos } from "../data/queries";
import { rechercheCriteriaSchema } from "../domain/schemas";
import { SectionLabel } from "@/features/shared/ui/SectionLabel";
import { Link } from "@/lib/i18n/routing";

type Row = { id: string; nom: string; type: string | null; ville: string | null; arrondissement: string | null; photo_ref: string | null };

function ResultRow({ e }: { e: Row }) {
  const photoUrl = e.photo_ref ? `/api/places/photo?ref=${encodeURIComponent(e.photo_ref)}&w=200` : null;
  const initial = e.nom.charAt(0).toUpperCase();
  const subtitle = [e.type, e.arrondissement ?? e.ville].filter(Boolean).join(" · ");
  return (
    <li data-testid="resto-result">
      <Link href={`/restos/${e.id}`} className="flex items-center gap-4 border-b border-line-soft py-3">
        <span className="h-14 w-14 shrink-0 overflow-hidden rounded-control bg-[linear-gradient(135deg,var(--hero-from),var(--hero-to))]">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt={e.nom} className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center font-serif text-lg text-faint">{initial}</span>
          )}
        </span>
        <span className="min-w-0">
          <span className="block font-serif text-lg text-ink">{e.nom}</span>
          {subtitle && <span className="block text-sm text-muted">{subtitle}</span>}
        </span>
      </Link>
    </li>
  );
}

export async function RechercheResults({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const t = await getTranslations("recherche");
  const criteria = rechercheCriteriaSchema.parse({
    zone: searchParams.zone, budgetMax: searchParams.budgetMax, type: searchParams.type, ambiance: searchParams.ambiance,
  });
  const { maListe, recos } = await rechercheRestos(criteria);
  return (
    <div className="flex flex-col gap-8">
      <section data-testid="ma-liste-section">
        <SectionLabel>{t("maListe")}</SectionLabel>
        {maListe.length === 0 ? <p className="text-sm text-muted">{t("vide")}</p> : <ul className="flex flex-col">{maListe.map((e) => <ResultRow key={e.id} e={e} />)}</ul>}
      </section>
      <section data-testid="recos-section">
        <SectionLabel>{t("recos")}</SectionLabel>
        {recos.length === 0 ? <p className="text-sm text-muted">{t("vide")}</p> : <ul className="flex flex-col">{recos.map((e) => <ResultRow key={e.id} e={e} />)}</ul>}
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Vérifier typecheck + lint + unit**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS.

- [ ] **Step 3: e2e recherche (non-régression ciblée)**

Run: `supabase db reset && npx playwright test e2e/recherche.spec.ts --retries=0`
Expected: PASS sans modifier le spec (`ma-liste-section`/`recos-section`/`resto-result` présents ; au moins une reco du 17e). Retry une fois si le webServer échoue.

- [ ] **Step 4: Commit**

```bash
git add src/features/reco/ui/RechercheResults.tsx
git commit -m "feat(carnet,recherche): deux sections + lignes avec miniature"
```

---

### Task 4: Non-régression complète + build

- [ ] **Step 1: Suite e2e complète + build**

Run: `supabase db reset && npx playwright test --retries=0 && npm run build`
Expected: suite complète **verte sans modifier les specs** + build OK. Un seul `db reset` avant. Si un spec casse, corriger le composant (testid/flux), **pas** le test. Retry une fois si le webServer échoue.

- [ ] **Step 2: Commit (si correctifs)**

```bash
git add -A && git commit -m "fix(carnet,recherche): correctifs non-régression Slice 4" # seulement si nécessaire
```

---

## Notes d'exécution

- **Ordre** : T1 (data+i18n) → T2 (form+page) → T3 (résultats) → T4 (non-régression).
- **Prod** : aucune migration. Au « go prod » : merge → Vercel redéploie `main`.
- **Filet** : si un e2e casse, c'est un testid/flux modifié par inadvertance → réparer le composant, jamais le test.
