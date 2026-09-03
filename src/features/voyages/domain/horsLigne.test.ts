import { describe, it, expect } from "vitest";
import { urlsDuCarnet, tailleLisible, estAffichable, parJour, sejourEnCours, cheminCarnet } from "./horsLigne";

describe("urlsDuCarnet", () => {
  it("met la page en tête, puis chaque pièce jointe", () => {
    expect(urlsDuCarnet("fr", "v1", ["d1", "d2"])).toEqual([
      "/fr/carnet-hors-ligne/v1",
      "/api/voyages/documents/d1",
      "/api/voyages/documents/d2",
    ]);
  });

  it("reste valide sans aucune pièce jointe : la page seule suffit", () => {
    expect(urlsDuCarnet("it", "v1", [])).toEqual(["/it/carnet-hors-ligne/v1"]);
  });

  it("respecte la locale demandée (le carnet est figé dans la langue téléchargée)", () => {
    expect(cheminCarnet("es", "abc")).toBe("/es/carnet-hors-ligne/abc");
  });
});

describe("tailleLisible", () => {
  it("annonce un poids compréhensible avant de télécharger en itinérance", () => {
    expect(tailleLisible(512)).toBe("512 o");
    expect(tailleLisible(2048)).toBe("2 Ko");
    expect(tailleLisible(3 * 1024 * 1024)).toBe("3,0 Mo");
  });
});

describe("estAffichable", () => {
  it("affiche les images, garde les PDF derrière un lien", () => {
    expect(estAffichable("image/jpeg")).toBe(true);
    expect(estAffichable("application/pdf")).toBe(false);
  });
});

describe("parJour", () => {
  it("ordonne les journées", () => {
    const groupes = parJour([
      { date_debut: "2026-04-12" },
      { date_debut: "2026-04-10" },
      { date_debut: "2026-04-12" },
    ]);
    expect(groupes.map((g) => g.date)).toEqual(["2026-04-10", "2026-04-12"]);
    expect(groupes[1]?.items).toHaveLength(2);
  });

  it("garde les réservations sans date, en dernier : hors ligne, un voucher non daté reste utile", () => {
    const groupes = parJour([{ date_debut: null }, { date_debut: "2026-04-10" }]);
    expect(groupes.map((g) => g.date)).toEqual(["2026-04-10", null]);
  });

  it("ne fabrique aucun groupe vide", () => {
    expect(parJour([])).toEqual([]);
  });
});

describe("sejourEnCours", () => {
  it("reconnaît le jour d'arrivée et le jour de départ", () => {
    expect(sejourEnCours("2026-04-10", "2026-04-14", "2026-04-10")).toBe(true);
    expect(sejourEnCours("2026-04-10", "2026-04-14", "2026-04-14")).toBe(true);
  });

  it("est faux avant, après, et sans date de début", () => {
    expect(sejourEnCours("2026-04-10", "2026-04-14", "2026-04-09")).toBe(false);
    expect(sejourEnCours("2026-04-10", "2026-04-14", "2026-04-15")).toBe(false);
    expect(sejourEnCours(null, null, "2026-04-10")).toBe(false);
  });

  it("traite un voyage d'un seul jour (sans date de fin)", () => {
    expect(sejourEnCours("2026-04-10", null, "2026-04-10")).toBe(true);
  });
});
