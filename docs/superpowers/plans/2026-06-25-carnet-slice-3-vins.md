# Slice 3 — Vins « Le Carnet » (vignettes + onglets couleur + fiche hero) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-skinner l'écran Vins au style Le Carnet — vignettes colorées par couleur, onglets de couleur (+ filtres secondaires conservés), fiche en hero — sans migration ni casse e2e.

**Architecture:** Helper pur `couleurTint(couleur)` pour les fonds colorés (pas de photo). Onglets de couleur (`VinsCouleurTabs`, client) pilotant le searchParam `couleur` ; `VinsFilters` perd le select couleur mais garde région/note/dates ; `VinsList` rend une grille de vignettes ; `VinDetail` rend un hero + aside « Fiche ». `getMesVins`/`getVinDetail` inchangés.

**Tech Stack:** Next.js 16 (Server Components + searchParams), Tailwind v4, next-intl (fr/en/it/es), Vitest, Playwright.

## Global Constraints

- **Pas de migration, pas de photo** (vins sans `place_id`) : vignettes/hero = fond coloré par couleur.
- **Note /5** conservée (modèle de données ; la maquette illustrait /20 — non retenu).
- **e2e `vins.spec.ts`** : préserver `vin-row` (+ lien interne), `degustation-form`, `buy-button`, `degustation-row`. **Seule modification autorisée** : le filtre couleur passe du `<select>` de `vins-filters` à l'onglet « Blanc ». Ne jamais affaiblir un test.
- `VIN_COULEURS = ["rouge","blanc","rose","petillant","autre"]` ; libellés via `vins.couleurs.*` ; « Tous » via `vins.filtres.tous`.
- Fondations Slice 0/1/2 (`font-serif`, `text-faint`, `border-line`, `border-line-soft`, `rounded-card`, kit). Style éditorial.
- Parité i18n (4 locales) garantie par `messages-parity.test.ts`. Pas de chaîne en dur.
- TS strict (`noUncheckedIndexedAccess`).
- Réf. spec : `docs/superpowers/specs/2026-06-25-carnet-slice-3-vins-design.md`.

---

### Task 1: Fondations — couleurTint (TDD) + i18n + getVinsCount

**Files:**
- Create: `src/features/vins/domain/couleurTint.ts`
- Create: `src/features/vins/domain/couleurTint.test.ts`
- Modify: `messages/fr.json`, `messages/en.json`, `messages/it.json`, `messages/es.json`
- Modify: `src/features/vins/data/queries.ts` (ajout `getVinsCount`)

**Interfaces:**
- Produces : `couleurTint(couleur: string | null): string` (chaîne `background` CSS) ; clés `vins.eyebrow`, `vins.compte` (ICU `{n}`), `vins.fiche`, `vins.mesDegustations` ; `getVinsCount(): Promise<number>`.

- [ ] **Step 1: Écrire le test de `couleurTint`**

Create `src/features/vins/domain/couleurTint.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { couleurTint } from "./couleurTint";

describe("couleurTint", () => {
  it("rend un dégradé spécifique pour une couleur connue", () => {
    expect(couleurTint("rouge")).toContain("#5e2730");
    expect(couleurTint("blanc")).toContain("#cdbf8a");
  });
  it("retombe sur le dégradé neutre (tokens) pour null ou inconnu", () => {
    expect(couleurTint(null)).toContain("--hero-from");
    expect(couleurTint("autre")).toContain("--hero-from");
  });
});
```

- [ ] **Step 2: Lancer → échec**

Run: `npm run test -- couleurTint`
Expected: FAIL (module absent).

- [ ] **Step 3: Implémenter `couleurTint.ts`**

Create `src/features/vins/domain/couleurTint.ts`:
```ts
const TINTS: Record<string, string> = {
  rouge: "linear-gradient(135deg,#5e2730,#7a3540)",
  blanc: "linear-gradient(135deg,#cdbf8a,#e0d4a0)",
  rose: "linear-gradient(135deg,#c97d8f,#e0a9b6)",
  petillant: "linear-gradient(135deg,#d4c98a,#ece0a8)",
};
const NEUTRAL = "linear-gradient(135deg,var(--hero-from),var(--hero-to))";

export function couleurTint(couleur: string | null): string {
  return (couleur && TINTS[couleur]) || NEUTRAL;
}
```

