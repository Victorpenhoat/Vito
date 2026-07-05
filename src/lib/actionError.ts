import { log, errorContext } from "./log";

// Logge une erreur SYSTÈME avalée par une server action (erreur Supabase/RPC) — effet de
// bord seul, pour préserver les `return { error: "..." }` littéraux (dont dépend
// l'inférence d'union TS des états côté UI). Réservé aux échecs système : la validation
// zod et les refus d'auth sont du contrôle de flux attendu, à ne pas logger.
export function logActionError(event: string, err: unknown): void {
  log.error(event, errorContext(err));
}
