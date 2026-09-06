import { describe, it, expect } from "vitest";
import {
  convertir, tauxSaisi, conversionAffichable, estDeviseConnue, convertirParts, DEVISES,
} from "./devises";

describe("convertir", () => {
  it("convertit au centime : 52 $ à 0,9207 font 47,88 €", () => {
    expect(convertir(5200, 0.9207)).toBe(4788);
  });

  it("arrondit plutôt que de traîner des décimales impayables", () => {
    expect(convertir(333, 0.9207)).toBe(307); // 306,59...
    expect(convertir(1, 157.32)).toBe(157);
  });

  it("un taux de 1 laisse le montant intact", () => {
    expect(convertir(8650, 1)).toBe(8650);
  });
});

describe("tauxSaisi", () => {
  it("accepte le point comme la virgule, et les espaces de frappe", () => {
    expect(tauxSaisi("0.9207")).toBe(0.9207);
    expect(tauxSaisi("0,9207")).toBe(0.9207);
    expect(tauxSaisi(" 157,32 ")).toBe(157.32);
  });

  it("refuse ce qui n'est pas un taux, plutôt que de rendre NaN", () => {
    for (const brut of ["", "0", "-1", "abc", "0,92,1", "1e3"]) {
      expect(tauxSaisi(brut)).toBeNull();
    }
  });
});

describe("conversionAffichable", () => {
  const conv = { montantSaisiCents: 5200, deviseSaisie: "USD", taux: 0.9207 };

  it("montre l'original quand la dépense vient d'ailleurs", () => {
    expect(conversionAffichable(conv, "EUR")).toEqual(conv);
  });

  it("ne dit rien d'une dépense saisie dans la devise du voyage", () => {
    expect(conversionAffichable({ ...conv, deviseSaisie: "EUR", taux: 1 }, "EUR")).toBeNull();
  });

  it("une dépense d'avant le multi-devise n'a rien à montrer", () => {
    expect(conversionAffichable({}, "EUR")).toBeNull();
    expect(conversionAffichable({ montantSaisiCents: 5200, deviseSaisie: "USD" }, "EUR")).toBeNull();
  });
});

describe("DEVISES", () => {
  it("ne propose que des devises que le fournisseur sait convertir", () => {
    expect(estDeviseConnue("USD")).toBe(true);
    expect(estDeviseConnue("XXX")).toBe(false);
    expect(new Set(DEVISES).size).toBe(DEVISES.length);
    expect(DEVISES).toContain("EUR");
  });
});

describe("convertirParts", () => {
  it("convertit chaque part et fait tomber la somme juste sur le total", () => {
    // 3 × 33,33 $ = 99,99 $ ; à 0,9207 chaque part fait 30,69 € et la somme
    // 92,07 €, alors que le total converti vaut 92,06 €.
    const parts = convertirParts({ a: 3333, b: 3333, c: 3333 }, 0.9207, convertir(9999, 0.9207));
    expect(Object.values(parts).reduce((s, c) => s + c, 0)).toBe(convertir(9999, 0.9207));
  });

  it("l'écart d'arrondi tombe sur la plus grosse part", () => {
    const parts = convertirParts({ petite: 100, grosse: 10_000 }, 0.335, convertir(10_100, 0.335));
    expect(parts.petite).toBe(34);
    expect(parts.grosse).toBe(3350 + (convertir(10_100, 0.335) - 3384));
  });

  it("laisse l'écart quand ce n'est plus un arrondi : la saisie ne tombe pas juste", () => {
    // 10 + 10 saisis pour un total de 100 : ce n'est pas au taux de rattraper.
    const parts = convertirParts({ a: 1000, b: 1000 }, 1, 10_000);
    expect(parts).toEqual({ a: 1000, b: 1000 });
  });

  it("sans part à convertir, il n'y a rien à corriger", () => {
    expect(convertirParts({}, 0.92, 0)).toEqual({});
  });
});
