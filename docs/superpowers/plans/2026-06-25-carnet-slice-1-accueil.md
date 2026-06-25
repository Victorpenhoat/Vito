# Slice 1 — Accueil « Le Carnet » Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-skinner l'écran Accueil (`/accueil`) au style Le Carnet (en-tête serif sans dégradé, bandeau stats bordé, deux colonnes activité/aside) en réutilisant la donnée existante, sans casser l'e2e.

**Architecture:** Refonte **présentationnelle** : `getDashboardData()`/`greeting()` inchangés. On réécrit `HeroCard` (en-tête éditorial), on ajoute `StatsRow` (rangée bordée, 4 cellules), et on recompose `accueil/page.tsx`. Une seule clé i18n ajoutée (`discoveries.suggested`).

**Tech Stack:** Next.js 16 (Server Components), Tailwind v4, next-intl (fr/en/it/es), Playwright, Vitest.

## Global Constraints

- **Refonte présentationnelle pure** : aucune requête, action serveur ni migration modifiée.
- **e2e `e2e/accueil.spec.ts` vert SANS modification** — préserver exactement :
  - `data-testid="accueil"` (le `<main>`), `data-testid="hero"` contenant un texte `/Bonjour|Bonsoir/`,
  - `data-testid="kpi-tiles"` avec **exactement 4 enfants directs `> div`**,
  - `data-testid="recent-activity"` visible,
  - un lien de nom accessible **« Demande de conciergerie »** dans `accueil` (le `Fab`).
- S'appuyer sur les fondations Slice 0 : `font-serif`, `text-faint`, `border-line`, `border-line-soft`, `border-accent`, kit (`Card`/`SectionLabel`/`Badge`/`Fab`).
- **Pas d'emoji** dans la salutation ; eyebrow = date courte (`weekday`+`day`+`month`).
- Parité i18n (4 locales) garantie par `src/lib/i18n/messages-parity.test.ts`. Pas de chaîne en dur.
- Réf. spec : `docs/superpowers/specs/2026-06-25-carnet-slice-1-accueil-design.md`.

---

### Task 1: i18n — clé `discoveries.suggested`

**Files:**
- Modify: `messages/fr.json`, `messages/en.json`, `messages/it.json`, `messages/es.json`

**Interfaces:**
- Produces : clé `accueil.discoveries.suggested` (string) dans les 4 locales (consommée par la page en Task 2).

- [ ] **Step 1: Ajouter la clé dans chaque locale**

Sous `accueil.discoveries` (qui contient déjà `vide`), ajouter `suggested` :
- `messages/fr.json` → `"suggested": "Suggéré"`
- `messages/en.json` → `"suggested": "Suggested"`
- `messages/it.json` → `"suggested": "Suggerito"`
- `messages/es.json` → `"suggested": "Sugerido"`

- [ ] **Step 2: Vérifier la parité**

Run: `npm run test -- messages-parity`
Expected: PASS (les 4 locales ont `accueil.discoveries.suggested`).

- [ ] **Step 3: Commit**

```bash
git add messages/fr.json messages/en.json messages/it.json messages/es.json
git commit -m "feat(carnet,i18n): accueil.discoveries.suggested (4 locales)"
```

---

### Task 2: Re-skin Accueil (HeroCard + StatsRow + page)

**Files:**
- Modify: `src/features/accueil/ui/HeroCard.tsx` (réécriture — en-tête sans dégradé)
- Create: `src/features/accueil/ui/StatsRow.tsx`
- Modify: `src/app/[locale]/(app)/accueil/page.tsx` (recomposition)

**Interfaces:**
- Consumes : `getDashboardData()` (inchangé), `greeting(hour)`, clé `discoveries.suggested` (Task 1), kit `Card`/`SectionLabel`/`Badge`/`Fab`.
- Produces : `HeroCard({ userName: string })` (la prop `sorties` est SUPPRIMÉE — seul appelant : `accueil/page.tsx`) ; `StatsRow({ stats: { label: string; value: string | number }[] })` rendant `data-testid="kpi-tiles"` avec 4 `<div>`.

