const TINTS: Record<string, string> = {
  confirme: "linear-gradient(135deg,#2f5a3f,#3f7a55)",
  planifie: "linear-gradient(135deg,#2a3a5e,#3a5080)",
  en_cours: "linear-gradient(135deg,#7a5a2a,#a07a3a)",
  termine: "linear-gradient(135deg,#3a3632,#4a443e)",
};
const NEUTRAL = "linear-gradient(135deg,var(--hero-from),var(--hero-to))";

export function statutTint(statut: string | null): string {
  return (statut && TINTS[statut]) || NEUTRAL;
}
