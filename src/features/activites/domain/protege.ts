// Ce qui entoure les données protégées d'une activité : la validité d'un
// document. Le masque, lui, est commun à toute l'application —
// `src/lib/securite/masque.ts`.

/** Seuil des alertes, tel que le montre la maquette (« expire dans 21 jours »). */
export const JOURS_ALERTE = 30;

export type Validite = "expire" | "bientot" | "valide";

/**
 * L'état d'un document daté. Comme pour les échéances de paiement, il se
 * DÉDUIT : stocker « expiré » le rendrait faux le lendemain.
 *
 * Un document sans date d'expiration n'a pas d'état — un règlement intérieur
 * ne périme pas, et lui coller « valide » suggérerait qu'on l'a vérifié.
 */
export function etatValidite(expireLe: string | null | undefined, aujourdhui: string): Validite | null {
  if (!expireLe) return null;
  if (expireLe < aujourdhui) return "expire";
  const limite = new Date(Date.parse(`${aujourdhui}T00:00:00Z`) + JOURS_ALERTE * 86_400_000)
    .toISOString().slice(0, 10);
  return expireLe <= limite ? "bientot" : "valide";
}

/** « expire dans 21 jours » : le nombre de jours, jamais négatif. */
export function joursAvant(expireLe: string, aujourdhui: string): number {
  const jours = Math.round(
    (Date.parse(`${expireLe}T00:00:00Z`) - Date.parse(`${aujourdhui}T00:00:00Z`)) / 86_400_000,
  );
  return Math.max(0, jours);
}
