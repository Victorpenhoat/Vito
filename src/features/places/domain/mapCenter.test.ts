import { describe, it, expect } from "vitest";
import { mapCenter } from "./mapCenter";
import type { Place } from "./filterPlaces";

const place = (lat: number | null, lng: number | null): Place => ({
  id: Math.random().toString(36), statut: "a_faire", is_favorite: false,
  etablissement: { id: "x", nom: "X", type: null, ville: null, arrondissement: null, categorie: "resto", photo_ref: null, lat, lng, place_id: null, rating: null, rating_count: null },
  tags: [],
});

describe("mapCenter", () => {
  it("moyenne les coordonnées valides", () => {
    const c = mapCenter([place(48, 2), place(50, 4)]);
    expect(c.lat).toBeCloseTo(49);
    expect(c.lng).toBeCloseTo(3);
  });
  it("ignore les coords nulles", () => {
    const c = mapCenter([place(48, 2), place(null, null)]);
    expect(c.lat).toBeCloseTo(48);
    expect(c.lng).toBeCloseTo(2);
  });
  it("défaut Paris si aucune coord", () => {
    const c = mapCenter([place(null, null)]);
    expect(c.lat).toBeCloseTo(48.8566);
    expect(c.lng).toBeCloseTo(2.3522);
  });
});
