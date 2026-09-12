import { describe, it, expect } from "vitest";
import { qrSvg, urlLien } from "./qr";

describe("urlLien", () => {
  it("assemble l'adresse que scanne l'appareil photo", () => {
    expect(urlLien("https://vito.app", "fr", "7K4P2M9X")).toBe("https://vito.app/fr/lier/7K4P2M9X");
  });
  it("supporte une origine avec barre finale", () => {
    expect(urlLien("https://vito.app/", "en", "7K4P2M9X")).toBe("https://vito.app/en/lier/7K4P2M9X");
  });
});

describe("qrSvg", () => {
  it("produit un SVG qui s'adapte à son cadre (pas de taille en pixels)", () => {
    const svg = qrSvg("https://vito.app/fr/lier/7K4P2M9X");
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).not.toMatch(/width="\d+px"/);
    expect(svg).toMatch(/viewBox=/);
  });
  it("dessine un motif différent pour un code différent", () => {
    expect(qrSvg("https://vito.app/fr/lier/7K4P2M9X"))
      .not.toBe(qrSvg("https://vito.app/fr/lier/AAAAAAAA"));
  });
  it("le même contenu redonne le même dessin", () => {
    expect(qrSvg("https://vito.app/fr/lier/7K4P2M9X")).toBe(qrSvg("https://vito.app/fr/lier/7K4P2M9X"));
  });
});