- [ ] **Step 4: Lancer → succès**

Run: `npm run test -- couleurTint`
Expected: PASS.

- [ ] **Step 5: Ajouter les clés i18n (4 locales)**

Sous l'objet `vins` de chaque locale, ajouter :
- fr : `"eyebrow": "La cave"`, `"compte": "{n} vins"`, `"fiche": "Fiche"`, `"mesDegustations": "Mes dégustations"`
- en : `"eyebrow": "The cellar"`, `"compte": "{n} wines"`, `"fiche": "Details"`, `"mesDegustations": "My tastings"`
- it : `"eyebrow": "La cantina"`, `"compte": "{n} vini"`, `"fiche": "Scheda"`, `"mesDegustations": "Le mie degustazioni"`
- es : `"eyebrow": "La bodega"`, `"compte": "{n} vinos"`, `"fiche": "Ficha"`, `"mesDegustations": "Mis catas"`

- [ ] **Step 6: Ajouter `getVinsCount` dans `queries.ts`**

In `src/features/vins/data/queries.ts`, append:
```ts
export async function getVinsCount(): Promise<number> {
  const supabase = await createServerSupabase();
  const { count } = await supabase.from("vins").select("id", { count: "exact", head: true });
  return count ?? 0;
}
```

- [ ] **Step 7: Vérifier**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS (couleurTint vert ; parité i18n verte avec les 4 nouvelles clés).

- [ ] **Step 8: Commit**

```bash
git add src/features/vins/domain/couleurTint.ts src/features/vins/domain/couleurTint.test.ts messages/fr.json messages/en.json messages/it.json messages/es.json src/features/vins/data/queries.ts
git commit -m "feat(carnet,vins): couleurTint + i18n (eyebrow/compte/fiche/mesDegustations) + getVinsCount"
```

---

### Task 2: Onglets couleur + filtres + page

**Files:**
- Create: `src/features/vins/ui/VinsCouleurTabs.tsx`
- Modify: `src/features/vins/ui/VinsFilters.tsx` (retirer le select couleur)
- Modify: `src/app/[locale]/(app)/vins/page.tsx`

**Interfaces:**
- Consumes : `VIN_COULEURS` (schemas), clés `vins.filtres.tous`/`vins.couleurs.*`/`vins.eyebrow`/`vins.compte`, `getVinsCount` (Task 1).
- Produces : `VinsCouleurTabs` (client, testids `vin-tab-tous` + `vin-tab-{couleur}`, pilote le searchParam `couleur`).

- [ ] **Step 1: Créer `VinsCouleurTabs.tsx`**

Create `src/features/vins/ui/VinsCouleurTabs.tsx`:
```tsx
"use client";
import { useRouter, usePathname } from "@/lib/i18n/routing";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { VIN_COULEURS } from "../domain/schemas";

export function VinsCouleurTabs() {
  const t = useTranslations("vins");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get("couleur") ?? "";
  const go = (couleur: string) => {
    const next = new URLSearchParams(params.toString());
    if (couleur) next.set("couleur", couleur);
    else next.delete("couleur");
    router.replace(`${pathname}?${next.toString()}`);
  };
  const tabs = [
    { key: "", testid: "vin-tab-tous", label: t("filtres.tous") },
    ...VIN_COULEURS.map((c) => ({ key: c, testid: `vin-tab-${c}`, label: t(`couleurs.${c}`) })),
  ];
  return (
    <div role="tablist" className="flex flex-wrap gap-6 border-b border-line">
      {tabs.map((it) => {
        const active = current === it.key;
        return (
          <button
            key={it.testid}
            type="button"
            role="tab"
            data-testid={it.testid}
            aria-selected={active}
            onClick={() => go(it.key)}
            className={`-mb-px border-b-2 pb-3 text-sm ${active ? "border-ink font-semibold text-ink" : "border-transparent text-muted"}`}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Retirer le select couleur de `VinsFilters.tsx`**

In `src/features/vins/ui/VinsFilters.tsx`, delete the couleur `<select>` block (the `<select aria-label={t("couleur")} …>…</select>`). Keep everything else (région, noteMin, dates, reset) and `data-testid="vins-filters"`. Resulting JSX inside the `vins-filters` div:
```tsx
      <input aria-label={t("region")} placeholder={t("region")} defaultValue={params.get("region") ?? ""} onBlur={(e) => set("region", e.target.value)} className={inputCls} />
      <input aria-label={t("filtres.noteMin")} type="number" min={1} max={5} placeholder={t("filtres.noteMin")} defaultValue={params.get("noteMin") ?? ""} onBlur={(e) => set("noteMin", e.target.value)} className={`${inputCls} w-24`} />
      <input aria-label={t("filtres.du")} type="date" defaultValue={params.get("dateFrom") ?? ""} onChange={(e) => set("dateFrom", e.target.value)} className={inputCls} />
      <input aria-label={t("filtres.au")} type="date" defaultValue={params.get("dateTo") ?? ""} onChange={(e) => set("dateTo", e.target.value)} className={inputCls} />
      <button type="button" onClick={() => router.replace(pathname)} className="text-accent hover:underline">{t("filtres.reset")}</button>
