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

// Hôtels v2 : booléens d'équipements réellement fournis par Places API New.
// null/absent = information non fournie (≠ false = explicitement non).
export type Equipements = {
  breakfast?: boolean | null;
  parking?: boolean | null;
  accessibility?: boolean | null;
  goodForChildren?: boolean | null;
  allowsDogs?: boolean | null;
};

export type DetailsOpts = {
  /** Hôtels v2 : demande les champs d'équipements (élargit le FieldMask details). */
  hotel?: boolean;
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
  /** Servi seulement si details(…, { hotel: true }). */
  equipements?: Equipements | null;
};

export interface PlacesProvider {
  search(query: string, opts?: SearchOpts): Promise<PlaceSummary[]>;
  details(placeId: string, opts?: DetailsOpts): Promise<PlaceResult | null>;
  photoUrl(photoRef: string, maxWidth: number): string | null;
}
