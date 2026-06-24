# Refonte Core.Badakan — Slice C : Dashboard d'accueil Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le stub `/accueil` par le dashboard de référence Core.Badakan (hero, À FAIRE / CE MOIS-CI / DÉCOUVERTES, activité récente, FAB), en données mockées sauf la salutation, et faire de `/accueil` la home post-login.

**Architecture:** Page server component sous `(app)` composant un `HeroCard` (salutation réelle via helper `greeting` + nom de session + date next-intl) et des sections inline réutilisant le kit (Card/Tile/SectionLabel/Badge/Fab) sur des données mockées. Repointage des redirections post-login vers `/accueil`.

**Tech Stack:** Next.js 16, Tailwind v4, next-intl (4 locales, formatter de date), lucide-react, Vitest, Playwright.

## Global Constraints

- Next.js 16 ; Tailwind v4 ; TS strict (`noUncheckedIndexedAccess`).
- **Aucune chaîne UI/chrome en dur** — next-intl (namespace `accueil`). Le **contenu mocké factice**
  (titres de découvertes, lignes d'activité) vit dans `mock.ts` (texte FR placeholder, ce n'est pas du
  chrome). Date via next-intl `getFormatter` (locale-aware), jamais en dur.
- Réutiliser le kit (`Card`/`Tile`/`SectionLabel`/`Badge`/`Fab`) et les tokens (`bg-[linear-gradient(...var(--hero-from)...)]`, `border-accent`, KPI tones).
- **Données mockées** (le câblage réel est différé). **Salutation réelle** (nom session + heure serveur).
- **Home = `/accueil`** : repointer signIn/signUp + landing, et **mettre à jour les ~15 helpers de login e2e** (`/restos` → `/accueil`).
- `data-testid` : `accueil`, `hero`, `kpi-tiles`, `recent-activity`.
- Pas de migration, pas de DB.

---

### Task 1: i18n `accueil` (4 locales) + helper `greeting` (TDD) + mock

**Files:**
- Modify: `messages/fr.json`, `messages/en.json`, `messages/it.json`, `messages/es.json` (objet `accueil`)
- Create: `src/features/accueil/greeting.ts` + `greeting.test.ts`
- Create: `src/features/accueil/mock.ts`

**Interfaces:**
- Produces : `greeting(hour: number): "bonjour" | "bonsoir"` ; `MONTHLY_KPIS`/`TODO`/`DISCOVERIES`/`ACTIVITY`/`SORTIES_THIS_MONTH`.

- [ ] **Step 1: Remplacer l'objet `accueil` dans chaque locale**

In each `messages/<loc>.json`, replace the existing `"accueil"` object with the version below for that language (keeps `title`/`welcome`/`cta`, adds the dashboard keys; mind JSON commas).

