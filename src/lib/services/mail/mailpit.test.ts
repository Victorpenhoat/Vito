import { describe, it, expect, vi, afterEach } from "vitest";
import { MailpitMailProvider } from "./mailpit";

const provider = new MailpitMailProvider("http://127.0.0.1:54324", "contact@vito.app");
const message = { a: "lecteur@vito.test", genre: "lien_magique", sujet: "Sujet", html: "<p>x</p>", texte: "x" };

afterEach(() => vi.unstubAllGlobals());

describe("MailpitMailProvider", () => {
  it("dépose le message dans la boîte locale", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ID: "m1" }) } as Response);
    vi.stubGlobal("fetch", fetchMock);
    expect(await provider.envoyer(message)).toEqual({ id: "m1" });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:54324/api/v1/send");
    expect(JSON.parse(init.body as string).To).toEqual([{ Email: "lecteur@vito.test" }]);
  });

  it("rend null si la boîte locale n'est pas là, sans jeter", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
    expect(await provider.envoyer(message)).toBeNull();
  });
});
