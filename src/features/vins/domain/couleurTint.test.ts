import { describe, it, expect } from "vitest";
import { couleurTint } from "./couleurTint";

describe("couleurTint", () => {
  it("rend un dégradé spécifique pour une couleur connue", () => {
    expect(couleurTint("rouge")).toContain("#B84A5A");
    expect(couleurTint("blanc")).toContain("#8F8659");
  });
  it("retombe sur le dégradé neutre (tokens) pour null ou inconnu", () => {
    expect(couleurTint(null)).toContain("--hero-from");
    expect(couleurTint("autre")).toContain("--hero-from");
  });
});
