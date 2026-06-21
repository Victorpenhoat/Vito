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

// euros -> tier price_level (aligné sur la recherche)
function budgetToTier(budgetMax: number): number {
  return budgetMax <= 20 ? 1 : budgetMax <= 40 ? 2 : budgetMax <= 80 ? 3 : 4;
}

// Score déterministe : préférences explicites (poids forts) + signaux implicites (poids doux).
export function scoreEtablissement(
  etab: ScoringEtab,
  gouts: ScoringGouts,
  implicites: SignauxImplicites,
): number {
  let score = 0;
  if (etab.type && gouts.typesPreferes.includes(etab.type)) score += 3;
  if (etab.arrondissement && gouts.zones.includes(etab.arrondissement)) score += 2;
  // price_level (0-4) vs budget : proximité au tier de budget (2 si pile, dégressif).
  if (gouts.budgetMax != null && etab.price_level != null) {
    const tier = budgetToTier(gouts.budgetMax);
    score += Math.max(0, 2 - Math.abs(etab.price_level - tier)); // proximité : 2 si pile, dégressif
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
