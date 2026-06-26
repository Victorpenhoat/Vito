# Slice 6 — Dépenses « Le Carnet » Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-skinner l'écran Dépenses (liste des comptes + détail Détail/Total/Équilibre) au style Le Carnet, sans casser l'e2e, sans migration.

**Architecture:** Re-skin présentationnel : `getGroupeDetail`/`getMesGroupes` inchangés. Liste = en-tête + cartes ; détail = en-tête éditorial + 2 colonnes (Détail des dépenses / aside Total + Équilibre + Remboursement + Membres). Total calculé localement depuis les dépenses chargées. Soldes colorés par signe.

**Tech Stack:** Next.js 16 (Server Components + une liste client), Tailwind v4, next-intl (fr/en/it/es), Vitest, Playwright.

## Global Constraints

- **Pas de migration, pas de photo.** Re-skin présentationnel.
- **e2e `depenses.spec.ts` vert SANS modification** : préserver `groupe-form`, `groupe-card` (+ lien), `depense-form` (input `name="libelle"`/`name="montant"`), `depense-row`, `soldes-panel`, `solde-row`, `transfert-row`, `solde-regle`. Sous-composants `DepenseForm`/`RemboursementForm`/`MembersList`/`ShareForm` montés inchangés.
- Fondations Slices 0-5 (`font-serif`, `text-faint`, `text-muted`, `border-line`, `border-line-soft`, `rounded-card`, tokens `--kpi-green`/`--kpi-amber`, kit `PageHeader`/`SectionLabel`/`Card`/`Button`).
- `formatCents(cents: number, devise: string): string` (existant).
- Parité i18n (4 locales) garantie par `messages-parity.test.ts`. Pas de chaîne en dur.
- TS strict (`noUncheckedIndexedAccess`).
- Réf. spec : `docs/superpowers/specs/2026-06-26-carnet-slice-6-depenses-design.md`.

---

### Task 1: i18n + liste (GroupesList + page)

**Files:**
- Modify: `messages/fr.json`, `messages/en.json`, `messages/it.json`, `messages/es.json`
- Modify: `src/features/depenses/ui/GroupesList.tsx`
- Modify: `src/app/[locale]/(app)/depenses/page.tsx`

**Interfaces:**
- Produces : clés `depenses.eyebrow/total/parPersonne/equilibre` (consommées en Task 2).

- [ ] **Step 1: Ajouter les 4 clés i18n (4 locales)**

Sous l'objet `depenses` de chaque locale :
- fr : `"eyebrow":"Comptes partagés"`, `"total":"Total du séjour"`, `"parPersonne":"{montant} par personne"`, `"equilibre":"Équilibre"`
- en : `"eyebrow":"Shared accounts"`, `"total":"Trip total"`, `"parPersonne":"{montant} per person"`, `"equilibre":"Balance"`
- it : `"eyebrow":"Conti condivisi"`, `"total":"Totale soggiorno"`, `"parPersonne":"{montant} a persona"`, `"equilibre":"Bilancio"`
- es : `"eyebrow":"Cuentas compartidas"`, `"total":"Total del viaje"`, `"parPersonne":"{montant} por persona"`, `"equilibre":"Balance"`

- [ ] **Step 2: Vérifier la parité**

Run: `npm run test -- messages-parity`
Expected: PASS.

- [ ] **Step 3: Réécrire `GroupesList.tsx` (cartes)**

```tsx
import { getMesGroupes } from "../data/queries";
import { Link } from "@/lib/i18n/routing";
import { getTranslations } from "next-intl/server";

export async function GroupesList() {
  const t = await getTranslations("depenses");
  const groupes = await getMesGroupes();
  if (groupes.length === 0) return <p className="text-sm text-muted">{t("vide")}</p>;
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {groupes.map((g) => (
        <li key={g.id} data-testid="groupe-card">
          <Link href={`/depenses/${g.id}`} className="block rounded-card border border-line bg-surface p-5">
            <span className="block font-serif text-xl font-medium text-ink">{g.titre}</span>
            <span className="text-sm text-muted">{g.devise}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 4: Recomposer `depenses/page.tsx` (eyebrow)**

```tsx
import { getTranslations } from "next-intl/server";
import { GroupeForm } from "@/features/depenses/ui/GroupeForm";
import { GroupesList } from "@/features/depenses/ui/GroupesList";
import { getMesVoyages } from "@/features/voyages/data/queries";
import { PageHeader } from "@/features/shared/ui/PageHeader";

