import { describe, it, expect, vi } from "vitest";
import { consommerQuota, BAREMES } from "./quota";

type Reponse = { data: unknown; error: { message: string } | null };
function client(reponse: Reponse) {
  const rpc = vi.fn().mockResolvedValue(reponse);
  return { client: { rpc } as never, rpc };
}

describe("consommerQuota", () => {
  it("transmet le barème du serveur, jamais un barème reçu d'ailleurs", async () => {
    const { client: c, rpc } = client({ data: true, error: null });
    await consommerQuota(c, "recherche_lieu");
    expect(rpc).toHaveBeenCalledWith("consommer_quota", {
      p_action: "recherche_lieu",
      p_limite: BAREMES.recherche_lieu.limite,
      p_fenetre_secondes: BAREMES.recherche_lieu.fenetreSecondes,
    });
  });

  it("laisse passer quand la base dit oui", async () => {
    const { client: c } = client({ data: true, error: null });
    await expect(consommerQuota(c, "photo_lieu")).resolves.toBe(true);
  });

  it("refuse quand la limite est atteinte", async () => {
    const { client: c } = client({ data: false, error: null });
    await expect(consommerQuota(c, "photo_lieu")).resolves.toBe(false);
  });

  it("REFUSE quand la base est en erreur — un limiteur qui s'ouvre n'en est pas un", async () => {
    const { client: c } = client({ data: null, error: { message: "boum" } });
    await expect(consommerQuota(c, "lecture_document")).resolves.toBe(false);
  });

  it("refuse aussi sur une réponse inattendue", async () => {
    const { client: c } = client({ data: null, error: null });
    await expect(consommerQuota(c, "lecture_etiquette")).resolves.toBe(false);
  });
});

describe("BAREMES", () => {
  it("couvre les cinq chemins qui coûtent de l'argent", () => {
    expect(Object.keys(BAREMES).sort()).toEqual([
      "ajout_lieu", "lecture_document", "lecture_etiquette", "photo_lieu", "recherche_lieu",
    ]);
  });

  it("n'a aucun barème absurde — la base lèverait, autant ne pas l'y mener", () => {
    for (const [nom, b] of Object.entries(BAREMES)) {
      expect(b.limite, nom).toBeGreaterThan(0);
      expect(b.fenetreSecondes, nom).toBeGreaterThan(0);
    }
  });

  it("est plus sévère sur ce qui est facturé à l'appel que sur les vignettes", () => {
    expect(BAREMES.lecture_document.limite).toBeLessThan(BAREMES.photo_lieu.limite);
    expect(BAREMES.lecture_etiquette.limite).toBeLessThan(BAREMES.recherche_lieu.limite);
  });
});
