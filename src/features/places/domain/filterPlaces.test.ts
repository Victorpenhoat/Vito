import { describe, it, expect } from "vitest";
import { filterPlaces } from "./filterPlaces";

const P = (nom: string, ville: string | null, tags: string[] = []) => ({
  id: nom, statut: "a_faire" as const, is_favorite: false,
  etablissement: { id: nom, nom, type: null, ville, arrondissement: null, categorie: "resto" as const, photo_ref: null, lat: null, lng: null, place_id: null },
  tags: tags.map((label) => ({ slug: label, label, color: null })),
});

describe("filterPlaces", () => {
  const list = [P("Le Comptoir", "Paris", ["terrasse"]), P("Septime", "Lyon", ["gastronomique"])];
  it("query vide → tout", () => expect(filterPlaces(list, "")).toHaveLength(2));
  it("matche le nom (insensible casse)", () => expect(filterPlaces(list, "comptoir").map((p) => p.id)).toEqual(["Le Comptoir"]));
  it("matche la ville", () => expect(filterPlaces(list, "lyon").map((p) => p.id)).toEqual(["Septime"]));
  it("matche un tag", () => expect(filterPlaces(list, "gastro").map((p) => p.id)).toEqual(["Septime"]));
  it("accents ignorés", () => expect(filterPlaces([P("Crêperie", "Brest")], "creperie")).toHaveLength(1));
});
