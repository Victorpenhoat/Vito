import { describe, it, expect } from "vitest";
import { classifyFallback } from "./classifyFallback";

describe("classifyFallback", () => {
  it("priceLevel 4 + fine_dining => étoilé", () => {
    expect(classifyFallback(["restaurant", "fine_dining"], 4)).toBe("étoilé");
  });
  it("priceLevel 4 seul (sans fine_dining) => étoilé", () => {
    expect(classifyFallback(["restaurant"], 4)).toBe("étoilé");
  });
  it("fine_dining seul avec priceLevel null => étoilé", () => {
    expect(classifyFallback(["fine_dining"], null)).toBe("étoilé");
  });
  it("type bistro => bistrot", () => {
    expect(classifyFallback(["restaurant", "bistro"], 2)).toBe("bistrot");
  });
  it("type brasserie => brasserie", () => {
    expect(classifyFallback(["brasserie"], 2)).toBe("brasserie");
  });
  it("défaut => restaurant", () => {
    expect(classifyFallback(["restaurant"], 1)).toBe("restaurant");
  });
});
