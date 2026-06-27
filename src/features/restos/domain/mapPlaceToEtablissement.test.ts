import { describe, it, expect } from "vitest";
import { mapPlaceToEtablissement } from "./mapPlaceToEtablissement";
import type { PlaceResult } from "@/lib/services/places/types";

const place: PlaceResult = {
  placeId: "mock_etoile_1", nom: "La Table Étoilée", adresse: "1 av Gourmet",
  ville: "Paris", codePostal: "75008", lat: 48.87, lng: 2.31,
  telephone: "+33 1 43 00 00 00", website: "https://x.fr", priceLevel: 4,
  rating: 4.8, ratingCount: 156,
  types: ["restaurant", "fine_dining"], photoRefs: ["p"],
};

describe("mapPlaceToEtablissement", () => {
  it("mappe les champs et déduit l'arrondissement parisien", () => {
    const e = mapPlaceToEtablissement(place);
    expect(e.place_id).toBe("mock_etoile_1");
    expect(e.type).toBe("étoilé");
    expect(e.arrondissement).toBe("8e");
    expect(e.categorie).toBe("resto");
    expect(e.source).toBe("places");
    expect(e.photo_ref).toBe("p");
  });

  const withCp = (ville: string | null, codePostal: string | null): PlaceResult => ({
    ...place,
    ville,
    codePostal,
  });

  it("75001 -> 1er (convention française)", () => {
    expect(mapPlaceToEtablissement(withCp("Paris", "75001")).arrondissement).toBe("1er");
  });
  it("75020 -> 20e (borne haute)", () => {
    expect(mapPlaceToEtablissement(withCp("Paris", "75020")).arrondissement).toBe("20e");
  });
  it("75021 (hors plage) -> null", () => {
    expect(mapPlaceToEtablissement(withCp("Paris", "75021")).arrondissement).toBeNull();
  });
  it("ville non parisienne -> null", () => {
    expect(mapPlaceToEtablissement(withCp("Lyon", "69001")).arrondissement).toBeNull();
  });
  it("code postal absent -> null", () => {
    expect(mapPlaceToEtablissement(withCp("Paris", null)).arrondissement).toBeNull();
  });
});

const base: PlaceResult = {
  placeId: "p1", nom: "Le Test", adresse: null, ville: "Paris", codePostal: "75011",
  lat: 48.8, lng: 2.3, telephone: null, website: null, priceLevel: 2, types: ["restaurant"],
  photoRefs: [], rating: 4.6, ratingCount: 320,
};

it("mappe rating et rating_count", () => {
  const e = mapPlaceToEtablissement(base, "resto");
  expect(e.rating).toBe(4.6);
  expect(e.rating_count).toBe(320);
});
