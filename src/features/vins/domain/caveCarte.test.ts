import { describe, it, expect } from "vitest";
import { regrouperLieux, centreLieux, type DegustationLieu, type LieuCarte } from "./caveCarte";

const deg = (p: Partial<DegustationLieu>): DegustationLieu => ({
  id: "d", note: null, etablissement: null, lieu_type: null, lieu_nom: null, ...p,
});
const bistrot = { id: "e1", nom: "Kuzina", lat: 48.86, lng: 2.35 };

describe("regrouperLieux", () => {
  it("regroupe les dégustations d'un même restaurant en un seul point compté", () => {
    const { carte } = regrouperLieux([
      deg({ id: "1", etablissement: bistrot, note: 4 }),
      deg({ id: "2", etablissement: bistrot, note: 5 }),
    ]);
    expect(carte).toHaveLength(1);
    expect(carte[0]).toMatchObject({ id: "e1", nom: "Kuzina", nb: 2, note_moyenne: 4.5 });
  });

  it("un restaurant sans coordonnées ne peut pas être épinglé : il est compté à part", () => {
    const { carte, sansCoordonnees } = regrouperLieux([
      deg({ etablissement: { id: "e2", nom: "Sans adresse", lat: null, lng: null } }),
    ]);
    expect(carte).toHaveLength(0);
    expect(sansCoordonnees).toBe(1);
  });

  it("les lieux libres partent dans « Ailleurs », groupés par type et par nom", () => {
    const { ailleurs } = regrouperLieux([
      deg({ lieu_type: "maison", note: 3 }),
      deg({ lieu_type: "maison", note: 4 }),
      deg({ lieu_type: "caviste", lieu_nom: "Caviste du coin", note: 5 }),
      deg({ lieu_type: "caviste", lieu_nom: "Autre caviste", note: 4 }),
    ]);
    expect(ailleurs).toEqual([
      { cle: "maison", type: "maison", nom: null, nb: 2, note_moyenne: 3.5 },
      { cle: "caviste·autre caviste", type: "caviste", nom: "Autre caviste", nb: 1, note_moyenne: 4 },
      { cle: "caviste·caviste du coin", type: "caviste", nom: "Caviste du coin", nb: 1, note_moyenne: 5 },
    ]);
  });

  it("une dégustation sans lieu du tout ne compte nulle part", () => {
    const { carte, ailleurs, sansCoordonnees } = regrouperLieux([deg({ note: 4 })]);
    expect(carte).toHaveLength(0);
    expect(ailleurs).toHaveLength(0);
    expect(sansCoordonnees).toBe(0);
  });

  it("un lieu_type « restaurant » sans établissement reste un lieu libre plutôt que de disparaître", () => {
    const { ailleurs } = regrouperLieux([deg({ lieu_type: "restaurant", lieu_nom: "Chez Untel" })]);
    expect(ailleurs).toEqual([
      { cle: "restaurant·chez untel", type: "restaurant", nom: "Chez Untel", nb: 1, note_moyenne: null },
    ]);
  });

  it("les lieux les plus fréquentés passent devant, à égalité par ordre alphabétique", () => {
    const { carte } = regrouperLieux([
      deg({ etablissement: { id: "z", nom: "Zinc", lat: 1, lng: 1 } }),
      deg({ etablissement: bistrot }),
      deg({ etablissement: bistrot }),
      deg({ etablissement: { id: "a", nom: "Ardoise", lat: 2, lng: 2 } }),
    ]);
    expect(carte.map((l) => l.nom)).toEqual(["Kuzina", "Ardoise", "Zinc"]);
  });

  it("une note manquante ne tire pas la moyenne du lieu vers le bas", () => {
    const { carte } = regrouperLieux([
      deg({ etablissement: bistrot, note: 4 }),
      deg({ etablissement: bistrot, note: null }),
    ]);
    expect(carte.map((l) => l.note_moyenne)).toEqual([4]);
  });
});

describe("centreLieux", () => {
  const lieu = (lat: number, lng: number): LieuCarte =>
    ({ id: `${lat}`, nom: "L", lat, lng, nb: 1, note_moyenne: null });

  it("centre sur la moyenne des lieux épinglés", () => {
    expect(centreLieux([lieu(48, 2), lieu(50, 4)])).toEqual({ lat: 49, lng: 3 });
  });

  it("sans aucun lieu, Paris par défaut — une carte vide vaut mieux au-dessus d'une ville", () => {
    expect(centreLieux([])).toEqual({ lat: 48.8566, lng: 2.3522 });
  });
});
