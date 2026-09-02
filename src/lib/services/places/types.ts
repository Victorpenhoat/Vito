export type PlaceSummary = {
  placeId: string;
  nom: string;
  adresse: string | null;
  // Restos v2 (Lot R-C) — enrichissements optionnels de la recherche externe.
  // ⚠ Les servir depuis Google élargit le FieldMask (SKU Text Search Pro).
  lat?: number | null;
  lng?: number | null;
  openNow?: boolean | null;
  photoRef?: string | null;
  types?: string[];
};

// Options de recherche externe (design écran 7). Tout est optionnel :
// sans opts, le comportement historique est inchangé (hôtels, e2e).
export type SearchOpts = {
  openNow?: boolean;
  /** Niveaux de prix Google 1..4 (inexpensive → very expensive). */
  priceLevels?: number[];
  /** Biais de localisation : cercle centre+rayon (km, ≤ 50). */
  center?: { lat: number; lng: number };
  radiusKm?: number;
  /** Un type Google à la fois (ex. italian_restaurant). */
  includedType?: string;
};

export type PlaceResult = {
  placeId: string;
  nom: string;
  adresse: string | null;
  ville: string | null;
  codePostal: string | null;
  lat: number | null;
  lng: number | null;
  telephone: string | null;
  website: string | null;
  priceLevel: number | null;
  rating: number | null;
  ratingCount: number | null;
  types: string[];
  photoRefs: string[];
};

export interface PlacesProvider {
  search(query: string, opts?: SearchOpts): Promise<PlaceSummary[]>;
  details(placeId: string): Promise<PlaceResult | null>;
  photoUrl(photoRef: string, maxWidth: number): string | null;
}
