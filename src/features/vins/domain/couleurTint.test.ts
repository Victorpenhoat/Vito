import { describe, it, expect } from "vitest";
import { couleurTint } from "./couleurTint";

describe("couleurTint", () => {
  it("rend un dégradé spécifique pour une couleur connue", () => {
    expect(couleurTint("rouge")).toContain("#5e2730");
    expect(couleurTint("blanc")).toContain("#cdbf8a");
  });
  it("retombe sur le dégradé neutre (tokens) pour null ou inconnu", () => {
    expect(couleurTint(null)).toContain("--hero-from");
    expect(couleurTint("autre")).toContain("--hero-from");
  });
});