- [ ] **Step 1: Réécrire `HeroCard.tsx`**

Replace `src/features/accueil/ui/HeroCard.tsx` with:
```tsx
import { getTranslations, getFormatter } from "next-intl/server";
import { greeting } from "../greeting";

export async function HeroCard({ userName }: { userName: string }) {
  const t = await getTranslations("accueil");
  const format = await getFormatter();
  const mode = greeting(new Date().getHours());
  const firstName = userName.split(/[\s@]/)[0] || userName;
  return (
    <section data-testid="hero" className="flex flex-col gap-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
        {format.dateTime(new Date(), { weekday: "long", day: "numeric", month: "long" })}
      </p>
      <h1 className="font-serif text-3xl font-medium text-ink md:text-4xl">
        {t(`greeting.${mode}`)} {firstName}
      </h1>
      <p className="max-w-xl border-l-[3px] border-accent pl-4 font-serif italic text-muted">
        {t("quote")}
      </p>
    </section>
  );
}
```

- [ ] **Step 2: Créer `StatsRow.tsx`**

Create `src/features/accueil/ui/StatsRow.tsx`:
```tsx
export function StatsRow({ stats }: { stats: { label: string; value: string | number }[] }) {
  return (
    <div data-testid="kpi-tiles" className="grid grid-cols-2 border-y border-line md:grid-cols-4">
      {stats.map((s, i) => (
        <div
          key={s.label}
          className={[
            "px-5 py-4",
            i % 2 === 1 ? "border-l border-line" : "",
            i >= 2 ? "border-t border-line" : "",
            "md:border-l md:border-line md:border-t-0 md:first:border-l-0",
          ].join(" ")}
        >
          <div className="font-serif text-3xl font-medium text-ink">{s.value}</div>
          <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">{s.label}</div>
        </div>
      ))}
    </div>
  );
}
```
(4 stats → exactement 4 `<div>` enfants directs : satisfait l'assertion e2e.)

- [ ] **Step 3: Recomposer `accueil/page.tsx`**

Replace `src/app/[locale]/(app)/accueil/page.tsx` with:
```tsx
import { getTranslations, getFormatter } from "next-intl/server";
import { ConciergeBell } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { Link } from "@/lib/i18n/routing";
import { Card } from "@/features/shared/ui/Card";
import { SectionLabel } from "@/features/shared/ui/SectionLabel";
import { Badge } from "@/features/shared/ui/Badge";
import { Fab } from "@/features/shared/ui/Fab";
import { HeroCard } from "@/features/accueil/ui/HeroCard";
import { StatsRow } from "@/features/accueil/ui/StatsRow";
import { getDashboardData } from "@/features/accueil/data/queries";

export default async function AccueilPage() {
  const t = await getTranslations("accueil");
  const format = await getFormatter();
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  let userName = auth.user?.email ?? "";
  if (auth.user) {
    const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", auth.user.id).maybeSingle();
    if (profile?.display_name) userName = profile.display_name;
  }
  const d = await getDashboardData();
  const now = new Date();
  const stats = [
    { label: t("kpi.sorties"), value: d.kpis.sorties },
    { label: t("kpi.nouveauxRestos"), value: d.kpis.nouveauxRestos },
    { label: t("kpi.vinsGoutes"), value: d.kpis.vinsGoutes },
    { label: t("kpi.depensesVoyage"), value: `${Math.round(d.kpis.depensesVoyageCents / 100)} €` },
  ];
  const todo = [
    { key: "restosATester", count: d.todo.restosATester },
    { key: "voyagesAVenir", count: d.todo.voyagesAVenir },
    { key: "conciergerieEnAttente", count: d.todo.conciergerieEnAttente },
  ];
  return (
    <main data-testid="accueil" className="flex flex-col gap-6 p-4 md:p-8">
      <HeroCard userName={userName} />
      <StatsRow stats={stats} />
      <div className="grid gap-6 md:grid-cols-[1.5fr_1fr]">
        <section>
          <SectionLabel>{t("sections.activity")}</SectionLabel>
          {d.activity.length === 0 ? (
            <p data-testid="recent-activity" className="text-sm text-muted">{t("activity.vide")}</p>
          ) : (
            <ul data-testid="recent-activity" className="flex flex-col">
              {d.activity.map((a, i) => (
                <li key={`${a.type}-${i}`} className="flex items-center justify-between gap-3 border-b border-line-soft py-3 text-sm">
                  <span className="text-ink">{a.label}</span>
                  <span className="shrink-0 text-xs text-faint">{format.relativeTime(new Date(a.at), now)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <aside className="flex flex-col gap-6">
          <Card>
            <SectionLabel>{t("sections.todo")}</SectionLabel>
            <ul className="flex flex-col gap-2">
              {todo.map((it) => (
                <li key={it.key} className="flex items-center justify-between text-sm text-ink">
                  <span>{t(`todo.${it.key}`)}</span>
                  <Badge>{it.count}</Badge>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <SectionLabel>{t("sections.discoveries")}</SectionLabel>
            {d.discoveries.length === 0 ? (
              <p className="text-sm text-muted">{t("discoveries.vide")}</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {d.discoveries.map((x) => (
                  <li key={x.title}>
                    <div className="font-serif text-ink">{x.title}</div>
                    <div className="text-xs text-muted">
                      {t("discoveries.suggested")}{x.source ? ` · ${x.source}` : ""}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </aside>
      </div>
      <Link href="/restos" className="text-sm font-medium text-accent hover:underline">{t("addResto")}</Link>
      <Fab href="/conciergerie" label={t("fab")} icon={<ConciergeBell size={22} />} />
    </main>
  );
}
```
(Plus d'import `Tile` ni de prop `sorties` ; `HeroCard` reçoit seulement `userName`.)

- [ ] **Step 4: Vérifier typecheck + lint + unit**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS (125 tests). Aucune erreur de type (signature `HeroCard` réduite, seul appelant mis à jour).

- [ ] **Step 5: Vérifier l'e2e Accueil (non-régression)**

Run: `supabase db reset && npx playwright test e2e/accueil.spec.ts --retries=0`
Expected: PASS sans modifier le spec (testids `accueil`/`hero`/`kpi-tiles` [4 div]/`recent-activity` + lien « Demande de conciergerie » conservés ; `hero` contient Bonjour/Bonsoir). Retry une fois si le webServer échoue à démarrer.

- [ ] **Step 6: Commit**

```bash
git add src/features/accueil/ui/HeroCard.tsx src/features/accueil/ui/StatsRow.tsx "src/app/[locale]/(app)/accueil/page.tsx"
git commit -m "feat(carnet): Accueil Le Carnet — en-tête serif + bandeau stats bordé + activité/aside"
```

---

### Task 3: Non-régression — suite complète + build

- [ ] **Step 1: Suite e2e complète + build**

Run: `supabase db reset && npx playwright test --retries=0 && npm run build`
Expected: suite e2e complète **verte sans modifier les specs** + build OK. Un seul `db reset` avant. Si un spec échoue, corriger le composant (testid/flux), **pas** le test. Retry une fois si le webServer échoue à démarrer.

- [ ] **Step 2: Commit (si correctifs)**

```bash
git add -A && git commit -m "fix(carnet): correctifs non-régression Accueil" # seulement si nécessaire
```

---

## Notes d'exécution

- **Ordre** : T1 (i18n) → T2 (composants+page, consomme la clé) → T3 (non-régression).
- **Prod** : aucune migration. Au « go prod » : merge → Vercel redéploie `main`.
- **Filet** : si l'e2e casse, c'est un testid/flux modifié par inadvertance → réparer le composant, jamais le test.
