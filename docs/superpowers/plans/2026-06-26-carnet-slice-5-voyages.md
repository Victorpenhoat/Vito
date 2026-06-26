# Slice 5 — Voyages « Le Carnet » Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-skinner l'écran Voyages au style Le Carnet — liste (prochain départ + carnet de route), fiche en hero 2 colonnes — sans casser l'e2e ni la logique, sans migration.

**Architecture:** Helpers purs `statutTint` (dégradé par statut, pas de photo) et `splitVoyages` (sépare le prochain départ du reste). `VoyageCard`/`VoyageFeatured` présentationnels ; `VoyagesList` orchestre ; `VoyageDetail` passe en hero + 2 colonnes en réutilisant ses sous-composants (formulaires, listes) inchangés. `getMesVoyages`/`getVoyageDetail` inchangés ; ajout d'un compteur léger `getVoyageMeta` pour la carte mise en avant.

**Tech Stack:** Next.js 16 (Server Components), Tailwind v4, next-intl (fr/en/it/es), Vitest, Playwright.

## Global Constraints

- **Pas de photo** (voyages sans image) : visuels = dégradés teintés par statut. **Aucune migration.**
- **e2e `voyages.spec.ts` vert SANS modification** : préserver `voyage-form`, `voyage-card` (+ lien), `reservation-form`, `reservation-row`, `share-form`, `member-row`, `documents-section`. **Chaque** voyage rend un `voyage-card` avec lien — en featured comme en grille.
- Enum statut = `planifie | confirme | en_cours | termine` (labels `voyages.statuts.*` présents). « À venir » = `planifie`/`confirme` **et** `date_debut >= today`.
- Fondations Slices 0-4 (`font-serif`, `text-faint`, `text-muted`, `border-line`, `border-line-soft`, `rounded-card`, tokens `--hero-from/--hero-to`, kit `PageHeader`/`SectionLabel`/`Card`). Ne PAS modifier `VoyageForm` (re-skin différé ; il porte le testid e2e et fonctionne).
- Parité i18n (4 locales) garantie par `messages-parity.test.ts`. Pas de chaîne en dur.
- TS strict (`noUncheckedIndexedAccess`).
- Réf. spec : `docs/superpowers/specs/2026-06-26-carnet-slice-5-voyages-design.md`.

---

### Task 1: Helpers (TDD) + getVoyageMeta + i18n

**Files:**
- Create: `src/features/voyages/domain/statutTint.ts` + `statutTint.test.ts`
- Create: `src/features/voyages/domain/splitVoyages.ts` + `splitVoyages.test.ts`
- Modify: `src/features/voyages/data/queries.ts` (ajout `getVoyageMeta`)
- Modify: `messages/fr.json`, `messages/en.json`, `messages/it.json`, `messages/es.json`

**Interfaces:**
- Produces : `statutTint(statut: string | null): string` ; `splitVoyages<T extends { statut: string; date_debut: string | null }>(voyages: T[], today: string): { prochain: T | null; reste: T[] }` ; `getVoyageMeta(id: string): Promise<{ reservations: number; documents: number; voyageurs: number }>` ; clés `voyages.eyebrow/heading/prochainDepart/carnetRoute/compte/depenses`.

- [ ] **Step 1: Tests `statutTint`**

Create `src/features/voyages/domain/statutTint.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { statutTint } from "./statutTint";

describe("statutTint", () => {
  it("dégradé spécifique pour un statut connu", () => {
    expect(statutTint("confirme")).toContain("#2f5a3f");
  });
  it("fallback neutre (tokens) pour null/inconnu", () => {
    expect(statutTint(null)).toContain("--hero-from");
    expect(statutTint("zzz")).toContain("--hero-from");
  });
});
```

- [ ] **Step 2: Lancer → échec** — Run: `npm run test -- statutTint` → FAIL.

- [ ] **Step 3: Implémenter `statutTint.ts`**

```ts
const TINTS: Record<string, string> = {
  confirme: "linear-gradient(135deg,#2f5a3f,#3f7a55)",
  planifie: "linear-gradient(135deg,#2a3a5e,#3a5080)",
  en_cours: "linear-gradient(135deg,#7a5a2a,#a07a3a)",
  termine: "linear-gradient(135deg,#3a3632,#4a443e)",
};
const NEUTRAL = "linear-gradient(135deg,var(--hero-from),var(--hero-to))";

export function statutTint(statut: string | null): string {
  return (statut && TINTS[statut]) || NEUTRAL;
}
```

