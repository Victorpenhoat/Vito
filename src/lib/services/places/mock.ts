import type { PlacesProvider, PlaceResult, PlaceSummary, SearchOpts } from "./types";

type Fixture = PlaceResult & { openNow: boolean };

const FIXTURES: Fixture[] = [
  {
    placeId: "mock_bistrot_1",
    nom: "Le Bistrot du Coin",
    adresse: "12 rue des Acacias",
    ville: "Paris",
    codePostal: "75017",
    lat: 48.878,
    lng: 2.295,
    telephone: "+33 1 42 00 00 00",
    website: "https://exemple.fr",
    priceLevel: 2,
    rating: 4.6,
    ratingCount: 320,
    types: ["restaurant", "bistro"],
    photoRefs: ["mock_photo_1"],
    openNow: true,
  },
  {
    placeId: "mock_etoile_1",
    nom: "La Table Étoilée",
    adresse: "1 avenue Gourmet",
    ville: "Paris",
    codePostal: "75008",
    lat: 48.87,
    lng: 2.31,
    telephone: "+33 1 43 00 00 00",
    website: "https://exemple-etoile.fr",
    priceLevel: 4,
    rating: 4.8,
    ratingCount: 156,
    types: ["restaurant", "fine_dining"],
    photoRefs: ["mock_photo_2"],
    openNow: false,
  },
  {
    placeId: "mock_hotel_1",
    nom: "Hôtel des Voyageurs",
    adresse: "5 place de la Gare",
    ville: "Lyon",
    codePostal: "69002",
    lat: 45.76,
    lng: 4.83,
    telephone: "+33 4 78 00 00 00",
    website: "https://hotel-voyageurs.fr",
    priceLevel: 3,
    rating: 4.5,
    ratingCount: 210,
    types: ["lodging", "hotel"],
    photoRefs: ["mock_photo_h1"],
    openNow: true,
  },
  {
    placeId: "mock_hotel_2",
    nom: "Grand Hôtel Riviera",
    adresse: "10 promenade des Anglais",
    ville: "Nice",
    codePostal: "06000",
    lat: 43.69,
    lng: 7.26,
    telephone: "+33 4 93 00 00 00",
    website: "https://grand-hotel-riviera.fr",
    priceLevel: 4,
    rating: 4.5,
    ratingCount: 487,
    types: ["lodging", "hotel"],
    photoRefs: ["mock_photo_h2"],
    openNow: true,
  },
];

export class MockPlacesProvider implements PlacesProvider {
  async search(query: string, opts?: SearchOpts): Promise<PlaceSummary[]> {
    const q = query.toLowerCase();
    let hits = FIXTURES.filter(
      (f) => f.nom.toLowerCase().includes(q) || f.types.some((t) => t.includes(q))
    );
    // Filtres v2 (mêmes sémantiques que Google, pour les e2e du Lot R-C)
    if (opts?.openNow) hits = hits.filter((f) => f.openNow);
    if (opts?.priceLevels?.length) hits = hits.filter((f) => f.priceLevel != null && opts.priceLevels!.includes(f.priceLevel));
    if (opts?.includedType) hits = hits.filter((f) => f.types.includes(opts.includedType!));
    const enrichi = opts !== undefined;
    return hits.map((f) => ({
      placeId: f.placeId,
      nom: f.nom,
      adresse: f.adresse,
      ...(enrichi
        ? { lat: f.lat, lng: f.lng, openNow: f.openNow, photoRef: f.photoRefs[0] ?? null, types: f.types }
        : {}),
    }));
  }
  async details(placeId: string): Promise<PlaceResult | null> {
    const f = FIXTURES.find((x) => x.placeId === placeId);
    if (!f) return null;
    const { openNow: _openNow, ...result } = f;
    return result;
  }
  photoUrl(photoRef: string, _maxWidth: number): string | null {
    if (!photoRef) return null;
    // Dev/démo : si la réf est déjà une URL http(s) ou un data-URI (photos de seed),
    // on la renvoie telle quelle -> /api/places/photo la streame (http) ou redirige
    // (data:). Sinon, placeholder 1×1 déterministe (maxWidth ignoré).
    if (/^https?:\/\//.test(photoRef) || photoRef.startsWith("data:")) return photoRef;
    return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  }
}
