# Intégration Sentry — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Faire remonter dans Sentry les erreurs déjà loggées par le logger structuré (#98), sans toucher un seul appelant, via un sink enfichable gaté par DSN.

**Architecture:** Un *sink* enfichable dans `log.ts` (le cœur reste sans dépendance) que `emit()` appelle pour les erreurs seulement. Des modules d'init runtime (serveur via `instrumentation.ts`, client via un composant monté au layout), gatés par DSN, enregistrent un sink qui forwarde vers `@sentry/nextjs`. Sans DSN : aucun init, aucun sink → `emit()` inchangé (no-op mock-first).

**Tech Stack:** Next.js 16.2.9 App Router (`instrumentation.ts`/`register`), `@sentry/nextjs` (isomorphe), Vitest.

## Global Constraints

- **Seam-forward minimal** : PAS de `withSentryConfig`, PAS de wrapping `next.config`, PAS d'auto-instrumentation. Le forward part de `emit()` du logger.
- **Erreurs seulement** : `emit` ne forwarde qu'au niveau `error`. `warn`/`info` restent console-only.
- **Env-gated / mock-first** : sans `SENTRY_DSN` (serveur) / `NEXT_PUBLIC_SENTRY_DSN` (client), aucun `Sentry.init`, sink jamais enregistré → `emit()` strictement identique à aujourd'hui.
- **`log.ts` reste sans dépendance** : il n'importe PAS `@sentry/nextjs` ; le SDK n'est importé que dans les modules d'init/sink, en **import dynamique** (hors bundle si DSN absent).
- **Aucun appelant modifié** : les 12 error boundaries, `global-error`, `logActionError`, le webhook, etc. ne changent pas.
- `sendDefaultPii: false`, `tracesSampleRate: 0` dans chaque `Sentry.init`.
- **AGENTS.md** : lire `node_modules/next/dist/docs/` (instrumentation / `register`) avant d'écrire `instrumentation.ts` — ce Next 16.2.9 peut différer.
- **Vérif pré-push** : `npm run typecheck && npm run lint && npm run test` doivent passer (mémoire `vito-verif-inclut-lint`).
- Branche : `feat/sentry-integration` (le spec y est déjà commité).

---

### Task 1: Dépendance `@sentry/nextjs` + env + `.env.example`

**Files:**
- Modify: `package.json` / `package-lock.json` (dépendance)
- Modify: `src/lib/env.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces: `env.SENTRY_DSN` (`string | undefined`), `env.NEXT_PUBLIC_SENTRY_DSN` (`string | undefined`). Package `@sentry/nextjs` installé.

- [ ] **Step 1: Installer le SDK**

Run: `npm install @sentry/nextjs`
Expected: `@sentry/nextjs` ajouté à `dependencies`.

- [ ] **Step 2: Ajouter les 2 vars au schéma env**

Dans `src/lib/env.ts`, ajouter au `z.object` (après les champs existants, avant un éventuel `.refine`) :

```ts
  SENTRY_DSN: z.string().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
```

Et dans l'objet passé à `safeParse` :

```ts
  SENTRY_DSN: process.env.SENTRY_DSN,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
```

(Purement additif — aucun refine. Les modules d'init liront `process.env` directement ; ces
entrées servent la validation/documentation.)

- [ ] **Step 3: Documenter dans `.env.example`**

Ajouter à `.env.example` :

```
# Sentry (optionnel — absent = observabilité désactivée, no-op). DSN d'un projet Sentry.
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=
```

- [ ] **Step 4: Vérifier**

Run: `npx tsc --noEmit`
Expected: exit 0 (env élargi, aucun usage encore).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/lib/env.ts .env.example
git commit -m "chore(observabilité): dépendance @sentry/nextjs + env SENTRY_DSN"
```

---

### Task 2: Sink enfichable dans `log.ts`

**Files:**
- Modify: `src/lib/log.ts`
- Modify: `src/lib/log.test.ts`

**Interfaces:**
- Consumes: rien.
- Produces:
  - `export type ErrorSink = (event: string, ctx: LogContext) => void;`
  - `export function setErrorSink(sink: ErrorSink | null): void;`
  - `emit()` appelle le sink enregistré **uniquement** pour `level === "error"`, avec `(event, ctx ?? {})`.

