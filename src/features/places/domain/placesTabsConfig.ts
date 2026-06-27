import type { Place } from "./filterPlaces";

export type PlacesTab = "favoris" | "recommandes" | "carte" | "recherche";
export type PlaceView = "liste" | "vignettes" | "carte";

export const TAB_VIEWS: Record<"favoris" | "recommandes", PlaceView[]> = {
  favoris: ["liste", "vignettes", "carte"],
  recommandes: ["liste"],
};

/** Items d'un onglet de liste. favoris = coups de cœur ; recommandes = à tester (statut a_faire). */
export function subsetForTab(places: Place[], tab: "favoris" | "recommandes"): Place[] {
  return tab === "favoris"
    ? places.filter((p) => p.is_favorite)
    : places.filter((p) => p.statut === "a_faire");
}
