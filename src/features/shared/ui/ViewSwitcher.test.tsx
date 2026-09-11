import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ViewSwitcher } from "./ViewSwitcher";

const OPTIONS = [
  { cle: "liste" as const, icone: <span>☰</span>, libelle: "Liste" },
  { cle: "vignettes" as const, icone: <span>▦</span>, libelle: "Vignettes" },
];

describe("ViewSwitcher", () => {
  // L'icône seule ne dit rien à un lecteur d'écran : le libellé doit être le
  // nom accessible, et l'état courant doit s'annoncer.
  it("nomme chaque vue et annonce la courante", () => {
    render(<ViewSwitcher options={OPTIONS} valeur="liste" onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Liste" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Vignettes" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("émet la clé choisie", () => {
    const onChange = vi.fn();
    render(<ViewSwitcher options={OPTIONS} valeur="liste" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Vignettes" }));
    expect(onChange).toHaveBeenCalledWith("vignettes");
  });

  // Le composant ne décide pas du nombre de vues : la carte en est une chez
  // Restos tant que le lot 4 ne l'a pas sortie du commutateur.
  it("rend autant de segments qu'on lui en donne", () => {
    render(<ViewSwitcher valeur="liste" onChange={() => {}}
      options={[...OPTIONS, { cle: "carte" as const, icone: <span>◍</span>, libelle: "Carte" }]} />);
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });

  // testId doit se retrouver sur le bouton lui-même : c'est lui que les tests
  // e2e ciblent, pas le rail qui l'entoure.
  it("place testId sur le bouton interactif", () => {
    render(<ViewSwitcher options={OPTIONS} valeur="liste" onChange={() => {}}
      testId={(cle) => `vue-${cle}`} />);
    expect(screen.getByRole("button", { name: "Vignettes" }).getAttribute("data-testid")).toBe("vue-vignettes");
  });
});
