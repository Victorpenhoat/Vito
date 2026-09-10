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

  // Mesuré le 2026-09-10 : le jeu publie VINGT ET UNE valeurs de `population`,
  // dont cinq familles enseignantes (« Enseignants », « … des collèges »,
  // « … des lycées », « … du premier degré », « … du second degré »). Une
  // égalité stricte sur « Enseignants » laissait passer les quatre autres, et
  // comme la clé de dédoublonnage ignore la population, la ligne enseignante
  // ÉCRASAIT celle des élèves : Zone C 2025-2026, l'été des enseignants finit
  // un jour plus tôt que celui des familles.
  const ETE_MELANGE = {
    results: [
      { description: "Vacances d'Été", start_date: "2026-07-03T22:00:00+00:00",
        end_date: "2026-08-31T22:00:00+00:00", zones: "Zone C", population: "Élèves",
        location: "Paris", annee_scolaire: "2025-2026" },
      // Une famille enseignante SANS ligne élève en face : si le filtre la
      // laissait passer, elle inventerait une période pour la Zone B.
      { description: "Prérentrée", start_date: "2026-08-30T22:00:00+00:00",
        end_date: "2026-08-30T22:00:00+00:00", zones: "Zone B",
        population: "Enseignants du premier degré", location: "Lille",
        annee_scolaire: "2025-2026" },
      // EN DERNIER dans le tableau, comme dans la réponse réelle : sans filtre,
      // c'est elle qui gagne et on annonce le 31 août aux familles.
      { description: "Vacances d'Été", start_date: "2026-07-03T22:00:00+00:00",
        end_date: "2026-08-30T22:00:00+00:00", zones: "Zone C",
        population: "Enseignants du second degré", location: "Paris",
        annee_scolaire: "2025-2026" },
    ],
  };

  it("écarte TOUTES les familles enseignantes, pas seulement « Enseignants »", () => {
    expect(normaliser(ETE_MELANGE)).toEqual([
      { anneeScolaire: "2025-2026", zone: "Zone C", libelle: "Vacances d'Été",
        debut: "2026-07-04", fin: "2026-09-01" },
    ]);
  });

  // Zone C 2026-2027 ne publie QUE `Début des Vacances d'Été`, une ligne d'un
  // seul jour : sans dérivation, juillet et août se lisent comme libres.
  const MARQUEUR_SEUL = {
    results: [
      { description: "Début des Vacances d'Été", start_date: "2027-07-02T22:00:00+00:00",
        end_date: "2027-07-02T22:00:00+00:00", zones: "Zone C", population: "-",
        location: "Paris", annee_scolaire: "2026-2027" },
    ],
  };

  // La forme habituelle : un vrai `Vacances d'Été` avec sa plage, que le
  // marqueur accompagne parfois.
  const MARQUEUR_ET_PLAGE = {
    results: [
      ...MARQUEUR_SEUL.results,
      { description: "Vacances d'Été", start_date: "2027-07-02T22:00:00+00:00",
        end_date: "2027-08-31T22:00:00+00:00", zones: "Zone C", population: "Élèves",
        location: "Paris", annee_scolaire: "2026-2027" },
    ],
  };

  it("dérive les grandes vacances quand la source n'en publie que le marqueur", () => {
    expect(normaliser(MARQUEUR_SEUL)).toEqual([
      { anneeScolaire: "2026-2027", zone: "Zone C", libelle: "Vacances d'Été",
        debut: "2027-07-03", fin: "2027-08-31" },
    ]);
  });

  it("laisse la vraie plage l'emporter sur la dérivée, sans doublon", () => {
    const attendu = [
      { anneeScolaire: "2026-2027", zone: "Zone C", libelle: "Vacances d'Été",
        debut: "2027-07-03", fin: "2027-09-01" },
    ];
    expect(normaliser(MARQUEUR_ET_PLAGE)).toEqual(attendu);
    // L'ordre de la réponse ne doit rien décider : la dérivation n'a lieu
    // qu'une fois toutes les lignes lues.
    expect(normaliser({ results: [...MARQUEUR_ET_PLAGE.results].reverse() })).toEqual(attendu);
  });

  // « Aucun été inventé » ne se prouve pas sur une réponse sans marqueur :
  // `deriverEte` n'y aurait de toute façon rien à faire, correctif ou pas. Il
  // faut une réponse où la dérivation OPÈRE pour une zone, afin que l'absence
  // d'été chez l'autre dise quelque chose.
  const MARQUEUR_UNE_SEULE_ZONE = {
    results: [
      ...MARQUEUR_SEUL.results,
      // Zone A : pas la moindre ligne d'été, ni marqueur ni plage.
      { description: "Vacances de Noël", start_date: "2026-12-18T23:00:00+00:00",
        end_date: "2027-01-03T23:00:00+00:00", zones: "Zone A", population: "-",
        location: "Besançon", annee_scolaire: "2026-2027" },
    ],
  };

  it("n'invente un été QUE là où la source pose un marqueur", () => {
    const periodes = normaliser(MARQUEUR_UNE_SEULE_ZONE);
    expect(periodes.filter((p) => p.libelle.includes("Été"))).toEqual([
      { anneeScolaire: "2026-2027", zone: "Zone C", libelle: "Vacances d'Été",
        debut: "2027-07-03", fin: "2027-08-31" },
    ]);
    // La Zone A garde son Noël et rien de plus : la dérivation ne déborde pas
    // sur les zones voisines de la même réponse.
    expect(periodes.filter((p) => p.zone === "Zone A").map((p) => p.libelle))
      .toEqual(["Vacances de Noël"]);
  });

  // Deux lignes qui diffèrent VRAIMENT, une fois les enseignants écartés.
  // Mesuré : Polynésie 2026-2027 « Grandes Vacances » commence un jour plus
  // tôt pour le premier degré que pour le second — et un foyer peut avoir des
  // enfants dans les deux. Le décalage de FIN est ajouté ici : la source n'en
  // montre pas aujourd'hui, rien ne garantit qu'elle n'en montrera jamais, et
  // la règle (amplitude la plus large) doit tenir des deux côtés.
  const DEUX_DEGRES = {
    results: [
      { description: "Grandes Vacances", start_date: "2027-06-30T22:00:00+00:00",
        end_date: "2027-08-23T22:00:00+00:00", zones: "Polynésie",
        population: "Élèves du premier degré", annee_scolaire: "2026-2027" },
      { description: "Grandes Vacances", start_date: "2027-07-01T22:00:00+00:00",
        end_date: "2027-08-22T22:00:00+00:00", zones: "Polynésie",
        population: "Élèves du second degré", annee_scolaire: "2026-2027" },
    ],
  };

  it("fusionne à l'amplitude la plus large deux lignes de même clé aux dates décalées", () => {
    expect(normaliser(DEUX_DEGRES)).toEqual([
      { anneeScolaire: "2026-2027", zone: "Polynésie", libelle: "Grandes Vacances",
        debut: "2027-07-01", fin: "2027-08-24" },
    ]);
  });

  // L'autre moitié du filtre, celle qu'aucun test ne tenait : un resserrement
  // en « ne garder que `-` et `Élèves…` » ferait disparaître la Guadeloupe et
  // les deux degrés SANS qu'aucune assertion bronche. Ces populations ne
  // nomment pas un public enseignant — les guadeloupéennes ne nomment même
  // pas un public, mais un territoire.
  const POPULATIONS_GARDEES = {
    results: [
      { description: "Vacances de Noël", start_date: "2026-12-18T23:00:00+00:00",
        end_date: "2027-01-03T23:00:00+00:00", zones: "Zone A",
        population: "Premier degré", annee_scolaire: "2026-2027" },
      { description: "Vacances de Noël", start_date: "2026-12-18T23:00:00+00:00",
        end_date: "2027-01-03T23:00:00+00:00", zones: "Zone B",
        population: "Second degré", annee_scolaire: "2026-2027" },
      { description: "Vacances de Carnaval", start_date: "2027-02-12T23:00:00+00:00",
        end_date: "2027-02-21T23:00:00+00:00", zones: "Guadeloupe",
        population: "Guadeloupe & Saint-Martin", annee_scolaire: "2026-2027" },
      { description: "Vacances de Pâques", start_date: "2027-04-09T22:00:00+00:00",
        end_date: "2027-04-25T22:00:00+00:00", zones: "Guadeloupe",
        population: "Saint-Barthélémy", annee_scolaire: "2026-2027" },
    ],
  };

  it("ne sur-filtre pas : les degrés et les populations territoriales survivent", () => {
    expect(normaliser(POPULATIONS_GARDEES).map((p) => `${p.zone} · ${p.libelle}`)).toEqual([
      "Zone A · Vacances de Noël",
      "Zone B · Vacances de Noël",
      "Guadeloupe · Vacances de Carnaval",
      "Guadeloupe · Vacances de Pâques",
    ]);
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
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(periodes).not.toBeNull();
  });

  // Le plafond de pages prouve que la boucle S'ARRÊTE, jamais qu'elle
  // s'arrête À TEMPS. Une source dégradée qui répond juste sous la limite à
  // chaque page épuiserait un délai posé par page sans jamais le déclencher :
  // trois pages de 250 ms, puis deux années, puis trois zones en parallèle,
  // et la page entière pend. Le budget est donc créé une fois pour toute la
  // récupération.
  //
  // Le fetch simulé RESPECTE le signal — sans quoi le test ne mesurerait que
  // la patience de Vitest.
  it("borne le temps de la récupération ENTIÈRE, pas de chaque page", async () => {
    const BUDGET = 300;
    const PAGE_MS = 250;
    const fetchMock = vi.fn((_url: string, init?: { signal?: AbortSignal }) =>
      new Promise((resolve, reject) => {
        const t = setTimeout(
          () => resolve({ ok: true, json: async () => ({ total_count: 100_000, results: page(100, 0) }) }),
          PAGE_MS);
        init?.signal?.addEventListener("abort", () => {
          clearTimeout(t);
          reject(new DOMException("The operation was aborted", "TimeoutError"));
        });
      }));
    vi.stubGlobal("fetch", fetchMock);

    const debut = Date.now();
    const periodes = await new EducationGouvProvider(BUDGET).recuperer("2026-2027");
    const ecoule = Date.now() - debut;

    // La deuxième page est coupée par le budget de la première : rien de
    // complet, donc `null` — pas un calendrier à moitié rempli.
    expect(periodes).toBeNull();
    // Et le temps total reste celui du budget, pas `PAGES_MAX` fois le sien.
    // Marge large : c'est la différence entre ~300 ms et ~750 ms qu'on
    // mesure, pas la précision d'un `setTimeout`.
    expect(ecoule).toBeLessThan(BUDGET * 2);
  });
});