- [ ] **Step 4: Tests `splitVoyages`**

Create `src/features/voyages/domain/splitVoyages.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { splitVoyages } from "./splitVoyages";

const v = (id: string, statut: string, date_debut: string | null) => ({ id, statut, date_debut });

describe("splitVoyages", () => {
  it("isole le prochain départ à venir (statut planifié/confirmé, date >= today)", () => {
    const r = splitVoyages([v("a", "termine", "2020-01-01"), v("b", "confirme", "2026-09-12")], "2026-06-26");
    expect(r.prochain?.id).toBe("b");
    expect(r.reste.map((x) => x.id)).toEqual(["a"]);
  });
  it("aucun à venir → prochain=null, reste=tout", () => {
    const r = splitVoyages([v("a", "termine", "2020-01-01"), v("c", "planifie", "2026-01-01")], "2026-06-26");
    expect(r.prochain).toBeNull();
    expect(r.reste.map((x) => x.id)).toEqual(["a", "c"]);
  });
  it("en_cours n'est pas un « prochain départ »", () => {
    const r = splitVoyages([v("d", "en_cours", "2026-09-01")], "2026-06-26");
    expect(r.prochain).toBeNull();
  });
});
```

- [ ] **Step 5: Lancer → échec** — Run: `npm run test -- splitVoyages` → FAIL.

- [ ] **Step 6: Implémenter `splitVoyages.ts`**

```ts
const UPCOMING = new Set(["planifie", "confirme"]);

export function splitVoyages<T extends { statut: string; date_debut: string | null }>(
  voyages: T[],
  today: string,
): { prochain: T | null; reste: T[] } {
  // voyages est déjà trié par date_debut croissant → le premier à venir est le prochain départ.
  const idx = voyages.findIndex((v) => UPCOMING.has(v.statut) && v.date_debut != null && v.date_debut >= today);
  if (idx === -1) return { prochain: null, reste: voyages };
  return { prochain: voyages[idx]!, reste: voyages.filter((_, i) => i !== idx) };
}
```

- [ ] **Step 7: Lancer → succès** — Run: `npm run test -- statutTint splitVoyages` → PASS.

- [ ] **Step 8: Ajouter `getVoyageMeta` dans `queries.ts`**

In `src/features/voyages/data/queries.ts`, append:
```ts
export async function getVoyageMeta(id: string): Promise<{ reservations: number; documents: number; voyageurs: number }> {
  const supabase = await createServerSupabase();
  const [r, d, m] = await Promise.all([
    supabase.from("reservations").select("id", { count: "exact", head: true }).eq("voyage_id", id),
    supabase.from("voyage_documents").select("id", { count: "exact", head: true }).eq("voyage_id", id),
    supabase.from("voyage_membres").select("profile_id", { count: "exact", head: true }).eq("voyage_id", id),
  ]);
  return { reservations: r.count ?? 0, documents: d.count ?? 0, voyageurs: m.count ?? 0 };
}
```

- [ ] **Step 9: Ajouter les clés i18n (4 locales)**

Sous l'objet `voyages` de chaque locale, ajouter :
- fr : `"eyebrow":"Mes voyages"`, `"heading":"Voyages"`, `"prochainDepart":"Prochain départ"`, `"carnetRoute":"Carnet de route"`, `"compte":"{avenir} à venir · {passes} passés"`, `"depenses":"Dépenses"`
- en : `"eyebrow":"My trips"`, `"heading":"Trips"`, `"prochainDepart":"Next departure"`, `"carnetRoute":"Travel log"`, `"compte":"{avenir} upcoming · {passes} past"`, `"depenses":"Expenses"`
- it : `"eyebrow":"I miei viaggi"`, `"heading":"Viaggi"`, `"prochainDepart":"Prossima partenza"`, `"carnetRoute":"Diario di viaggio"`, `"compte":"{avenir} in arrivo · {passes} passati"`, `"depenses":"Spese"`
- es : `"eyebrow":"Mis viajes"`, `"heading":"Viajes"`, `"prochainDepart":"Próxima salida"`, `"carnetRoute":"Diario de ruta"`, `"compte":"{avenir} próximos · {passes} pasados"`, `"depenses":"Gastos"`

- [ ] **Step 10: Vérifier**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS (helpers verts ; parité i18n verte avec les 6 nouvelles clés).

- [ ] **Step 11: Commit**

