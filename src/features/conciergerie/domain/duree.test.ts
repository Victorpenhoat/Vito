import { describe, it, expect } from "vitest";
import { dureeFromNuits } from "./duree";

describe("dureeFromNuits", () => {
  it("ajoute les nuits", () => expect(dureeFromNuits("2026-09-12", 3)).toBe("2026-09-15"));
  it("gère le passage de mois", () => expect(dureeFromNuits("2026-09-29", 3)).toBe("2026-10-02"));
});
