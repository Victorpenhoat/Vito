import { describe, it, expect, vi, afterEach } from "vitest";
import { ResendMailProvider } from "./resend";

const provider = new ResendMailProvider("cle-de-test", "contact@vito.app");

const message = {
  a: "lecteur@vito.test",
  sujet: "Votre lien de connexion",
  html: "<p>lien</p>",
  texte: "lien",
};

function repond(corps: unknown, ok = true) {
  const mock = vi.fn().mockResolvedValue({ ok, json: async () => corps } as Response);
  vi.stubGlobal("fetch", mock);
  return mock;
}

afterEach(() => vi.unstubAllGlobals());

describe("ResendMailProvider", () => {
  it("poste le message et rend l'identifiant du fournisseur", async () => {
    const fetchMock = repond({ id: "re_123" });
    expect(await provider.envoyer(message)).toEqual({ id: "re_123" });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer cle-de-test");
    expect(JSON.parse(init.body as string)).toEqual({
      from: "contact@vito.app",
      to: "lecteur@vito.test",
      subject: "Votre lien de connexion",
      html: "<p>lien</p>",
      text: "lien",
    });
  });

  it("rend null plutôt que de jeter quand le fournisseur refuse", async () => {
    repond({ message: "domaine non vérifié" }, false);
    expect(await provider.envoyer(message)).toBeNull();
  });

  it("rend null quand le réseau tombe", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNRESET")));
    expect(await provider.envoyer(message)).toBeNull();
  });

  it("rend null si la réponse n'a pas d'identifiant : sans lui le webhook ne retrouvera rien", async () => {
    repond({});
    expect(await provider.envoyer(message)).toBeNull();
  });
});
