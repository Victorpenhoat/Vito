import { describe, it, expect } from "vitest";
import { NAV_ITEMS, filterNav, groupNav } from "./nav-config";

describe("filterNav", () => {
  it("client ne voit ni agence ni admin", () => {
    const keys = filterNav(NAV_ITEMS, "client").map((i) => i.key);
    expect(keys).toContain("restos");
    expect(keys).not.toContain("agence");
    expect(keys).not.toContain("admin");
  });
  it("agence voit agence mais pas admin", () => {
    const keys = filterNav(NAV_ITEMS, "agence").map((i) => i.key);
    expect(keys).toContain("agence");
    expect(keys).not.toContain("admin");
  });
  it("admin voit agence et admin", () => {
    const keys = filterNav(NAV_ITEMS, "admin").map((i) => i.key);
    expect(keys).toContain("agence");
    expect(keys).toContain("admin");
  });
});

describe("groupNav", () => {
  it("rend les groupes dans l'ordre carnet → voyages → cercle", () => {
    const groups = groupNav(filterNav(NAV_ITEMS, "client"));
    expect(groups.map((g) => g.group)).toEqual(["carnet", "voyages", "cercle"]);
  });

  it("classe accueil/restos/vins/recherche dans carnet", () => {
    const carnet = groupNav(NAV_ITEMS).find((g) => g.group === "carnet")!;
    expect(carnet.entries.map((e) => e.key)).toEqual(["accueil", "restos", "hotels", "vins", "recherche"]);
  });

  it("place agence et admin dans cercle (rôle admin)", () => {
    const cercle = groupNav(filterNav(NAV_ITEMS, "admin")).find((g) => g.group === "cercle")!;
    expect(cercle.entries.map((e) => e.key)).toContain("agence");
    expect(cercle.entries.map((e) => e.key)).toContain("admin");
  });

  it("exclut les groupes vides", () => {
    const groups = groupNav([{ key: "accueil", href: "/accueil", group: "carnet" }]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.group).toBe("carnet");
  });
});
