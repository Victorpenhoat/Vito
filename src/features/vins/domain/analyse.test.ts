import { describe, it, expect } from "vitest";
import { lireAnalyse, niveauProfil, remplissageProfil } from "./analyse";

describe("lireAnalyse", () => {
  it("relit une analyse complète", () => {
    const a = lireAnalyse({
      profil: { corps: 4, tanins: 3, acidite: 2.5, sucre: 0 },
      aromes: ["Fruits noirs", "Garrigue"],
      accords: ["Gigot d'agneau"],
      service: { temperature: "16–18 °C", carafage: "1 h", garde: "10 ans et plus" },
      prixEstime: 28,
      presentation: "Référence de Bandol.",
    });
    expect(a?.profil.corps).toBe(4);
    expect(a?.aromes).toEqual(["Fruits noirs", "Garrigue"]);
    expect(a?.prixEstime).toBe(28);
  });

  it("écarte ce qui n'est pas exploitable au lieu de casser la fiche", () => {
    const a = lireAnalyse({
      profil: { corps: "beaucoup", tanins: null },
      aromes: ["Poivre", 42, "", "Poivre"],
      accords: "pas un tableau",
      service: { temperature: "  " },
      prixEstime: "cher",
    });
    expect(a?.profil.corps).toBeNull();
    expect(a?.aromes).toEqual(["Poivre"]); // dédupliqué, vides et non-textes retirés
    expect(a?.accords).toEqual([]);
    expect(a?.service.temperature).toBeNull();
    expect(a?.prixEstime).toBeNull();
  });

  it("renvoie null quand il ne reste rien à montrer", () => {
    expect(lireAnalyse(null)).toBeNull();
    expect(lireAnalyse("une chaîne")).toBeNull();
    expect(lireAnalyse({})).toBeNull();
    expect(lireAnalyse({ aromes: [], accords: [], profil: {} })).toBeNull();
  });

  it("garde une analyse même réduite à un seul champ", () => {
    expect(lireAnalyse({ presentation: "Un mot." })?.presentation).toBe("Un mot.");
  });
});

describe("niveauProfil", () => {
  it("donne trois crans", () => {
    expect(niveauProfil(1)).toBe("bas");
    expect(niveauProfil(3)).toBe("moyen");
    expect(niveauProfil(4.5)).toBe("haut");
  });

  it("ignore une valeur hors jauge plutôt que de la ramener de force", () => {
    expect(niveauProfil(null)).toBeNull();
    expect(niveauProfil(-1)).toBeNull();
    expect(niveauProfil(9)).toBeNull();
  });
});

describe("remplissageProfil", () => {
  it("convertit la jauge en pourcentage", () => {
    expect(remplissageProfil(5)).toBe(100);
    expect(remplissageProfil(2.5)).toBe(50);
    expect(remplissageProfil(null)).toBe(0);
    expect(remplissageProfil(12)).toBe(0);
  });
});