```bash
git add src/features/voyages/domain/statutTint.ts src/features/voyages/domain/statutTint.test.ts src/features/voyages/domain/splitVoyages.ts src/features/voyages/domain/splitVoyages.test.ts src/features/voyages/data/queries.ts messages/fr.json messages/en.json messages/it.json messages/es.json
git commit -m "feat(carnet,voyages): helpers statutTint/splitVoyages + getVoyageMeta + i18n"
```

---

### Task 2: Liste — cartes + VoyagesList + page

**Files:**
- Create: `src/features/voyages/ui/VoyageCard.tsx`
- Create: `src/features/voyages/ui/VoyageFeatured.tsx`
- Modify: `src/features/voyages/ui/VoyagesList.tsx`
- Modify: `src/app/[locale]/(app)/voyages/page.tsx`

**Interfaces:**
- Consumes : `statutTint`, `splitVoyages`, `getVoyageMeta` (Task 1), `getMesVoyages`, `SectionLabel`, `PageHeader`.
- Produces : `VoyageCard` (sync, `{ voyage, statutLabel }`), `VoyageFeatured` (async, `{ voyage }`). Les deux rendent `data-testid="voyage-card"` + lien `/voyages/{id}`.

- [ ] **Step 1: Créer `VoyageCard.tsx`**

```tsx
import { Link } from "@/lib/i18n/routing";
import { statutTint } from "../domain/statutTint";

type Voyage = { id: string; titre: string; destination: string | null; date_debut: string | null; date_fin: string | null; statut: string };

export function VoyageCard({ voyage, statutLabel }: { voyage: Voyage; statutLabel: string }) {
  const dates = [voyage.date_debut, voyage.date_fin].filter(Boolean).join(" → ");
  const sub = [voyage.destination, dates].filter(Boolean).join(" · ");
  return (
    <li data-testid="voyage-card" className={voyage.statut === "termine" ? "opacity-70" : ""}>
      <Link href={`/voyages/${voyage.id}`} className="block overflow-hidden rounded-card border border-line bg-surface">
        <div className="relative h-28" style={{ background: statutTint(voyage.statut) }}>
          <span className="absolute left-3 top-3 rounded-full bg-black/30 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-white">{statutLabel}</span>
        </div>
        <div className="flex flex-col gap-1 p-4">
          <span className="font-serif text-xl font-medium text-ink">{voyage.titre}</span>
          {sub && <span className="text-sm text-muted">{sub}</span>}
        </div>
      </Link>
    </li>
  );
}
```

- [ ] **Step 2: Créer `VoyageFeatured.tsx`**

```tsx
import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import { statutTint } from "../domain/statutTint";
import { getVoyageMeta } from "../data/queries";

type Voyage = { id: string; titre: string; destination: string | null; date_debut: string | null; date_fin: string | null; statut: string };

export async function VoyageFeatured({ voyage }: { voyage: Voyage }) {
  const t = await getTranslations("voyages");
  const meta = await getVoyageMeta(voyage.id);
  const dates = [voyage.date_debut, voyage.date_fin].filter(Boolean).join(" → ");
  const sub = [voyage.destination, dates].filter(Boolean).join(" · ");
  const metaLine = [
    `${meta.reservations} ${t("reservations").toLowerCase()}`,
    `${meta.voyageurs} ${t("membres").toLowerCase()}`,
    `${meta.documents} ${t("documents.titre").toLowerCase()}`,
  ].join(" · ");
  return (
    <div data-testid="voyage-card">
      <Link href={`/voyages/${voyage.id}`} className="flex flex-col overflow-hidden rounded-card border border-line bg-surface md:flex-row">
        <div className="relative h-40 md:h-auto md:w-2/5" style={{ background: statutTint(voyage.statut) }}>
          <span className="absolute left-4 top-4 rounded-full bg-black/30 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-white">{t(`statuts.${voyage.statut}`)}</span>
        </div>
        <div className="flex flex-1 flex-col gap-2 p-6">
          <h3 className="font-serif text-2xl font-medium text-ink">{voyage.titre}</h3>
          {sub && <p className="text-sm text-muted">{sub}</p>}
          <p className="mt-auto pt-3 text-sm text-faint">{metaLine}</p>
        </div>
      </Link>
    </div>
  );
}
```

- [ ] **Step 3: Réécrire `VoyagesList.tsx`**

