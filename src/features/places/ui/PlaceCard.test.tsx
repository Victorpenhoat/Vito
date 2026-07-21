import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { PlaceCard } from "./PlaceCard";
import type { Place } from "../domain/filterPlaces";

const messages = { places: { noteMaNote: "/ ma note", "conseilléPar": "Conseillé par {name}" } };

const makePlace = (over: Partial<Place["etablissement"]> = {}, tags: Place["tags"] = [], reco_source: string | null = null): Place => ({
  id: "li1",
  statut: "a_faire",
  is_favorite: false,
  reco_source,
  etablissement: {
    id: "e1", nom: "Le Bistrot Démo", type: null, ville: "Paris", arrondissement: null,
    categorie: "resto", photo_ref: null, lat: null, lng: null, place_id: null,
    rating: 4.6, rating_count: 320, ...over,
  },
  tags,
});

const renderCard = (place: Place, variant?: "liste" | "vignette") =>
  render(
    <NextIntlClientProvider locale="fr" messages={messages}>
      <ul>
        <PlaceCard place={place} variant={variant} />
      </ul>
    </NextIntlClientProvider>
  );

describe("PlaceCard — note", () => {
  it("resto : affiche l'étoile et la note /5 formatée (virgule fr)", () => {
    renderCard(makePlace({ categorie: "resto", rating: 4.6 }));
    const note = screen.getByTestId("place-note");
    expect(note).toHaveTextContent("★");
    expect(note).toHaveTextContent("4,6");
    expect(note).not.toHaveTextContent("/ ma note");
  });

  it("hôtel : affiche le score /10 (= rating × 2) avec le label « / ma note »", () => {
    renderCard(makePlace({ categorie: "hotel", rating: 4.5 }));
    const note = screen.getByTestId("place-note");
    expect(note).toHaveTextContent("9,0");
    expect(note).toHaveTextContent("/ ma note");
  });

  it("rating null : aucune note rendue", () => {
    renderCard(makePlace({ rating: null }));
    expect(screen.queryByTestId("place-note")).toBeNull();
  });
});

describe("PlaceCard — variants & chips", () => {
  const tags: Place["tags"] = [
    { slug: "a", label: "Bistrot", color: null },
    { slug: "b", label: "Classique", color: null },
    { slug: "c", label: "Terrasse", color: null },
  ];

  it("liste (défaut) : au plus 2 chips, pas de racine vignette", () => {
    renderCard(makePlace({}, tags));
    expect(screen.getByText("Bistrot")).toBeInTheDocument();
    expect(screen.getByText("Classique")).toBeInTheDocument();
    expect(screen.queryByText("Terrasse")).toBeNull();
    expect(screen.queryByTestId("place-card-vignette")).toBeNull();
  });

  it("vignette : 1 seul chip et racine vignette présente", () => {
    renderCard(makePlace({}, tags), "vignette");
    expect(screen.getByText("Bistrot")).toBeInTheDocument();
    expect(screen.queryByText("Classique")).toBeNull();
    expect(screen.getByTestId("place-card-vignette")).toBeInTheDocument();
  });

  it("liste : racine liste présente, favori et miniature rendus", () => {
    renderCard(makePlace({ nom: "Le Bistrot Démo", ville: "Paris" }, tags));
    expect(screen.getByTestId("place-card-liste")).toBeInTheDocument();
    expect(screen.queryByTestId("place-card-vignette")).toBeNull();
    // sous-titre (type · ville) rendu à droite de la miniature
    expect(screen.getByText("Paris")).toBeInTheDocument();
  });
});

describe("PlaceCard — conseillé par (reco_source)", () => {
  it("liste : affiche « Conseillé par X » quand reco_source présent", () => {
    renderCard(makePlace({}, [], "Camille"));
    expect(screen.getByTestId("place-reco")).toHaveTextContent("Conseillé par Camille");
  });
  it("liste : pas de bloc reco quand reco_source null", () => {
    renderCard(makePlace({}, [], null));
    expect(screen.queryByTestId("place-reco")).toBeNull();
  });
  it("vignette : jamais de bloc reco", () => {
    renderCard(makePlace({}, [], "Camille"), "vignette");
    expect(screen.queryByTestId("place-reco")).toBeNull();
  });
});