- [ ] **Step 1: Écrire les tests du sink**

Ajouter à `src/lib/log.test.ts` :

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { formatLog, errorContext, log, setErrorSink } from "./log";

describe("errorSink (forward des erreurs)", () => {
  afterEach(() => {
    setErrorSink(null);
    vi.restoreAllMocks();
  });

  it("emit(error) appelle le sink avec (event, ctx)", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const sink = vi.fn();
    setErrorSink(sink);
    log.error("action.failed", { name: "toggleFavorite" });
    expect(sink).toHaveBeenCalledWith("action.failed", { name: "toggleFavorite" });
  });

  it("emit(error) sans ctx appelle le sink avec un objet vide", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const sink = vi.fn();
    setErrorSink(sink);
    log.error("boom");
    expect(sink).toHaveBeenCalledWith("boom", {});
  });

  it("warn/info n'appellent PAS le sink", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
    const sink = vi.fn();
    setErrorSink(sink);
    log.warn("w");
    log.info("i");
    expect(sink).not.toHaveBeenCalled();
  });

  it("sans sink enregistré : aucun throw, console seule", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    log.error("no-sink");
    expect(spy).toHaveBeenCalledOnce();
  });

  it("setErrorSink(null) détache", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const sink = vi.fn();
    setErrorSink(sink);
    setErrorSink(null);
    log.error("x");
    expect(sink).not.toHaveBeenCalled();
  });
});
```

> Note : l'import en tête de `log.test.ts` doit inclure `log, setErrorSink` (les tests
> `formatLog`/`errorContext` existants restent inchangés — fusionner les imports vitest).

- [ ] **Step 2: Lancer les tests → échec**

Run: `npm run test -- src/lib/log.test.ts`
Expected: FAIL (`setErrorSink` n'existe pas).

- [ ] **Step 3: Ajouter le sink à `log.ts`**

Dans `src/lib/log.ts`, après la déclaration de `LogContext` (avant `formatLog`), ajouter :

```ts
export type ErrorSink = (event: string, ctx: LogContext) => void;

let errorSink: ErrorSink | null = null;
// Enregistre (ou détache avec null) le forward des erreurs vers un collecteur externe
// (Sentry). Appelé par les modules d'init runtime, uniquement si un DSN est configuré.
// log.ts reste sans dépendance : le SDK vit dans les modules d'init.
export function setErrorSink(sink: ErrorSink | null): void {
  errorSink = sink;
}
```

Puis modifier `emit()` pour forwarder les erreurs (après l'écriture console) :

```ts
function emit(level: Level, event: string, ctx?: LogContext): void {
  const line = formatLog(level, event, ctx, new Date().toISOString());
  const sink = level === "error" ? console.error : level === "warn" ? console.warn : console.info;
  sink(line);
  if (level === "error" && errorSink) errorSink(event, ctx ?? {});
}
```

- [ ] **Step 4: Lancer les tests → succès**

Run: `npm run test -- src/lib/log.test.ts`
Expected: PASS (tests existants + 5 nouveaux).

- [ ] **Step 5: Commit**

```bash
git add src/lib/log.ts src/lib/log.test.ts
git commit -m "feat(observabilité): sink d'erreurs enfichable dans le logger (setErrorSink)"
```

---

### Task 3: Forward Sentry — `sentrySink.ts`

**Files:**
- Create: `src/lib/observability/sentrySink.ts`
- Create: `src/lib/observability/sentrySink.test.ts`

**Interfaces:**
- Consumes: `ErrorSink`, `LogContext` (Task 2) ; `@sentry/nextjs` (Task 1).
- Produces: `export const sentryErrorSink: ErrorSink` — appelle `Sentry.captureException(new Error(String(ctx.message ?? event)), { tags: { event }, extra: <ctx sans message> })`.

- [ ] **Step 1: Écrire le test (SDK mocké)**

Create `src/lib/observability/sentrySink.test.ts` :

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const captureException = vi.fn();
vi.mock("@sentry/nextjs", () => ({ captureException: (...a: unknown[]) => captureException(...a) }));

import { sentryErrorSink } from "./sentrySink";

beforeEach(() => captureException.mockClear());

describe("sentryErrorSink", () => {
  it("forwarde une Error reconstruite + event en tag + reste du ctx en extra", () => {
    sentryErrorSink("action.failed", { message: "boom", name: "toggleFavorite", digest: "d1" });
    expect(captureException).toHaveBeenCalledTimes(1);
    const [err, opts] = captureException.mock.calls[0];
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toBe("boom");
    expect(opts).toEqual({ tags: { event: "action.failed" }, extra: { name: "toggleFavorite", digest: "d1" } });
  });

  it("sans message dans le ctx : retombe sur l'event comme message", () => {
    sentryErrorSink("global_error", {});
    const [err, opts] = captureException.mock.calls[0];
    expect((err as Error).message).toBe("global_error");
    expect(opts).toEqual({ tags: { event: "global_error" }, extra: {} });
  });
});
```

