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
