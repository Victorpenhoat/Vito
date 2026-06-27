import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { PlaceCard } from "./PlaceCard";
import type { Place } from "../domain/filterPlaces";

const messages = { places: { noteSur10: "/10" } };

const makePlace = (over: Partial<Place["etablissement"]> = {}, tags: Place["tags"] = []): Place => ({
  id: "li1",
  statut: "a_faire",
  is_favorite: false,
  reco_source: null,
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
    expect(note).not.toHaveTextContent("/10");
  });

  it("hôtel : affiche le score /10 (= rating × 2) formaté", () => {
    renderCard(makePlace({ categorie: "hotel", rating: 4.5 }));
    const note = screen.getByTestId("place-note");
    expect(note).toHaveTextContent("9,0");
    expect(note).toHaveTextContent("/10");
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
});
