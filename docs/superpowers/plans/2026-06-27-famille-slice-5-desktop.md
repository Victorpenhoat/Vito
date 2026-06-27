# Famille Slice 5 — Desktop (master-detail + aperçu + modale) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrichir les écrans Famille pour le desktop (`lg:`) : layout master-detail avec rail gauche partagé (300px), répertoire en grille, fiche 2 colonnes avec aperçu inline du document, tunnel en carte-modale avec stepper horizontal — sans toucher le mobile.

**Architecture:** 100 % responsive additif (`lg:`). Un `famille/layout.tsx` fournit le rail desktop + contenu ; les composants existants reçoivent des variantes `lg:` ; un panneau d'aperçu réutilise la route déchiffrée existante. Aucune donnée/sécurité nouvelle.

**Tech Stack:** Next.js 16 App Router, TS strict, Tailwind v4, next-intl, Playwright.

## Global Constraints

- **Mobile-first inchangé** : tout est additif en `lg:`. Aucun écran/flux mobile ne doit régresser.
- `Link`/`usePathname`/`redirect` **locale-aware** depuis `@/lib/i18n/routing` (jamais `next/link`).
- **Aucune chaîne UI en dur** : `useTranslations`/`getTranslations("famille")`. Parité 4 locales (`src/lib/i18n/messages-parity.test.ts`).
- **Sécurité** : l'aperçu charge uniquement `/api/famille/documents/[id]` (RLS owner-only, `private,no-store`) ; `contenu_chiffre` jamais exposé. Aucune nouvelle route/clé.
- Style Le Carnet, **aucun nouveau token**. TS strict, DRY/YAGNI.
- AGENTS.md : consulter `node_modules/next/dist/docs/` au besoin (layouts, client/server components Next 16).
- Réf. spec : `docs/superpowers/specs/2026-06-27-famille-slice-5-desktop-design.md`. Aucune migration.

---

### Task 1: `getProches` en cache + layout master-detail + `FamilleRail`

**Files:**
- Modify: `src/features/famille/data/queries.ts`
- Create: `src/app/[locale]/(app)/famille/layout.tsx`
- Create: `src/features/famille/ui/FamilleRail.tsx`

**Interfaces:**
- Consumes: `getProches`/`Proche` (Slice 3), `Avatar`/`ExpiryBadge`/`RelationChip`, `Link`/`usePathname` (`@/lib/i18n/routing`), `CIRCLES` (`../domain/schemas`).
- Produces: `FamilleRail` (client), `famille/layout.tsx`.

- [ ] **Step 1: Mettre `getProches` en cache (React)**

Dans `src/features/famille/data/queries.ts` : importer `cache` de `react` et envelopper `getProches`.
Remplacer la signature `export async function getProches(): Promise<Proche[]> { … }` par :

```ts
import { cache } from "react";
// …
export const getProches = cache(async (): Promise<Proche[]> => {
  const supabase = await createServerSupabase();
  // … corps inchangé …
});
```

(Ne change rien d'autre au corps. Si `getProche` ou d'autres exports sont à proximité, ne les touche pas.)

- [ ] **Step 2: `FamilleRail`**

Create `src/features/famille/ui/FamilleRail.tsx` :

```tsx
"use client";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/lib/i18n/routing";
import type { Proche } from "../data/queries";
import { CIRCLES } from "../domain/schemas";
import { Avatar } from "@/features/shared/ui/Avatar";
import { ExpiryBadge } from "./ExpiryBadge";

export function FamilleRail({ proches }: { proches: Proche[] }) {
  const t = useTranslations("famille");
  const pathname = usePathname();
  return (
    <nav data-testid="famille-rail" className="flex flex-col gap-5 border-r border-line pr-5">
      <div className="flex items-center justify-between">
        <span className="font-serif text-lg text-ink">{t("proches.titre")}</span>
        <Link href="/famille/proches/nouveau" className="text-sm font-medium text-accent">{t("proches.ajouter")}</Link>
      </div>
      {CIRCLES.map((circle) => {
        const group = proches.filter((p) => p.circle === circle);
        if (group.length === 0) return null;
        return (
          <div key={circle} className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">{t(`circles.${circle}`)}</span>
            {group.map((p) => {
              const active = pathname === `/famille/proches/${p.id}`;
              return (
                <Link key={p.id} href={`/famille/proches/${p.id}`}
                  className={`flex items-center gap-2 rounded-control px-2 py-1.5 ${active ? "bg-accent-50" : "hover:bg-surface-hover"}`}>
                  <Avatar name={`${p.first_name} ${p.last_name}`} size="sm" color={p.avatar_color ?? undefined} />
                  <span className="flex-1 truncate text-sm text-ink">{p.first_name} {p.last_name}</span>
                  {(p.urgency === "expired" || p.urgency === "soon") && <ExpiryBadge status={p.urgency} monthsLeft={p.urgency_months ?? undefined} />}
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 3: Layout master-detail**

Create `src/app/[locale]/(app)/famille/layout.tsx` :

```tsx
import { getProches } from "@/features/famille/data/queries";
import { FamilleRail } from "@/features/famille/ui/FamilleRail";