**fr.json:**
```json
  "accueil": {
    "title": "Accueil", "welcome": "Bienvenue sur Vito 👋", "cta": "Voir mes restos",
    "greeting": { "bonjour": "Bonjour", "bonsoir": "Bonsoir" },
    "quote": "Chaque sortie est une histoire à raconter.",
    "sortiesMois": "{n} sorties ce mois",
    "addResto": "+ Ajouter un resto",
    "fab": "Demande de conciergerie",
    "sections": { "todo": "À faire", "month": "Ce mois-ci", "discoveries": "Découvertes", "activity": "Activité récente" },
    "todo": { "restosATester": "Restos à tester", "voyagesAVenir": "Voyages à venir", "vinsARacheter": "Vins à racheter" },
    "kpi": { "sorties": "Sorties", "nouveauxRestos": "Nouveaux restos", "vinsGoutes": "Vins goûtés", "depensesVoyage": "Dépenses voyage" }
  },
```
**en.json:**
```json
  "accueil": {
    "title": "Home", "welcome": "Welcome to Vito 👋", "cta": "See my restaurants",
    "greeting": { "bonjour": "Good morning", "bonsoir": "Good evening" },
    "quote": "Every outing is a story to tell.",
    "sortiesMois": "{n} outings this month",
    "addResto": "+ Add a restaurant",
    "fab": "Concierge request",
    "sections": { "todo": "To do", "month": "This month", "discoveries": "Discoveries", "activity": "Recent activity" },
    "todo": { "restosATester": "Restaurants to try", "voyagesAVenir": "Upcoming trips", "vinsARacheter": "Wines to rebuy" },
    "kpi": { "sorties": "Outings", "nouveauxRestos": "New restaurants", "vinsGoutes": "Wines tasted", "depensesVoyage": "Trip spending" }
  },
```
**it.json:**
```json
  "accueil": {
    "title": "Home", "welcome": "Benvenuto su Vito 👋", "cta": "Vedi i miei ristoranti",
    "greeting": { "bonjour": "Buongiorno", "bonsoir": "Buonasera" },
    "quote": "Ogni uscita è una storia da raccontare.",
    "sortiesMois": "{n} uscite questo mese",
    "addResto": "+ Aggiungi un ristorante",
    "fab": "Richiesta concierge",
    "sections": { "todo": "Da fare", "month": "Questo mese", "discoveries": "Scoperte", "activity": "Attività recente" },
    "todo": { "restosATester": "Ristoranti da provare", "voyagesAVenir": "Viaggi in arrivo", "vinsARacheter": "Vini da ricomprare" },
    "kpi": { "sorties": "Uscite", "nouveauxRestos": "Nuovi ristoranti", "vinsGoutes": "Vini degustati", "depensesVoyage": "Spese di viaggio" }
  },
```
**es.json:**
```json
  "accueil": {
    "title": "Inicio", "welcome": "Bienvenido a Vito 👋", "cta": "Ver mis restaurantes",
    "greeting": { "bonjour": "Buenos días", "bonsoir": "Buenas noches" },
    "quote": "Cada salida es una historia que contar.",
    "sortiesMois": "{n} salidas este mes",
    "addResto": "+ Añadir un restaurante",
    "fab": "Solicitud de conserjería",
    "sections": { "todo": "Por hacer", "month": "Este mes", "discoveries": "Descubrimientos", "activity": "Actividad reciente" },
    "todo": { "restosATester": "Restaurantes para probar", "voyagesAVenir": "Viajes próximos", "vinsARacheter": "Vinos para recomprar" },
    "kpi": { "sorties": "Salidas", "nouveauxRestos": "Restaurantes nuevos", "vinsGoutes": "Vinos catados", "depensesVoyage": "Gastos de viaje" }
  },
```

- [ ] **Step 2: Test `greeting` (échec)**

Create `src/features/accueil/greeting.test.ts` :
```ts
import { describe, it, expect } from "vitest";
import { greeting } from "./greeting";

describe("greeting", () => {
  it("bonsoir le soir/la nuit", () => {
    expect(greeting(20)).toBe("bonsoir");
    expect(greeting(2)).toBe("bonsoir");
    expect(greeting(18)).toBe("bonsoir");
  });
  it("bonjour la journée", () => {
    expect(greeting(9)).toBe("bonjour");
    expect(greeting(14)).toBe("bonjour");
    expect(greeting(5)).toBe("bonjour");
    expect(greeting(17)).toBe("bonjour");
  });
});
```

- [ ] **Step 3: Lancer (échec)**

Run: `npx vitest run src/features/accueil/greeting.test.ts` → FAIL.

- [ ] **Step 4: Implémenter `greeting.ts` + `mock.ts`**

Create `src/features/accueil/greeting.ts` :
```ts
export function greeting(hour: number): "bonjour" | "bonsoir" {
  return hour >= 18 || hour < 5 ? "bonsoir" : "bonjour";
}
```

