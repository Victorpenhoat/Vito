// Dégradés de couverture de voyage. Ce ne sont PAS des rôles d'interface —
// ils disent un statut par une ambiance — mais ils doivent vivre dans la même
// famille froide que la refonte v3, sinon une carte de voyage est le seul
// objet chaud d'un écran bleu nuit.
const TINTS: Record<string, string> = {
  confirme: "linear-gradient(135deg,#174436,#1F6B4E)",
  planifie: "linear-gradient(135deg,#1B2B4A,#2A4470)",
  en_preparation: "linear-gradient(135deg,#1B2B4A,#2A4470)",
  idee: "linear-gradient(135deg,#2B3348,#3B4762)",
  en_cours: "linear-gradient(135deg,#4A3A1A,#6E5526)",
  termine: "linear-gradient(135deg,#242C3A,#333D4E)",
};
const NEUTRAL = "linear-gradient(135deg,var(--hero-from),var(--hero-to))";

export function statutTint(statut: string | null): string {
  return (statut && TINTS[statut]) || NEUTRAL;
}
