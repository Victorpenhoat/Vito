import { describe, it, expect } from "vitest";
import { MockEnrichmentProvider } from "./mock";

describe("MockEnrichmentProvider", () => {
  it("normalise sans rien inventer (trim, no-op sur le reste)", async () => {
    const p = new MockEnrichmentProvider();
    const out = await p.normalize({
      nom: "  Château Test  ", domaine: "  Domaine X ", millesime: 2018,
      region: "  Bordeaux ", couleur: "rouge", cepages: [" merlot ", ""],
    });
    expect(out.nom).toBe("Château Test");
    expect(out.domaine).toBe("Domaine X");
    expect(out.region).toBe("Bordeaux");
    expect(out.cepages).toEqual(["merlot"]);
    expect(out.couleur).toBe("rouge");
    expect(out.millesime).toBe(2018);
  });
});
