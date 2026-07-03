import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PhotoVignette } from "./PhotoVignette";

describe("PhotoVignette — fallback monogramme", () => {
  it("affiche la photo quand src est fourni", () => {
    render(<PhotoVignette src="/api/places/photo?ref=ok&w=200" nom="Le Bistrot Démo" />);
    expect(screen.getByRole("img", { name: "Le Bistrot Démo" })).toBeInTheDocument();
    expect(screen.queryByTestId("photo-monogramme")).not.toBeInTheDocument();
  });

  it("retombe sur le monogramme quand l'image ne charge pas (ref expirée/invalide)", () => {
    render(<PhotoVignette src="/api/places/photo?ref=mock_photo_1&w=200" nom="Hôtel Démo" />);
    fireEvent.error(screen.getByRole("img", { name: "Hôtel Démo" }));
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByTestId("photo-monogramme")).toHaveTextContent("H");
  });

  it("affiche le monogramme quand il n'y a pas de photo", () => {
    render(<PhotoVignette src={null} nom="café du 1er" />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByTestId("photo-monogramme")).toHaveTextContent("C");
  });
});
