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
// Les zones réellement passées à `.eq("zone", …)`, dans l'ordre : elles
// prouvent que `lire()` filtre pour de bon, et donc que la bascule ci-dessous
// simule une table trop généreuse plutôt qu'un code qui ne demanderait rien.
const zonesLues: string[] = [];
// Bascule de MENSONGE de la table : le mock rend alors les lignes de TOUTES
// les zones. Sans elle, ce fichier reproduirait le `.eq("zone", zone)` de
// `lire()` et aucun test ne pourrait éprouver ce que `getVacances` fait d'un
// tableau contenant autre chose que ce qu'il a demandé — la propriété serait
// tenue par le mock, pas par le code.
let lectureIgnoreLaZone = false;
// L'utilisateur que `getCachedUser` rapporte, et l'adresse de la fiche « Moi ».
// `utilisateur = null` simule le rendu parallèle page/layout où la session
// n'est pas encore établie : la RLS répondrait alors « permission denied » à
// `anon` (cf. #61/#63), pas « zéro ligne ».
let utilisateur: { id: string } | null = { id: "u1" };
let adresseFoyer: string | null = null;
vi.mock("@/lib/supabase/server", () => ({
  getCachedUser: async () => ({ user: utilisateur }),
  createServerSupabase: async () => ({
    from: () => ({
      select: () => ({
        eq: (_c: string, zone: string) => {
          zonesLues.push(zone);
          return ({
          // Lecture d'une seule ligne : la fiche « Moi » du foyer, ou le
          // profil. Seule l'adresse intéresse ces tests.
          maybeSingle: async () => ({
            data: adresseFoyer === null ? null : { address: adresseFoyer, zone_scolaire: null },
          }),
          in: (_c2: string, annees: string[]) => ({
            order: async () => {
              const data = lignes.filter(
                (l) => (lectureIgnoreLaZone || l.zone === zone) && annees.includes(l.annee_scolaire));
              // PostgREST rend `data` ET `error` en cas d'échec : c'est exactement
              // ce que `lire()` doit refuser de servir, en faisant confiance à
              // `error` plutôt qu'à `data`. Un mock qui rendrait `data: null` ne
              // distinguerait rien — un `return data ?? []` bogué passerait aussi.
              return erreurLecture ? { data, error: { message: erreurLecture } } : { data, error: null };
            },
          }),
        });
        },
      }),
    }),
  }),
}));
// Bascule « clé de service absente » : `createAdminClient()` JETTE alors, comme
// il le fait vraiment quand `SUPABASE_SERVICE_ROLE_KEY` manque (elle est
// `.optional()` dans env.ts). Un mock qui ne jetterait jamais ne pourrait rien
// dire du `try/catch` qui l'entoure — c'est le motif de test vide que ce
// chantier a déjà purgé plusieurs fois.
let cleDeServiceAbsente = false;
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    if (cleDeServiceAbsente) throw new Error("SUPABASE_SERVICE_ROLE_KEY manquante");
    return {
      from: () => ({
        upsert: async (rows: unknown[]) => {
          upserts.push(rows);
          return erreurEcriture ? { error: { message: erreurEcriture } } : { error: null };
        },
      }),
    };
  },
}));

import { getVacances, anneesScolairesDe, getZoneDeduiteDuFoyer } from "./vacances";

