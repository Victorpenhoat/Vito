import { describe, it, expect } from "vitest";
import {
  filtrerActivites, grouperParMembre, correspond, normaliser, type ActiviteFiltrable,
} from "./liste";

const alexia = { id: "m-a", prenom: "Alexia", couleur: "#1" };
const tom = { id: "m-t", prenom: "Tom", couleur: "#2" };
const moi = { id: "m-v", prenom: "Victor", couleur: "#3", estMoi: true };

const act = (p: Partial<ActiviteFiltrable>): ActiviteFiltrable => ({
  id: "a", nom: "Équitation", type: "equitation", statut: "en_cours",
  clubNom: "Poney-club des Landes", membres: [alexia], tags: [{ slug: "sport" }], intervenants: [], ...p,
});

describe("normaliser / correspond", () => {
  it("trouve « équitation » en tapant « equitation », sans accent ni casse", () => {
    expect(normaliser("Équitation")).toBe("equitation");
    expect(correspond(act({}), "EQUIT")).toBe(true);
  });

  it("cherche aussi dans le club et l'intervenant, comme le dit le champ", () => {
    expect(correspond(act({}), "poney")).toBe(true);
    expect(correspond(act({ intervenants: ["Claire Dubois"] }), "dubois")).toBe(true);
  });

  it("une recherche vide ne retire rien", () => {
    expect(correspond(act({}), "   ")).toBe(true);
  });

  it("ne trouve pas ce qui n'y est pas", () => {
    expect(correspond(act({}), "trompette")).toBe(false);
  });
});

describe("filtrerActivites", () => {
  const equitation = act({ id: "eq", membres: [alexia, tom] });
  const danse = act({ id: "da", nom: "Danse", type: "danse", statut: "en_pause", tags: [{ slug: "musique" }], clubNom: "Conservatoire" });
  const natation = act({ id: "na", nom: "Natation", type: "natation", statut: "terminee", tags: [], clubNom: "Piscine" });
  const toutes = [equitation, danse, natation];

  it("sans filtre, rien n'est retiré", () => {
    expect(filtrerActivites(toutes, {})).toHaveLength(3);
  });

  it("ET entre les dimensions : « Alexia » + « en pause » ne garde que la danse", () => {
    expect(filtrerActivites(toutes, { membres: ["m-a"], statuts: ["en_pause"] }).map((a) => a.id))
      .toEqual(["da"]);
  });

  it("OU à l'intérieur d'une dimension : deux statuts élargissent la liste", () => {
    expect(filtrerActivites(toutes, { statuts: ["en_pause", "terminee"] }).map((a) => a.id))
      .toEqual(["da", "na"]);
  });

  it("un membre ne voit que ce qui le concerne", () => {
    expect(filtrerActivites(toutes, { membres: ["m-t"] }).map((a) => a.id)).toEqual(["eq"]);
  });

  it("le filtre par tag et la recherche se cumulent au reste", () => {
    expect(filtrerActivites(toutes, { tags: ["sport"] }).map((a) => a.id)).toEqual(["eq"]);
    expect(filtrerActivites(toutes, { recherche: "conservatoire" }).map((a) => a.id)).toEqual(["da"]);
    expect(filtrerActivites(toutes, { tags: ["sport"], recherche: "conservatoire" })).toEqual([]);
  });
});

describe("grouperParMembre", () => {
  it("une activité partagée apparaît chez chacun — sans quoi le compte mentirait", () => {
    const eq = act({ id: "eq", membres: [alexia, tom] });
    const groupes = grouperParMembre([eq, act({ id: "da", membres: [alexia] })]);
    expect(groupes.map((g) => [g.membre?.prenom, g.activites.length]))
      .toEqual([["Alexia", 2], ["Tom", 1]]);
  });

  it("classe par prénom, « moi » en dernier : on regarde d'abord les cours des enfants", () => {
    const groupes = grouperParMembre([
      act({ id: "t", membres: [moi] }),
      act({ id: "u", membres: [tom] }),
      act({ id: "v", membres: [alexia] }),
    ]);
    expect(groupes.map((g) => g.membre?.prenom)).toEqual(["Alexia", "Tom", "Victor"]);
  });

  it("une activité sans membre forme un groupe à part plutôt que de disparaître", () => {
    const groupes = grouperParMembre([act({ id: "seule", membres: [] })]);
    expect(groupes).toHaveLength(1);
    expect(groupes[0]?.membre).toBeNull();
  });

  it("aucune activité, aucun groupe", () => {
    expect(grouperParMembre([])).toEqual([]);
  });
});
