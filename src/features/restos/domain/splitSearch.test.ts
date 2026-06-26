import { describe, it, expect } from "vitest";
import { splitSearch } from "./splitSearch";
import type { Place } from "@/features/places/domain/filterPlaces";

const place = (over: Partial<Place> & { nom: string; place_id?: string | null }): Place => ({
  id: Math.random().toString(36),
  statut: over.statut ?? "a_faire",
  is_favorite: over.is_favorite ?? false,
  etablissement: { id: "e", nom: over.nom, type: null, ville: null, arrondissement: null, categorie: "resto", photo_ref: null, lat: null, lng: null, place_id: over.place_id ?? null },
  tags: [],
});

const ext = (placeId: string, nom: string) => ({ placeId, nom, adresse: null });

describe("splitSearch", () => {
  const places: Place[] = [
    place({ nom: "Bistrot Favori", is_favorite: true, place_id: "p_fav" }),
    place({ nom: "Bistrot ATester", statut: "a_faire", place_id: "p_test" }),
    place({ nom: "Bistrot Visite", statut: "visite", place_id: "p_vis" }),
  ];

  it("query vide → tout vide", () => {
    expect(splitSearch("", places, [ext("x", "X")])).toEqual({ favoris: [], aTester: [], externes: [] });
  });
  it("priorise favoris puis à tester (sans visités)", () => {
    const r = splitSearch("bistrot", places, []);
    expect(r.favoris.map((p) => p.etablissement.nom)).toEqual(["Bistrot Favori"]);
    expect(r.aTester.map((p) => p.etablissement.nom)).toEqual(["Bistrot ATester"]);
  });
  it("dédoublonne les externes déjà possédés (par place_id)", () => {
    const r = splitSearch("bistrot", places, [ext("p_fav", "Doublon"), ext("p_new", "Nouveau")]);
    expect(r.externes.map((e) => e.placeId)).toEqual(["p_new"]);
  });
});
