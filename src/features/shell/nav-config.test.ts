import { describe, it, expect } from "vitest";
import { NAV_ITEMS, filterNav } from "./nav-config";

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
