"use client";
import { useEffect } from "react";

// Init observabilité client (navigateur). Gaté par NEXT_PUBLIC_SENTRY_DSN. Monté une fois
// dans le root layout (comme PwaRegister). Import dynamique du SDK → hors bundle si DSN absent.
export function SentryClientInit(): null {
  useEffect(() => {
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    if (!dsn) return;
    let cancelled = false;
    (async () => {
      // Tous les imports dynamiques d'abord, avec re-check de `cancelled` après chaque await,
      // puis les effets de bord (init + enregistrement du sink) ensemble à la fin : un unmount
      // rapide n'enregistre jamais le sink après teardown.
      const Sentry = await import("@sentry/nextjs");
      if (cancelled) return;
      const { sentryErrorSink } = await import("@/lib/observability/sentrySink");
      if (cancelled) return;
      const { setErrorSink } = await import("@/lib/log");
      if (cancelled) return;
      Sentry.init({ dsn, tracesSampleRate: 0, sendDefaultPii: false });
      setErrorSink(sentryErrorSink);
    })();
    return () => { cancelled = true; };
  }, []);
  return null;
}
