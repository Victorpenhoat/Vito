const TINTS: Record<string, string> = {
  rouge: "linear-gradient(135deg,#5e2730,#7a3540)",
  blanc: "linear-gradient(135deg,#cdbf8a,#e0d4a0)",
  rose: "linear-gradient(135deg,#c97d8f,#e0a9b6)",
  petillant: "linear-gradient(135deg,#d4c98a,#ece0a8)",
};
const NEUTRAL = "linear-gradient(135deg,var(--hero-from),var(--hero-to))";

export function couleurTint(couleur: string | null): string {
  return (couleur && TINTS[couleur]) || NEUTRAL;
}
