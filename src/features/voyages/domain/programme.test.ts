import { describe, it, expect } from "vitest";
import { joursDuVoyage, grouperEtapes, type Etape } from "./programme";

const etape = (p: Partial<Etape>): Etape =>
  ({ id: "e", jour: null, heure: null, titre: "Étape", lieu: null, etablissementId: null, notes: null, ordre: 0, ...p });

describe("joursDuVoyage", () => {
  it("déroule les jours entre le départ et le retour, bornes comprises", () => {
    expect(joursDuVoyage("2026-09-12", "2026-09-15")).toEqual(
      ["2026-09-12", "2026-09-13", "2026-09-14", "2026-09-15"],
    );
  });

  it("passe les mois et les années sans trébucher", () => {
    expect(joursDuVoyage("2026-12-30", "2027-01-02")).toEqual(
      ["2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02"],
    );
  });

  it("un voyage d'un seul jour tient en un jour", () => {
    expect(joursDuVoyage("2026-09-12", "2026-09-12")).toEqual(["2026-09-12"]);
  });

  it("sans date de retour, on ne déroule que le départ — le reste serait inventé", () => {
    expect(joursDuVoyage("2026-09-12", null)).toEqual(["2026-09-12"]);
  });

  it("un voyage sans dates (une idée) n'a pas de jours", () => {
    expect(joursDuVoyage(null, null)).toEqual([]);
    expect(joursDuVoyage(null, "2026-09-15")).toEqual([]);
  });

  it("un retour avant le départ ne produit pas une liste à l'envers", () => {
    expect(joursDuVoyage("2026-09-15", "2026-09-12")).toEqual(["2026-09-15"]);
  });
});

describe("grouperEtapes", () => {
  it("range chaque étape sous son jour, dans l'ordre du voyage", () => {
    const groupes = grouperEtapes(
      [etape({ id: "b", jour: "2026-09-13" }), etape({ id: "a", jour: "2026-09-12" })],
      ["2026-09-12", "2026-09-13"],
    );
    expect(groupes.jours.map((j) => [j.jour, j.etapes.map((e) => e.id)])).toEqual([
      ["2026-09-12", ["a"]],
      ["2026-09-13", ["b"]],
    ]);
  });

  it("garde les jours vides : un jour sans rien de prévu reste un jour du voyage", () => {
    const groupes = grouperEtapes([], ["2026-09-12", "2026-09-13"]);
    expect(groupes.jours).toHaveLength(2);
    expect(groupes.jours.every((j) => j.etapes.length === 0)).toBe(true);
  });

  it("les étapes sans jour vont « à caler », pas à la poubelle", () => {
    const groupes = grouperEtapes([etape({ id: "libre" })], ["2026-09-12"]);
    expect(groupes.aCaler.map((e) => e.id)).toEqual(["libre"]);
  });

  it("une étape datée hors du voyage rejoint « à caler » plutôt que de disparaître", () => {
    const groupes = grouperEtapes([etape({ id: "hors", jour: "2026-10-01" })], ["2026-09-12"]);
    expect(groupes.jours[0]?.etapes).toEqual([]);
    expect(groupes.aCaler.map((e) => e.id)).toEqual(["hors"]);
  });

  it("dans une journée, l'heure commande ; sans heure, le rang saisi", () => {
    const groupes = grouperEtapes(
      [
        etape({ id: "soir", jour: "2026-09-12", heure: "20:00" }),
        etape({ id: "rang2", jour: "2026-09-12", ordre: 2 }),
        etape({ id: "matin", jour: "2026-09-12", heure: "09:30" }),
        etape({ id: "rang1", jour: "2026-09-12", ordre: 1 }),
      ],
      ["2026-09-12"],
    );
    expect(groupes.jours[0]?.etapes.map((e) => e.id)).toEqual(["matin", "soir", "rang1", "rang2"]);
  });

  it("un voyage sans dates met tout « à caler » : c'est encore une envie", () => {
    const groupes = grouperEtapes([etape({ id: "a", jour: "2026-09-12" }), etape({ id: "b" })], []);
    expect(groupes.jours).toEqual([]);
    expect(groupes.aCaler.map((e) => e.id)).toEqual(["a", "b"]);
  });
});
