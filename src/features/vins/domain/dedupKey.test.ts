import { describe, it, expect } from "vitest";
import { vinDedupKey } from "./dedupKey";

describe("vinDedupKey", () => {
  it("normalise casse + millésime/domaine nuls", () => {
    expect(vinDedupKey({ nom: "Château Margaux", millesime: null, domaine: null }))
      .toBe("château margaux 0 ");
  });
  it("deux saisies équivalentes -> même clé", () => {
    const a = vinDedupKey({ nom: "Clos X", millesime: 2019, domaine: "Domaine Y" });
    const b = vinDedupKey({ nom: "clos x", millesime: 2019, domaine: "domaine y" });
    expect(a).toBe(b);
  });
  it("millésime différent -> clé différente", () => {
    expect(vinDedupKey({ nom: "V", millesime: 2018, domaine: null }))
      .not.toBe(vinDedupKey({ nom: "V", millesime: 2019, domaine: null }));
  });
});
