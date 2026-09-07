import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { estNatif, plateforme } from "./natif";
import { ouvrirLienExterne } from "./liens";
import { partager } from "./partage";
import { positionActuelle } from "./position";
import { toucher } from "./haptique";
import { cheminDuLien, ecouterLiensProfonds } from "./liensProfonds";
import { uaEstCoque, MARQUEUR_COQUE } from "./coque";
import { filterNav, NAV_ITEMS } from "@/features/shell/nav-config";

const ouvrirNatif = vi.fn();
const partagerNatif = vi.fn();
const positionNative = vi.fn();
const impact = vi.fn();
const retire = vi.fn();
/** Les écouteurs enregistrés par le code, pour les déclencher depuis le test. */
const ecouteurs: Record<string, ((e: { url: string }) => void) | undefined> = {};

vi.mock("@capacitor/browser", () => ({ Browser: { open: (o: unknown) => ouvrirNatif(o) } }));
vi.mock("@capacitor/share", () => ({ Share: { share: (o: unknown) => partagerNatif(o) } }));
vi.mock("@capacitor/geolocation", () => ({ Geolocation: { getCurrentPosition: (o: unknown) => positionNative(o) } }));
vi.mock("@capacitor/app", () => ({
  App: {
    addListener: async (nom: string, cb: (e: { url: string }) => void) => {
      ecouteurs[nom] = cb;
      return { remove: retire };
    },
  },
}));
vi.mock("@capacitor/haptics", () => ({
  Haptics: { impact: (o: unknown) => impact(o) },
  ImpactStyle: { Light: "LIGHT" },
}));

/** Fait croire au code qu'il tourne dans la coque (pont Capacitor injecté). */
function dansLaCoque(plateformeNom = "ios") {
  (window as unknown as { Capacitor?: unknown }).Capacitor = {
    isNativePlatform: () => true,
    getPlatform: () => plateformeNom,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  delete (window as unknown as { Capacitor?: unknown }).Capacitor;
});
afterEach(() => vi.unstubAllGlobals());

describe("estNatif", () => {
  it("est faux dans un navigateur ordinaire : aucun pont injecté", () => {
    expect(estNatif()).toBe(false);
    expect(plateforme()).toBe("web");
  });

  it("est vrai quand la coque a injecté son pont", () => {
    dansLaCoque();
    expect(estNatif()).toBe(true);
    expect(plateforme()).toBe("ios");
  });

  it("ne se laisse pas abuser par un pont incomplet ou hostile", () => {
    (window as unknown as { Capacitor?: unknown }).Capacitor = {};
    expect(estNatif()).toBe(false);
    (window as unknown as { Capacitor?: unknown }).Capacitor = {
      isNativePlatform: () => { throw new Error("pont cassé"); },
    };
    expect(estNatif()).toBe(false);
    expect(plateforme()).toBe("web");
  });
});

describe("ouvrirLienExterne", () => {
  it("sur le web : un nouvel onglet, sans donner la main sur le nôtre", async () => {
    const open = vi.fn();
    vi.stubGlobal("open", open);
    await ouvrirLienExterne("https://exemple.test/carte");
    expect(open).toHaveBeenCalledWith("https://exemple.test/carte", "_blank", "noopener,noreferrer");
    expect(ouvrirNatif).not.toHaveBeenCalled();
  });

  it("dans la coque : le navigateur du système, pas la WebView", async () => {
    dansLaCoque();
    const open = vi.fn();
    vi.stubGlobal("open", open);
    await ouvrirLienExterne("https://exemple.test/carte");
    expect(ouvrirNatif).toHaveBeenCalledWith({ url: "https://exemple.test/carte" });
    // Le point de tout l'exercice : Vito n'est PAS remplacé par le site visité.
    expect(open).not.toHaveBeenCalled();
  });

  it("une URL vide n'ouvre rien du tout", async () => {
    const open = vi.fn();
    vi.stubGlobal("open", open);
    await ouvrirLienExterne("");
    expect(open).not.toHaveBeenCalled();
    expect(ouvrirNatif).not.toHaveBeenCalled();
  });
});

describe("partager", () => {
  const fiche = { titre: "Le Bistrot", url: "https://vito.test/restos/1" };

  it("dans la coque : la feuille de partage iOS", async () => {
    dansLaCoque();
    partagerNatif.mockResolvedValue(undefined);
    expect(await partager(fiche)).toBe("natif");
    expect(partagerNatif).toHaveBeenCalledWith({ title: "Le Bistrot", text: undefined, url: fiche.url });
  });

  it("refermer la feuille de partage ne copie RIEN dans le dos", async () => {
    dansLaCoque();
    partagerNatif.mockRejectedValue(new Error("annulé"));
    const write = vi.fn();
    vi.stubGlobal("navigator", { clipboard: { writeText: write } });
    expect(await partager(fiche)).toBe("annule");
    expect(write).not.toHaveBeenCalled();
  });

  it("sur un navigateur qui sait partager : son API", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { share });
    expect(await partager(fiche)).toBe("web");
    expect(share).toHaveBeenCalled();
  });

  it("sinon, le lien part au presse-papiers — et on peut le dire", async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText: write } });
    expect(await partager(fiche)).toBe("copie");
    expect(write).toHaveBeenCalledWith(fiche.url);
  });
});

