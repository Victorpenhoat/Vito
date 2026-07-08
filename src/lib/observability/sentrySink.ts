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
