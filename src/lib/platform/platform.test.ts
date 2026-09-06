import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { estNatif, plateforme } from "./natif";
import { ouvrirLienExterne } from "./liens";
import { partager } from "./partage";
import { positionActuelle } from "./position";
import { toucher } from "./haptique";

const ouvrirNatif = vi.fn();
const partagerNatif = vi.fn();
const positionNative = vi.fn();
const impact = vi.fn();

vi.mock("@capacitor/browser", () => ({ Browser: { open: (o: unknown) => ouvrirNatif(o) } }));
vi.mock("@capacitor/share", () => ({ Share: { share: (o: unknown) => partagerNatif(o) } }));
vi.mock("@capacitor/geolocation", () => ({ Geolocation: { getCurrentPosition: (o: unknown) => positionNative(o) } }));
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
