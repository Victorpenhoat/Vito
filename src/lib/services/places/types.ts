export type PlaceSummary = {
  placeId: string;
  nom: string;
  adresse: string | null;
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
  types: string[];
  photoRefs: string[];
};

export interface PlacesProvider {
  search(query: string): Promise<PlaceSummary[]>;
  details(placeId: string): Promise<PlaceResult | null>;
  photoUrl(photoRef: string, maxWidth: number): string | null;
}
