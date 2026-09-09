import { describe, it, expect } from "vitest";
import { dureeEstimeeMinutes } from "./trajet";

// Bordeaux centre → Le Teich : une trentaine de kilomètres à vol d'oiseau.
const maison = { lat: 44.8378, lng: -0.5792 };
const poneyClub = { lat: 44.6383, lng: -1.0186 };

describe("dureeEstimeeMinutes", () => {
  it("donne un ordre de grandeur plausible pour un trajet réel", () => {
    const minutes = dureeEstimeeMinutes(maison, poneyClub)!;
    // ~40 km par la route : entre une heure et deux, jamais dix minutes.
    expect(minutes).toBeGreaterThan(60);
    expect(minutes).toBeLessThan(180);
  });

  it("un club à quelques rues se compte en minutes, pas en secondes", () => {
    const coinDeLaRue = { lat: 44.8390, lng: -0.5800 };
    expect(dureeEstimeeMinutes(maison, coinDeLaRue)).toBeGreaterThanOrEqual(1);
    expect(dureeEstimeeMinutes(maison, coinDeLaRue)).toBeLessThan(10);
  });

  it("jamais « ~0 min » : sortir prend du temps même à côté", () => {
    expect(dureeEstimeeMinutes(maison, maison)).toBe(1);
  });

  it("sans l'un des deux points, il n'y a rien à estimer", () => {
    // Mieux vaut ne rien afficher qu'un chiffre inventé.
    expect(dureeEstimeeMinutes(null, poneyClub)).toBeNull();
    expect(dureeEstimeeMinutes(maison, null)).toBeNull();
    expect(dureeEstimeeMinutes(null, null)).toBeNull();
  });

  it("la durée grandit avec la distance", () => {
    const proche = dureeEstimeeMinutes(maison, { lat: 44.85, lng: -0.58 })!;
    const loin = dureeEstimeeMinutes(maison, poneyClub)!;
    expect(loin).toBeGreaterThan(proche);
  });
});