- [ ] **Step 2: Lancer → échec**

Run: `npm run test -- src/lib/observability/sentrySink.test.ts`
Expected: FAIL (`./sentrySink` absent).

- [ ] **Step 3: Écrire le sink**

Create `src/lib/observability/sentrySink.ts` :

```ts
import * as Sentry from "@sentry/nextjs";
import type { ErrorSink } from "@/lib/log";

// Forwarde une erreur loggée vers Sentry. Le logger aplatit l'erreur en ctx (message + digest) :
// on reconstruit une Error à partir du message (limite v1 assumée — la stack pointe ici, mais le
// digest Next dans extra + le tag `event` relient et regroupent). `event` = tag de regroupement.
export const sentryErrorSink: ErrorSink = (event, ctx) => {
  const { message, ...extra } = ctx;
  Sentry.captureException(new Error(String(message ?? event)), {
    tags: { event },
    extra,
  });
};
```

- [ ] **Step 4: Lancer → succès**

Run: `npm run test -- src/lib/observability/sentrySink.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Vérifier typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/lib/observability/sentrySink.ts src/lib/observability/sentrySink.test.ts
git commit -m "feat(observabilité): forward Sentry (captureException + tag event + extra)"
```

---

### Task 4: Init serveur — `instrumentation.ts`

**Files:**
- Create: `src/instrumentation.ts`

**Interfaces:**
- Consumes: `sentryErrorSink` (Task 3) ; `setErrorSink` (Task 2) ; `@sentry/nextjs` (Task 1).
- Produces: `export async function register(): Promise<void>` — si `process.env.SENTRY_DSN`, init Sentry + `setErrorSink(sentryErrorSink)`.

- [ ] **Step 0: Lire le guide Next**