describe("positionActuelle", () => {
  it("dans la coque : la position d'iOS", async () => {
    dansLaCoque();
    positionNative.mockResolvedValue({ coords: { latitude: 48.86, longitude: 2.35 } });
    expect(await positionActuelle()).toEqual({ lat: 48.86, lng: 2.35 });
  });

  it("sur le web : celle du navigateur", async () => {
    vi.stubGlobal("navigator", {
      geolocation: {
        getCurrentPosition: (ok: (p: unknown) => void) =>
          ok({ coords: { latitude: 45.76, longitude: 4.83 } }),
      },
    });
    expect(await positionActuelle()).toEqual({ lat: 45.76, lng: 4.83 });
  });

  it("un refus est une réponse, pas une panne : on rend null", async () => {
    vi.stubGlobal("navigator", {
      geolocation: {
        getCurrentPosition: (_ok: unknown, ko: () => void) => ko(),
      },
    });
    expect(await positionActuelle()).toBeNull();

    dansLaCoque();
    positionNative.mockRejectedValue(new Error("refusé"));
    expect(await positionActuelle()).toBeNull();
  });

  it("un navigateur sans géolocalisation ne fait pas planter l'écran", async () => {
    vi.stubGlobal("navigator", {});
    expect(await positionActuelle()).toBeNull();
  });
});

describe("toucher", () => {
  it("ne fait rien sur le web", async () => {
    await toucher();
    expect(impact).not.toHaveBeenCalled();
  });

  it("vibre brièvement dans la coque", async () => {
    dansLaCoque();
    impact.mockResolvedValue(undefined);
    await toucher();
    expect(impact).toHaveBeenCalledWith({ style: "LIGHT" });
  });

  it("un appareil sans moteur haptique ne fait pas échouer l'action", async () => {
    dansLaCoque();
    impact.mockRejectedValue(new Error("pas de moteur"));
    await expect(toucher()).resolves.toBeUndefined();
  });
});

describe("cheminDuLien", () => {
  const nous = "https://vito.exemple";

  it("garde le chemin, la requête et le fragment d'un lien à nous", () => {
    expect(cheminDuLien(`${nous}/api/auth/confirm?token_hash=abc&type=email`, nous))
      .toBe("/api/auth/confirm?token_hash=abc&type=email");
    expect(cheminDuLien(`${nous}/fr/invitation/xyz#part`, nous)).toBe("/fr/invitation/xyz#part");
  });

  it("refuse un lien d'un autre domaine : ce serait une redirection ouverte", () => {
    expect(cheminDuLien("https://ailleurs.test/api/auth/confirm?token_hash=abc", nous)).toBeNull();
    // Le piège classique : un domaine qui commence comme le nôtre.
    expect(cheminDuLien("https://vito.exemple.attaquant.test/fr/accueil", nous)).toBeNull();
    // Et le même hôte sur un autre schéma.
    expect(cheminDuLien("http://vito.exemple/fr/accueil", nous)).toBeNull();
  });

  it("refuse ce qui n'est pas une URL", () => {
    expect(cheminDuLien("pas une url", nous)).toBeNull();
    expect(cheminDuLien("", nous)).toBeNull();
  });
});

describe("ecouterLiensProfonds", () => {
  it("sur le web, il n'y a rien à écouter", async () => {
    const ouvrir = vi.fn();
    const arreter = await ecouterLiensProfonds("https://vito.exemple", ouvrir);
    expect(ouvrir).not.toHaveBeenCalled();
    expect(() => arreter()).not.toThrow();
  });

  it("dans la coque, une URL reçue d'iOS ouvre son chemin — et une URL étrangère, rien", async () => {
    dansLaCoque();
    const ouvrir = vi.fn();
    const arreter = await ecouterLiensProfonds("https://vito.exemple", ouvrir);
    expect(typeof ecouteurs.appUrlOpen).toBe("function");

    ecouteurs.appUrlOpen?.({ url: "https://vito.exemple/api/auth/confirm?token_hash=abc&type=email" });
    expect(ouvrir).toHaveBeenCalledWith("/api/auth/confirm?token_hash=abc&type=email");

    ouvrir.mockClear();
    ecouteurs.appUrlOpen?.({ url: "https://ailleurs.test/api/auth/confirm?token_hash=abc" });
    expect(ouvrir).not.toHaveBeenCalled();

    arreter();
    expect(retire).toHaveBeenCalled();
  });
});

describe("uaEstCoque", () => {
  const SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15";

  it("reconnaît la coque à son marqueur", () => {
    expect(uaEstCoque(`${SAFARI} ${MARQUEUR_COQUE}`)).toBe(true);
  });

  it("ne prend pas Safari pour la coque", () => {
    expect(uaEstCoque(SAFARI)).toBe(false);
    expect(uaEstCoque(null)).toBe(false);
    expect(uaEstCoque(undefined)).toBe(false);
    expect(uaEstCoque("")).toBe(false);
  });
});

describe("filterNav dans la coque", () => {
  it("retire l'abonnement de la navigation de l'app — et de nulle part ailleurs", () => {
    const web = filterNav(NAV_ITEMS, "client").map((i) => i.key);
    const app = filterNav(NAV_ITEMS, "client", true).map((i) => i.key);
    expect(web).toContain("abonnement");
    expect(app).not.toContain("abonnement");
    // Le reste ne bouge pas : on masque une entrée, on ne réécrit pas le menu.
    expect(app).toEqual(web.filter((k) => k !== "abonnement"));
  });

  it("le filtrage par rôle continue de s'appliquer dans la coque", () => {
    const app = filterNav(NAV_ITEMS, "client", true).map((i) => i.key);
    expect(app).not.toContain("admin");
    expect(filterNav(NAV_ITEMS, "admin", true).map((i) => i.key)).toContain("admin");
  });
});
