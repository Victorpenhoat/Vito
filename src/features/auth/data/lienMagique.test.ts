import { describe, it, expect, vi, beforeEach } from "vitest";

// "server-only" throw inconditionnellement hors bundler Next — no-op pour ce
// test unitaire (même convention que envoyer.test.ts).
vi.mock("server-only", () => ({}));

// `vi.hoisted` : les `vi.mock` sont hissés en tête de fichier, avant toute
// déclaration de variable — sans ça, les fabriques ci-dessous liraient
// `generateLink`/`envoyer` avant leur initialisation.
const { generateLink, envoyer } = vi.hoisted(() => ({
  generateLink: vi.fn(),
  envoyer: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ auth: { admin: { generateLink } } }),
}));
vi.mock("@/lib/mail/envoyer", () => ({ envoyer }));

import { envoyerLienMagiqueA } from "./lienMagique";

beforeEach(() => {
  generateLink.mockReset();
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

    expect(envoyer).toHaveBeenCalledOnce();
    const arg = envoyer.mock.calls[0]![0];
    expect(arg.genre).toBe("lien_magique");
    expect(arg.a).toBe("lecteur@vito.test");
    expect(arg.userId).toBe("u-1");
    expect(arg.html).toContain("https://vito.app/api/auth/confirm?token_hash=abc123&type=email");
    expect(arg.texte).toContain("https://vito.app/api/auth/confirm?token_hash=abc123&type=email");
  });

  // La règle de sécurité qui existait déjà et qu'il ne faut surtout pas perdre :
  // rien ne doit permettre de savoir si un compte existe.
  it("n'envoie rien et ne jette pas pour une adresse inconnue", async () => {
    generateLink.mockResolvedValue({ data: null, error: { message: "User not found" } });
    await expect(envoyerLienMagiqueA("inconnu@vito.test", "https://vito.app")).resolves.toBeUndefined();
    expect(envoyer).not.toHaveBeenCalled();
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
