import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SearchField } from "./SearchField";

describe("SearchField", () => {
  // La croix n'a de sens que s'il y a quelque chose à effacer. L'afficher à
  // vide met une cible morte sous le doigt.
  it("ne montre la croix que lorsqu'il y a du texte", () => {
    const { rerender } = render(
      <SearchField valeur="" onChange={() => {}} placeholder="Nom, ville, tag…" libelleEffacer="Effacer" />);
    expect(screen.queryByRole("button", { name: "Effacer" })).toBeNull();
    rerender(
      <SearchField valeur="coréen" onChange={() => {}} placeholder="Nom, ville, tag…" libelleEffacer="Effacer" />);
    expect(screen.getByRole("button", { name: "Effacer" })).toBeTruthy();
  });

  it("efface en émettant une chaîne vide", () => {
    const onChange = vi.fn();
    render(<SearchField valeur="coréen" onChange={onChange} placeholder="Nom…" libelleEffacer="Effacer" />);
    fireEvent.click(screen.getByRole("button", { name: "Effacer" }));
    expect(onChange).toHaveBeenCalledWith("");
  });

  // Les e2e ciblent le champ par son data-testid (`places-search`) : il doit
  // siéger sur l'<input>, pas sur le <label> qui l'enveloppe. Écrit de façon à
  // échouer si on le déplaçait.
  it("place testId sur le champ, pas sur son étiquette", () => {
    render(<SearchField valeur="" onChange={() => {}} placeholder="Nom…"
      libelleEffacer="Effacer" testId="places-search" />);
    expect(screen.getByRole("searchbox").getAttribute("data-testid")).toBe("places-search");
  });

  // Hors connexion, le champ doit être inerte POUR DE BON : un champ
  // simplement grisé se laisse encore remplir, et la frappe part dans le vide.
  it("est réellement inerte hors connexion", () => {
    render(<SearchField valeur="" onChange={() => {}} placeholder="Hors connexion"
      libelleEffacer="Effacer" horsLigne />);
    expect(screen.getByRole("searchbox").hasAttribute("disabled")).toBe(true);
  });

  // Le contrat dit que placeholder « sert aussi d'aria-label » : sans nom
  // accessible propre, un lecteur d'écran ne dit rien du champ.
  it("porte placeholder à la fois comme texte indicatif et comme aria-label", () => {
    render(<SearchField valeur="" onChange={() => {}} placeholder="Nom, ville, tag…" libelleEffacer="Effacer" />);
    const champ = screen.getByRole("searchbox", { name: "Nom, ville, tag…" });
    expect(champ.getAttribute("placeholder")).toBe("Nom, ville, tag…");
  });

  // className fait partie de l'interface publique : un futur édit qui le
  // perdrait romprait la mise en page des écrans qui le passent.
  it("applique className passé par l'appelant", () => {
    const { container } = render(
      <SearchField valeur="" onChange={() => {}} placeholder="Nom…" libelleEffacer="Effacer" className="w-80" />);
    expect(container.querySelector("label")).toHaveClass("w-80");
  });

  // Avec un libellé unique ("Effacer") partout ailleurs, ce test passerait
  // même si le composant codait ce texte en dur. Un libellé différent isole
  // le fait que le nom accessible du bouton suit réellement la prop.
  it("nomme la croix selon libelleEffacer, pas un texte figé", () => {
    render(<SearchField valeur="coréen" onChange={() => {}} placeholder="Nom…" libelleEffacer="Vider" />);
    expect(screen.getByRole("button", { name: "Vider" })).toBeTruthy();
  });

  // La frappe au clavier est le seul point d'entrée réel d'un champ de
  // recherche : sans ce test, un composant qui n'écoute plus l'input et ne
  // notifie que le bouton d'effacement passerait toute la suite.
  it("émet la valeur tapée dans le champ", () => {
    const onChange = vi.fn();
    render(<SearchField valeur="" onChange={onChange} placeholder="Nom…" libelleEffacer="Effacer" />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "sushi" } });
    expect(onChange).toHaveBeenCalledWith("sushi");
  });

  // Le test hors-ligne précédent porte sur un champ vide : la croix y est
  // déjà absente parce qu'il n'y a rien à effacer, ce qui ne prouve rien sur
  // horsLigne. Avec du texte présent, seul horsLigne peut expliquer son
  // absence.
  it("masque aussi la croix hors connexion même quand il y a du texte", () => {
    render(<SearchField valeur="coréen" onChange={() => {}} placeholder="Nom…" libelleEffacer="Effacer" horsLigne />);
    expect(screen.queryByRole("button", { name: "Effacer" })).toBeNull();
  });
});
