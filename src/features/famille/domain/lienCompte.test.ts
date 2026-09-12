import { describe, it, expect } from "vitest";
import { ALPHABET_CODE, relationInverse, genererCode, normaliserCode, formaterCode, compteARebours } from "./lienCompte";

describe("relationInverse", () => {
  it("conjoint est sa propre réciproque", () => expect(relationInverse("conjoint")).toBe("conjoint"));
  it("ami est sa propre réciproque", () => expect(relationInverse("ami")).toBe("ami"));
  it("un enfant a pour réciproque un parent (le genre reste à choisir)", () => {
    expect(relationInverse("fille")).toBe("parent");
    expect(relationInverse("fils")).toBe("parent");
    expect(relationInverse("enfant")).toBe("parent");
  });
  it("un parent a pour réciproque un enfant", () => {
    expect(relationInverse("pere")).toBe("enfant");
    expect(relationInverse("mere")).toBe("enfant");
    expect(relationInverse("parent")).toBe("enfant");
  });
  it("beau-parent n'a pas de réciproque nommée dans le modèle", () => {
    expect(relationInverse("beau_parent")).toBe("autre");
  });
  it("« moi » ne désigne personne d'autre : pas de réciproque", () => {
    expect(relationInverse("moi")).toBe(null);
  });
});

describe("genererCode", () => {
  it("fait huit caractères de l'alphabet sans ambiguïté", () => {
    for (let i = 0; i < 50; i++) {
      const code = genererCode();
      expect(code).toHaveLength(8);
      for (const c of code) expect(ALPHABET_CODE).toContain(c);
    }
  });
  it("n'emploie ni I, ni O, ni 0, ni 1 (confusions à la lecture)", () => {
    expect(ALPHABET_CODE).not.toMatch(/[IO01LU]/);
  });
  it("ne redonne pas deux fois le même code", () => {
    const tirages = new Set(Array.from({ length: 200 }, () => genererCode()));
    expect(tirages.size).toBe(200);
  });
});

describe("normaliserCode", () => {
  it("accepte la saisie humaine : minuscules, tiret, espaces", () => {
    expect(normaliserCode(" 7k4p-2m9x ")).toBe("7K4P2M9X");
  });
  it("refuse un code trop court", () => expect(normaliserCode("7K4P2M9")).toBe(null));
  it("refuse un code trop long", () => expect(normaliserCode("7K4P2M9XY")).toBe(null));
  it("refuse un caractère hors alphabet", () => expect(normaliserCode("7K4P2M9I")).toBe(null));
  it("refuse une saisie vide", () => expect(normaliserCode("")).toBe(null));
});

describe("formaterCode", () => {
  it("coupe en deux groupes de quatre, pour la lecture à voix haute", () => {
    expect(formaterCode("7K4P2M9X")).toBe("7K4P-2M9X");
  });
});

describe("compteARebours", () => {
  const t0 = new Date("2026-09-12T10:00:00Z").getTime();
  it("montre les minutes et les secondes qu'il reste", () => {
    expect(compteARebours(new Date(t0 + 754_000).toISOString(), t0)).toEqual({ expire: false, restant: "12:34" });
  });
  it("garde deux chiffres aux secondes", () => {
    expect(compteARebours(new Date(t0 + 65_000).toISOString(), t0)).toEqual({ expire: false, restant: "01:05" });
  });
  it("déclare le code expiré à l'échéance, pas une seconde après", () => {
    expect(compteARebours(new Date(t0).toISOString(), t0)).toEqual({ expire: true, restant: "00:00" });
  });
  it("ne descend jamais sous zéro", () => {
    expect(compteARebours(new Date(t0 - 90_000).toISOString(), t0)).toEqual({ expire: true, restant: "00:00" });
  });
  it("une échéance illisible vaut expirée : on ne montre pas un QR mort", () => {
    expect(compteARebours("pas une date", t0)).toEqual({ expire: true, restant: "00:00" });
  });
});
