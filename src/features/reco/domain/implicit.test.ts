import { describe, it, expect } from "vitest";
import { buildSignauxImplicites } from "./implicit";

describe("buildSignauxImplicites", () => {
  it("pèse les favoris plus fort que les avis", () => {
    const s = buildSignauxImplicites(
      [{ type: "bistrot", arrondissement: "17e" }],
      [{ type: "bistrot", arrondissement: "8e" }],
    );
    expect(s.types["bistrot"]).toBe(3); // +2 favori, +1 avis
    expect(s.zones["17e"]).toBe(2);
    expect(s.zones["8e"]).toBe(1);
  });
  it("ignore les valeurs nulles", () => {
    const s = buildSignauxImplicites([{ type: null, arrondissement: null }], []);
    expect(Object.keys(s.types)).toHaveLength(0);
    expect(Object.keys(s.zones)).toHaveLength(0);
  });
});
