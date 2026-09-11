import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SubTabPills } from "./SubTabPills";

const OPTIONS = [
  { cle: "favoris" as const, libelle: "Favoris", compte: 8 },
  { cle: "a_tester" as const, libelle: "À tester", compte: 12 },
];

describe("SubTabPills", () => {
  // Le rôle ARIA n'est pas décoratif : sans lui, un lecteur d'écran annonce
  // une rangée de boutons sans dire lequel est courant.
  it("annonce ses onglets et celui qui est courant", () => {
    render(<SubTabPills options={OPTIONS} valeur="favoris" onChange={() => {}} ariaLabel="Vue" />);
    const onglets = screen.getAllByRole("tab");
    expect(onglets).toHaveLength(2);
    expect(onglets[0]!.getAttribute("aria-selected")).toBe("true");
    expect(onglets[1]!.getAttribute("aria-selected")).toBe("false");
  });

  it("émet la clé choisie, pas l'index", () => {
    const onChange = vi.fn();
    render(<SubTabPills options={OPTIONS} valeur="favoris" onChange={onChange} ariaLabel="Vue" />);
    const tabATestrer = screen.getByRole("tab", { name: /À tester/ });
    fireEvent.click(tabATestrer);
    expect(onChange).toHaveBeenCalledWith("a_tester");
  });

  // Un compteur à zéro est une information (« rien ici »), pas une absence :
  // le masquer ferait disparaître la pastille au moment où elle explique le vide.
  it("affiche un compteur à zéro", () => {
    render(<SubTabPills options={[{ cle: "x" as const, libelle: "Vide", compte: 0 }]}
      valeur="x" onChange={() => {}} ariaLabel="Vue" />);
    expect(screen.getByRole("tab").textContent).toContain("0");
  });

  // Les props de configuration (testId, idOnglet, ariaControls) doivent siéger
  // sur l'élément interactif (button), pas sur le wrapper tablist. Les tests e2e
  // cliquent sur getByRole("tab"), et aria-labelledby/aria-controls établissent
  // la relation onglet/panneau uniquement si ces attributs sont sur le tab lui-même.
  it("place testId, idOnglet et ariaControls sur l'onglet interactif", () => {
    render(
      <SubTabPills
        options={OPTIONS}
        valeur="favoris"
        onChange={() => {}}
        ariaLabel="Vue"
        testId={(cle) => `tab-${cle}`}
        idOnglet={(cle) => `onglet-${cle}`}
        ariaControls="panel-contenu"
      />
    );
    const onglets = screen.getAllByRole("tab");

    // Première pastille : testId, idOnglet, ariaControls sur le button lui-même
    expect(onglets[0]!.getAttribute("data-testid")).toBe("tab-favoris");
    expect(onglets[0]!.getAttribute("id")).toBe("onglet-favoris");
    expect(onglets[0]!.getAttribute("aria-controls")).toBe("panel-contenu");

    // Deuxième pastille : idem
    expect(onglets[1]!.getAttribute("data-testid")).toBe("tab-a_tester");
    expect(onglets[1]!.getAttribute("id")).toBe("onglet-a_tester");
    expect(onglets[1]!.getAttribute("aria-controls")).toBe("panel-contenu");
  });
});
