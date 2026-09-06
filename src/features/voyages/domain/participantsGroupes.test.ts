import { describe, it, expect } from "vitest";
import { grouperParticipants, libelleVoyageur, type ParticipantDetaille } from "./participantsGroupes";

const p = (o: Partial<ParticipantDetaille>): ParticipantDetaille => ({
  id: "p", profileId: null, familyMemberId: null, displayName: "Quelqu'un", email: null,
  role: "voyageur", typeVoyageur: "adulte", dateNaissance: null, invitationEnAttente: false, ...o,
});

describe("grouperParticipants", () => {
  it("sépare le Cercle des invités externes, comme la maquette", () => {
    const groupes = grouperParticipants([
      p({ id: "cercle", familyMemberId: "f1" }),
      p({ id: "externe", email: "thomas@exemple.fr" }),
    ]);
    expect(groupes.cercle.map((x) => x.id)).toEqual(["cercle"]);
    expect(groupes.externes.map((x) => x.id)).toEqual(["externe"]);
  });

  it("un voyageur saisi librement, sans e-mail, reste avec le Cercle plutôt que de passer pour un invité", () => {
    const groupes = grouperParticipants([p({ id: "libre" })]);
    expect(groupes.cercle.map((x) => x.id)).toEqual(["libre"]);
    expect(groupes.externes).toEqual([]);
  });

  it("l'organisateur ouvre la marche", () => {
    const groupes = grouperParticipants([
      p({ id: "z", displayName: "Zoé" }),
      p({ id: "chef", displayName: "Victor", role: "organisateur" }),
    ]);
    expect(groupes.cercle.map((x) => x.id)).toEqual(["chef", "z"]);
  });
});

describe("libelleVoyageur", () => {
  const LE_JOUR = new Date("2026-09-06T00:00:00Z");

  it("nomme l'organisateur avant tout", () => {
    expect(libelleVoyageur(p({ role: "organisateur" }), LE_JOUR)).toEqual({ cle: "organisateur" });
  });

  it("donne l'âge d'un enfant, calculé depuis sa fiche du Cercle", () => {
    expect(libelleVoyageur(p({ typeVoyageur: "enfant", dateNaissance: "2017-05-01" }), LE_JOUR))
      .toEqual({ cle: "enfantAge", age: 9 });
  });

  it("un enfant sans date de naissance reste un enfant, sans âge inventé", () => {
    expect(libelleVoyageur(p({ typeVoyageur: "enfant" }), LE_JOUR)).toEqual({ cle: "enfant" });
  });

  it("un adulte est un adulte : son âge ne regarde personne", () => {
    expect(libelleVoyageur(p({ dateNaissance: "1985-01-01" }), LE_JOUR)).toEqual({ cle: "adulte" });
  });

  it("un invité dont l'invitation n'est pas acceptée est « en attente »", () => {
    expect(libelleVoyageur(p({ email: "t@x.fr", invitationEnAttente: true }), LE_JOUR))
      .toEqual({ cle: "enAttente" });
  });
});
