import type { Place } from "./filterPlaces";
import type { PlaceSummary } from "@/lib/services/places/types";

export type Envie = { emoji: string; labelKey: string; query: string };

/** « Explorer par envie » par catégorie. resto = cuisines ; hotel = 4 ambiances. */
export function searchEnvies(category: "resto" | "hotel"): Envie[] {
  if (category === "hotel") {
    return [
      { emoji: "🏖️", labelKey: "envieBordDeMer", query: "bord de mer" },
      { emoji: "💆", labelKey: "envieSpa", query: "spa" },
      { emoji: "🏨", labelKey: "envieBoutique", query: "hôtel boutique" },
      { emoji: "🏊", labelKey: "enviePiscine", query: "piscine" },
    ];
  }
  return [
    { emoji: "🍷", labelKey: "envieCaveAManger", query: "cave à manger" },
    { emoji: "🐟", labelKey: "envieFruitsDeMer", query: "fruits de mer" },
    { emoji: "🍝", labelKey: "envieItalien", query: "italien" },
    { emoji: "☕", labelKey: "envieBrunch", query: "brunch" },
  ];
}

/** Annote chaque résultat externe selon qu'il est déjà possédé (par place_id). Ordre préservé. */
export function markOwned(
  results: PlaceSummary[],
  places: Place[],
): { result: PlaceSummary; owned: boolean }[] {
  const ownedIds = new Set(
    places.map((p) => p.etablissement.place_id).filter((x): x is string => !!x),
  );
  return results.map((result) => ({ result, owned: ownedIds.has(result.placeId) }));
}

/** Ajoute une recherche en tête (dédupliquée, casse-insensible), plafonnée à max. */
export function addRecent(list: string[], query: string, max = 5): string[] {
  const term = query.trim();
  if (!term) return list;
  const rest = list.filter((r) => r.toLowerCase() !== term.toLowerCase());
  return [term, ...rest].slice(0, max);
}

/** Retire une recherche récente (correspondance exacte). */
export function removeRecent(list: string[], query: string): string[] {
  return list.filter((r) => r !== query);
}
