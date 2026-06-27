import { describe, it, expect } from "vitest";
import { subsetForTab, TAB_VIEWS } from "./placesTabsConfig";
import type { Place } from "./filterPlaces";

const mk = (over: Partial<Place>): Place => ({
  id: Math.random().toString(36),
  statut: "a_faire",
  is_favorite: false,
  reco_source: null,
  etablissement: { id: "e", nom: "X", type: null, ville: null, arrondissement: null, categorie: "resto", photo_ref: null, lat: null, lng: null, place_id: null, rating: null, rating_count: null },
  tags: [],
  ...over,
});

describe("subsetForTab", () => {
  const list = [
    mk({ id: "fav", is_favorite: true, statut: "visite" }),
    mk({ id: "todo", is_favorite: false, statut: "a_faire" }),
    mk({ id: "vis", is_favorite: false, statut: "visite" }),
  ];
  it("favoris → uniquement is_favorite", () => {
    expect(subsetForTab(list, "favoris").map((p) => p.id)).toEqual(["fav"]);
  });
  it("recommandes → uniquement statut a_faire", () => {
    expect(subsetForTab(list, "recommandes").map((p) => p.id)).toEqual(["todo"]);
  });
});

describe("TAB_VIEWS", () => {
  it("favoris a les 3 vues", () => expect(TAB_VIEWS.favoris).toEqual(["liste", "vignettes", "carte"]));
  it("recommandes en liste seule", () => expect(TAB_VIEWS.recommandes).toEqual(["liste"]));
});