```
(L'import `VIN_COULEURS` devient inutile dans ce fichier → le retirer pour éviter un lint d'import inutilisé.)

- [ ] **Step 3: Recomposer `vins/page.tsx`**

Replace `src/app/[locale]/(app)/vins/page.tsx` with:
```tsx
import { getTranslations } from "next-intl/server";
import { VinsFilters } from "@/features/vins/ui/VinsFilters";
import { VinsCouleurTabs } from "@/features/vins/ui/VinsCouleurTabs";
import { VinsList } from "@/features/vins/ui/VinsList";
import { getVinsCount } from "@/features/vins/data/queries";
import { PageHeader } from "@/features/shared/ui/PageHeader";

export default async function VinsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const t = await getTranslations("vins");
  const sp = await searchParams;
  const count = await getVinsCount();
  return (
    <main className="flex flex-col gap-6 p-4 md:p-8">
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} subtitle={t("compte", { n: count })} />
      <VinsCouleurTabs />
      <VinsFilters />
      <VinsList searchParams={sp} />
    </main>
  );
}
```

- [ ] **Step 4: Vérifier**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/vins/ui/VinsCouleurTabs.tsx src/features/vins/ui/VinsFilters.tsx "src/app/[locale]/(app)/vins/page.tsx"
git commit -m "feat(carnet,vins): onglets couleur + page (eyebrow/compte) + filtres secondaires"
```

---

### Task 3: Liste en vignettes (`VinsList`)

**Files:**
- Modify: `src/features/vins/ui/VinsList.tsx`

**Interfaces:**
- Consumes : `getMesVins` (inchangé), `couleurTint` (Task 1), `vins.couleurs.*`/`vins.fois`/`vins.vide`.

- [ ] **Step 1: Réécrire `VinsList.tsx` en grille de vignettes**

Replace `src/features/vins/ui/VinsList.tsx` with:
```tsx
import { getMesVins } from "../data/queries";
import { vinFiltersSchema } from "../domain/schemas";
import { couleurTint } from "../domain/couleurTint";
import { Link } from "@/lib/i18n/routing";
import { getTranslations } from "next-intl/server";

export async function VinsList({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const t = await getTranslations("vins");
  const filters = vinFiltersSchema.parse({
    couleur: searchParams.couleur, region: searchParams.region, noteMin: searchParams.noteMin,
    etablissementId: searchParams.etablissementId, dateFrom: searchParams.dateFrom, dateTo: searchParams.dateTo,
  });
  const vins = await getMesVins(filters);
  if (vins.length === 0) return <p className="text-sm text-muted">{t("vide")}</p>;
  return (
    <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2">
      {vins.map((v) => {
        const eyebrow = [v.region, v.couleur ? t(`couleurs.${v.couleur}`) : null].filter(Boolean).join(" · ");
        return (
          <li key={v.id} data-testid="vin-row">
            <Link href={`/vins/${v.id}`} className="block overflow-hidden rounded-card border border-line bg-surface">
              <div className="h-32" style={{ background: couleurTint(v.couleur) }} />
              <div className="flex flex-col gap-1 p-4">
                {eyebrow && <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">{eyebrow}</span>}
                <span className="font-serif text-xl font-medium text-ink">
                  {v.nom}{v.millesime ? ` ${v.millesime}` : ""}
                </span>
                <div className="mt-1 flex items-center justify-between text-sm text-muted">
                  <span>{t("fois", { count: v.nb_degustations })}</span>
                  {v.derniere_note != null && <span className="text-ink">{v.derniere_note}/5</span>}
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
```
(`vin-row` conservé sur le `<li>` ; le lien interne reste un `role="link"` cliquable — parcours e2e OK.)