```tsx
import { getMesVoyages } from "../data/queries";
import { splitVoyages } from "../domain/splitVoyages";
import { VoyageCard } from "./VoyageCard";
import { VoyageFeatured } from "./VoyageFeatured";
import { SectionLabel } from "@/features/shared/ui/SectionLabel";
import { getTranslations } from "next-intl/server";

export async function VoyagesList() {
  const t = await getTranslations("voyages");
  const voyages = await getMesVoyages();
  if (voyages.length === 0) return <p className="text-sm text-muted">{t("vide")}</p>;
  const today = new Date().toISOString().slice(0, 10);
  const { prochain, reste } = splitVoyages(voyages, today);
  return (
    <div className="flex flex-col gap-8">
      {prochain && (
        <section>
          <SectionLabel>{t("prochainDepart")}</SectionLabel>
          <VoyageFeatured voyage={prochain} />
        </section>
      )}
      {reste.length > 0 && (
        <section>
          <SectionLabel>{t("carnetRoute")}</SectionLabel>
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {reste.map((v) => <VoyageCard key={v.id} voyage={v} statutLabel={t(`statuts.${v.statut}`)} />)}
          </ul>
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Recomposer `voyages/page.tsx`**

```tsx
import { getTranslations } from "next-intl/server";
import { VoyageForm } from "@/features/voyages/ui/VoyageForm";
import { VoyagesList } from "@/features/voyages/ui/VoyagesList";
import { getMesVoyages } from "@/features/voyages/data/queries";
import { PageHeader } from "@/features/shared/ui/PageHeader";

export default async function VoyagesPage() {
  const t = await getTranslations("voyages");
  const voyages = await getMesVoyages();
  const today = new Date().toISOString().slice(0, 10);
  const avenir = voyages.filter((v) => (v.statut === "planifie" || v.statut === "confirme") && v.date_debut != null && v.date_debut >= today).length;
  const passes = voyages.length - avenir;
  return (
    <main className="flex flex-col gap-6 p-4 md:p-8">
      <PageHeader eyebrow={t("eyebrow")} title={t("heading")} subtitle={t("compte", { avenir, passes })} />
      <VoyageForm />
      <VoyagesList />
    </main>
  );
}
```
(`getMesVoyages` est appelé ici pour le compteur ET dans `VoyagesList` — requête légère indexée, double appel accepté pour garder `VoyagesList` autonome.)

- [ ] **Step 5: Vérifier**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/voyages/ui/VoyageCard.tsx src/features/voyages/ui/VoyageFeatured.tsx src/features/voyages/ui/VoyagesList.tsx "src/app/[locale]/(app)/voyages/page.tsx"
git commit -m "feat(carnet,voyages): liste prochain départ + carnet de route"
```

---

### Task 3: Fiche voyage en hero 2 colonnes (`VoyageDetail`)

**Files:**
- Modify: `src/features/voyages/ui/VoyageDetail.tsx`

**Interfaces:**
- Consumes : `getVoyageDetail`/`getVoyageDocuments` (inchangés), `statutTint`, `SectionLabel`/`Card`, sous-composants (`ReservationForm`/`ShareForm`/`MembersList`/`DocumentUploadForm`/`DocumentsList`) inchangés, `openVoyageGroupe`.

- [ ] **Step 1: Réécrire `VoyageDetail.tsx`**

