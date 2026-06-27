# Famille Slice 6 — Polish (skeletons + a11y + erreurs riches) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finition de l'épic Famille : squelettes de chargement, accessibilité ciblée, et gestion d'erreur riche du tunnel OCR (réseau vs illisible) — sans changer aucun flux. (Le rafraîchissement du kit Claude Design est un livrable séparé post-merge, hors de ce plan.)

**Architecture:** Additif. Primitive `Skeleton` + `loading.tsx` (Suspense App Router) ; attributs a11y sur composants existants ; nouvel état `readError` dans `DocumentTunnel` pour distinguer échec réseau et document illisible. Aucune migration/dépendance.

**Tech Stack:** Next.js 16 App Router, TS strict, Tailwind v4, next-intl, Playwright.

## Global Constraints

- **Mobile-first inchangé**, tout additif. Aucun flux fonctionnel modifié.
- **Aucune chaîne UI en dur** : `useTranslations`/`getTranslations("famille")`. Parité 4 locales (`src/lib/i18n/messages-parity.test.ts`).
- `Link`/`usePathname` **locale-aware** (`@/lib/i18n/routing`). Style Le Carnet, **aucun nouveau token** (`bg-line`, `outline-accent`, etc. existent). `lint` doit rester à **0 warning**. TS strict.
- **Sécurité** : aucune surface nouvelle ; le « Réessayer » re-poste le fichier (en mémoire) à la route OCR authentifiée ; rien n'est persisté avant le submit D.
- AGENTS.md : consulter `node_modules/next/dist/docs/` au besoin (`loading.tsx`/Suspense, client components Next 16).
- Réf. spec : `docs/superpowers/specs/2026-06-27-famille-slice-6-polish-design.md`. Aucune migration.

---

### Task 1: Primitive `Skeleton` + `loading.tsx` (liste + fiche)

**Files:**
- Create: `src/features/shared/ui/Skeleton.tsx`
- Create: `src/app/[locale]/(app)/famille/loading.tsx`
- Create: `src/app/[locale]/(app)/famille/proches/[id]/loading.tsx`

**Interfaces:**
- Produces: `Skeleton` (présentational).

- [ ] **Step 1: Primitive `Skeleton`**

Create `src/features/shared/ui/Skeleton.tsx` :

```tsx
export function Skeleton({ className = "" }: { className?: string }) {
  return <span className={`block animate-pulse rounded-control bg-line/60 ${className}`} aria-hidden="true" />;
}
```

- [ ] **Step 2: `loading.tsx` de la liste**

Create `src/app/[locale]/(app)/famille/loading.tsx` :

```tsx
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/features/shared/ui/PageHeader";
import { SectionLabel } from "@/features/shared/ui/SectionLabel";
import { Skeleton } from "@/features/shared/ui/Skeleton";

export default async function FamilleLoading() {
  const t = await getTranslations("famille");
  return (
    <main className="flex flex-col gap-8 p-4 md:p-8">
      <PageHeader eyebrow={t("eyebrow")} title={t("proches.titre")} />
      <section className="flex flex-col gap-4">
        <SectionLabel>{t("proches.titre")}</SectionLabel>
        <div className="flex flex-col gap-2 lg:grid lg:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-card border border-line bg-surface p-4">
              <Skeleton className="h-[46px] w-[46px] rounded-full" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 3: `loading.tsx` de la fiche**

Create `src/app/[locale]/(app)/famille/proches/[id]/loading.tsx` :

```tsx
import { Skeleton } from "@/features/shared/ui/Skeleton";