beforeEach(() => {
  lignes = [];
  upserts.length = 0;
  erreurLecture = null;
  erreurEcriture = null;
  lectureIgnoreLaZone = false;
  cleDeServiceAbsente = false;
  utilisateur = { id: "u1" };
  adresseFoyer = null;
  zonesLues.length = 0;
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
  // Les deux fixtures ci-dessus ne franchissent jamais la frontière : elles
  // passeraient tout aussi bien avec une bascule au 1er août. Un jour d'écart
  // décalerait TOUTE la fenêtre d'une année scolaire.
  it("bascule le 1er septembre, pas la veille ni le mois d'avant", () => {
    expect(anneesScolairesDe("2026-08-31", "2026-08-31")).toEqual(["2025-2026"]);
    expect(anneesScolairesDe("2026-09-01", "2026-09-01")).toEqual(["2026-2027"]);
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

  // Discriminant : le mock rend À LA FOIS des lignes et une erreur (ce que
  // PostgREST fait réellement en cas d'échec), pour prouver que `lire()` fait
  // confiance à `error` plutôt qu'à `data` — pas seulement qu'une table vide
  // donne une liste vide, ce qu'un `return data ?? []` bogué ferait aussi.
  it("ne sert pas les lignes reçues quand la table les accompagne d'une erreur", async () => {
    lignes = [{ annee_scolaire: "2026-2027", zone: "Zone C", libelle: "Noël", debut: "2026-12-19", fin: "2027-01-04" }];
    erreurLecture = "connexion refusée";
    recuperer.mockResolvedValue(null); // rien ne doit repeupler le cache après le refus.
    await expect(getVacances("Zone C", "2026-10-01", "2027-06-30")).resolves.toEqual([]);
  });

  it("ne prend pas une lecture EN ERREUR pour une année absente : rien n'est demandé au ministère", async () => {
    // Une table qui refuse de répondre ne dit pas qu'elle est vide : la tenir
    // pour vide ferait partir à la source — puis écrire — à chaque hoquet
    // transitoire, pour des années peut-être déjà en cache.
    lignes = [{ annee_scolaire: "2026-2027", zone: "Zone C", libelle: "Noël", debut: "2026-12-19", fin: "2027-01-04" }];
    erreurLecture = "connexion refusée";

    await getVacances("Zone C", "2026-10-01", "2027-06-30");

    expect(recuperer).not.toHaveBeenCalled();
    expect(upserts).toHaveLength(0);
  });

  // ⚠ Le mémo des tentatives vaines vit en mémoire de PROCESSUS : il survit à
  // `beforeEach`, et un test qui l'arme pour un couple (année, zone) prive
  // tous les tests SUIVANTS de la récupération pour ce couple-là.
  //
  // Cela vaut pour tout ce qui suit dans ce fichier, pas seulement pour les
  // deux tests ci-dessous : ceux qui comptent les appels à `recuperer`
  // emploient chacun un couple inédit, et ceux qui attendent une
  // récupération — les deux « sans clé de service », sur (2027-2028, Zone C)
  // — supposent qu'aucun test placé plus haut ne l'a armé. Un test inséré
  // au-dessus qui armerait l'un de ces couples les casserait de loin, sans
  // que rien ne désigne le coupable.

  it("ne tient pas une année pour présente parce qu'une AUTRE zone y a des lignes", async () => {
    // 2027-2028 existe dans la source, garnie de Mayotte et de la Polynésie
    // seulement. Une présence indexée sur l'année seule dispenserait la
    // Zone A de récupérer, et son planning resterait vide pour toujours.
    //
    // La bascule est le cœur du test : elle fait rendre à la table les lignes
    // de toutes les zones. Sans elle, le mock reproduirait le filtre de
    // `lire()` et le test passerait même avec un `presentes` bâti sur
    // l'année seule — il ne prouverait rien.
    lectureIgnoreLaZone = true;
    lignes = [{ annee_scolaire: "2027-2028", zone: "Mayotte", libelle: "Grandes Vacances", debut: "2027-12-17", fin: "2028-01-10" }];
    recuperer.mockResolvedValue(null);

    await getVacances("Zone A", "2027-10-01", "2028-06-30");

    expect(recuperer).toHaveBeenCalledWith("2027-2028");
    // Et la bascule ne dispense pas `lire()` de demander sa zone : c'est bien
    // une table trop généreuse qu'on simule, pas une requête sans filtre.
    expect(zonesLues).toEqual(["Zone A", "Zone A"]);
  });

  it("ne rappelle pas la source dans la foulée pour une (année, zone) qu'elle ne garnit pas", async () => {
    // La source répond, et sa réponse est concluante : elle connaît
    // 2027-2028, elle n'y met simplement aucune Zone B. Sans mémo, chaque
    // rendu du planning rappellerait le ministère pour rien.
    lignes = [{ annee_scolaire: "2026-2027", zone: "Zone B", libelle: "Noël", debut: "2026-12-19", fin: "2027-01-04" }];
    recuperer.mockResolvedValue([
      { anneeScolaire: "2027-2028", zone: "Mayotte", libelle: "Grandes Vacances", debut: "2027-12-17", fin: "2028-01-10" },
    ]);

    const premier = await getVacances("Zone B", "2027-06-01", "2028-05-31");
    const second = await getVacances("Zone B", "2027-06-01", "2028-05-31");

    expect(recuperer).toHaveBeenCalledTimes(1);
    // Le mémo ne court-circuite que l'appel réseau : ce que la table contient
    // est servi aux deux appels, à l'identique.
    expect(premier).toHaveLength(1);
    expect(second).toEqual(premier);
  });

  it("ne mémorise pas une source INJOIGNABLE : une panne d'un instant n'en devient pas une de six heures", async () => {
    // L'arbitrage retenu : seul un échec concluant (la source répond, elle ne
    // porte pas cette zone) entre au mémo. Écrit dans le commentaire du
    // module, défendu dans le journal — et jusqu'ici gardé par rien.
    // Couple (année, zone) inédit dans ce fichier : le mémo vit en mémoire de
    // processus et survit à `beforeEach`.
    recuperer.mockResolvedValue(null);

    await getVacances("Guyane", "2027-10-01", "2028-06-30");
    await getVacances("Guyane", "2027-10-01", "2028-06-30");

    expect(recuperer).toHaveBeenCalledTimes(2);
  });

  // Sans clé de service, rien de ce qu'on récupérerait ne serait conservé :
  // quatre appels par ouverture du planning, douze avec l'interrupteur, à
  // chaque rendu et pour toujours, vers un service public, au bénéfice de
  // personne. Les deux tests suivants tiennent les deux moitiés de cette
  // garde : ne pas jeter, et ne pas appeler.
  const sansCleDeService = () => {
    cleDeServiceAbsente = true;
    lignes = [{ annee_scolaire: "2026-2027", zone: "Zone C", libelle: "Noël", debut: "2026-12-19", fin: "2027-01-04" }];
    // 2027-2028 manque : sans la garde, la boucle de récupération partirait.
    recuperer.mockResolvedValue([
      { anneeScolaire: "2027-2028", zone: "Zone C", libelle: "Toussaint", debut: "2027-10-16", fin: "2027-11-01" },
    ]);
  };

  it("sans clé de service, sert le cache sans jeter", async () => {
    sansCleDeService();
    await expect(getVacances("Zone C", "2027-06-01", "2028-05-31")).resolves.toEqual([
      { id: "2026-2027|Zone C|Noël", libelle: "Noël", debut: "2026-12-19", fin: "2027-01-04" },
    ]);
  });

  it("sans clé de service, n'appelle pas le ministère du tout", async () => {
    sansCleDeService();
    await getVacances("Zone C", "2027-06-01", "2028-05-31");
    expect(recuperer).not.toHaveBeenCalled();
    expect(upserts).toHaveLength(0);
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

describe("getZoneDeduiteDuFoyer", () => {
  it("déduit la zone de l'adresse de la fiche « Moi »", async () => {
    adresseFoyer = "12 rue de la Paix, 75002 Paris";
    expect(await getZoneDeduiteDuFoyer()).toBe("Zone C");
  });

  // La garde, et rien d'autre : l'adresse déduirait « Zone C », mais sans
  // session établie la lecture ne doit PAS partir. Retirer le
  // `if (!auth.user) return null;` fait tomber ce test — c'est sa seule
  // raison d'être.
  it("ne lit rien tant que la session n'est pas établie", async () => {
    adresseFoyer = "12 rue de la Paix, 75002 Paris";
    utilisateur = null;
    expect(await getZoneDeduiteDuFoyer()).toBeNull();
  });
});
