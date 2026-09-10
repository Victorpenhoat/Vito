import { describe, it, expect } from "vitest";
import { deduireZone, ZONES } from "./zoneScolaire";

describe("ZONES", () => {
  it("porte le vocabulaire de la source, pas un A/B/C réducteur", () => {
    expect(ZONES).toContain("Zone A");
    expect(ZONES).toContain("Corse");
    expect(ZONES).toContain("Réunion");
    expect(ZONES).toHaveLength(11);
  });
});

describe("deduireZone", () => {
  // Ancres vérifiées contre la source : l'API donne académie → zone, et ces
  // départements → académie ne souffrent aucune ambiguïté.
  it.each([
    ["12 rue de Rivoli, 75001 Paris", "Zone C"],
    ["8 quai Saint-Antoine, 69002 Lyon", "Zone A"],
    ["3 La Canebière, 13001 Marseille", "Zone B"],
    ["5 place du Capitole, 31000 Toulouse", "Zone C"],
    ["2 cours de l'Intendance, 33000 Bordeaux", "Zone A"],
    ["1 rue Faidherbe, 59000 Lille", "Zone B"],
    ["4 rue Crébillon, 44000 Nantes", "Zone B"],
    ["7 avenue de la Mer, 34000 Montpellier", "Zone C"],
    ["1 cours Napoléon, 20000 Ajaccio", "Corse"],
    ["10 rue de Paris, 97400 Saint-Denis", "Réunion"],
  ])("déduit %s → %s", (adresse, attendu) => {
    expect(deduireZone(adresse)).toBe(attendu);
  });

  it("rend null quand elle ne sait pas, plutôt qu'une zone plausible", () => {
    expect(deduireZone("chez ma sœur, en face de la boulangerie")).toBeNull();
    expect(deduireZone("")).toBeNull();
    expect(deduireZone(null)).toBeNull();
    expect(deduireZone("99999 Nulle-Part")).toBeNull();
  });
});
