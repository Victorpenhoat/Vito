import { describe, it, expect } from "vitest";
import { trierReception, dejaAuCarnet, destinatairesPossibles, type Recommandation } from "./reception";

const reco = (p: Partial<Recommandation>): Recommandation => ({
  id: "r", deProfileId: "p1", deNom: "Camille", categorie: "resto",
  placeId: "place-1", libelle: "Le Bistrot", mot: null, creeLe: "2026-09-01T10:00:00Z", ...p,
});

describe("trierReception", () => {
  it("les plus récentes d'abord : une boîte se lit par le haut", () => {
    const boite = [
      reco({ id: "vieille", creeLe: "2026-08-01T10:00:00Z" }),
      reco({ id: "fraiche", creeLe: "2026-09-03T10:00:00Z" }),
    ];
    expect(trierReception(boite).map((r) => r.id)).toEqual(["fraiche", "vieille"]);
  });

  it("à instant égal, l'ordre reste stable plutôt qu'arbitraire", () => {
    const boite = [reco({ id: "a" }), reco({ id: "b" })];
    expect(trierReception(boite).map((r) => r.id)).toEqual(["a", "b"]);
  });
});

describe("dejaAuCarnet", () => {
  it("reconnaît une adresse déjà présente : on ne la propose pas comme neuve", () => {
    expect(dejaAuCarnet(reco({ placeId: "place-1" }), ["place-1", "place-2"])).toBe(true);
  });

  it("une adresse inconnue du carnet ne l'est pas", () => {
    expect(dejaAuCarnet(reco({ placeId: "place-9" }), ["place-1"])).toBe(false);
  });

  it("un carnet vide ne fait ressembler personne à personne", () => {
    expect(dejaAuCarnet(reco({}), [])).toBe(false);
  });
});

describe("destinatairesPossibles", () => {
  const proches = [
    { id: "f1", nom: "Camille Durand", profileId: "p-camille" },
    { id: "f2", nom: "Paul Martin", profileId: null },
    { id: "f3", nom: "Léa Martin", profileId: "p-lea" },
  ];

  it("ne propose que les proches ayant un compte rattaché : les autres ne peuvent rien recevoir", () => {
    expect(destinatairesPossibles(proches).map((p) => p.id)).toEqual(["f1", "f3"]);
  });

  it("sans aucun compte rattaché, il n'y a personne à qui recommander", () => {
    expect(destinatairesPossibles([{ id: "f2", nom: "Paul", profileId: null }])).toEqual([]);
  });

  it("l'ordre alphabétique tient, accents compris", () => {
    const liste = [
      { id: "e", nom: "Émile", profileId: "p-e" },
      { id: "d", nom: "Denis", profileId: "p-d" },
    ];
    expect(destinatairesPossibles(liste).map((p) => p.id)).toEqual(["d", "e"]);
  });
});
