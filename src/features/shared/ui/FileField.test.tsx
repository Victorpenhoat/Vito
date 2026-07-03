import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FileField } from "./FileField";

describe("FileField", () => {
  it("affiche le libellé du bouton et l'état vide", () => {
    render(<FileField label="Choisir un fichier" emptyLabel="Aucun fichier" name="file" />);
    expect(screen.getByText("Choisir un fichier")).toBeInTheDocument();
    expect(screen.getByText("Aucun fichier")).toBeInTheDocument();
  });

  it("affiche le nom du fichier sélectionné", () => {
    render(<FileField label="Choisir un fichier" emptyLabel="Aucun fichier" name="file" data-testid="upload" />);
    const input = screen.getByTestId("upload");
    const file = new File(["%PDF-1.4"], "passeport.pdf", { type: "application/pdf" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(screen.getByText("passeport.pdf")).toBeInTheDocument();
    expect(screen.queryByText("Aucun fichier")).not.toBeInTheDocument();
  });

  it("forwarde name/accept/data-testid sur l'input natif (actions serveur + setInputFiles)", () => {
    render(<FileField label="Choisir" emptyLabel="Vide" name="file" accept=".pdf" data-testid="upload" />);
    const input = screen.getByTestId("upload");
    expect(input).toHaveAttribute("type", "file");
    expect(input).toHaveAttribute("name", "file");
    expect(input).toHaveAttribute("accept", ".pdf");
  });
});
