import { describe, it, expect } from "vitest";
import { statutDepuisEvenement, avance } from "./statut";

describe("statutDepuisEvenement", () => {
  it("traduit les événements qui nous intéressent", () => {
    expect(statutDepuisEvenement("email.delivered")).toBe("remis");
    expect(statutDepuisEvenement("email.bounced")).toBe("rebond");
    expect(statutDepuisEvenement("email.complained")).toBe("plainte");
  });

  it("ignore les autres plutôt que d'inventer un statut", () => {
    expect(statutDepuisEvenement("email.delivery_delayed")).toBeNull();
    expect(statutDepuisEvenement("n'importe.quoi")).toBeNull();
  });
});

describe("avance", () => {
  it("laisse progresser", () => {
    expect(avance("en_cours", "accepte")).toBe(true);
    expect(avance("accepte", "remis")).toBe(true);
  });

  // Les webhooks arrivent dans le désordre : c'est la seule protection qui tienne.
  it("refuse de reculer", () => {
    expect(avance("remis", "accepte")).toBe(false);
    expect(avance("remis", "remis")).toBe(false);
  });

  it("laisse un rebond ou une plainte l'emporter sur une remise", () => {
    expect(avance("remis", "rebond")).toBe(true);
    expect(avance("remis", "plainte")).toBe(true);
  });
});
