import { describe, it, expect } from "vitest";
import { deposeDuCreneau, colonnesDepose } from "./depose";

describe("deposeDuCreneau", () => {
  it("un proche nommé dépose", () => {
    expect(deposeDuCreneau({ deposePar: { prenom: "Camille" } }))
      .toEqual({ mode: "membre", prenom: "Camille" });
  });

  it("le covoiturage dit que quelqu'un s'en charge, sans que ce soit nous", () => {
    expect(deposeDuCreneau({ covoiturage: true })).toEqual({ mode: "covoiturage" });
  });

  it("sans rien, la question reste ouverte — et c'est une réponse", () => {
    expect(deposeDuCreneau({})).toEqual({ mode: "a_definir" });
    expect(deposeDuCreneau({ deposePar: null, covoiturage: false })).toEqual({ mode: "a_definir" });
  });

  it("un proche nommé l'emporte sur un covoiturage resté coché", () => {
    // La base l'interdit déjà ; l'affichage ne doit pas hésiter pour autant.
    expect(deposeDuCreneau({ deposePar: { prenom: "Camille" }, covoiturage: true }))
      .toEqual({ mode: "membre", prenom: "Camille" });
  });
});

describe("colonnesDepose", () => {
  it("traduit le choix du formulaire en colonnes", () => {
    expect(colonnesDepose("covoiturage")).toEqual({ deposePar: null, covoiturage: true });
    expect(colonnesDepose("f1111111-1111-4111-8111-111111111111"))
      .toEqual({ deposePar: "f1111111-1111-4111-8111-111111111111", covoiturage: false });
  });

  it("le choix vide est « à définir », pas une erreur", () => {
    expect(colonnesDepose("")).toEqual({ deposePar: null, covoiturage: false });
    expect(colonnesDepose(undefined)).toEqual({ deposePar: null, covoiturage: false });
    expect(colonnesDepose(null)).toEqual({ deposePar: null, covoiturage: false });
  });

  it("les deux colonnes ne sont jamais renseignées ensemble", () => {
    // C'est l'invariant que la contrainte de base protège.
    for (const v of ["covoiturage", "f1111111-1111-4111-8111-111111111111", "", null]) {
      const c = colonnesDepose(v);
      expect(c.deposePar !== null && c.covoiturage).toBe(false);
    }
  });
});
