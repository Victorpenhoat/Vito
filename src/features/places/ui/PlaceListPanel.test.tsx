import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { PlaceListPanel } from "./PlaceListPanel";
import type { Place } from "../domain/filterPlaces";

const messages = {
  places: {
    filtrerPlaceholder: "Filtrer…",
    vueListe: "Liste",
    vueVignettes: "Vignettes",
    vueCarte: "Carte",
    tagTous: "Tous",
    emptyRecherche: "Aucun résultat pour cette recherche.",
    emptyFavorisTitle: "Aucun favori pour l'instant",
    emptyFavorisBody: "Découvrez des adresses et ajoutez-les à vos favoris.",
    emptyCtaHotel: "Découvrir des hôtels",
    emptyCtaResto: "Découvrir des restos",
    "conseilléPar": "Conseillé par {name}",
    noteMaNote: "/ ma note",
  },
};

const makePlace = (over: Partial<Place["etablissement"]> = {}): Place => ({
  id: "li1",
  statut: "a_faire",
  is_favorite: true,
  reco_source: null,
  etablissement: {
    id: "e1",
    nom: "Le Bistrot Démo",
    type: null,
    ville: "Paris",
    arrondissement: null,
    categorie: "hotel",
    photo_ref: null,
    lat: null,
    lng: null,
    place_id: null,
    rating: 4.6,
    rating_count: 320,
    ...over,
  },
  tags: [],
});

const renderPanel = (places: Place[]) =>
  render(
    <NextIntlClientProvider locale="fr" messages={messages}>
      <PlaceListPanel
        places={places}
        views={["liste"]}
        locale="fr"
        category="hotel"
        emptyKind="favoris"
        onDiscover={() => {}}
      />
    </NextIntlClientProvider>
  );

describe("PlaceListPanel — état vide riche vs. recherche sans résultat", () => {
  it("aucune donnée : affiche l'état vide riche", () => {
    renderPanel([]);
    expect(screen.getByTestId("place-empty-state")).toBeInTheDocument();
  });

  it("données présentes mais recherche sans résultat : pas d'état vide riche, message neutre", async () => {
    const user = userEvent.setup();
    renderPanel([makePlace()]);
    const search = screen.getByTestId("places-search");
    await user.type(search, "zzz-aucune-correspondance");
    expect(screen.queryByTestId("place-empty-state")).toBeNull();
    expect(screen.getByText("Aucun résultat pour cette recherche.")).toBeInTheDocument();
  });
});
