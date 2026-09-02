import { describe, expect, it } from "vitest";
import { restoStatut, subsetForRestoStatut } from "./statut";

const p = (is_favorite: boolean, statut: string, id: string) => ({ id, is_favorite, statut });

describe("restoStatut", () => {
  it("favori prime, quel que soit le statut stocké (visites conservées)", () => {
    expect(restoStatut({ is_favorite: true, statut: "a_faire" })).toBe("favori");
    expect(restoStatut({ is_favorite: true, statut: "visite" })).toBe("favori");
  });
  it("visite sans favori → teste", () => {
    expect(restoStatut({ is_favorite: false, statut: "visite" })).toBe("teste");
  });
  it("a_faire sans favori → a_tester", () => {
    expect(restoStatut({ is_favorite: false, statut: "a_faire" })).toBe("a_tester");
  });
});

describe("subsetForRestoStatut", () => {
  const places = [p(true, "a_faire", "f1"), p(true, "visite", "f2"), p(false, "visite", "t1"), p(false, "a_faire", "at1")];
  it("partition exclusive : un favori ne sort pas dans à-tester ni testés", () => {
    expect(subsetForRestoStatut(places, "favori").map((x) => x.id)).toEqual(["f1", "f2"]);
    expect(subsetForRestoStatut(places, "teste").map((x) => x.id)).toEqual(["t1"]);
    expect(subsetForRestoStatut(places, "a_tester").map((x) => x.id)).toEqual(["at1"]);
  });
  it("la partition couvre tout sans doublon", () => {
    const total = ["favori", "a_tester", "teste"].flatMap((s) => subsetForRestoStatut(places, s as never));
    expect(total).toHaveLength(places.length);
  });
});