Read: `node_modules/next/dist/docs/` — chercher `instrumentation` / `register`. Confirmer : emplacement du fichier (`src/instrumentation.ts` quand l'app est sous `src/`), signature `export async function register()`, et que `register` s'exécute côté serveur au démarrage. Noter ce qui est confirmé dans le rapport.

- [ ] **Step 1: Écrire `instrumentation.ts`**

Create `src/instrumentation.ts` :

```ts
// Init observabilité serveur/edge (Next 16 : register() au démarrage). Gaté par DSN :
// sans SENTRY_DSN, aucun init et le sink n'est jamais enregistré → logger inchangé.
// Imports dynamiques : le SDK reste hors bundle serveur quand le DSN est absent.
export async function register(): Promise<void> {
  if (!process.env.SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0, sendDefaultPii: false });
  const { sentryErrorSink } = await import("@/lib/observability/sentrySink");
  const { setErrorSink } = await import("@/lib/log");
  setErrorSink(sentryErrorSink);
}
```

- [ ] **Step 2: Vérifier typecheck + lint + build de sanity**

Run: `npx tsc --noEmit && npm run lint`
Expected: exit 0, clean.
Run (sanity, sans DSN → register no-op) : `npm run test` — la suite complète reste verte (aucun test ne dépend de l'init ; on vérifie l'absence de régression d'import).
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/instrumentation.ts
git commit -m "feat(observabilité): init Sentry serveur via instrumentation.register (gaté DSN)"
```

---

### Task 5: Init client — `SentryClientInit` monté au layout

**Files:**
- Create: `src/lib/observability/sentryClient.tsx`
- Modify: `src/app/[locale]/layout.tsx`

**Interfaces:**
- Consumes: `sentryErrorSink` (Task 3) ; `setErrorSink` (Task 2) ; `@sentry/nextjs` (Task 1).
- Produces: `export function SentryClientInit(): null` — composant client render-null qui init Sentry côté navigateur si `NEXT_PUBLIC_SENTRY_DSN`, monté une fois dans le layout (précédent : `PwaRegister`).

- [ ] **Step 1: Écrire le composant**

Create `src/lib/observability/sentryClient.tsx` :

```tsx
"use client";
import { useEffect } from "react";

// Init observabilité client (navigateur). Gaté par NEXT_PUBLIC_SENTRY_DSN. Monté une fois
// dans le root layout (comme PwaRegister). Import dynamique du SDK → hors bundle si DSN absent.
export function SentryClientInit(): null {
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
    let cancelled = false;
    (async () => {
      const Sentry = await import("@sentry/nextjs");
      if (cancelled) return;
      Sentry.init({ dsn: process.env.NEXT_PUBLIC_SENTRY_DSN, tracesSampleRate: 0, sendDefaultPii: false });
      const { sentryErrorSink } = await import("@/lib/observability/sentrySink");
      const { setErrorSink } = await import("@/lib/log");
      setErrorSink(sentryErrorSink);
    })();
    return () => { cancelled = true; };
  }, []);
  return null;
}
```

- [ ] **Step 2: Monter dans le layout**

Dans `src/app/[locale]/layout.tsx` : ajouter l'import et monter le composant à côté de `<PwaRegister />` dans le `<body>`.

Import (avec les autres imports) :
```ts
import { SentryClientInit } from "@/lib/observability/sentryClient";
```
Montage (juste après `<PwaRegister />`) :
```tsx
          <PwaRegister />
          <SentryClientInit />
```

- [ ] **Step 3: Vérifier**

Run: `npx tsc --noEmit && npm run lint`
Expected: exit 0, clean.

- [ ] **Step 4: Commit**

```bash
git add src/lib/observability/sentryClient.tsx src/app/\[locale\]/layout.tsx
git commit -m "feat(observabilité): init Sentry client monté au layout (gaté DSN)"
```

---

### Task 6: Vérification complète + e2e no-op

**Files:** (aucun — vérification de bout en bout)

- [ ] **Step 1: Suite unitaire complète**

Run: `npm run test`
Expected: PASS — tous les nouveaux tests (log sink + sentrySink) + non-régression. La suite passe de 302 à ~309 tests.

- [ ] **Step 2: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: exit 0, clean (mémoire `vito-verif-inclut-lint` : la CI quality échoue sinon).

- [ ] **Step 3: e2e (no-op, sans DSN)**

Run: `npm run test:e2e` (ou un spec ciblé si le runner l'exige)
Expected: PASS — sans `SENTRY_DSN`/`NEXT_PUBLIC_SENTRY_DSN` en env de test, aucun init Sentry, `emit()` inchangé, le parcours applicatif fonctionne comme avant. Confirmer qu'aucun octet Sentry ne charge (import dynamique gaté).

- [ ] **Step 4: Ouvrir la PR**

```bash
git push -u origin feat/sentry-integration
gh pr create --base main --title "feat(observabilité): forward Sentry des erreurs loggées (seam-forward, gaté DSN)" --body "Implémente docs/superpowers/specs/2026-07-08-sentry-integration-design.md. Sink enfichable dans log.ts (cœur sans dépendance), forward des erreurs seulement, init serveur+client gatés par DSN. Sans DSN : no-op total (CI/e2e/local inchangés). Aucun appelant modifié."
```

---

## Notes d'activation (hors code — pour le PO)

Pour activer : créer un projet Sentry, récupérer le DSN, renseigner `SENTRY_DSN` et
`NEXT_PUBLIC_SENTRY_DSN` en env de prod. Source maps (chantier ultérieur optionnel) : `withSentryConfig`
+ `SENTRY_AUTH_TOKEN` en CI.
