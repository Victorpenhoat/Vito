# Intégration Sentry (observabilité erreurs) — Design

**Date :** 2026-07-08
**Statut :** Validé (design). Plan d'implémentation à suivre.
**Branche :** `feat/sentry-integration`

---

## 0. Contexte

Le chantier observabilité (#98) a introduit un logger structuré isomorphe (`src/lib/log.ts`),
câblé dans les 12 error boundaries (via `useCaptureError`), `global-error.tsx`, et ~51 sites
d'actions serveur (`logActionError`). Le commentaire de `log.ts` annonce explicitement la
couture : *« brancher un forward dans emit() (ex. Sentry.captureException) sans toucher les
appelants »*. Ce chantier réalise ce forward : les erreurs déjà loggées remontent dans Sentry,
**sans modifier un seul appelant**.

On respecte les conventions du repo : env-gated / mock-first (comme Stripe), dépendance minimale,
types dérivés du schéma, TDD, e2e sur le no-op.

## 1. Décisions de cadrage (validées)

| Sujet | Décision |
|-------|----------|
| Approche | **Seam-forward minimal** : forward depuis `emit()` du logger, PAS de `withSentryConfig`/wrapping `next.config`, PAS d'auto-instrumentation. Évite toute friction avec le Next 16 non-standard (AGENTS.md). |
| Ce qui remonte | **Erreurs seulement** (`log.error`). `warn`/`info` restent des logs console. Pas de perf/traces, pas de session replay, pas de breadcrumbs. |
| Bascule | **Env-gated par DSN** : sans `SENTRY_DSN` (serveur) / `NEXT_PUBLIC_SENTRY_DSN` (client), aucun `Sentry.init`, aucun sink → le logger se comporte exactement comme aujourd'hui. |
| Couplage | `log.ts` reste **sans dépendance** : un *sink* enfichable découple le cœur du SDK (testable sans Sentry, SDK importé seulement dans les modules d'init). |
| SDK | `@sentry/nextjs` (isomorphe : client + serveur + edge ; `captureException` universel). |
| PII | `sendDefaultPii: false`. On envoie l'`event` (tag) + le `ctx` loggé (extra) — déjà curé (pas de PII brute au-delà d'un éventuel message). |
| Hors scope (YAGNI) | Upload source maps (`withSentryConfig` + `SENTRY_AUTH_TOKEN`), performance tracing, session replay, breadcrumbs depuis warn/info. Ajoutables plus tard sans toucher les appelants. |

## 2. Principe d'architecture

Le logger isomorphe tourne dans deux runtimes (serveur RSC/actions/route ; client boundaries).
Un SDK Sentry runtime-spécifique ne peut pas être importé directement dans `log.ts` sans le
coupler et le tirer dans tous les bundles. On introduit donc un **sink enfichable** :

- `log.ts` expose `setErrorSink(sink | null)` et n'appelle le sink **que pour `level === "error"`**.
- Sans sink enregistré, `emit()` est **identique** à aujourd'hui (console seule) — c'est le no-op
  mock-first quand Sentry est off.
- Les modules d'init (un par runtime), gatés par DSN, enregistrent un sink qui forwarde vers
  `@sentry/nextjs`. Le cœur reste testable sans le SDK.

## 3. Sink dans `src/lib/log.ts`

Ajouts (le reste du module inchangé) :

```ts
export type ErrorSink = (event: string, ctx: LogContext) => void;

let errorSink: ErrorSink | null = null;
// Enregistre (ou détache avec null) le forward des erreurs vers un collecteur externe
// (Sentry). Appelé par les modules d'init runtime, uniquement si un DSN est configuré.
export function setErrorSink(sink: ErrorSink | null): void {
  errorSink = sink;
}
```

Dans `emit()`, après l'écriture console, forwarder les erreurs :

```ts
function emit(level: Level, event: string, ctx?: LogContext): void {
  const line = formatLog(level, event, ctx, new Date().toISOString());
  const sink = level === "error" ? console.error : level === "warn" ? console.warn : console.info;
  sink(line);
  if (level === "error" && errorSink) errorSink(event, ctx ?? {});
}
```

Le forward est isolé du formatage (`formatLog` reste pur). Un throw éventuel du sink ne doit pas
casser l'appelant : le sink Sentry (`captureException`) ne throw pas en pratique ; on ne rajoute
pas de try/catch (YAGNI) — si un besoin apparaît, l'encapsuler côté sink.

## 4. Forward Sentry — `src/lib/observability/sentrySink.ts`

Fonction pure qui construit le sink (testable en mockant `@sentry/nextjs`) :

```ts
import * as Sentry from "@sentry/nextjs";
import type { ErrorSink } from "@/lib/log";

// Forwarde une erreur loggée vers Sentry : le message du ctx devient l'exception,
// `event` un tag (regroupement), le reste du ctx en `extra`.
export const sentryErrorSink: ErrorSink = (event, ctx) => {
  const { message, ...extra } = ctx;
  Sentry.captureException(new Error(String(message ?? event)), {
    tags: { event },
    extra,
  });
};
```

*(Limite v1 assumée : `errorContext` aplatit l'erreur en `ctx` (message + digest) — le logger ne
transmet pas l'objet `Error` d'origine, donc le sink reconstruit une `Error` à partir du `message`.
La stack pointe vers le sink, pas vers le throw originel ; le `digest` Next (dans `extra`) et le tag
`event` permettent quand même de relier et regrouper. Préserver la vraie stack imposerait de passer
l'`Error` d'origine au logger — donc de toucher les appelants, ce que ce chantier refuse par
principe. Améliorable plus tard sans changer les appelants si Sentry le justifie.)*

## 5. Init par runtime (gaté par DSN)

**Serveur/edge — `instrumentation.ts`** (racine ; Next 16 `register()`) :

```ts
export async function register() {
  if (!process.env.SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0, sendDefaultPii: false });
  const { sentryErrorSink } = await import("@/lib/observability/sentrySink");
  const { setErrorSink } = await import("@/lib/log");
  setErrorSink(sentryErrorSink);
}
```

**Client — `src/lib/observability/sentryClient.ts`** (module `"use client"`), monté une fois
dans le root layout (composant qui n'affiche rien, init en `useEffect` ou au module-scope guardé) :

```ts
"use client";
import { useEffect } from "react";

export function SentryClientInit() {
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

Monté dans `src/app/[locale]/layout.tsx` (ou le root layout approprié) : `<SentryClientInit />`.
Import dynamique du SDK → aucun octet Sentry dans le bundle quand le DSN est absent.

**AGENTS.md** : lire `node_modules/next/dist/docs/` (instrumentation / `register`) avant d'écrire
`instrumentation.ts` — confirmer la convention exacte de ce Next 16.2.9.

## 6. Env (`src/lib/env.ts`)

Ajouts optionnels (aucun refine — purement additif) :

```
SENTRY_DSN              z.string().optional()
NEXT_PUBLIC_SENTRY_DSN  z.string().optional()
```

Documenter dans `.env.example`. Les modules d'init lisent `process.env` directement (serveur via
`instrumentation.ts` avant que `env.ts` soit forcément chargé ; client via la var publique inline)
— cohérent avec l'usage Next, et évite de faire dépendre l'init de l'ordre de chargement d'`env.ts`.

## 7. Gestion des erreurs

- DSN absent → aucun init, sink jamais enregistré → `emit()` inchangé (no-op total).
- Le sink ne doit pas casser l'appelant : `Sentry.captureException` est non-throwant ; pas de
  try/catch ajouté (YAGNI).
- Double init (client re-render) : garde-fou par `useEffect([])` monté une fois + `cancelled`.

## 8. Tests

- **Unit `log.test.ts`** (étendre) :
  - `emit("error", …)` appelle le sink enregistré avec `(event, ctx)` ; `warn`/`info` ne l'appellent PAS.
  - Sans sink (défaut) : aucun appel, comportement console inchangé.
  - `setErrorSink(null)` détache.
  - `formatLog` reste pur (inchangé).
- **Unit `sentrySink.test.ts`** : en mockant `@sentry/nextjs`, `sentryErrorSink({event, ctx})` appelle
  `captureException` avec l'Error reconstruite, `tags.event`, et `extra` = ctx sans `message`.
- **e2e/CI** : inchangés — pas de DSN → no-op. La suite reste verte sans Sentry.
- **Vérif pré-push** : `npm run typecheck && npm run lint && npm run test` (mémoire `vito-verif-inclut-lint`).

## 9. Découpage d'implémentation (indicatif, pour le plan)

1. Dépendance `@sentry/nextjs` + env (`SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`) + `.env.example`.
2. Sink dans `log.ts` (`setErrorSink` + forward dans `emit`) + tests unitaires du cœur.
3. `sentrySink.ts` (forward Sentry) + test unitaire (SDK mocké).
4. Init serveur `instrumentation.ts` (gaté DSN, lire docs Next d'abord).
5. Init client `SentryClientInit` + montage dans le layout.
6. Vérif complète + e2e no-op verts.

## 10. Dépendances

- `@sentry/nextjs` en dépendance de prod (import dynamique → hors bundle si DSN absent).
- Aucune autre.

## 11. Activation (hors code — pour le PO)

Pour activer en prod : créer un projet Sentry, récupérer le DSN, renseigner `SENTRY_DSN` +
`NEXT_PUBLIC_SENTRY_DSN` en env de prod. (Source maps : chantier ultérieur optionnel via
`withSentryConfig` + `SENTRY_AUTH_TOKEN`.)
