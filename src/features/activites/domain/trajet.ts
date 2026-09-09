import { haversineKm } from "@/features/restos/domain/distance";

// « ~22 min depuis chez nous ».
//
// C'est une ESTIMATION, et le mot compte : la distance est prise à vol
// d'oiseau, et la durée en découle par une vitesse moyenne. Aucun itinéraire
// n'est calculé — ni route, ni trafic, ni sens interdit. Promettre un temps de
// trajet réel demanderait une API payante ; annoncer un ordre de grandeur ne
// demande rien et ne trompe personne, à condition de le dire.

/**
 * Vitesse moyenne retenue, en km/h.
 *
 * 22 km/h : c'est la vitesse effective d'un trajet urbain court une fois
 * comptés les feux, les détours et le stationnement — bien en dessous de la
 * vitesse autorisée, et volontairement.
 */
export const VITESSE_MOYENNE_KMH = 22;

/** Le détour réel par les rues, rapporté à la ligne droite. */
const SINUOSITE = 1.3;

export type Point = { lat: number; lng: number };

/**
 * Durée estimée en minutes, ou `null` s'il manque un des deux points.
 *
 * Jamais moins d'une minute : « ~0 min » ne veut rien dire, et un club au coin
 * de la rue demande quand même de sortir.
 */
export function dureeEstimeeMinutes(depuis: Point | null, vers: Point | null): number | null {
  if (!depuis || !vers) return null;
  const km = haversineKm(depuis, vers) * SINUOSITE;
  return Math.max(1, Math.round((km / VITESSE_MOYENNE_KMH) * 60));
}
