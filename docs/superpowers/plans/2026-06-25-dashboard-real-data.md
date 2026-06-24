# Dashboard — branchement des vraies données Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer les données mockées du dashboard `/accueil` par de vraies requêtes RLS-scopées (KPI, à-faire, découvertes, activité récente).

**Architecture:** Un module `accueil/data/queries.ts` (server, sans `"use server"`) expose `getDashboardData()` qui exécute toutes les requêtes en parallèle et renvoie un objet typé. La page et `HeroCard` consomment ces vraies données. `mock.ts` est supprimé. Le temps relatif de l'activité est formaté dans la page via next-intl.

**Tech Stack:** Next.js 16, Supabase (RLS), next-intl, Vitest, Playwright.

## Global Constraints

- TS strict (`noUncheckedIndexedAccess`). Requêtes via le client de session (`createServerSupabase`) →
  RLS scope au user. Aucune lecture transverse, pas de migration, pas de RLS modifiée.
- Conserver les `data-testid` du dashboard (`accueil`, `hero`, `kpi-tiles`, `recent-activity`) →
  l'e2e accueil existant reste vert.
- Aucune chaîne UI en dur (next-intl, namespace `accueil`).
- Colonnes vérifiées : `liste_items(statut('a_faire'|'visite'), added_at, etablissement:etablissements(nom))` ;
  `degustations(deguste_le, created_at, vin:vins(nom))` ; `voyages(titre, statut, date_debut, created_at)` ;
  `depenses(libelle, montant_cents, date, created_at)` ; `conciergerie_demandes(statut('nouvelle'|'en_cours'|...))`.

---

### Task 1: Couche données `getDashboardData()` + `monthRange` (TDD)

**Files:**
- Create: `src/features/accueil/data/queries.ts` + `monthRange.test.ts`

**Interfaces:**
- Produces : `monthRange(now: Date): { start: string; end: string }` ; `getDashboardData()` →
  `{ kpis: { sorties; nouveauxRestos; vinsGoutes; depensesVoyageCents }; todo: { restosATester; voyagesAVenir; conciergerieEnAttente }; discoveries: { title; source }[]; activity: { type; label; at }[] }`.

- [ ] **Step 1: Test de `monthRange` (échec)**

Create `src/features/accueil/data/monthRange.test.ts` :
```ts
import { describe, it, expect } from "vitest";
import { monthRange } from "./queries";

describe("monthRange", () => {
  it("milieu de mois", () => {
    expect(monthRange(new Date("2026-06-15T10:00:00Z"))).toEqual({ start: "2026-06-01", end: "2026-07-01" });
  });
  it("décembre → janvier suivant", () => {
    expect(monthRange(new Date("2026-12-20T00:00:00Z"))).toEqual({ start: "2026-12-01", end: "2027-01-01" });
  });
  it("1er du mois", () => {
    expect(monthRange(new Date("2026-03-01T23:00:00Z"))).toEqual({ start: "2026-03-01", end: "2026-04-01" });
  });
});
```

- [ ] **Step 2: Lancer (échec)**

Run: `npx vitest run src/features/accueil/data/monthRange.test.ts` → FAIL.

- [ ] **Step 3: Implémenter `queries.ts`**