Create `src/features/accueil/mock.ts` :
```ts
import type { Tone } from "@/features/shared/ui/helpers";

export const SORTIES_THIS_MONTH = 12;

export const MONTHLY_KPIS: { key: string; tone: Tone; value: string | number }[] = [
  { key: "sorties", tone: "blue", value: 12 },
  { key: "nouveauxRestos", tone: "green", value: 4 },
  { key: "vinsGoutes", tone: "violet", value: 7 },
  { key: "depensesVoyage", tone: "amber", value: "320 €" },
];

export const TODO: { key: string; count: number }[] = [
  { key: "restosATester", count: 5 },
  { key: "voyagesAVenir", count: 2 },
  { key: "vinsARacheter", count: 3 },
];

export const DISCOVERIES: { title: string; source: string }[] = [
  { title: "Le Clarence", source: "Recommandé par Marie" },
  { title: "Trattoria da Gigi", source: "Tendance ce mois" },
  { title: "Château Margaux 2015", source: "Coup de cœur sommelier" },
];

export const ACTIVITY: { title: string; ago: string }[] = [
  { title: "« Septime » ajouté à tester", ago: "il y a 1h" },
  { title: "Voyage « Rome » mis à jour", ago: "hier" },
  { title: "Vin « Chablis » noté ★★★★", ago: "il y a 3 j" },
];
```

- [ ] **Step 5: Lancer (succès) + build**

Run: `npx vitest run src/features/accueil/greeting.test.ts && npm run build && npm run lint`
Expected: tests verts ; build OK (4 locales, JSON valides) ; lint 0.

- [ ] **Step 6: Commit**

```bash
git add messages/ src/features/accueil/greeting.ts src/features/accueil/greeting.test.ts src/features/accueil/mock.ts
git commit -m "feat(accueil): i18n dashboard (4 locales) + greeting (testé) + données mockées"
```

---

### Task 2: Fab href + HeroCard + page dashboard

**Files:**
- Modify: `src/features/shared/ui/Fab.tsx` (support `href` + position au-dessus de la bottom-nav)
- Create: `src/features/accueil/ui/HeroCard.tsx`
- Modify: `src/app/[locale]/(app)/accueil/page.tsx` (remplace le stub)

**Interfaces:**
- Consumes : kit (`Card`/`Tile`/`SectionLabel`/`Badge`/`Fab`) ; `greeting` + `mock` (Task 1) ; `Link` (`@/lib/i18n/routing`) ; `getTranslations`/`getFormatter` (`next-intl/server`) ; `createServerSupabase`.
- Produces : page `/accueil` dashboard.

- [ ] **Step 1: Étendre `Fab` (href + offset bottom-nav)**

Replace the contents of `src/features/shared/ui/Fab.tsx` with:
```tsx
import type { ReactNode } from "react";
import { Link } from "@/lib/i18n/routing";

const FAB_CLASS =
  "fixed bottom-20 right-6 z-20 grid h-14 w-14 place-items-center rounded-full bg-accent text-white shadow-lg shadow-black/30 transition-colors hover:bg-accent-hover md:bottom-6";

export function Fab({
  icon, label, href, onClick,
}: { icon: ReactNode; label: string; href?: string; onClick?: () => void }) {
  if (href) {
    return (
      <Link href={href} aria-label={label} className={FAB_CLASS}>
        {icon}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} aria-label={label} className={FAB_CLASS}>
      {icon}
    </button>
  );
}
```
(`bottom-20 md:bottom-6` : sur mobile le FAB passe au-dessus de la bottom-nav (`h-14`+padding) ; sur
desktop il revient en bas. Le `href` rend un `Link` — utilisable depuis un server component ; la branche
`onClick` reste pour les usages client comme `/ui-kit`.)

- [ ] **Step 2: `HeroCard`**

Create `src/features/accueil/ui/HeroCard.tsx` :
```tsx
import { getTranslations, getFormatter } from "next-intl/server";
import { Star } from "lucide-react";
import { greeting } from "../greeting";
import { SORTIES_THIS_MONTH } from "../mock";

export async function HeroCard({ userName }: { userName: string }) {
  const t = await getTranslations("accueil");
  const format = await getFormatter();
  const hour = new Date().getHours();
  const mode = greeting(hour);
  const firstName = userName.split(/[\s@]/)[0] || userName;
  const emoji = mode === "bonsoir" ? "🌙" : "☀️";
  return (
    <section
      data-testid="hero"
      className="rounded-card bg-[linear-gradient(135deg,var(--hero-from),var(--hero-to))] p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">
            {t(`greeting.${mode}`)} {firstName} {emoji}
          </h1>
          <p className="mt-1 text-sm capitalize text-muted">
            {format.dateTime(new Date(), { dateStyle: "full" })}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1 text-xs text-muted">
          {t("sortiesMois", { n: SORTIES_THIS_MONTH })}
          <Star size={14} className="text-kpi-amber" />
        </div>
      </div>
      <p className="mt-4 border-l-4 border-accent pl-3 text-ink">{t("quote")}</p>
    </section>
  );
}
```

