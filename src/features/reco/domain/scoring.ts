import type { SignauxImplicites } from "./implicit";

export type ScoringEtab = {
  type: string | null;
  arrondissement: string | null;
  price_level: number | null;
};
export type ScoringGouts = {
  typesPreferes: string[];
  zones: string[];
  budgetMax: number | null;
};

// Score déterministe : préférences explicites (poids forts) + signaux implicites (poids doux).
export function scoreEtablissement(
  etab: ScoringEtab,
  gouts: ScoringGouts,
  implicites: SignauxImplicites,
): number {
  let score = 0;
  if (etab.type && gouts.typesPreferes.includes(etab.type)) score += 3;
  if (etab.arrondissement && gouts.zones.includes(etab.arrondissement)) score += 2;
  // price_level (0-4) vs budget : un price_level plus bas que le budget est neutre/positif.
  if (gouts.budgetMax != null && etab.price_level != null && etab.price_level <= 4) {
    score += 1;
  }
  // Signaux implicites : ajout doux et borné.
  if (etab.type) {
    const typeSignal = implicites.types[etab.type];
    if (typeSignal) score += Math.min(2, typeSignal * 0.5);
  }
  if (etab.arrondissement) {
    const zoneSignal = implicites.zones[etab.arrondissement];
    if (zoneSignal) score += Math.min(2, zoneSignal * 0.5);
  }
  return score;
}
