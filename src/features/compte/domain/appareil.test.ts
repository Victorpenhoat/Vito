import { describe, expect, it } from "vitest";
import { nomAppareil, typeAppareil } from "./appareil";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)";
const IPAD = "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)";
const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)";
const WIN = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)";

describe("typeAppareil", () => {
  it("distingue mobile, tablette et ordinateur", () => {
    expect(typeAppareil(IPHONE)).toBe("mobile");
    expect(typeAppareil(IPAD)).toBe("tablette");
    expect(typeAppareil(MAC)).toBe("ordinateur");
    expect(typeAppareil(WIN)).toBe("ordinateur");
  });
  it("retombe sur ordinateur sans agent", () => {
    expect(typeAppareil(null)).toBe("ordinateur");
  });
});

describe("nomAppareil", () => {
  it("nomme les appareils courants", () => {
    expect(nomAppareil(IPHONE)).toBe("iPhone");
    expect(nomAppareil(IPAD)).toBe("iPad");
    expect(nomAppareil(MAC)).toBe("Mac");
    expect(nomAppareil(WIN)).toBe("Windows");
  });
  it("reste neutre quand l'agent est inconnu", () => {
    expect(nomAppareil(null)).toBe("Appareil");
    expect(nomAppareil("curl/8.0")).toBe("Appareil");
  });
});