- [ ] **Step 3: Page dashboard (remplace le stub)**

Replace the contents of `src/app/[locale]/(app)/accueil/page.tsx` with:
```tsx
import { getTranslations } from "next-intl/server";
import { ConciergeBell } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { Link } from "@/lib/i18n/routing";
import { Card } from "@/features/shared/ui/Card";
import { SectionLabel } from "@/features/shared/ui/SectionLabel";
import { Tile } from "@/features/shared/ui/Tile";
import { Badge } from "@/features/shared/ui/Badge";
import { Fab } from "@/features/shared/ui/Fab";
import { HeroCard } from "@/features/accueil/ui/HeroCard";
import { MONTHLY_KPIS, TODO, DISCOVERIES, ACTIVITY } from "@/features/accueil/mock";

export default async function AccueilPage() {
  const t = await getTranslations("accueil");
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  let userName = auth.user?.email ?? "";
  if (auth.user) {
    const { data: profile } = await supabase
      .from("profiles").select("display_name").eq("id", auth.user.id).maybeSingle();
    if (profile?.display_name) userName = profile.display_name;
  }
  return (
    <main data-testid="accueil" className="flex flex-col gap-4 p-4 md:p-6">
      <HeroCard userName={userName} />
      <Link href="/restos" className="text-sm font-medium text-accent hover:underline">{t("addResto")}</Link>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <SectionLabel icon="✅">{t("sections.todo")}</SectionLabel>
          <ul className="flex flex-col gap-2">
            {TODO.map((it) => (
              <li key={it.key} className="flex items-center justify-between text-sm text-ink">
                <span>{t(`todo.${it.key}`)}</span>
                <Badge>{it.count}</Badge>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <SectionLabel icon="📊">{t("sections.month")}</SectionLabel>
          <div data-testid="kpi-tiles" className="grid grid-cols-2 gap-3">
            {MONTHLY_KPIS.map((k) => (
              <Tile key={k.key} tone={k.tone} label={t(`kpi.${k.key}`)} value={k.value} />
            ))}
          </div>
        </Card>

        <Card>
          <SectionLabel icon="✨">{t("sections.discoveries")}</SectionLabel>
          <ul className="flex flex-col gap-2">
            {DISCOVERIES.map((d) => (
              <li key={d.title} className="text-sm">
                <div className="text-ink">{d.title}</div>
                <div className="text-xs text-muted">{d.source}</div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card>
        <SectionLabel icon="🕑">{t("sections.activity")}</SectionLabel>
        <ul data-testid="recent-activity" className="flex flex-col gap-2">
          {ACTIVITY.map((a) => (
            <li key={a.title} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-ink">{a.title}</span>
              <span className="shrink-0 text-xs text-faint">{a.ago}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Fab href="/conciergerie" label={t("fab")} icon={<ConciergeBell size={22} />} />
    </main>
  );
}
```

- [ ] **Step 4: Vérifier (typecheck + lint + build + unit)**

Run: `npm run typecheck && npm run lint && npm run test && npm run build`
Expected: PASS (types/lint OK ; suite unitaire verte ; build OK).

- [ ] **Step 5: Commit**

```bash
git add src/features/shared/ui/Fab.tsx src/features/accueil/ui/HeroCard.tsx "src/app/[locale]/(app)/accueil/page.tsx"
git commit -m "feat(accueil): dashboard de référence (hero + sections + activité + FAB) + Fab href"
```

---

### Task 3: Repointage home → /accueil + e2e + maj des helpers de login

