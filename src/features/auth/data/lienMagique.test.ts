import { describe, it, expect, vi, beforeEach } from "vitest";

// "server-only" throw inconditionnellement hors bundler Next — no-op pour ce
// test unitaire (même convention que envoyer.test.ts).
vi.mock("server-only", () => ({}));

// `vi.hoisted` : les `vi.mock` sont hissés en tête de fichier, avant toute
// déclaration de variable — sans ça, les fabriques ci-dessous liraient
// `generateLink`/`rpc`/`envoyer` avant leur initialisation.
const { generateLink, rpc, envoyer } = vi.hoisted(() => ({
  generateLink: vi.fn(),
  rpc: vi.fn(),
  envoyer: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ auth: { admin: { generateLink } }, rpc }),
}));
vi.mock("@/lib/mail/envoyer", () => ({ envoyer }));

import { envoyerLienMagiqueA } from "./lienMagique";

beforeEach(() => {
  generateLink.mockReset();
  rpc.mockReset();
  // Compte existant par défaut : chaque test qui veut le cas « inconnu »
  // le redéfinit explicitement, pour ne jamais s'y retrouver par accident.
  rpc.mockResolvedValue({ data: true, error: null });
  envoyer.mockReset();
  envoyer.mockResolvedValue({ id: "re_1" });
});

describe("envoyerLienMagiqueA", () => {
  it("envoie un lien qui pointe sur /api/auth/confirm avec le jeton haché", async () => {
    generateLink.mockResolvedValue({
      data: { properties: { hashed_token: "abc123" }, user: { id: "u-1" } },
      error: null,
    });

    await envoyerLienMagiqueA("lecteur@vito.test", "https://vito.app");

    expect(rpc).toHaveBeenCalledWith("compte_existe", { p_email: "lecteur@vito.test" });
    expect(envoyer).toHaveBeenCalledOnce();
    const arg = envoyer.mock.calls[0]![0];
    expect(arg.genre).toBe("lien_magique");
    expect(arg.a).toBe("lecteur@vito.test");
    expect(arg.userId).toBe("u-1");
    expect(arg.html).toContain("https://vito.app/api/auth/confirm?token_hash=abc123&type=email");
    expect(arg.texte).toContain("https://vito.app/api/auth/confirm?token_hash=abc123&type=email");
  });

  // La règle de sécurité qui existait déjà et qu'il ne faut surtout pas perdre :
  // rien ne doit permettre de savoir si un compte existe. Corrigé après revue :
  // le point de décision est compte_existe(), PAS l'échec de generateLink —
  // generateLink CRÉE le compte pour une adresse inconnue, il ne doit donc
  // jamais être appelé dans ce cas.
  it("n'envoie rien, n'appelle jamais generateLink, et ne jette pas pour une adresse inconnue", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    await expect(envoyerLienMagiqueA("inconnu@vito.test", "https://vito.app")).resolves.toBeUndefined();
    expect(generateLink).not.toHaveBeenCalled();
    expect(envoyer).not.toHaveBeenCalled();
  });

  it("ne jette pas si la sonde d'existence échoue", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "fonction indisponible" } });
    await expect(envoyerLienMagiqueA("lecteur@vito.test", "https://vito.app")).resolves.toBeUndefined();
    expect(generateLink).not.toHaveBeenCalled();
  });

  it("ne jette pas si l'envoi échoue", async () => {
    generateLink.mockResolvedValue({
      data: { properties: { hashed_token: "abc" }, user: { id: "u-1" } },
      error: null,
    });
    envoyer.mockResolvedValue(null);
    await expect(envoyerLienMagiqueA("lecteur@vito.test", "https://vito.app")).resolves.toBeUndefined();
  });
});
