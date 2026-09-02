// Âge en années révolues à partir d'une date de naissance "YYYY-MM-DD" (colonne DATE).
// Même convention que expiry.ts : comparaison en jours UTC, pas en instants.
export function ageYears(birthDate: string | null, now: Date): number | null {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  if (Number.isNaN(b.getTime())) return null;
  let age = now.getUTCFullYear() - b.getUTCFullYear();
  const anniversaryPassed =
    now.getUTCMonth() > b.getUTCMonth() ||
    (now.getUTCMonth() === b.getUTCMonth() && now.getUTCDate() >= b.getUTCDate());
  if (!anniversaryPassed) age -= 1;
  return age >= 0 ? age : null;
}