export default async function DepensesPage() {
  const t = await getTranslations("depenses");
  const voyages = (await getMesVoyages()).map((v) => ({ id: v.id, titre: v.titre }));
  return (
    <main className="flex flex-col gap-6 p-4 md:p-8">
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} />
      <GroupeForm voyages={voyages} />
      <GroupesList />
    </main>
  );
}
```

- [ ] **Step 5: Vérifier**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add messages/fr.json messages/en.json messages/it.json messages/es.json src/features/depenses/ui/GroupesList.tsx "src/app/[locale]/(app)/depenses/page.tsx"
git commit -m "feat(carnet,depenses): liste comptes (cartes + en-tête) + i18n"
```

---

### Task 2: Détail — GroupeDetail (2 colonnes + total) + DepensesList + SoldesPanel

**Files:**
- Modify: `src/features/depenses/ui/GroupeDetail.tsx`
- Modify: `src/features/depenses/ui/DepensesList.tsx`
- Modify: `src/features/depenses/ui/SoldesPanel.tsx`

**Interfaces:**
- Consumes : `getGroupeDetail` (inchangé), `formatCents`, clés `depenses.*` (dont Task 1), kit `Card`/`SectionLabel`/`Button`.

- [ ] **Step 1: Réécrire `DepensesList.tsx` (re-skin, `depense-row` + delete conservés)**

```tsx
"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { deleteDepense } from "../data/actions";
import { formatCents } from "../domain/money";
import { Button } from "@/features/shared/ui/Button";

type Depense = { id: string; paye_par: string; libelle: string; montant_cents: number; date: string | null; mode: string };

export function DepensesList({ groupeId, depenses, devise, nameById }: {
  groupeId: string;
  depenses: Depense[];
  devise: string;
  nameById: Record<string, string>;
}) {
  const t = useTranslations("depenses");
  const [, action] = useActionState(deleteDepense, undefined);
  return (
    <ul className="flex flex-col">
      {depenses.map((d) => (
        <li key={d.id} data-testid="depense-row" className="flex items-center justify-between gap-3 border-b border-line-soft py-3">
          <div className="min-w-0">
            <div className="text-ink">{d.libelle}</div>
            <div className="text-xs text-muted">{t("payePar")} {nameById[d.paye_par] ?? d.paye_par}{d.date ? ` · ${d.date}` : ""}</div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="font-serif text-lg text-ink">{formatCents(d.montant_cents, devise)}</span>
            <form action={action}>
              <input type="hidden" name="depenseId" value={d.id} />
              <input type="hidden" name="groupeId" value={groupeId} />
              <Button type="submit" variant="ghost" className="px-2 py-1 text-xs">{t("supprimer")}</Button>
            </form>
          </div>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 2: Réécrire `SoldesPanel.tsx` (re-skin, testids conservés, soldes colorés)**

```tsx
import { getTranslations } from "next-intl/server";
import { formatCents } from "../domain/money";
import { SectionLabel } from "@/features/shared/ui/SectionLabel";
import type { Balance, Transfert } from "../domain/calculations";

