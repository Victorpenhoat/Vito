import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TagChip } from "./TagChip";

describe("TagChip", () => {
  // Le contrat du spec : « un chip qui filtre est un <button> ; un chip qui
  // décrit n'est pas cliquable. Le composant prend la décision, pas l'écran. »
  // Sans ça, un écran rend un <span> cliquable et le clavier ne l'atteint pas.
  it("n'est un bouton que lorsqu'il agit", () => {
    const { rerender } = render(<TagChip>Terrasse</TagChip>);
    expect(screen.queryByRole("button")).toBeNull();
    rerender(<TagChip onClick={() => {}}>Terrasse</TagChip>);
    expect(screen.getByRole("button")).toBeTruthy();
  });

  // Un chip « vide » annonce zéro : le rendre cliquable promet un filtre qui
  // ne filtrera rien.
  it("refuse le clic quand il est vide", () => {
    const clic = vi.fn();
    render(<TagChip ton="vide" onClick={clic}>Coréen</TagChip>);
    expect(screen.getByRole("button").hasAttribute("disabled")).toBe(true);
  });

  // La croix est une seconde action DANS le chip : imbriquer un <button> dans
  // un <button> est invalide et le clavier s'y perd. Le chip doit donc rendre
  // deux éléments frères, pas emboîtés.
  it("sort la croix de retrait du bouton principal", () => {
    render(<TagChip onClick={() => {}} onRetirer={() => {}} libelleRetrait="Retirer Terrasse">Terrasse</TagChip>);
    const retrait = screen.getByRole("button", { name: "Retirer Terrasse" });
    expect(retrait.closest("button")).toBe(retrait);
  });
});
