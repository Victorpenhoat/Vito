import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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
  it("est désactivé quand il est vide et empêche le clic", () => {
    const clic = vi.fn();
    render(<TagChip ton="vide" onClick={clic}>Coréen</TagChip>);
    const btn = screen.getByRole("button");
    expect(btn.hasAttribute("disabled")).toBe(true);
    fireEvent.click(btn);
    expect(clic).not.toHaveBeenCalled();
  });

  // La croix est une seconde action DANS le chip : imbriquer un <button> dans
  // un <button> est invalide et le clavier s'y perd. Le chip doit donc rendre
  // deux éléments frères, pas emboîtés.
  it("sort la croix de retrait du bouton principal", () => {
    render(<TagChip onClick={() => {}} onRetirer={() => {}} libelleRetrait="Retirer Terrasse">Terrasse</TagChip>);
    const retrait = screen.getByRole("button", { name: "Retirer Terrasse" });
    expect(retrait.closest("button")).toBe(retrait);
  });

  // L'attribut `data-testid` porté par le bouton principal permet aux tests e2e
  // de cliquer le chip directement ; s'il glisse sur le wrapper, le clic rate.
  it("porte data-testid sur le bouton principal, pas sur un wrapper", () => {
    render(<TagChip testId="test-chip" onClick={() => {}}>Terrasse</TagChip>);
    const btn = screen.getByTestId("test-chip");
    expect(btn.tagName).toBe("BUTTON");
  });

  // Le chip avec retrait contient un wrapper <span> ; `data-testid` doit rester
  // sur le bouton de contenu, pas migrer sur le wrapper.
  it("porte data-testid sur le bouton même avec onRetirer", () => {
    render(<TagChip testId="test-chip" onClick={() => {}} onRetirer={() => {}} libelleRetrait="Retirer">Terrasse</TagChip>);
    const btn = screen.getByTestId("test-chip");
    expect(btn.tagName).toBe("BUTTON");
    expect(btn.textContent).toContain("Terrasse");
  });

  // Un chip de filtre est un interrupteur ; `aria-pressed` l'annonce. Le lecteur
  // d'écran dit alors que c'est un toggle. Sur un chip sans toggle (ajout,
  // suggestion), l'absence de `aria-pressed` indique une action unique.
  it("porte aria-pressed uniquement sur les tons qui basculent", () => {
    // Ton qui bascule: aria-pressed="false"
    const { rerender } = render(<TagChip ton="defaut" onClick={() => {}}>Terrasse</TagChip>);
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "false");

    // Ton qui bascule: aria-pressed="true"
    rerender(<TagChip ton="selectionne" onClick={() => {}}>Terrasse</TagChip>);
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");

    // Ton qui bascule: aria-pressed="true"
    rerender(<TagChip ton="actif-doux" onClick={() => {}}>Terrasse</TagChip>);
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");

    // Ton d'action : pas de aria-pressed
    rerender(<TagChip ton="ajout" onClick={() => {}}>+ Ajouter</TagChip>);
    expect(screen.getByRole("button")).not.toHaveAttribute("aria-pressed");

    // Ton d'action : pas de aria-pressed
    rerender(<TagChip ton="suggere" onClick={() => {}}>Occasion</TagChip>);
    expect(screen.getByRole("button")).not.toHaveAttribute("aria-pressed");
  });

  // Quand onRetirer est présent, un wrapper <span> enveloppe le bouton principal.
  // `aria-pressed` doit rester sur le <button>, pas migrer sur le wrapper.
  it("porte aria-pressed sur le bouton même avec onRetirer et un ton qui bascule", () => {
    render(
      <TagChip
        ton="selectionne"
        onClick={() => {}}
        onRetirer={() => {}}
        libelleRetrait="Retirer"
      >
        Terrasse
      </TagChip>
    );
    const btn = screen.getByRole("button", { name: "Terrasse" });
    expect(btn).toHaveAttribute("aria-pressed", "true");
  });

  // Un compte à zéro est une information (« aucun résultat »), pas une
  // absence : le masquer ferait disparaître le chiffre au moment précis où il
  // explique le vide.
  it("affiche un compte à zéro", () => {
    render(<TagChip compte={0}>Coréen</TagChip>);
    expect(screen.getByText("Coréen").closest("span")).toHaveTextContent("Coréen0");
  });

  // `couleur` pose un point coloré décoratif à côté du libellé ; `aria-hidden`
  // dit au lecteur d'écran de l'ignorer, le libellé porte déjà le sens.
  it("rend le point de couleur en aria-hidden quand couleur est fourni", () => {
    render(<TagChip couleur="#2f855a">Valeur sûre</TagChip>);
    const chip = screen.getByText("Valeur sûre").closest("span");
    const point = chip!.querySelector("[aria-hidden='true']");
    expect(point).not.toBeNull();
    expect(point).toHaveStyle({ background: "#2f855a" });
  });

  // `pressed` doit l'emporter sur la dérivation par `ton`, dans les deux sens.
  it("laisse pressed remplacer la valeur dérivée du ton", () => {
    // Ton d'action, sans pressed : pas de aria-pressed (comportement dérivé).
    const { rerender } = render(<TagChip ton="ajout" onClick={() => {}} pressed>+ Ajouter</TagChip>);
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");

    // Ton qui bascule normalement vers "true", explicitement forcé à "false".
    rerender(<TagChip ton="selectionne" onClick={() => {}} pressed={false}>Terrasse</TagChip>);
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "false");

    // Omis : le comportement dérivé d'avant reste inchangé.
    rerender(<TagChip ton="selectionne" onClick={() => {}}>Terrasse</TagChip>);
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
  });
});