```tsx
import { getTranslations } from "next-intl/server";
import { getVoyageDetail, getVoyageDocuments } from "../data/queries";
import { statutTint } from "../domain/statutTint";
import { ReservationForm } from "./ReservationForm";
import { ShareForm } from "./ShareForm";
import { MembersList } from "./MembersList";
import { DocumentUploadForm } from "./DocumentUploadForm";
import { DocumentsList } from "./DocumentsList";
import { openVoyageGroupe } from "@/features/depenses/data/actions";
import { Card } from "@/features/shared/ui/Card";
import { SectionLabel } from "@/features/shared/ui/SectionLabel";

export async function VoyageDetail({ id }: { id: string }) {
  const t = await getTranslations("voyages");
  const { voyage, reservations, membres, isOwner } = await getVoyageDetail(id);
  const documents = await getVoyageDocuments(voyage.id);
  const dates = [voyage.date_debut, voyage.date_fin].filter(Boolean).join(" → ");
  const sub = [voyage.destination, dates].filter(Boolean).join(" · ");
  return (
    <article className="flex flex-col gap-6">
      <div className="relative overflow-hidden rounded-card">
        <div className="h-44 md:h-56" style={{ background: statutTint(voyage.statut) }} />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-5 text-white">
          <span className="inline-block rounded-full bg-white/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em]">{t(`statuts.${voyage.statut}`)}</span>
          <h1 className="mt-2 font-serif text-3xl font-medium md:text-4xl">{voyage.titre}</h1>
          {sub && <p className="mt-1 text-sm opacity-90">{sub}</p>}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6">
          <section>
            <SectionLabel>{t("reservations")}</SectionLabel>
            <ul className="flex flex-col">
              {reservations.map((r) => (
                <li key={r.id} data-testid="reservation-row" className="flex flex-col gap-0.5 border-b border-line-soft py-3">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">{t(`types.${r.type}`)}</span>
                  <span className="font-serif text-lg text-ink">{[r.fournisseur, r.reference].filter(Boolean).join(" · ") || t(`types.${r.type}`)}</span>
                  {(r.date_debut || r.date_fin) && <span className="text-sm text-muted">{[r.date_debut, r.date_fin].filter(Boolean).join(" → ")}</span>}
                  <span className="flex flex-wrap gap-3 text-sm">
                    {r.conciergerie_tel && <a href={`tel:${r.conciergerie_tel}`} className="text-accent hover:underline">{r.conciergerie_tel}</a>}
                    {r.conciergerie_mail && <a href={`mailto:${r.conciergerie_mail}`} className="text-accent hover:underline">{r.conciergerie_mail}</a>}
                    {r.lien && <a href={r.lien} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">{t("voirLien")}</a>}
                  </span>
                </li>
              ))}
            </ul>
            <ReservationForm voyageId={voyage.id} />
          </section>

          <section data-testid="documents-section">
            <SectionLabel>{t("documents.titre")}</SectionLabel>
            <DocumentsList voyageId={voyage.id} documents={documents} />
            <DocumentUploadForm voyageId={voyage.id} />
          </section>
        </div>

        <aside className="flex flex-col gap-6">
          <Card>
            <SectionLabel>{t("membres")}</SectionLabel>
            <MembersList voyageId={voyage.id} membres={membres} isOwner={isOwner} />
            {isOwner && <ShareForm voyageId={voyage.id} />}
          </Card>
          <Card>
            <SectionLabel>{t("depenses")}</SectionLabel>
            <form action={openVoyageGroupe}>
              <input type="hidden" name="voyageId" value={voyage.id} />
              <button type="submit" className="text-sm font-semibold text-accent hover:underline">{t("ouvrirCompte")}</button>
            </form>
          </Card>
        </aside>
      </div>
    </article>
  );
}
```
(Les sous-composants — `ReservationForm`/`ShareForm`/`MembersList`/`DocumentUploadForm`/`DocumentsList` — et leurs testids `reservation-form`/`share-form`/`member-row` restent inchangés. `reservation-row` et `documents-section` conservés.)

- [ ] **Step 2: Vérifier typecheck + lint + unit**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS.

- [ ] **Step 3: e2e voyages (non-régression ciblée)**

Run: `supabase db reset && npx playwright test e2e/voyages.spec.ts --retries=0`
Expected: PASS sans modifier le spec (créer « Lisbonne », réservation hôtel `reservation-row`, partage `share-form`/`member-row` ; agence voit « Rome » en `voyage-card`). Retry une fois si le webServer échoue.

- [ ] **Step 4: Commit**

```bash
git add src/features/voyages/ui/VoyageDetail.tsx
git commit -m "feat(carnet,voyages): fiche en hero + 2 colonnes (réservations/documents · voyageurs/dépenses)"
```

---

### Task 4: Non-régression complète + build

- [ ] **Step 1: Suite e2e complète + build**

Run: `supabase db reset && npx playwright test --retries=0 && npm run build`
Expected: suite complète **verte sans modifier les specs** + build OK. Un seul `db reset` avant. Si un spec casse, corriger le composant (testid/flux), **pas** le test. Retry une fois si le webServer échoue.

- [ ] **Step 2: Commit (si correctifs)**

```bash
git add -A && git commit -m "fix(carnet,voyages): correctifs non-régression Slice 5" # seulement si nécessaire
```

---

## Notes d'exécution

- **Ordre** : T1 (helpers+meta+i18n) → T2 (liste) → T3 (fiche) → T4 (non-régression).
- **Prod** : aucune migration. Au « go prod » : merge → Vercel redéploie `main`.
- **Filet** : `voyage-card` doit être présent sur la carte featured ET les cartes de grille (sinon l'e2e ne trouve plus « Lisbonne »/« Rome »). Si un e2e casse, réparer le composant, jamais le test.
- `VoyageForm` n'est PAS modifié (re-skin différé) — il conserve `voyage-form` et le flux de création.
