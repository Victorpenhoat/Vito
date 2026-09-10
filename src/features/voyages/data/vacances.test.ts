import { describe, it, expect, vi, beforeEach } from "vitest";

// "server-only" throw inconditionnellement hors bundler Next (pas de condition
// d'export "react-server" sous Vitest) — no-op pour ce test unitaire du module lui-même.
vi.mock("server-only", () => ({}));

const recuperer = vi.fn();
vi.mock("@/lib/services/vacances", () => ({
  getVacancesProvider: () => ({ name: "faux", recuperer }),
}));

// Base en mémoire : les lignes que la table contiendrait.
let lignes: { annee_scolaire: string; zone: string; libelle: string; debut: string; fin: string }[] = [];
const upserts: unknown[][] = [];
// Bascules pour qu'un test fasse échouer la lecture ou l'écriture sans
// réécrire les mocks : `null` = comportement normal.
let erreurLecture: string | null = null;
let erreurEcriture: string | null = null;
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({
    from: () => ({
      select: () => ({
        eq: (_c: string, zone: string) => ({
          in: (_c2: string, annees: string[]) => ({
            order: async () =>
              erreurLecture
                ? { data: null, error: { message: erreurLecture } }
                : {
                    data: lignes.filter((l) => l.zone === zone && annees.includes(l.annee_scolaire)),
                    error: null,
                  },
          }),
        }),
      }),
    }),
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      upsert: async (rows: unknown[]) => {
        upserts.push(rows);
        return erreurEcriture ? { error: { message: erreurEcriture } } : { error: null };
      },
    }),
  }),
}));

import { getVacances, anneesScolairesDe } from "./vacances";

beforeEach(() => {
  lignes = [];
  upserts.length = 0;
  erreurLecture = null;
  erreurEcriture = null;
  recuperer.mockReset();
});

describe("anneesScolairesDe", () => {
  // L'année scolaire bascule au 1er septembre : une fenêtre de douze mois
  // ouverte en janvier chevauche donc deux années.
  it("rend l'année qui couvre une fenêtre interne", () => {
    expect(anneesScolairesDe("2026-10-01", "2027-06-30")).toEqual(["2026-2027"]);
  });
  it("rend les deux années d'une fenêtre à cheval sur septembre", () => {
    expect(anneesScolairesDe("2027-06-01", "2028-05-31")).toEqual(["2026-2027", "2027-2028"]);
  });
});

describe("getVacances", () => {
  it("sert le cache sans appeler la source quand l'année est là", async () => {
    lignes = [{ annee_scolaire: "2026-2027", zone: "Zone C", libelle: "Noël", debut: "2026-12-19", fin: "2027-01-04" }];
    const periodes = await getVacances("Zone C", "2026-10-01", "2027-06-30");
    expect(periodes).toEqual([{ id: "2026-2027|Zone C|Noël", libelle: "Noël", debut: "2026-12-19", fin: "2027-01-04" }]);
    expect(recuperer).not.toHaveBeenCalled();
  });

  it("récupère et écrit l'année absente, puis la sert", async () => {
    recuperer.mockImplementation(async () => {
      lignes.push({ annee_scolaire: "2026-2027", zone: "Zone C", libelle: "Noël", debut: "2026-12-19", fin: "2027-01-04" });
      return [{ anneeScolaire: "2026-2027", zone: "Zone C", libelle: "Noël", debut: "2026-12-19", fin: "2027-01-04" }];
    });
    const periodes = await getVacances("Zone C", "2026-10-01", "2027-06-30");
    expect(recuperer).toHaveBeenCalledWith("2026-2027");
    // Le mapping des champs, pas seulement le nombre de lignes : une
    // permutation annee_scolaire/anneeScolaire passerait un simple toHaveLength.
    expect(upserts[0]).toEqual([
      { annee_scolaire: "2026-2027", zone: "Zone C", libelle: "Noël", debut: "2026-12-19", fin: "2027-01-04" },
    ]);
    expect(periodes).toHaveLength(1);
  });

  // Le point de tout le dispositif : une source absente ne vide pas l'écran.
  it("sert le cache même quand la source est injoignable", async () => {
    lignes = [{ annee_scolaire: "2026-2027", zone: "Zone C", libelle: "Noël", debut: "2026-12-19", fin: "2027-01-04" }];
    recuperer.mockResolvedValue(null);
    expect(await getVacances("Zone C", "2026-06-01", "2027-05-31")).toHaveLength(1);
  });

  it("rend une liste vide, sans jeter, quand il n'y a ni cache ni source", async () => {
    recuperer.mockResolvedValue(null);
    await expect(getVacances("Zone C", "2026-10-01", "2027-06-30")).resolves.toEqual([]);
  });

  it("ne jette pas quand la lecture de la table échoue, et rend une liste vide", async () => {
    erreurLecture = "connexion refusée";
    recuperer.mockResolvedValue(null);
    await expect(getVacances("Zone C", "2026-10-01", "2027-06-30")).resolves.toEqual([]);
  });

  // Le point de tout le dispositif, version écriture : une source qui répond
  // mais un upsert qui échoue ne doit ni jeter ni faire disparaître ce que la
  // table contenait déjà pour l'année déjà en cache.
  it("sert le cache déjà présent, sans jeter, quand l'upsert de l'année absente échoue", async () => {
    lignes = [{ annee_scolaire: "2026-2027", zone: "Zone C", libelle: "Noël", debut: "2026-12-19", fin: "2027-01-04" }];
    erreurEcriture = "contrainte violée";
    // Contrairement au test « récupère et écrit », le mock ne simule pas ici
    // une écriture réussie en base : l'upsert échouant réellement, la ligne
    // de l'année 2027-2028 ne doit jamais apparaître dans `lignes`.
    recuperer.mockResolvedValue([
      { anneeScolaire: "2027-2028", zone: "Zone C", libelle: "Toussaint", debut: "2027-10-16", fin: "2027-11-01" },
    ]);

    const periodes = await getVacances("Zone C", "2027-06-01", "2028-05-31");

    expect(upserts).toHaveLength(1);
    expect(periodes).toEqual([{ id: "2026-2027|Zone C|Noël", libelle: "Noël", debut: "2026-12-19", fin: "2027-01-04" }]);
  });
});