Create `src/features/accueil/data/queries.ts` :
```ts
import { createServerSupabase } from "@/lib/supabase/server";
import { rechercheRestos } from "@/features/reco/data/queries";

export function monthRange(now: Date): { start: string; end: string } {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { start: iso(new Date(Date.UTC(y, m, 1))), end: iso(new Date(Date.UTC(y, m + 1, 1))) };
}

type ActivityItem = { type: "resto" | "voyage" | "vin" | "depense"; label: string; at: string };

function embedName(v: unknown): string {
  // un embed supabase peut être un objet ou un tableau
  const e = Array.isArray(v) ? v[0] : v;
  return (e && typeof e === "object" && "nom" in e ? String((e as { nom: unknown }).nom) : "") || "";
}

export async function getDashboardData() {
  const supabase = await createServerSupabase();
  const now = new Date();
  const { start, end } = monthRange(now);
  const today = now.toISOString().slice(0, 10);

  const [
    sorties, nouveauxRestos, vinsGoutes, restosATester, voyagesAVenir, conciergerieEnAttente,
    depensesRes, recentRestos, recentVoyages, recentVins, recentDepenses, recos,
  ] = await Promise.all([
    supabase.from("liste_items").select("id", { count: "exact", head: true }).eq("statut", "visite").gte("added_at", start).lt("added_at", end),
    supabase.from("liste_items").select("id", { count: "exact", head: true }).gte("added_at", start).lt("added_at", end),
    supabase.from("degustations").select("id", { count: "exact", head: true }).gte("deguste_le", start).lt("deguste_le", end),
    supabase.from("liste_items").select("id", { count: "exact", head: true }).eq("statut", "a_faire"),
    supabase.from("voyages").select("id", { count: "exact", head: true }).in("statut", ["planifie", "confirme"]).gte("date_debut", today),
    supabase.from("conciergerie_demandes").select("id", { count: "exact", head: true }).in("statut", ["nouvelle", "en_cours"]),
    supabase.from("depenses").select("montant_cents").gte("date", start).lt("date", end),
    supabase.from("liste_items").select("added_at, etablissement:etablissements(nom)").order("added_at", { ascending: false }).limit(5),
    supabase.from("voyages").select("titre, created_at").order("created_at", { ascending: false }).limit(5),
    supabase.from("degustations").select("created_at, vin:vins(nom)").order("created_at", { ascending: false }).limit(5),
    supabase.from("depenses").select("libelle, created_at").order("created_at", { ascending: false }).limit(5),
    rechercheRestos({}).catch(() => ({ recos: [] as { nom: string; ville: string | null; type: string | null }[] })),
  ]);

  const depensesVoyageCents = (depensesRes.data ?? []).reduce((s, r) => s + Number(r.montant_cents), 0);

  const activity: ActivityItem[] = [
    ...(recentRestos.data ?? []).map((r) => ({ type: "resto" as const, label: embedName(r.etablissement), at: r.added_at })),
    ...(recentVoyages.data ?? []).map((r) => ({ type: "voyage" as const, label: r.titre, at: r.created_at })),
    ...(recentVins.data ?? []).map((r) => ({ type: "vin" as const, label: embedName(r.vin), at: r.created_at })),
    ...(recentDepenses.data ?? []).map((r) => ({ type: "depense" as const, label: r.libelle, at: r.created_at })),
  ]
    .filter((a) => a.label)
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, 6);

  const discoveries = (recos.recos ?? []).slice(0, 3).map((r) => ({
    title: r.nom,
    source: r.ville ?? r.type ?? "",
  }));

  return {
    kpis: {
      sorties: sorties.count ?? 0,
      nouveauxRestos: nouveauxRestos.count ?? 0,
      vinsGoutes: vinsGoutes.count ?? 0,
      depensesVoyageCents,
    },
    todo: {
      restosATester: restosATester.count ?? 0,
      voyagesAVenir: voyagesAVenir.count ?? 0,
      conciergerieEnAttente: conciergerieEnAttente.count ?? 0,
    },
    discoveries,
    activity,
  };
}
```
**Note implémenteur :** vérifier la signature exacte de `rechercheRestos` (`RechercheCriteria`) dans
`src/features/reco/data/queries.ts` — si un objet de critères vide `{}` n'est pas accepté, passer les
critères par défaut attendus (ou dériver des goûts via `getGouts`) et adapter le typage de `recos`. Le
typage de `r.recos` (nom/ville/type) doit correspondre au `RestoResult` réel ; ajuster si besoin (objectif :
top 3 `{ title, source }`). Régénérer/raisonner sur `database.types` pour les embeds `etablissement`/`vin`.

- [ ] **Step 4: Lancer (succès) + typecheck/lint**

