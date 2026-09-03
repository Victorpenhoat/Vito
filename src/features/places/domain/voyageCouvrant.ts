// Hôtels v2 (Lot H3) : détection du voyage qui couvre un séjour.
// Domaine pur (testable) — les dates sont des chaînes ISO YYYY-MM-DD, dont la
// comparaison lexicographique équivaut à la comparaison chronologique (même
// convention que voyages/domain/affichageVoyage).

export type VoyageLite = {
  id: string;
  titre: string;
  date_debut: string | null;
  date_fin: string | null;
};

/**
 * Voyages englobant la plage [arrivee, depart] (bornes incluses), du plus récent
 * début au plus ancien. `depart` absent → on teste la seule date d'arrivée.
 * Retourne [] si l'arrivée manque : sans date, aucune détection possible.
 */
export function voyagesCouvrant<T extends VoyageLite>(
  voyages: T[],
  arrivee: string | null | undefined,
  depart?: string | null,
): T[] {
  if (!arrivee) return [];
  const fin = depart && depart >= arrivee ? depart : arrivee;
  return voyages
    .filter((v) => v.date_debut != null && v.date_fin != null && v.date_debut <= arrivee && v.date_fin >= fin)
    .sort((a, b) => (b.date_debut ?? "").localeCompare(a.date_debut ?? ""));
}