// Tests de typage : l'union discriminée doit rejeter les appels invalides.
// Ces lignes n'existent pas pour être exécutées, mais pour garantir que
// le compilateur TypeScript refuse les mauvais appels.
describe("TagChip — vérification des types (non exécutée)", () => {
  it("rejette onRetirer sans libelleRetrait", () => {
    // @ts-expect-error — libelleRetrait est obligatoire avec onRetirer
    <TagChip onClick={() => {}} onRetirer={() => {}}>Terrasse</TagChip>;
  });

  it("rejette libelleRetrait sans onRetirer", () => {
    // @ts-expect-error — libelleRetrait ne peut exister sans onRetirer
    <TagChip libelleRetrait="Retirer">Terrasse</TagChip>;
  });
});

describe("TagChip — les tons sémantiques", () => {
  // Un badge dit un état métier ; ce n'est pas un interrupteur. Sans ce test,
  // ajouter `succes` à la liste des tons pressables passerait inaperçu et ferait
  // annoncer « non pressé » sur un badge que personne ne peut presser.
  it("ne portent jamais aria-pressed, même rendus cliquables", () => {
    for (const ton of ["succes", "alerte", "danger"] as const) {
      const { unmount } = render(
        <TagChip ton={ton} onClick={() => {}} testId={`badge-${ton}`}>État</TagChip>,
      );
      expect(screen.getByTestId(`badge-${ton}`).hasAttribute("aria-pressed"), ton).toBe(false);
      unmount();
    }
  });

  // Le contraste de ces tons repose sur --ink, pas sur la couleur du ton : la
  // forme teinte-sur-teinte tombe à 4,27–4,36:1 en thème clair. Les seuils de
  // theme.test.ts tiennent la paire de jetons ; ce test-ci tient le fait qu'on
  // l'emploie réellement, ce que le seuil ne peut pas voir.
  it("écrivent en --ink, jamais dans la couleur du ton", () => {
    for (const ton of ["succes", "alerte", "danger", "actif-doux"] as const) {
      const { unmount } = render(<TagChip ton={ton} testId={`t-${ton}`}>État</TagChip>);
      expect(screen.getByTestId(`t-${ton}`).className, ton).toContain("text-ink");
      unmount();
    }
  });
});