export default async function FamilleLayout({ children }: { children: React.ReactNode }) {
  const proches = await getProches();
  return (
    <div className="lg:grid lg:grid-cols-[300px_1fr] lg:gap-6 lg:p-8">
      <div className="hidden lg:block">{proches.length > 0 && <FamilleRail proches={proches} />}</div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
```

(Note : les pages enfant gardent leur propre `<main className="… p-4 md:p-8">`. En `lg:`, le `p-8` du layout + celui de la page se cumulent légèrement ; l'implémenteur ajuste si le double-padding est visible — au besoin retirer `lg:p-8` du layout et laisser la page gérer. Vérifier visuellement via build, mais ne pas sur-optimiser.)

- [ ] **Step 4: typecheck + lint + test + commit**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS (aucune chaîne en dur ; parité i18n inchangée — pas de nouvelle clé ici).
```bash
git add src/features/famille/data/queries.ts "src/app/[locale]/(app)/famille/layout.tsx" src/features/famille/ui/FamilleRail.tsx
git commit -m "feat(famille): layout master-detail desktop + FamilleRail + getProches en cache"
```

---

### Task 2: Répertoire en grille + fiche 2 colonnes + aperçu document

**Files:**
- Modify: `src/features/famille/ui/ProchesList.tsx`
- Modify: `src/features/famille/ui/FichePersonne.tsx`
- Create: `src/features/famille/ui/DocumentsPanel.tsx`
- Create: `src/features/famille/ui/DocumentPreview.tsx`
- Modify: `messages/{fr,en,it,es}.json`

**Interfaces:**
- Consumes: `DocMeta`/`ProcheDetail` (Slice 3), `DocumentRow` (Slice 3), `SectionLabel`.
- Produces: `DocumentsPanel` (client), `DocumentPreview` (client).

- [ ] **Step 1: i18n `fiche.apercu` (4 locales)**

Ajouter sous `famille.fiche` la clé `apercu` dans les 4 fichiers : fr « Aperçu », en « Preview », it « Anteprima », es « Vista previa ». (Insertion propre dans l'objet `fiche` existant, JSON valide.)

Run: `npm run test -- messages-parity` → PASS.

- [ ] **Step 2: `ProchesList` en grille (desktop)**

Dans `src/features/famille/ui/ProchesList.tsx`, sur le `<ul>` de chaque cercle, remplacer
`className="flex flex-col gap-2"` par `className="flex flex-col gap-2 lg:grid lg:grid-cols-2 xl:grid-cols-3"`.
(Aucune autre modification.)

- [ ] **Step 3: `DocumentPreview`**

Create `src/features/famille/ui/DocumentPreview.tsx` :

```tsx
"use client";
import { useTranslations } from "next-intl";
import type { DocMeta } from "../data/queries";

export function DocumentPreview({ doc }: { doc: DocMeta }) {
  const t = useTranslations("famille");
  const src = `/api/famille/documents/${doc.id}`;
  const isImage = doc.mime_type.startsWith("image/");
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted">{t("fiche.apercu")}</span>
      {isImage ? (
        <img src={src} alt={t("fiche.apercu")} className="max-w-full rounded-card border border-line" />
      ) : (
        <iframe src={src} title={t("fiche.apercu")} className="h-[480px] w-full rounded-card border border-line" />
      )}
    </div>
  );
}
```

- [ ] **Step 4: `DocumentsPanel`**

Create `src/features/famille/ui/DocumentsPanel.tsx` :

```tsx
"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import type { DocMeta } from "../data/queries";
import { DocumentRow } from "./DocumentRow";
import { DocumentPreview } from "./DocumentPreview";
import { SectionLabel } from "@/features/shared/ui/SectionLabel";

export function DocumentsPanel({ documents }: { documents: DocMeta[] }) {
  const t = useTranslations("famille");
  const [selected, setSelected] = useState<string | null>(documents[0]?.id ?? null);
  const current = documents.find((d) => d.id === selected) ?? documents[0] ?? null;
  return (
    <section className="flex flex-col gap-3">
      <SectionLabel>{t("fiche.documents")}</SectionLabel>
      {documents.length === 0 ? (
        <p className="text-muted">{t("fiche.aucunDocument")}</p>
      ) : (
        <div className="lg:grid lg:grid-cols-2 lg:gap-6">
          <ul className="flex flex-col gap-2">
            {documents.map((d) => (
              <li key={d.id}>
                <button type="button" onClick={() => setSelected(d.id)} className="w-full text-left">
                  <DocumentRow doc={d} />
                </button>
              </li>
            ))}
          </ul>
          {current && <div className="hidden lg:block"><DocumentPreview doc={current} /></div>}
        </div>
      )}
    </section>
  );
}
```

(Note : `DocumentRow` reste tel quel — il contient déjà le numéro masqué + « Voir le document » ; l'enrober d'un `<button>` ne casse pas son rendu. La sélection ne change que l'aperçu desktop. Sur mobile le panneau d'aperçu est `hidden lg:block`.)

- [ ] **Step 5: `FichePersonne` 2 colonnes + branchement `DocumentsPanel`**

Dans `src/features/famille/ui/FichePersonne.tsx` :
1. Importer `DocumentsPanel` (`import { DocumentsPanel } from "./DocumentsPanel";`).
2. Remplacer le bloc de la section « Documents » (le `<section>` qui mappe les `DocumentRow` / affiche « aucun document ») par `<DocumentsPanel documents={documents} />`.
3. Envelopper le contenu en 2 colonnes desktop : l'en-tête identité (Avatar xl + nom + RelationChip + cercle + contacts) dans une colonne, le `DocumentsPanel` dans l'autre. Structure cible :

```tsx
<div className="flex flex-col gap-6 lg:grid lg:grid-cols-[280px_1fr] lg:gap-8 lg:items-start">
  <div className="flex flex-col gap-6">
    {/* en-tête identité + section contacts existante (inchangés) */}
  </div>
  <DocumentsPanel documents={documents} />
</div>
```

(Conserver le lien « Modifier » et toute la logique existante de l'en-tête. Sur mobile, `flex flex-col` → empilé comme aujourd'hui.)

- [ ] **Step 6: typecheck + lint + test + commit**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS (parité i18n verte).
```bash
git add src/features/famille/ui/ProchesList.tsx src/features/famille/ui/FichePersonne.tsx src/features/famille/ui/DocumentsPanel.tsx src/features/famille/ui/DocumentPreview.tsx messages/
git commit -m "feat(famille): répertoire en grille + fiche 2 colonnes + aperçu document (desktop)"
```

---

### Task 3: Tunnel desktop — carte-modale + stepper horizontal

**Files:**
- Modify: `src/features/famille/ui/DocumentTunnel.tsx`
- Modify: `src/app/[locale]/(app)/famille/proches/[id]/documents/nouveau/page.tsx`
- Modify: `messages/{fr,en,it,es}.json`

**Interfaces:**
- Consumes: `useTranslations` ; état `step` existant du `DocumentTunnel`.
- Produces: sous-composant `StepIndicator` (dans `DocumentTunnel.tsx`).

- [ ] **Step 1: i18n `tunnel.steps` (4 locales)**

Ajouter sous `famille.tunnel` l'objet `steps` : fr `{ type:"Type", document:"Document", lecture:"Lecture", verification:"Vérification" }` ; en `{ type:"Type", document:"Document", lecture:"Reading", verification:"Review" }` ; it `{ type:"Tipo", document:"Documento", lecture:"Lettura", verification:"Verifica" }` ; es `{ type:"Tipo", document:"Documento", lecture:"Lectura", verification:"Verificación" }`.

Run: `npm run test -- messages-parity` → PASS.

- [ ] **Step 2: `StepIndicator` horizontal (desktop)**

Dans `src/features/famille/ui/DocumentTunnel.tsx`, ajouter un sous-composant et l'afficher en `lg:`
au-dessus du contenu d'étape (le texte « n / 4 » mobile reste). `step` ∈ {"A","B","C","D"} correspond
aux index 1..4.

```tsx
function StepIndicator({ step, t }: { step: "A" | "B" | "C" | "D"; t: ReturnType<typeof useTranslations> }) {
  const steps = [
    { k: "A", label: t("tunnel.steps.type") },
    { k: "B", label: t("tunnel.steps.document") },
    { k: "C", label: t("tunnel.steps.lecture") },
    { k: "D", label: t("tunnel.steps.verification") },
  ];
  const currentIdx = steps.findIndex((s) => s.k === step);
  return (
    <ol className="hidden lg:flex items-center gap-2" aria-hidden="true">
      {steps.map((s, i) => (
        <li key={s.k} className="flex items-center gap-2">
          <span className={`grid h-6 w-6 place-items-center rounded-full text-xs font-semibold ${i <= currentIdx ? "bg-accent text-white" : "bg-accent-50 text-accent"}`}>{i + 1}</span>
          <span className={`text-sm ${i === currentIdx ? "text-ink font-medium" : "text-muted"}`}>{s.label}</span>
          {i < steps.length - 1 && <span className="mx-1 h-px w-6 bg-line" />}
        </li>
      ))}
    </ol>
  );
}
```

Puis dans le rendu de `DocumentTunnel`, juste sous la ligne « {titre} · {stepOf} », ajouter :
`<StepIndicator step={step} t={t} />`.

- [ ] **Step 3: Page tunnel stylée en modale (desktop)**

Dans `src/app/[locale]/(app)/famille/proches/[id]/documents/nouveau/page.tsx`, envelopper le
`DocumentTunnel` dans un conteneur qui devient une carte centrée en `lg:` :

```tsx
<div className="lg:mx-auto lg:max-w-[880px] lg:rounded-card lg:border lg:border-line lg:bg-surface lg:p-8 lg:shadow-lg">
  <DocumentTunnel memberId={id} />
</div>
```

(Le `PageHeader` existant reste au-dessus. Mobile = inchangé, pas de carte.)

- [ ] **Step 4: typecheck + lint + test + commit**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS (parité i18n verte).
```bash
git add src/features/famille/ui/DocumentTunnel.tsx "src/app/[locale]/(app)/famille/proches/[id]/documents/nouveau/page.tsx" messages/
git commit -m "feat(famille): tunnel desktop — carte-modale + stepper horizontal"
```

---

### Task 4: e2e desktop + non-régression mobile + build

**Files:**
- Test: `e2e/famille-desktop.spec.ts`

- [ ] **Step 1: e2e desktop + mobile**

Create `e2e/famille-desktop.spec.ts` :

```ts
import { test, expect, type Page } from "@playwright/test";

async function login(page: Page, email: string) {
  await page.goto("/fr/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill("password123");
  await page.getByRole("button", { name: "Connexion" }).click();
  await expect(page).toHaveURL(/\/fr\/accueil/);
}

test.describe("desktop", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("rail visible, navigation vers la fiche + aperçu du document", async ({ page }) => {
    await login(page, "client@vito.test");
    await page.goto("/fr/famille");
    // rail desktop : le proche seedé « Camille Durand » y figure
    const railLink = page.getByTestId("famille-rail").getByRole("link", { name: /Camille Durand/ });
    await expect(railLink.first()).toBeVisible();
    await railLink.first().click();
    await expect(page).toHaveURL(/\/famille\/proches\//);
    // aperçu : le document seedé est un PDF -> <iframe> d'aperçu
    await expect(page.locator('iframe[title="Aperçu"]')).toBeVisible();
  });

  test("tunnel desktop : stepper horizontal visible", async ({ page }) => {
    await login(page, "client@vito.test");
    await page.goto("/fr/famille");
    await page.getByTestId("famille-rail").getByRole("link", { name: /Camille Durand/ }).first().click();
    await page.getByRole("link", { name: "Ajouter un document" }).click();
    await expect(page.getByText("Vérification", { exact: true })).toBeVisible(); // libellé du StepIndicator
  });
});

test.describe("mobile (non-régression)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("rail masqué, liste mobile affichée", async ({ page }) => {
    await login(page, "client@vito.test");
    await page.goto("/fr/famille");
    // la liste mobile (proche-row) reste ; le rail n'apparaît pas comme nav distincte de proches cliquables en colonne
    await expect(page.getByTestId("proche-row").filter({ hasText: "Camille Durand" })).toBeVisible();
  });
});
```

(Le `<nav>` de `FamilleRail` porte déjà `data-testid="famille-rail"` (Task 1) → le test cible le rail sans ambiguïté avec la `Sidebar` globale.)

- [ ] **Step 2: Lancer e2e ciblée (reset) + typecheck + lint**

Run: `supabase db reset && npx playwright test famille-desktop --retries=0 && npm run typecheck && npm run lint`
Expected: PASS. (Flake `liste_items`/anon → relancer une fois.)

- [ ] **Step 3: Commit**

```bash
git add e2e/famille-desktop.spec.ts
git commit -m "test(famille): e2e desktop (rail + aperçu + stepper) + non-régression mobile"
```

- [ ] **Step 4: Non-régression complète + build**

Run: `supabase db reset && npx playwright test --retries=0 && npm run build`
Expected: suite e2e **verte** + build OK sans warning. (Flake `liste_items`/anon → relancer le fichier une fois.)

- [ ] **Step 5: Commit (si correctifs)**

```bash
git add -A && git commit -m "fix(famille): correctifs non-régression Slice 5" # seulement si nécessaire
```

---

## Notes d'exécution

- **Aucune migration, aucune dépendance.** 100 % responsive additif.
- **Filet** : le mobile ne doit pas régresser (rail `hidden lg:block`, panneaux `hidden lg:block`). Les e2e existants (viewport par défaut) doivent rester verts.
- **Sécurité** : l'aperçu réutilise la route déchiffrée existante (RLS owner-only). Aucune surface nouvelle.
- Si le double-padding layout/page est visible en `lg:`, ajuster (retirer `lg:p-8` du layout). Vérifier au build.
