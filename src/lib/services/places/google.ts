import type { PlacesProvider, PlaceResult, PlaceSummary, SearchOpts } from "./types";

// Places API (New). Conforme ToS : on ne stocke jamais les bytes des photos.
export class GooglePlacesProvider implements PlacesProvider {
  constructor(private readonly apiKey: string) {}

  async search(query: string, opts?: SearchOpts): Promise<PlaceSummary[]> {
    // FieldMask de base (SKU Essentials). Les enrichissements du design v2
    // (position, ouvert maintenant, photo) ne sont demandés QUE si des opts
    // sont fournies — ils font passer la recherche au SKU Text Search Pro.
    const enrichi = opts !== undefined;
    const fieldMask = enrichi
      ? "places.id,places.displayName,places.formattedAddress,places.location,places.currentOpeningHours.openNow,places.photos,places.types"
      : "places.id,places.displayName,places.formattedAddress";
    const body: Record<string, unknown> = { textQuery: query, languageCode: "fr" };
    if (opts?.openNow) body.openNow = true;
    if (opts?.priceLevels?.length) body.priceLevels = opts.priceLevels.map(intToPriceLevel).filter(Boolean);
    if (opts?.includedType) body.includedType = opts.includedType;
    if (opts?.center && opts.radiusKm) {
      body.locationBias = {
        circle: {
          center: { latitude: opts.center.lat, longitude: opts.center.lng },
          radius: Math.min(opts.radiusKm, 50) * 1000,
        },
      };
    }
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": this.apiKey,
        "X-Goog-FieldMask": fieldMask,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Places search ${res.status}`);
    const json = (await res.json()) as {
      places?: {
        id: string;
        displayName?: { text: string };
        formattedAddress?: string;
        location?: { latitude?: number; longitude?: number };
        currentOpeningHours?: { openNow?: boolean };
        photos?: { name: string }[];
        types?: string[];
      }[];
    };
    return (json.places ?? []).map((p) => ({
      placeId: p.id,
      nom: p.displayName?.text ?? "",
      adresse: p.formattedAddress ?? null,
      ...(enrichi
        ? {
            lat: p.location?.latitude ?? null,
            lng: p.location?.longitude ?? null,
            openNow: p.currentOpeningHours?.openNow ?? null,
            photoRef: p.photos?.[0]?.name ?? null,
            types: p.types ?? [],
          }
        : {}),
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

function intToPriceLevel(n: number): string | null {
  const map: Record<number, string> = {
    1: "PRICE_LEVEL_INEXPENSIVE",
    2: "PRICE_LEVEL_MODERATE",
    3: "PRICE_LEVEL_EXPENSIVE",
    4: "PRICE_LEVEL_VERY_EXPENSIVE",
  };
  return map[n] ?? null;
}