- [ ] **Step 2: Vérifier**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/features/vins/ui/VinsList.tsx
git commit -m "feat(carnet,vins): liste en vignettes colorées par couleur"
```

---

### Task 4: Fiche vin en hero (`VinDetail`)

**Files:**
- Modify: `src/features/vins/ui/VinDetail.tsx`

**Interfaces:**
- Consumes : `getVinDetail` (inchangé), `couleurTint`, kit `Card`/`SectionLabel`, clés `vins.couleurs.*`/`vins.fiche`/`vins.mesDegustations`/`vins.cepages`? (cf. ci-dessous).

- [ ] **Step 1: Réécrire `VinDetail.tsx` (hero + aside Fiche)**

Replace `src/features/vins/ui/VinDetail.tsx` with:
```tsx
import { getVinDetail } from "../data/queries";
import { getMerchantProvider } from "@/lib/services/merchant";
import { couleurTint } from "../domain/couleurTint";
import { BuyButton } from "./BuyButton";
import { Card } from "@/features/shared/ui/Card";
import { SectionLabel } from "@/features/shared/ui/SectionLabel";
import { getTranslations } from "next-intl/server";

export async function VinDetail({ id }: { id: string }) {
  const t = await getTranslations("vins");
  const { vin, degustations } = await getVinDetail(id);
  const merchantUrl = getMerchantProvider().buyUrl(
    { nom: vin.nom, domaine: vin.domaine, millesime: vin.millesime, couleur: vin.couleur },
    1,
  );
  const buyUrl = vin.achat_url ?? merchantUrl;
  const eyebrow = [vin.region, vin.couleur ? t(`couleurs.${vin.couleur}`) : null].filter(Boolean).join(" · ");
  const infos: { label: string; value: string }[] = [
    ...(vin.millesime ? [{ label: t("millesime"), value: String(vin.millesime) }] : []),
    ...(vin.cepages?.length ? [{ label: t("cepages"), value: vin.cepages.join(", ") }] : []),
    ...(vin.region ? [{ label: t("region"), value: vin.region }] : []),
    ...(vin.domaine ? [{ label: t("domaine"), value: vin.domaine }] : []),
  ];
  return (
    <article className="flex flex-col gap-4">
      <div className="relative overflow-hidden rounded-card">
        <div className="h-44 md:h-56" style={{ background: couleurTint(vin.couleur) }} />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-5 text-white">
          {eyebrow && <div className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-90">{eyebrow}</div>}
          <h1 className="font-serif text-3xl font-medium md:text-4xl">{vin.nom}{vin.millesime ? ` ${vin.millesime}` : ""}</h1>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-[1fr_280px]">
        <div className="flex flex-col gap-4">
          <BuyButton url={buyUrl} />
          <section>
            <SectionLabel>{t("mesDegustations")}</SectionLabel>
            <ul>
              {degustations.map((d) => (
                <li key={d.id} data-testid="degustation-row" className="border-b border-line-soft py-2 text-sm">
                  <span className="text-muted">{d.deguste_le}</span>
                  {d.note ? <span className="text-accent"> · {d.note}/5</span> : ""}
                  {d.prix_paye ? <span className="text-ink"> · {d.prix_paye}€</span> : ""}
                  {d.commentaire ? <span className="text-muted"> {d.commentaire}</span> : ""}
                </li>
              ))}
            </ul>
          </section>
        </div>
        {infos.length > 0 && (
          <aside>
            <Card>
              <SectionLabel>{t("fiche")}</SectionLabel>
              <dl className="flex flex-col gap-2 text-sm">
                {infos.map((i) => (
                  <div key={i.label} className="flex justify-between gap-3 border-b border-line-soft pb-2 last:border-0 last:pb-0">
                    <dt className="text-muted">{i.label}</dt>
                    <dd className="text-right text-ink">{i.value}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          </aside>
        )}
      </div>
    </article>
  );
}
```

- [ ] **Step 2: Vérifier que les clés `millesime`/`cepages`/`region`/`domaine` existent (sinon ajouter)**

Run: `node -e "const m=require('./messages/fr.json'); console.log(['millesime','cepages','region','domaine'].map(k=>k+':'+(m.vins[k]??'MANQUANT')).join(' | '))"`
Si l'une affiche `MANQUANT`, l'ajouter aux 4 locales (fr/en/it/es) sous `vins` avec une traduction adaptée (ex. `millesime` : Millésime/Vintage/Annata/Añada ; `cepages` : Cépages/Grapes/Vitigni/Uvas ; `domaine` : Domaine/Estate/Tenuta/Bodega ; `region` existe déjà). Vérifier la parité ensuite : `npm run test -- messages-parity` → PASS.

- [ ] **Step 3: Vérifier typecheck + lint + unit**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS.

- [ ] **Step 4: e2e fiche vin (non-régression ciblée)**

Run: `supabase db reset && npx playwright test e2e/vins.spec.ts --retries=0`
Expected : **peut échouer à l'étape du filtre couleur** (encore via select) — c'est attendu, corrigé en Task 5. Les autres étapes (`vin-row`, ouverture détail, `buy-button`, `degustation-row`) doivent fonctionner. (Si tu veux un run vert ici, tu peux sauter ce step et le couvrir en Task 5.)

- [ ] **Step 5: Commit**

```bash
git add src/features/vins/ui/VinDetail.tsx messages/fr.json messages/en.json messages/it.json messages/es.json
git commit -m "feat(carnet,vins): fiche vin en hero coloré + aside Fiche"
```

---

### Task 5: e2e (couleur via onglet) + non-régression complète + build

**Files:**
- Modify: `e2e/vins.spec.ts`

- [ ] **Step 1: Filtrer la couleur via l'onglet dans `vins.spec.ts`**

Le filtre couleur passe par un onglet. Remplacer la ligne qui faisait :
```ts
  await page.getByTestId("vins-filters").locator("select").first().selectOption("blanc");
```
par un clic sur l'onglet couleur « Blanc » :
```ts
  await page.getByTestId("vin-tab-blanc").click();
```
Ne pas toucher le reste du parcours (le vin capturé est blanc → reste visible après filtre ; les assertions `vin-row`/détail/`buy-button` restent valides). C'est une mise à jour du moyen de filtrer (comportement équivalent), pas un affaiblissement.

- [ ] **Step 2: Suite e2e complète + build**

Run: `supabase db reset && npx playwright test --retries=0 && npm run build`
Expected: suite complète **verte** + build OK. Un seul `db reset` avant. Si un spec autre que `vins.spec` casse, corriger le composant (testid/flux), **pas** le test. Retry une fois si le webServer échoue.

- [ ] **Step 3: Commit**

```bash
git add e2e/vins.spec.ts
git commit -m "test(carnet,vins): filtre couleur via onglet + non-régression Slice 3"
```

---

## Notes d'exécution

- **Ordre** : T1 (couleurTint+i18n+count) → T2 (onglets+filtres+page) → T3 (liste) → T4 (fiche) → T5 (e2e+build).
- **Prod** : aucune migration. Au « go prod » : merge → Vercel redéploie `main`.
- **Filet** : si un e2e autre que `vins.spec` casse, c'est un testid/flux modifié par inadvertance → réparer le composant, jamais le test.
- Le filtre couleur via onglet et les filtres secondaires (région/note/dates) écrivent tous le même type de searchParams lus par `getMesVins` — comportement de filtrage serveur inchangé.
