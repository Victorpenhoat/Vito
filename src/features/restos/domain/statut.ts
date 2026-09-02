// Statut v2 des restaurants (design Onglet_Resto_v2) : Favori / À tester / Testé.
// DÉRIVÉ de is_favorite + statut ('a_faire'|'visite') — source de vérité inchangée,
// donc le dashboard accueil et subsetForTab (Hôtels) restent vrais.
// « Passer en favori remplace le statut Testé, visites conservées » (décision design) :
// favori prime, l'historique de visites vit dans la table `visites`.

export type RestoStatut = "favori" | "a_tester" | "teste";
export const RESTO_STATUTS = ["favori", "a_tester", "teste"] as const;

export function restoStatut(item: { is_favorite: boolean; statut: string }): RestoStatut {
  if (item.is_favorite) return "favori";
  return item.statut === "visite" ? "teste" : "a_tester";
}

/** Partition EXCLUSIVE par statut v2 (≠ subsetForTab où favoris et recommandés se chevauchent). */
export function subsetForRestoStatut<T extends { is_favorite: boolean; statut: string }>(
  places: T[],
  statut: RestoStatut,
): T[] {
  return places.filter((p) => restoStatut(p) === statut);
}
