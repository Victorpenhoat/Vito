// Observabilité (audit 04/07 : aucun logging structuré, erreurs avalées → prod aveugle).
// Logger isomorphe (serveur RSC/actions + client boundaries) : une ligne JSON en prod
// (ingérable par les logs Vercel / un collecteur), lisible en dev. Zéro dépendance.
// Couture Sentry : brancher un forward dans emit() (ex. Sentry.captureException) sans
// toucher les appelants.
type Level = "error" | "warn" | "info";
export type LogContext = Record<string, unknown>;

// Cœur pur (testable sans espionner la console) : construit la ligne à émettre.
export function formatLog(level: Level, event: string, ctx: LogContext | undefined, iso: string): string {
  const record = { level, event, ...ctx, ts: iso };
  if (process.env.NODE_ENV === "production") return JSON.stringify(record);
  const rest = ctx && Object.keys(ctx).length ? " " + JSON.stringify(ctx) : "";
  return `[${level}] ${event}${rest}`;
}

// Normalise une erreur inconnue en contexte loggable (message + digest Next si présent).
export function errorContext(err: unknown): LogContext {
  if (err instanceof Error) {
    const digest = (err as { digest?: string }).digest;
    return { message: err.message, ...(digest ? { digest } : {}) };
  }
  return { message: String(err) };
}

function emit(level: Level, event: string, ctx?: LogContext): void {
  const line = formatLog(level, event, ctx, new Date().toISOString());
  const sink = level === "error" ? console.error : level === "warn" ? console.warn : console.info;
  sink(line);
}

export const log = {
  error: (event: string, ctx?: LogContext) => emit("error", event, ctx),
  warn: (event: string, ctx?: LogContext) => emit("warn", event, ctx),
  info: (event: string, ctx?: LogContext) => emit("info", event, ctx),
};
