// Les dates d'expiration sont des jours calendaires (colonne DATE). On compare des JOURS
// (minuit UTC de part et d'autre), pas un jour vs un instant : sinon un document expirant
// aujourd'hui bascule « expired » dès minuit UTC passé (audit 04/07). now est un instant
// (new Date()) → on le réduit à son jour UTC.
function dayUTC(now: Date): number {
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

export function expiryStatus(expiry: string | null, now: Date): "expired" | "soon" | "valid" | null {
  if (!expiry) return null;
  const d = new Date(expiry).getTime(); // "YYYY-MM-DD" → minuit UTC de ce jour
  const today = dayUTC(now);
  if (d < today) return "expired";
  const sixMonths = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 6, now.getUTCDate());
  return d < sixMonths ? "soon" : "valid";
}

export function monthsUntil(expiry: string, now: Date): number {
  const d = new Date(expiry);
  if (d.getTime() <= dayUTC(now)) return 0;
  let months = (d.getUTCFullYear() - now.getUTCFullYear()) * 12 + (d.getUTCMonth() - now.getUTCMonth());
  if (d.getUTCDate() < now.getUTCDate()) months -= 1;
  return Math.max(0, months);
}
