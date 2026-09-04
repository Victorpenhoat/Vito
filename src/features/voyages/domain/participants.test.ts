import { describe, it, expect } from "vitest";
import {
  sourceParticipant, candidatsCercle, candidatsComptes, trierParticipants,
  type Participant,
} from "./participants";

const p = (o: Partial<Participant>): Participant =>
  ({ id: "p", profileId: null, familyMemberId: null, displayName: "Quelqu'un", email: null, role: "voyageur", ...o });

describe("sourceParticipant", () => {
  it("distingue un compte, un proche du Cercle et une personne saisie librement", () => {
    expect(sourceParticipant(p({ profileId: "u1" }))).toBe("compte");
    expect(sourceParticipant(p({ familyMemberId: "f1" }))).toBe("cercle");
    expect(sourceParticipant(p({}))).toBe("libre");
  });

  it("un proche retiré du Cercle reste un voyageur, devenu libre", () => {
    // family_member_id passe à null à la suppression : le nom, lui, est un instantané
    expect(sourceParticipant(p({ familyMemberId: null, displayName: "Léa" }))).toBe("libre");
  });
});

describe("candidatsCercle", () => {
  const proches = [
    { id: "f1", nom: "Léa Martin" },
    { id: "f2", nom: "Paul Martin" },
  ];

  it("ne propose que les proches pas encore du voyage", () => {
    expect(candidatsCercle(proches, [p({ familyMemberId: "f1" })])).toEqual([{ id: "f2", nom: "Paul Martin" }]);
  });

  it("propose tout le Cercle quand personne n'est encore ajouté", () => {
    expect(candidatsCercle(proches, [])).toHaveLength(2);
  });

  it("un homonyme saisi librement ne masque pas le proche : c'est l'identité qui compte", () => {
    expect(candidatsCercle(proches, [p({ displayName: "Léa Martin" })])).toHaveLength(2);
  });
});

describe("candidatsComptes", () => {
  const membres = [
    { profileId: "u1", nom: "Victor" },
    { profileId: "u2", nom: "Agence" },
  ];

  it("ne propose que les comptes partagés pas encore voyageurs", () => {
    expect(candidatsComptes(membres, [p({ profileId: "u2" })])).toEqual([{ profileId: "u1", nom: "Victor" }]);
  });
});

describe("trierParticipants", () => {
  it("les organisateurs d'abord, puis l'ordre alphabétique", () => {
    const liste = [
      p({ id: "z", displayName: "Zoé" }),
      p({ id: "org", displayName: "Victor", role: "organisateur" }),
      p({ id: "a", displayName: "Alice" }),
    ];
    expect(trierParticipants(liste).map((x) => x.id)).toEqual(["org", "a", "z"]);
  });

  it("l'ordre ne dépend pas des accents", () => {
    const liste = [p({ id: "e", displayName: "Émile" }), p({ id: "d", displayName: "Denis" })];
    expect(trierParticipants(liste).map((x) => x.id)).toEqual(["d", "e"]);
  });
});
