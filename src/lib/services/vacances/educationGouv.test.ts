import { describe, it, expect, vi, afterEach } from "vitest";
import { EducationGouvProvider, normaliser, dateDeParis } from "./educationGouv";

// Capturé sur l'API réelle. Ne pas « simplifier » : chaque ligne est là pour
// un piège précis.
const REPONSE = {
  total_count: 6,
  results: [
    // Minuit à PARIS, exprimé en UTC : c'est le 19 décembre, pas le 18.
    { description: "Vacances de Noël", start_date: "2026-12-18T23:00:00+00:00",
      end_date: "2027-01-03T23:00:00+00:00", zones: "Zone A", population: "-",
      location: "Besançon", annee_scolaire: "2026-2027" },
    // Trois académies pour la MÊME période de la zone B : une seule doit sortir.
    { description: "Vacances de Noël", start_date: "2026-12-18T23:00:00+00:00",
      end_date: "2027-01-03T23:00:00+00:00", zones: "Zone B", population: "-",
      location: "Aix-Marseille", annee_scolaire: "2026-2027" },
    { description: "Vacances de Noël", start_date: "2026-12-18T23:00:00+00:00",
      end_date: "2027-01-03T23:00:00+00:00", zones: "Zone B", population: "-",
      location: "Amiens", annee_scolaire: "2026-2027" },
    { description: "Vacances de Noël", start_date: "2026-12-18T23:00:00+00:00",
      end_date: "2027-01-03T23:00:00+00:00", zones: "Zone B", population: "-",
      location: "Strasbourg", annee_scolaire: "2026-2027" },
    { description: "Vacances de Noël", start_date: "2026-12-18T23:00:00+00:00",
      end_date: "2027-01-03T23:00:00+00:00", zones: "Zone C", population: "-",
      location: "Paris", annee_scolaire: "2026-2027" },
    // Réservée aux enseignants : ne doit JAMAIS être annoncée à une famille.
    { description: "Vacances d'Été", start_date: "2027-07-09T22:00:00+00:00",
      end_date: "2027-08-31T22:00:00+00:00", zones: "Mayotte",
      population: "Enseignants", location: "Mayotte", annee_scolaire: "2026-2027" },
  ],
};

afterEach(() => vi.unstubAllGlobals());

describe("dateDeParis", () => {
  it("convertit minuit à Paris (hiver, UTC+1) en date locale", () => {
    expect(dateDeParis("2026-12-18T23:00:00+00:00")).toBe("2026-12-19");
  });

  it("convertit minuit à Paris (été, UTC+2) en date locale", () => {
    expect(dateDeParis("2027-07-09T22:00:00+00:00")).toBe("2027-07-10");
  });

  it("rend null sur une chaîne inexploitable", () => {
    expect(dateDeParis("pas une date")).toBeNull();
  });
});

describe("normaliser", () => {
  it("convertit en date de PARIS : Noël commence le 19, pas le 18", () => {
    const noelA = normaliser(REPONSE).find((p) => p.zone === "Zone A");
    expect(noelA).toMatchObject({ debut: "2026-12-19", fin: "2027-01-04" });
  });

  it("déduplique les académies : une seule période par zone", () => {
    const zoneB = normaliser(REPONSE).filter((p) => p.zone === "Zone B");
    expect(zoneB).toHaveLength(1);
  });

  it("écarte ce qui ne concerne que les enseignants", () => {
    expect(normaliser(REPONSE).some((p) => p.zone === "Mayotte")).toBe(false);
  });

  it("garde le vocabulaire de la source, sans le réduire à A/B/C", () => {
    const zones = new Set(normaliser(REPONSE).map((p) => p.zone));
    expect(zones).toEqual(new Set(["Zone A", "Zone B", "Zone C"]));
  });

  it("ne jette pas sur une réponse difforme, elle rend une liste vide", () => {
    expect(normaliser(null)).toEqual([]);
    expect(normaliser({ results: [{ description: "x" }] })).toEqual([]);
  });
});

describe("EducationGouvProvider", () => {
  const provider = new EducationGouvProvider();

  it("demande l'année scolaire voulue et rend les périodes normalisées", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => REPONSE } as Response);
    vi.stubGlobal("fetch", fetchMock);

    const periodes = await provider.recuperer("2026-2027");
    expect(periodes?.length).toBe(3);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("2026-2027");
  });

  it("rend null plutôt que de jeter quand la source refuse ou tombe", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) } as Response));
    expect(await provider.recuperer("2026-2027")).toBeNull();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNRESET")));
    expect(await provider.recuperer("2026-2027")).toBeNull();
  });
});