export async function SoldesPanel({ soldes, transferts, devise, nameById }: {
  soldes: Balance[];
  transferts: Transfert[];
  devise: string;
  nameById: Record<string, string>;
}) {
  const t = await getTranslations("depenses");
  return (
    <section data-testid="soldes-panel" className="flex flex-col gap-2">
      <SectionLabel>{t("equilibre")}</SectionLabel>
      <ul className="flex flex-col">
        {soldes.map((s) => (
          <li key={s.profileId} data-testid="solde-row" className="flex items-center justify-between border-b border-line-soft py-2 text-sm">
            <span className="text-ink">{nameById[s.profileId] ?? s.profileId}</span>
            <span className={`font-semibold ${s.soldeCents >= 0 ? "text-kpi-green" : "text-kpi-amber"}`}>{formatCents(s.soldeCents, devise)}</span>
          </li>
        ))}
      </ul>
      <h3 className="mt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">{t("transferts")}</h3>
      {transferts.length === 0 ? (
        <p data-testid="solde-regle" className="text-sm text-muted">{t("regle")}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {transferts.map((tr, i) => (
            <li key={i} data-testid="transfert-row" className="text-sm text-muted">
              {nameById[tr.deProfileId] ?? tr.deProfileId} {t("transfertVers")} <span className="font-semibold text-ink">{formatCents(tr.montantCents, devise)}</span> {t("vers").toLowerCase()} {nameById[tr.versProfileId] ?? tr.versProfileId}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 3: Réécrire `GroupeDetail.tsx` (en-tête + 2 colonnes + total)**

```tsx
import { getTranslations } from "next-intl/server";
import { getGroupeDetail } from "../data/queries";
import { formatCents } from "../domain/money";
import { DepenseForm } from "./DepenseForm";
import { DepensesList } from "./DepensesList";
import { SoldesPanel } from "./SoldesPanel";
import { RemboursementForm } from "./RemboursementForm";
import { MembersList } from "./MembersList";
import { ShareForm } from "./ShareForm";
import { Card } from "@/features/shared/ui/Card";
import { SectionLabel } from "@/features/shared/ui/SectionLabel";

export async function GroupeDetail({ id }: { id: string }) {
  const t = await getTranslations("depenses");
  const { groupe, membres, depenses, soldes, transferts, isOwner } = await getGroupeDetail(id);
  const nameById = Object.fromEntries(membres.map((m) => [m.profile_id, m.display_name ?? m.profile_id]));
  const membresSimple = membres.map((m) => ({ profile_id: m.profile_id, display_name: m.display_name }));
  const total = depenses.reduce((s, d) => s + d.montant_cents, 0);
  const parPersonne = Math.round(total / Math.max(membres.length, 1));
  return (
    <article className="flex flex-col gap-6">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">{t("eyebrow")}</p>
        <h1 className="font-serif text-3xl font-medium text-ink">{groupe.titre}</h1>
      </header>

      <div className="grid gap-6 md:grid-cols-[1fr_320px]">
        <section>
          <SectionLabel>{t("depenses")}</SectionLabel>
          <DepensesList groupeId={groupe.id} depenses={depenses} devise={groupe.devise} nameById={nameById} />
          <DepenseForm groupeId={groupe.id} membres={membresSimple} />
        </section>

        <aside className="flex flex-col gap-6">
          <Card>
            <SectionLabel>{t("total")}</SectionLabel>
            <div className="font-serif text-3xl font-medium text-ink">{formatCents(total, groupe.devise)}</div>
            <div className="mt-1 text-sm text-muted">{t("parPersonne", { montant: formatCents(parPersonne, groupe.devise) })}</div>
          </Card>
          <Card>
            <SoldesPanel soldes={soldes} transferts={transferts} devise={groupe.devise} nameById={nameById} />
          </Card>
          <Card>
            <SectionLabel>{t("remboursement")}</SectionLabel>
            <RemboursementForm groupeId={groupe.id} membres={membresSimple} />
          </Card>
          <Card>
            <SectionLabel>{t("membres")}</SectionLabel>
            <MembersList groupeId={groupe.id} membres={membres} isOwner={isOwner} />
            {isOwner && <ShareForm groupeId={groupe.id} />}
          </Card>
        </aside>
      </div>
    </article>
  );
}
```

- [ ] **Step 4: Vérifier typecheck + lint + unit**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS.

- [ ] **Step 5: e2e dépenses (non-régression ciblée)**

Run: `supabase db reset && npx playwright test e2e/depenses.spec.ts --retries=0`
Expected: PASS sans modifier le spec (création groupe `groupe-card`, ajout dépense `depense-row`, soldes `soldes-panel`/`solde-row`/`transfert-row`/`solde-regle`). Retry une fois si le webServer échoue.

- [ ] **Step 6: Commit**

```bash
git add src/features/depenses/ui/GroupeDetail.tsx src/features/depenses/ui/DepensesList.tsx src/features/depenses/ui/SoldesPanel.tsx
git commit -m "feat(carnet,depenses): détail en 2 colonnes (Détail / Total / Équilibre coloré)"
```

---

### Task 3: Non-régression complète + build

- [ ] **Step 1: Suite e2e complète + build**

Run: `supabase db reset && npx playwright test --retries=0 && npm run build`
Expected: suite complète **verte sans modifier les specs** + build OK. Un seul `db reset` avant. Si un spec casse, corriger le composant (testid/flux), **pas** le test. Retry une fois si le webServer échoue.

- [ ] **Step 2: Commit (si correctifs)**

```bash
git add -A && git commit -m "fix(carnet,depenses): correctifs non-régression Slice 6" # seulement si nécessaire
```

---

## Notes d'exécution

- **Ordre** : T1 (i18n + liste) → T2 (détail) → T3 (non-régression).
- **Prod** : aucune migration. Au « go prod » : merge → Vercel redéploie `main`.
- **Filet** : si un e2e casse, c'est un testid/flux modifié par inadvertance → réparer le composant, jamais le test.
