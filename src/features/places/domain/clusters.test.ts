import { describe, it, expect } from "vitest";
import {
  creerRegroupeur, villeDominante, dansLesLimites, bornesDesPoints,
  type PointCarte, type Limites,
} from "./clusters";

const pt = (id: string, lat: number, lng: number, ville: string | null = null): PointCarte =>
  ({ id, lat, lng, ville });

/** Le monde entier : la carte n'écarte alors aucun point. */
const MONDE: Limites = { ouest: -180, sud: -85, est: 180, nord: 85 };
const PARIS: Limites = { ouest: 2.2, sud: 48.8, est: 2.5, nord: 48.95 };

describe("regroupement", () => {
  it("de loin, deux adresses voisines ne font qu'une pastille", () => {
    const { groupes } = creerRegroupeur([pt("a", 48.86, 2.35), pt("b", 48.87, 2.36)]).groupes(MONDE, 3);
    expect(groupes).toHaveLength(1);
    expect(groupes[0]?.nb).toBe(2);
  });

  it("de près, chaque adresse retrouve son marqueur", () => {
    const r = creerRegroupeur([pt("a", 48.86, 2.35), pt("b", 48.87, 2.36)]).groupes(PARIS, 16);
    expect(r.groupes).toHaveLength(0);
    expect(r.isoles.sort()).toEqual(["a", "b"]);
  });

  it("ce qui est hors du cadrage n'est ni groupé ni compté", () => {
    const r = creerRegroupeur([pt("paris", 48.86, 2.35), pt("rome", 41.9, 12.5)]).groupes(PARIS, 12);
    expect(r.isoles).toEqual(["paris"]);
    expect(r.groupes).toHaveLength(0);
  });

  it("une pastille porte la ville la plus représentée de son groupe", () => {
    const { groupes } = creerRegroupeur([
      pt("a", 41.90, 12.50, "Rome"), pt("b", 41.91, 12.51, "Rome"), pt("c", 41.92, 12.49, "Fiumicino"),
    ]).groupes(MONDE, 3);
    expect(groupes[0]).toMatchObject({ nb: 3, ville: "Rome" });
  });

  it("un cadrage vide ne fabrique ni groupe ni marqueur", () => {
    const r = creerRegroupeur([]).groupes(MONDE, 5);
    expect(r).toEqual({ groupes: [], isoles: [] });
  });

  it("cliquer une pastille doit mener plus près qu'on ne l'est", () => {
    const regroupeur = creerRegroupeur([pt("a", 48.86, 2.35), pt("b", 48.87, 2.36)]);
    const { groupes } = regroupeur.groupes(MONDE, 3);
    const cle = groupes[0]?.cle ?? "";
    expect(regroupeur.zoomEclatement(cle)).toBeGreaterThan(3);
  });

  it("un identifiant de pastille inconnu ne fait pas exploser la carte", () => {
    expect(creerRegroupeur([pt("a", 48.86, 2.35)]).zoomEclatement("cluster-999")).toBeNull();
  });
});

describe("villeDominante", () => {
  it("rend la ville la plus fréquente", () => {
    expect(villeDominante(["Rome", "Rome", "Fiumicino"])).toBe("Rome");
  });

  it("à égalité, l'ordre alphabétique tranche — deux affichages du même groupe doivent coïncider", () => {
    expect(villeDominante(["Rome", "Arles"])).toBe("Arles");
  });

  it("sans aucune ville connue, la pastille n'affiche que son compte", () => {
    expect(villeDominante([null, null])).toBeNull();
    expect(villeDominante([])).toBeNull();
  });

  it("les villes inconnues ne votent pas", () => {
    expect(villeDominante([null, null, "Rome"])).toBe("Rome");
  });
});

describe("dansLesLimites", () => {
  it("ne garde que ce que la carte montre", () => {
    const points = [pt("paris", 48.86, 2.35), pt("rome", 41.9, 12.5)];
    expect(dansLesLimites(points, PARIS)).toEqual(["paris"]);
  });

  it("les bords comptent comme visibles", () => {
    expect(dansLesLimites([pt("bord", 48.8, 2.2)], PARIS)).toEqual(["bord"]);
  });
});

describe("bornesDesPoints", () => {
  it("englobe tous les points, du plus au sud-ouest au plus au nord-est", () => {
    expect(bornesDesPoints([pt("paris", 48.86, 2.35), pt("lyon", 45.76, 4.83)])).toEqual({
      sud: 45.76, ouest: 2.35, nord: 48.86, est: 4.83,
    });
  });

  it("un point seul donne des bornes valides, pas un rectangle nul à cadrer", () => {
    expect(bornesDesPoints([pt("a", 48.86, 2.35)])).toEqual({
      sud: 48.86, ouest: 2.35, nord: 48.86, est: 2.35,
    });
  });

  it("sans point, il n'y a rien à cadrer : la carte garde son centre par défaut", () => {
    expect(bornesDesPoints([])).toBeNull();
  });
});