export default function FicheLoading() {
  return (
    <main className="flex flex-col gap-6 p-4 md:p-8">
      <header className="flex items-center gap-4">
        <Skeleton className="h-[72px] w-[72px] rounded-full" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </header>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-24" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-card" />
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 4: typecheck + lint + test + commit**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS, 0 warning.
```bash
git add src/features/shared/ui/Skeleton.tsx "src/app/[locale]/(app)/famille/loading.tsx" "src/app/[locale]/(app)/famille/proches/[id]/loading.tsx"
git commit -m "feat(famille): primitive Skeleton + loading.tsx (liste + fiche)"
```

---

### Task 2: Accessibilité ciblée

**Files:**
- Modify: `src/features/famille/ui/DocumentRow.tsx`
- Modify: `src/features/famille/ui/FamilleRail.tsx`
- Modify: `src/features/famille/ui/DocumentPreview.tsx`
- Modify: `src/features/famille/ui/DocumentTunnel.tsx`

**Interfaces:** aucune nouvelle (attributs a11y sur l'existant).

- [ ] **Step 1: `DocumentRow` — `aria-pressed` + focus visible**

Dans `src/features/famille/ui/DocumentRow.tsx`, sur le `<button>` « révéler » : ajouter
`aria-pressed={revealed}` et la classe `focus-visible:outline-2 focus-visible:outline-accent` (en plus
des classes existantes). Sur le `<a>` « Voir le document » : ajouter la même classe `focus-visible:…`.

- [ ] **Step 2: `FamilleRail` — `aria-current` + focus visible**

Dans `src/features/famille/ui/FamilleRail.tsx`, sur le `Link` du proche : ajouter
`aria-current={active ? "page" : undefined}` et `focus-visible:outline-2 focus-visible:outline-accent`.
Sur le `Link` « Ajouter un proche » : ajouter la classe `focus-visible:…`.

- [ ] **Step 3: `DocumentPreview` — `alt` explicite**

Dans `src/features/famille/ui/DocumentPreview.tsx`, remplacer l'`alt` générique par le libellé de type :
`alt={t(\`docTypes.${doc.doc_type}\`)}`. (Le `title` de l'`<iframe>` peut rester `t("fiche.apercu")`.)

- [ ] **Step 4: `DocumentTunnel` — focus visible sur les boutons d'étape**

Dans `src/features/famille/ui/DocumentTunnel.tsx`, ajouter `focus-visible:outline-2
focus-visible:outline-accent` aux boutons interactifs des étapes A (sélection de type) et B (la zone
`<label>` du fichier reste atteignable au clavier via l'input — ne pas la masquer au focus). Ne change
aucune logique.

- [ ] **Step 5: typecheck + lint + test + commit**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS, 0 warning. (Pas de nouvelle clé i18n.)
```bash
git add src/features/famille/ui/DocumentRow.tsx src/features/famille/ui/FamilleRail.tsx src/features/famille/ui/DocumentPreview.tsx src/features/famille/ui/DocumentTunnel.tsx
git commit -m "feat(famille): a11y — aria-pressed/aria-current, focus-visible, alt explicite"
```

---

### Task 3: Erreurs riches du tunnel (étape C) + i18n

**Files:**
- Modify: `src/features/famille/ui/DocumentTunnel.tsx`
- Modify: `messages/{fr,en,it,es}.json`
- Test: `e2e/famille-ocr-error.spec.ts`

**Interfaces:** état interne `readError` + `attempt` dans `DocumentTunnel`.

- [ ] **Step 1: i18n `tunnel.cErreurTitre`/`cReessayer`/`cManuel` (4 locales)**

Ajouter sous `famille.tunnel` (parité) :
- fr : `cErreurTitre`:"La lecture a échoué", `cReessayer`:"Réessayer la lecture", `cManuel`:"Saisir manuellement"
- en : "Reading failed" / "Try reading again" / "Enter manually"
- it : "Lettura non riuscita" / "Riprova la lettura" / "Inserisci manualmente"
- es : "La lectura falló" / "Reintentar la lectura" / "Introducir manualmente"

Run: `npm run test -- messages-parity` → PASS.

- [ ] **Step 2: État `readError` + UI d'erreur de l'étape C**

Dans `src/features/famille/ui/DocumentTunnel.tsx` :
1. Ajouter `const [readError, setReadError] = useState(false);` et `const [attempt, setAttempt] = useState(0);`.
2. Modifier l'`useEffect` de l'étape C : dépendances `[step, file, docType, attempt]`. En cas de succès → `setFields`/`setOcrRaw`/`setManual(false)` puis `setStep("D")` (inchangé). **En cas d'échec (`!resp.ok` ou `catch`)** → `setReadError(true)` **et NE PAS** basculer en D (retirer le `setStep("D")` du chemin d'échec ; ne le faire que sur succès). Garder le garde `cancelled`.
3. Rendu de l'étape C : si `readError` → bloc d'erreur (`role="alert"`) avec `t("tunnel.cErreurTitre")` + deux boutons :
   - « Réessayer la lecture » (`t("tunnel.cReessayer")`) → `setReadError(false); setAttempt((a) => a + 1);` (re-déclenche l'effet, step reste "C").
   - « Saisir manuellement » (`t("tunnel.cManuel")`) → `setManual(true); setFields(EMPTY_FIELDS); setReadError(false); setStep("D");`.
   Sinon → le « Lecture… » existant.
   (Les deux boutons portent `focus-visible:outline-2 focus-visible:outline-accent`.)

Forme de référence du rendu étape C :

```tsx
{step === "C" && (
  <div className="flex flex-col items-center gap-3 p-8 text-center">
    {readError ? (
      <div role="alert" className="flex flex-col items-center gap-3">
        <h2 className="font-serif text-2xl text-ink">{t("tunnel.cErreurTitre")}</h2>
        <div className="flex gap-2">
          <Button onClick={() => { setReadError(false); setAttempt((a) => a + 1); }}>{t("tunnel.cReessayer")}</Button>
          <Button variant="ghost" onClick={() => { setManual(true); setFields(EMPTY_FIELDS); setReadError(false); setStep("D"); }}>{t("tunnel.cManuel")}</Button>
        </div>
      </div>
    ) : (
      <>
        <h2 className="font-serif text-2xl text-ink">{t("tunnel.cTitre")}</h2>
        <p className="text-muted">{t("tunnel.cSous")}</p>
      </>
    )}
  </div>
)}
```

- [ ] **Step 3: e2e erreur OCR**

Create `e2e/famille-ocr-error.spec.ts` :

```ts
import { test, expect, type Page } from "@playwright/test";

const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF");

async function login(page: Page, email: string) {
  await page.goto("/fr/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill("password123");
  await page.getByRole("button", { name: "Connexion" }).click();
  await expect(page).toHaveURL(/\/fr\/accueil/);
}

async function openTunnel(page: Page) {
  await page.goto("/fr/famille");
  await page.getByTestId("proche-row").filter({ hasText: "Camille Durand" }).first().click();
  await page.getByRole("link", { name: "Ajouter un document" }).click();
  await page.getByRole("button", { name: "Continuer" }).click(); // étape A -> B
}

test("échec réseau OCR : l'étape C affiche l'erreur, puis « Saisir manuellement » -> D vide", async ({ page }) => {
  await login(page, "client@vito.test");
  await page.route("**/api/famille/documents/read", (r) => r.abort());
  await openTunnel(page);
  await page.getByTestId("tunnel-file").setInputFiles({ name: "p.pdf", mimeType: "application/pdf", buffer: PDF });
  await expect(page.getByText("La lecture a échoué")).toBeVisible();
  await page.getByRole("button", { name: "Saisir manuellement" }).click();
  await expect(page.getByTestId("tunnel-verify")).toBeVisible();
  await expect(page.locator('input[name="country"]')).toHaveValue("");
});

test("« Réessayer la lecture » après rétablissement -> D pré-rempli (mock)", async ({ page }) => {
  await login(page, "client@vito.test");
  let fail = true;
  await page.route("**/api/famille/documents/read", (r) => (fail ? r.abort() : r.continue()));
  await openTunnel(page);
  await page.getByTestId("tunnel-file").setInputFiles({ name: "p.pdf", mimeType: "application/pdf", buffer: PDF });
  await expect(page.getByText("La lecture a échoué")).toBeVisible();
  fail = false;
  await page.getByRole("button", { name: "Réessayer la lecture" }).click();
  await expect(page.getByTestId("tunnel-verify")).toBeVisible();
  await expect(page.locator('input[name="country"]')).toHaveValue("France");
});
```

- [ ] **Step 4: e2e ciblée (reset) + typecheck + lint**

Run: `supabase db reset && npx playwright test famille-ocr-error famille --retries=0 && npm run typecheck && npm run lint`
Expected: nouveaux + existants PASS (le tunnel nominal reste vert). (Flake `liste_items`/anon → relancer une fois.)

- [ ] **Step 5: Commit**

```bash
git add src/features/famille/ui/DocumentTunnel.tsx messages/ e2e/famille-ocr-error.spec.ts
git commit -m "feat(famille): tunnel — erreur de lecture explicite (réseau) + réessayer / saisie manuelle"
```

---

### Task 4: Non-régression complète + build

**Files:** aucun (vérification).

- [ ] **Step 1: Suite complète + build**

Run: `supabase db reset && npx playwright test --retries=0 && npm run build`
Expected: suite e2e **verte** + build OK **sans warning**. (Flake `liste_items`/anon → relancer le fichier une fois.)

- [ ] **Step 2: Commit (si correctifs)**

```bash
git add -A && git commit -m "fix(famille): correctifs non-régression Slice 6" # seulement si nécessaire
```

---

## Notes d'exécution

- **Aucune migration, aucune dépendance.** Additif.
- **Filet** : aucun flux modifié ; seuls des skeletons, attributs a11y et un état d'erreur explicite (le fallback manuel reste accessible). Les e2e existants doivent rester verts.
- **Kit Claude Design** = livrable séparé post-merge (skill `/design-sync`), hors de ce plan.
