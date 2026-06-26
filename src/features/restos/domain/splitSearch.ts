import { filterPlaces, type Place } from "@/features/places/domain/filterPlaces";
import type { PlaceSummary } from "@/lib/services/places/types";

export function splitSearch(
  query: string,
  places: Place[],
  externals: PlaceSummary[],
): { favoris: Place[]; aTester: Place[]; externes: PlaceSummary[] } {
  if (!query.trim()) return { favoris: [], aTester: [], externes: [] };
  const matched = filterPlaces(places, query);
  const favoris = matched.filter((p) => p.is_favorite);
  const aTester = matched.filter((p) => !p.is_favorite && p.statut === "a_faire");
  const ownedPlaceIds = new Set(places.map((p) => p.etablissement.place_id).filter((x): x is string => !!x));
  const externes = externals.filter((e) => !ownedPlaceIds.has(e.placeId));
  return { favoris, aTester, externes };
}
