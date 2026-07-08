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
