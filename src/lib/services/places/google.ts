import type { PlacesProvider, PlaceResult, PlaceSummary } from "./types";

// Places API (New). Conforme ToS : on ne stocke jamais les bytes des photos.
export class GooglePlacesProvider implements PlacesProvider {
  constructor(private readonly apiKey: string) {}

  async search(query: string): Promise<PlaceSummary[]> {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": this.apiKey,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress",
      },
      body: JSON.stringify({ textQuery: query, languageCode: "fr" }),
    });
    if (!res.ok) throw new Error(`Places search ${res.status}`);
    const json = (await res.json()) as {
      places?: { id: string; displayName?: { text: string }; formattedAddress?: string }[];
    };
    return (json.places ?? []).map((p) => ({
      placeId: p.id,
      nom: p.displayName?.text ?? "",
      adresse: p.formattedAddress ?? null,
    }));
  }

  async details(placeId: string): Promise<PlaceResult | null> {
    const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
      headers: {
        "X-Goog-Api-Key": this.apiKey,
        "X-Goog-FieldMask":
          "id,displayName,formattedAddress,location,internationalPhoneNumber,websiteUri,priceLevel,rating,userRatingCount,types,photos,addressComponents",
      },
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Places details ${res.status}`);
    const p = (await res.json()) as Record<string, unknown>;
    const loc = p.location as { latitude?: number; longitude?: number } | undefined;
    const comps =
      (p.addressComponents as { types: string[]; longText: string }[] | undefined) ?? [];
    const cp = comps.find((c) => c.types.includes("postal_code"))?.longText ?? null;
    const ville = comps.find((c) => c.types.includes("locality"))?.longText ?? null;
    const photos = (p.photos as { name: string }[] | undefined) ?? [];
    return {
      placeId: (p.id as string | undefined) ?? "",
      nom: (p.displayName as { text: string } | undefined)?.text ?? "",
      adresse: (p.formattedAddress as string) ?? null,
      ville,
      codePostal: cp,
      lat: loc?.latitude ?? null,
      lng: loc?.longitude ?? null,
      telephone: (p.internationalPhoneNumber as string) ?? null,
      website: (p.websiteUri as string) ?? null,
      priceLevel: priceLevelToInt(p.priceLevel as string | undefined),
      rating: typeof p.rating === "number" ? p.rating : null,
      ratingCount: (p.userRatingCount as number | undefined) ?? null,
      types: (p.types as string[]) ?? [],
      photoRefs: photos.map((ph) => ph.name),
    };
  }

  photoUrl(photoRef: string, maxWidth: number): string | null {
    if (!photoRef) return null;
    return `https://places.googleapis.com/v1/${photoRef}/media?maxWidthPx=${maxWidth}&key=${this.apiKey}`;
  }
}

function priceLevelToInt(level: string | undefined): number | null {
  const map: Record<string, number> = {
    PRICE_LEVEL_FREE: 0,
    PRICE_LEVEL_INEXPENSIVE: 1,
    PRICE_LEVEL_MODERATE: 2,
    PRICE_LEVEL_EXPENSIVE: 3,
    PRICE_LEVEL_VERY_EXPENSIVE: 4,
  };
  return level && level in map ? map[level]! : null;
}
