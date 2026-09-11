import { describe, it, expect } from "vitest";
import { MASQUE } from "./masque";

describe("MASQUE", () => {
  it("ne trahit pas la longueur de la valeur", () => {
    // Un masque qui suit la longueur annonce combien de caractères chercher.
    expect(MASQUE).toBe("••••");
  });

  it("ne contient aucun caractère lisible", () => {
    // Le masque est une constante : par construction, il ne peut rien emprunter
    // à la valeur qu'il remplace. C'est ce qui manquait au Cercle, dont le
    // masque laissait passer les trois derniers caractères.
    expect(MASQUE).toMatch(/^•+$/);
  });
});
