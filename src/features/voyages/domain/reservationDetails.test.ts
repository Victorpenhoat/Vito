import { describe, it, expect } from "vitest";
import { lireDetails, champsDuType, resumeDetails, CHAMPS_PAR_TYPE } from "./reservationDetails";

describe("lireDetails", () => {
  it("relit les champs connus du type, et rien d'autre", () => {
    const d = lireDetails("vol", {
      compagnie: "Air France", numero: "AF1204", depart: "CDG", arrivee: "FCO",
      inconnu: "à jeter", agence: "Hertz",
    });
    expect(d).toEqual({ compagnie: "Air France", numero: "AF1204", depart: "CDG", arrivee: "FCO" });
  });

  it("ce qui n'est pas du jsonb exploitable ne casse pas l'écran", () => {
    expect(lireDetails("vol", null)).toEqual({});
    expect(lireDetails("vol", "AF1204")).toEqual({});
    expect(lireDetails("vol", 42)).toEqual({});
  });

  it("les valeurs vides ou non textuelles sont écartées, pas converties", () => {
    expect(lireDetails("vol", { numero: "  ", depart: 12, arrivee: null, compagnie: "  KLM  " }))
      .toEqual({ compagnie: "KLM" });
  });

  it("un type sans champ propre ne retient rien", () => {
    expect(lireDetails("autre", { numero: "X" })).toEqual({});
  });

  it("un champ d'un AUTRE type ne passe pas : les détails suivent le type", () => {
    expect(lireDetails("voiture", { numero: "AF1204", agence: "Hertz" })).toEqual({ agence: "Hertz" });
  });
});

describe("champsDuType", () => {
  it("donne les champs à saisir pour ce type", () => {
    expect(champsDuType("vol")).toEqual(CHAMPS_PAR_TYPE.vol);
    expect(champsDuType("train")).toContain("gareDepart");
  });

  it("un type inconnu ne propose aucun champ plutôt que de deviner", () => {
    expect(champsDuType("navette-spatiale")).toEqual([]);
  });
});

describe("resumeDetails", () => {
  it("résume un vol en une ligne lisible", () => {
    expect(resumeDetails("vol", { numero: "AF1204", depart: "CDG", arrivee: "FCO", heureDepart: "10:15" }))
      .toBe("AF1204 · CDG → FCO · 10:15");
  });

  it("un trajet incomplet ne fabrique pas de flèche dans le vide", () => {
    expect(resumeDetails("vol", { numero: "AF1204", depart: "CDG" })).toBe("AF1204 · CDG");
  });

  it("résume une voiture par son agence et ses lieux", () => {
    expect(resumeDetails("voiture", { agence: "Hertz", lieuPrise: "Gare de Rome", lieuRestitution: "Aéroport" }))
      .toBe("Hertz · Gare de Rome → Aéroport");
  });

  it("sans rien de connu, il n'y a pas de résumé à afficher", () => {
    expect(resumeDetails("vol", {})).toBeNull();
    expect(resumeDetails("autre", { numero: "X" })).toBeNull();
  });

  it("le résumé se lit depuis le jsonb brut aussi bien que depuis un objet relu", () => {
    expect(resumeDetails("train", { numero: "6201", gareDepart: "Termini", gareArrivee: "Firenze", inconnu: "x" }))
      .toBe("6201 · Termini → Firenze");
  });
});
