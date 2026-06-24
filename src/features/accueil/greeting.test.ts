import { describe, it, expect } from "vitest";
import { greeting } from "./greeting";

describe("greeting", () => {
  it("bonsoir le soir/la nuit", () => {
    expect(greeting(20)).toBe("bonsoir");
    expect(greeting(2)).toBe("bonsoir");
    expect(greeting(18)).toBe("bonsoir");
  });
  it("bonjour la journée", () => {
    expect(greeting(9)).toBe("bonjour");
    expect(greeting(14)).toBe("bonjour");
    expect(greeting(5)).toBe("bonjour");
    expect(greeting(17)).toBe("bonjour");
  });
});
