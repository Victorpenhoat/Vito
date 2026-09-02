import { describe, expect, it } from "vitest";
import { groupProches, groupeFor, matchesQuery } from "./groupes";

describe("groupeFor", () => {
  it("foyer : conjoint, fille, fils, enfant", () => {
    for (const r of ["conjoint", "fille", "fils", "enfant"]) expect(groupeFor(r)).toBe("foyer");
  });
  it("parents : pere, mere, parent, beau_parent", () => {
    for (const r of ["pere", "mere", "parent", "beau_parent"]) expect(groupeFor(r)).toBe("parents");
  });
  it("autres : ami, autre, inconnu", () => {
    for (const r of ["ami", "autre", "cousin"]) expect(groupeFor(r)).toBe("autres");
  });
});

describe("groupProches", () => {
  const p = (relation: string, id: string) => ({ id, relation });
  it("épingle moi et groupe le reste dans l'ordre foyer/parents/autres", () => {
    const { moi, groupes } = groupProches([p("ami", "a"), p("moi", "m"), p("fille", "f"), p("pere", "p")]);
    expect(moi?.id).toBe("m");
    expect(groupes.map((g) => g.key)).toEqual(["foyer", "parents", "autres"]);
    expect(groupes[0]!.items.map((i) => i.id)).toEqual(["f"]);
  });
  it("omet les groupes vides et tolère l'absence de moi", () => {
    const { moi, groupes } = groupProches([p("ami", "a")]);
    expect(moi).toBeNull();
    expect(groupes.map((g) => g.key)).toEqual(["autres"]);
  });
});

describe("matchesQuery", () => {
  it("insensible à la casse et aux accents", () => {
    expect(matchesQuery(["Père"], "pere")).toBe(true);
    expect(matchesQuery(["Alexia Penhoat"], "ALEXIA")).toBe(true);
  });
  it("requête vide → tout passe ; null ignorés", () => {
    expect(matchesQuery([null, "x"], "  ")).toBe(true);
    expect(matchesQuery([null], "a")).toBe(false);
  });
  it("aucune correspondance", () => {
    expect(matchesQuery(["Alexia"], "cousine")).toBe(false);
  });
});
