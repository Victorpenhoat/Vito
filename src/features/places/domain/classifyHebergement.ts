// Type d'hébergement dérivé des types[] Google Places (symétrique de
// classifyFallback côté restos). Valeurs = check de etablissements.type_hebergement.
export type TypeHebergement = "hotel" | "maison" | "appartement" | "chambre_hotes" | "autre";

export const TYPES_HEBERGEMENT: readonly TypeHebergement[] = ["hotel", "maison", "appartement", "chambre_hotes", "autre"];

export function classifyHebergement(types: string[]): TypeHebergement {
  const t = types.map((x) => x.toLowerCase());
  const has = (...needles: string[]) => needles.some((n) => t.includes(n));
  if (has("bed_and_breakfast", "guest_house", "inn")) return "chambre_hotes";
  if (has("cottage", "farmstay", "chalet", "villa")) return "maison";
  if (has("apartment_rental", "apartment_building", "condominium_complex", "extended_stay_hotel")) return "appartement";
  if (has("hotel", "motel", "resort_hotel", "lodging", "boutique_hotel", "budget_japanese_inn", "japanese_inn")) return "hotel";
  return "autre";
}
