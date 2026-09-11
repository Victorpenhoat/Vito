// Les couleurs de vin gardent leur teinte — un rouge doit rester rouge —
// mais descendent en luminosité pour tenir sur la surface sombre #131A26
// de la refonte v3.
const TINTS: Record<string, string> = {
  rouge: "linear-gradient(135deg,#B84A5A,#D2707E)",
  blanc: "linear-gradient(135deg,#8F8659,#B0A474)",
  rose: "linear-gradient(135deg,#9A5C6C,#BC7E8E)",
  petillant: "linear-gradient(135deg,#968C5E,#B8AC78)",
};
const NEUTRAL = "linear-gradient(135deg,var(--hero-from),var(--hero-to))";

export function couleurTint(couleur: string | null): string {
  return (couleur && TINTS[couleur]) || NEUTRAL;
}
