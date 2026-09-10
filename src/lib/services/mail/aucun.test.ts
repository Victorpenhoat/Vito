import { describe, it, expect, vi, beforeEach } from "vitest";

const info = vi.hoisted(() => vi.fn());
vi.mock("@/lib/log", () => ({ log: { info } }));

import { AucunMailProvider } from "./aucun";

const message = {
  a: "lecteur@vito.test",
  genre: "lien_magique",
  sujet: "sujet-secret-9f3a",
  html: "<p>corps-secret-9f3a</p>",
  texte: "corps-secret-9f3a",
};

beforeEach(() => info.mockReset());

describe("AucunMailProvider", () => {
  it("ne prétend pas avoir envoyé", async () => {
    expect(await new AucunMailProvider().envoyer(message)).toBeNull();
  });

  // Le journal ne garde AUCUN contenu, exprès. Les logs ne doivent pas devenir
  // discrètement l'endroit où il s'accumule à sa place : le genre dit ce qui
  // est parti, le sujet est du contenu.
  it("trace le genre, jamais le sujet ni le corps", async () => {
    await new AucunMailProvider().envoyer(message);
    expect(info).toHaveBeenCalledWith("mail_non_configure", {
      a: "lecteur@vito.test",
      genre: "lien_magique",
    });
    expect(JSON.stringify(info.mock.calls)).not.toContain("secret-9f3a");
  });
});
