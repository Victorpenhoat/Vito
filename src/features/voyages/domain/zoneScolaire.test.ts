import { describe, it, expect } from "vitest";
import { deduireZone, estMetropole, lettreDeZone, ZONES, ZONES_METROPOLE } from "./zoneScolaire";

describe("ZONES", () => {
  it("porte le vocabulaire de la source, pas un A/B/C réducteur", () => {
    expect(ZONES).toContain("Zone A");
    expect(ZONES).toContain("Corse");
    expect(ZONES).toContain("Réunion");
    expect(ZONES).toHaveLength(11);
  });
});

describe("ZONES_METROPOLE", () => {
  it("porte les trois zones qui se comparent entre elles, et rien d'autre", () => {
    expect([...ZONES_METROPOLE]).toEqual(["Zone A", "Zone B", "Zone C"]);
  });

  it("n'invente pas de zone hors du vocabulaire de la source", () => {
    for (const zone of ZONES_METROPOLE) expect(ZONES).toContain(zone);
  });

  it.each(["Corse", "Réunion", "Polynésie"])("%s n'est pas une zone métropolitaine", (zone) => {
    expect(estMetropole(zone)).toBe(false);
  });

  it("ne tient pas une zone absente pour métropolitaine", () => {
    expect(estMetropole(null)).toBe(false);
    expect(estMetropole("")).toBe(false);
  });
});

describe("lettreDeZone", () => {
  it.each([["Zone A", "A"], ["Zone B", "B"], ["Zone C", "C"]])("%s → %s", (zone, lettre) => {
    expect(lettreDeZone(zone)).toBe(lettre);
  });

  // `zone.slice(-1)` rendait « e » pour la Corse et « n » pour la Réunion :
  // une étiquette fausse plutôt qu'aucune.
  it.each(["Corse", "Réunion", "Polynésie", "Saint Pierre et Miquelon"])(
    "%s n'a pas de lettre, et n'en reçoit donc aucune", (zone) => {
      expect(lettreDeZone(zone)).toBeNull();
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

  it("prend le dernier nombre à cinq chiffres, pas le premier venu avant le code postal", () => {
    // Leurre : « Résidence 20000 » ressemble à un code postal corse, mais le
    // vrai code postal — 75011 — vient après, comme toujours en adresse
    // française. Un premier-match confondrait cette famille parisienne avec
    // la Corse.
    expect(deduireZone("Résidence 20000, 75011 Paris")).toBe("Zone C");
  });
});
