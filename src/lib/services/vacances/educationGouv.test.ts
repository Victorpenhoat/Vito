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

// Une page de résultats bruts, `n` enregistrements distincts à partir de
// `offset` (zones toutes différentes : aucun dédoublonnage ne doit en
// avaler un par accident, ce qui fausserait le compte de la pagination).
function page(n: number, offset: number) {
  return Array.from({ length: n }, (_, i) => ({
    description: "Vacances de test",
    start_date: "2026-12-18T23:00:00+00:00",
    end_date: "2027-01-03T23:00:00+00:00",
    zones: `Zone ${offset + i}`,
    population: "-",
    annee_scolaire: "2026-2027",
  }));
}

describe("EducationGouvProvider", () => {
  const provider = new EducationGouvProvider();

  it("demande l'année scolaire voulue et rend les périodes normalisées", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => REPONSE } as Response);
    vi.stubGlobal("fetch", fetchMock);

    const periodes = await provider.recuperer("2026-2027");
    expect(periodes?.length).toBe(3);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("2026-2027");
    // Une seule page a suffi (6 résultats sur les 6 annoncés) : pas de
    // deuxième requête inutile.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rend null plutôt que de jeter quand la source refuse ou tombe", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) } as Response));
    expect(await provider.recuperer("2026-2027")).toBeNull();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNRESET")));
    expect(await provider.recuperer("2026-2027")).toBeNull();
  });

  it("ne demande jamais plus de 100 résultats par page (l'API refuse au-delà)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ total_count: 198, results: page(100, 0) }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ total_count: 198, results: page(98, 100) }) });
    vi.stubGlobal("fetch", fetchMock);

    await provider.recuperer("2026-2027");
    for (const call of fetchMock.mock.calls) {
      expect(String(call[0])).toContain("limit=100");
      expect(String(call[0])).not.toContain("limit=200");
    }
  });

  it("page au-delà de 100 résultats et accumule les pages jusqu'au total annoncé", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ total_count: 198, results: page(100, 0) }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ total_count: 198, results: page(98, 100) }) });
    vi.stubGlobal("fetch", fetchMock);

    const periodes = await provider.recuperer("2026-2027");
    expect(periodes).toHaveLength(198);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("offset=100");
  });

  it("rend null si une page suivante échoue, plutôt qu'un calendrier à moitié rempli", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ total_count: 198, results: page(100, 0) }) })
      .mockRejectedValueOnce(new Error("ECONNRESET"));
    vi.stubGlobal("fetch", fetchMock);

    expect(await provider.recuperer("2026-2027")).toBeNull();
  });

  it("s'arrête au plafond de pages plutôt que de tourner sans fin sur une source qui n'annonce jamais la fin", async () => {
    // Chaque page est pleine (100) et `total_count` reste hors de portée :
    // sans garde-fou, la boucle ne s'arrêterait jamais.
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ total_count: 100_000, results: page(100, 0) }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const periodes = await provider.recuperer("2026-2027");
    expect(fetchMock).toHaveBeenCalledTimes(10);
    expect(periodes).not.toBeNull();
  });
});