**Files:**
- Modify: `src/features/auth/data/actions.ts` (signIn/signUp → /accueil)
- Modify: `src/app/[locale]/page.tsx` (landing connecté → /accueil)
- Create: `e2e/accueil.spec.ts`
- Modify: tous les specs e2e existants dont le helper de login asserte `/restos` (→ `/accueil`)

**Interfaces:**
- Consumes : page `/accueil` (Task 2), testids `accueil`/`hero`/`kpi-tiles`/`recent-activity`.

- [ ] **Step 1: Repointer les redirections**

In `src/features/auth/data/actions.ts`, change BOTH redirects (in `signIn` and `signUp`) from
`redirect({ href: "/restos", locale })` to `redirect({ href: "/accueil", locale })`.
In `src/app/[locale]/page.tsx`, change the logged-in redirect from `redirect({ href: "/restos", locale })`
to `redirect({ href: "/accueil", locale })`.

- [ ] **Step 2: Écrire l'e2e du dashboard**

Create `e2e/accueil.spec.ts` :
```ts
import { test, expect, type Page } from "@playwright/test";

async function login(page: Page, email: string) {
  await page.goto("/fr/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill("password123");
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/fr\/accueil/);
}

test("après login on atterrit sur le dashboard", async ({ page }) => {
  await login(page, "client@vito.test");
  await expect(page.getByTestId("accueil")).toBeVisible();
  await expect(page.getByTestId("hero")).toBeVisible();
});

test("le dashboard montre salutation, KPI et activité", async ({ page }) => {
  await login(page, "client@vito.test");
  await expect(page.getByTestId("hero")).toContainText(/Bonjour|Bonsoir/);
  await expect(page.getByTestId("kpi-tiles").locator("> div")).toHaveCount(4);
  await expect(page.getByTestId("recent-activity")).toBeVisible();
  // FAB scoping au main pour éviter la collision avec le lien Conciergerie de la nav (hors main)
  await expect(page.getByTestId("accueil").getByRole("link", { name: "Demande de conciergerie" })).toBeVisible();
});
```

- [ ] **Step 3: Mettre à jour les helpers de login existants**

Run to locate them:
```bash
grep -rln 'toHaveURL(/\\/fr\\/restos' e2e/
```
In **every** matched spec (≈15), replace `await expect(page).toHaveURL(/\/fr\/restos/);` with
`await expect(page).toHaveURL(/\/fr\/accueil/);`. **If** a spec's test then exercises `/restos` content
directly after login (e.g. `e2e/restos.spec.ts`), add `await page.goto("/fr/restos");` right after the
login assertion so the test still lands where it expects. This is mechanical disambiguation — do NOT
weaken any assertion.

- [ ] **Step 4: e2e accueil + suite complète**

Run:
```bash
supabase db reset && npx playwright test e2e/accueil.spec.ts --retries=0
supabase db reset && npx playwright test --retries=0
```
Expected: accueil 2/2 ; suite complète verte (toutes les redirections post-login pointent `/accueil`).
Diagnostiquer tout échec résiduel (un spec qui présumait encore `/restos`).

- [ ] **Step 5: Commit**

```bash
git add src/features/auth/data/actions.ts "src/app/[locale]/page.tsx" e2e/
git commit -m "feat(accueil): /accueil devient la home post-login + e2e dashboard + maj helpers login"
```

---

## Notes d'exécution

- **Ordre** : T1 (i18n+greeting+mock) → T2 (Fab+HeroCard+page) → T3 (repointage+e2e).
- **Pas de migration.** Déploiement = merge → Vercel.
- **Repointage** : le post-login passe de `/restos` à `/accueil` → les ~15 helpers de login e2e doivent
  être mis à jour (T3 step 3) ; sinon la suite complète échoue. Désambiguïsation mécanique, jamais
  d'affaiblissement.
- **Collision FAB/nav** : le FAB pointe `/conciergerie` ; la sidebar a aussi un lien Conciergerie. L'e2e
  scope le FAB à `getByTestId("accueil")` (le main ; la nav est hors main).
- **Greeting** : heure serveur (imprécision de fuseau acceptée). `format.dateTime` locale-aware.
- **Données mockées** : `mock.ts` (placeholder) — câblage réel différé.