Run: `npx vitest run src/features/accueil/data/monthRange.test.ts && npm run typecheck && npm run lint`
Expected: monthRange 3/3 ; typecheck/lint 0 (les embeds et counts typent ; ajuster `embedName`/types si le
typecheck remonte une forme d'embed différente).

- [ ] **Step 5: Commit**

```bash
git add src/features/accueil/data/
git commit -m "feat(accueil): getDashboardData (vraies requêtes RLS) + monthRange testé"
```

---

### Task 2: Câblage UI (page + HeroCard + i18n) + suppression mock

**Files:**
- Modify: `src/app/[locale]/(app)/accueil/page.tsx`, `src/features/accueil/ui/HeroCard.tsx`
- Modify: `messages/fr.json`, `messages/en.json`, `messages/it.json`, `messages/es.json`
- Delete: `src/features/accueil/mock.ts`

**Interfaces:**
- Consumes : `getDashboardData` (Task 1).

- [ ] **Step 1: i18n (4 locales)**

Dans l'objet `accueil` de chaque `messages/<loc>.json` : **retirer** `todo.vinsARacheter`, **ajouter**
`todo.conciergerieEnAttente`, et ajouter `activity.vide` + `discoveries.vide` :
- fr : `"conciergerieEnAttente": "Demandes en attente"` ; `"activity": { "vide": "Rien pour l'instant" }` ; `"discoveries": { "vide": "Aucune suggestion pour l'instant" }`
- en : `"Pending requests"` ; `"Nothing yet"` ; `"No suggestions yet"`
- it : `"Richieste in sospeso"` ; `"Niente per ora"` ; `"Nessun suggerimento per ora"`
- es : `"Solicitudes pendientes"` ; `"Nada por ahora"` ; `"Sin sugerencias por ahora"`
(JSON valide ; `sections.activity`/`sections.discoveries` existants restent inchangés — ne pas confondre
avec les nouvelles sous-clés `activity.vide`/`discoveries.vide`.)

- [ ] **Step 2: `HeroCard` prend `sorties` en prop**

In `src/features/accueil/ui/HeroCard.tsx` : remplacer l'import `SORTIES_THIS_MONTH` (de `../mock`) par une
prop `sorties: number`. La signature devient `HeroCard({ userName, sorties }: { userName: string; sorties: number })`
et le badge utilise `t("sortiesMois", { n: sorties })`. Le reste (greeting/date/quote) inchangé.

- [ ] **Step 3: Câbler la page sur les vraies données**

Replace the body of `src/app/[locale]/(app)/accueil/page.tsx` to use `getDashboardData()` (in addition to
the existing prénom fetch). Use `getFormatter` for relative activity time. Concretely:
```tsx
import { getTranslations, getFormatter } from "next-intl/server";
import { ConciergeBell } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { Link } from "@/lib/i18n/routing";
import { Card } from "@/features/shared/ui/Card";
import { SectionLabel } from "@/features/shared/ui/SectionLabel";
import { Tile } from "@/features/shared/ui/Tile";
import { Badge } from "@/features/shared/ui/Badge";
import { Fab } from "@/features/shared/ui/Fab";
import { HeroCard } from "@/features/accueil/ui/HeroCard";
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
  const todo = [
    { key: "restosATester", count: d.todo.restosATester },
    { key: "voyagesAVenir", count: d.todo.voyagesAVenir },
    { key: "conciergerieEnAttente", count: d.todo.conciergerieEnAttente },
  ];
  const kpis = [
    { key: "sorties", tone: "blue" as const, value: d.kpis.sorties },
    { key: "nouveauxRestos", tone: "green" as const, value: d.kpis.nouveauxRestos },
    { key: "vinsGoutes", tone: "violet" as const, value: d.kpis.vinsGoutes },
    { key: "depensesVoyage", tone: "amber" as const, value: `${Math.round(d.kpis.depensesVoyageCents / 100)} €` },
  ];
  const now = new Date();
  return (
    <main data-testid="accueil" className="flex flex-col gap-4 p-4 md:p-6">
      <HeroCard userName={userName} sorties={d.kpis.sorties} />
      <Link href="/restos" className="text-sm font-medium text-accent hover:underline">{t("addResto")}</Link>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <SectionLabel icon="✅">{t("sections.todo")}</SectionLabel>
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
          <SectionLabel icon="📊">{t("sections.month")}</SectionLabel>
          <div data-testid="kpi-tiles" className="grid grid-cols-2 gap-3">
            {kpis.map((k) => (
              <Tile key={k.key} tone={k.tone} label={t(`kpi.${k.key}`)} value={k.value} />
            ))}
          </div>
        </Card>

        <Card>
          <SectionLabel icon="✨">{t("sections.discoveries")}</SectionLabel>
          {d.discoveries.length === 0 ? (
            <p className="text-sm text-muted">{t("discoveries.vide")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {d.discoveries.map((x) => (
                <li key={x.title} className="text-sm">
                  <div className="text-ink">{x.title}</div>
                  <div className="text-xs text-muted">{x.source}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <SectionLabel icon="🕑">{t("sections.activity")}</SectionLabel>
        {d.activity.length === 0 ? (
          <p data-testid="recent-activity" className="text-sm text-muted">{t("activity.vide")}</p>
        ) : (
          <ul data-testid="recent-activity" className="flex flex-col gap-2">
            {d.activity.map((a, i) => (
              <li key={`${a.type}-${i}`} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-ink">{a.label}</span>
                <span className="shrink-0 text-xs text-faint">{format.relativeTime(new Date(a.at), now)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Fab href="/conciergerie" label={t("fab")} icon={<ConciergeBell size={22} />} />
    </main>
  );
}
```
(`data-testid="recent-activity"` est présent dans **les deux** branches — l'e2e le trouve même à vide.)

- [ ] **Step 4: Supprimer le mock**

Run: `git rm src/features/accueil/mock.ts`
(Vérifier qu'aucun autre fichier n'importe `@/features/accueil/mock` : `grep -rn "accueil/mock" src/` → vide.)

- [ ] **Step 5: Vérifier (typecheck + lint + unit + build)**

Run: `npm run typecheck && npm run lint && npm run test && npm run build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add "src/app/[locale]/(app)/accueil/page.tsx" src/features/accueil/ui/HeroCard.tsx messages/
git commit -m "feat(accueil): dashboard sur vraies données (KPI/à-faire/découvertes/activité) + i18n + suppression mock"
```

---

### Task 3: e2e + non-régression

**Files:**
- Modify (si besoin) : `e2e/accueil.spec.ts`

**Interfaces:**
- Consumes : dashboard réel, testids `accueil`/`hero`/`kpi-tiles`/`recent-activity`.

- [ ] **Step 1: Vérifier/ajuster l'e2e accueil**

`e2e/accueil.spec.ts` (Slice C) asserte : login → `/accueil`, `hero` visible + `/Bonjour|Bonsoir/`,
`kpi-tiles` a 4 enfants, `recent-activity` visible, FAB. Ces assertions **restent valides** en données
réelles (4 tuiles toujours rendues ; `recent-activity` rendu même à vide). Lancer tel quel ; **n'ajuster
le spec que si une assertion devient invalide** (et alors corriger sans affaiblir — ex. cibler la section
plutôt qu'un compte précis qui dépend du seed). Ne PAS asserter de valeur chiffrée dépendante du seed.

- [ ] **Step 2: e2e accueil + suite complète**

Run:
```bash
supabase db reset && npx playwright test e2e/accueil.spec.ts --retries=0
supabase db reset && npx playwright test --retries=0
```
Expected: accueil vert ; suite complète verte. (Retry une fois si le webServer échoue à démarrer.)
Diagnostiquer tout échec : une vraie requête casse-t-elle (embed/colonne) ? Corriger la requête (Task 1),
pas le test.

- [ ] **Step 3: Commit (si ajustement e2e)**

```bash
git add e2e/accueil.spec.ts && git commit -m "test(accueil): e2e dashboard données réelles" # seulement si modifié
```

---

## Notes d'exécution

- **Ordre** : T1 (données + monthRange) → T2 (UI + i18n + suppr mock) → T3 (e2e).
- **Pas de migration.** Déploiement = merge → Vercel.
- **Point d'intégration à confirmer par l'implémenteur** : la signature de `rechercheRestos` et la forme
  de `RestoResult` (pour les découvertes) + les noms d'embeds (`etablissement`/`vin`) via `database.types`.
  Ajuster le code si la forme réelle diffère ; objectif inchangé (top 3 `{title, source}`, activité
  `{type,label,at}`).
- **Seed** : `db reset` pose `added_at`/dates à « maintenant » → les compteurs « ce mois » sont non nuls
  pour les données seed ; l'e2e n'asserte que la structure (pas les valeurs).
