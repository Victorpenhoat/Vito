import { describe, it, expect } from "vitest";
import { etatValidite, joursAvant } from "./protege";

const AUJ = "2026-09-07";

describe("etatValidite", () => {
  it("hier : expiré", () => {
    expect(etatValidite("2026-09-06", AUJ)).toBe("expire");
  });

  it("aujourd'hui : pas encore expiré — on a la journée", () => {
    expect(etatValidite(AUJ, AUJ)).toBe("bientot");
  });

  it("dans 21 jours : bientôt, comme le dit la maquette", () => {
    expect(etatValidite("2026-09-28", AUJ)).toBe("bientot");
  });

  it("le seuil est à 30 jours pile", () => {
    expect(etatValidite("2026-10-07", AUJ)).toBe("bientot");
    expect(etatValidite("2026-10-08", AUJ)).toBe("valide");
  });

  it("sans date, aucun état : un règlement intérieur ne périme pas", () => {
    // Lui coller « valide » suggérerait qu'on l'a vérifié.
    expect(etatValidite(null, AUJ)).toBeNull();
    expect(etatValidite(undefined, AUJ)).toBeNull();
  });
});

describe("joursAvant", () => {
  it("compte les jours restants", () => {
    expect(joursAvant("2026-09-28", AUJ)).toBe(21);
    expect(joursAvant(AUJ, AUJ)).toBe(0);
  });

  it("ne rend jamais un nombre négatif pour un document déjà expiré", () => {
    expect(joursAvant("2026-01-01", AUJ)).toBe(0);
  });
});
