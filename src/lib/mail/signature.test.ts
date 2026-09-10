import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { signatureValide } from "./signature";

const SECRET = "whsec_" + Buffer.from("clef-de-test-longue-assez").toString("base64");
const CORPS = '{"type":"email.delivered"}';
const ID = "msg_1";

function signer(id: string, ts: string, corps: string, secret = SECRET): string {
  const brut = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  return "v1," + createHmac("sha256", brut).update(`${id}.${ts}.${corps}`).digest("base64");
}

const maintenant = () => Math.floor(Date.now() / 1000).toString();

describe("signatureValide", () => {
  it("accepte une signature correcte et récente", () => {
    const ts = maintenant();
    expect(signatureValide(SECRET, ID, ts, CORPS, signer(ID, ts, CORPS))).toBe(true);
  });

  it("refuse un corps modifié — c'est tout l'objet", () => {
    const ts = maintenant();
    const sig = signer(ID, ts, CORPS);
    expect(signatureValide(SECRET, ID, ts, '{"type":"email.bounced"}', sig)).toBe(false);
  });

  it("refuse une signature d'un autre secret", () => {
    const ts = maintenant();
    const autre = "whsec_" + Buffer.from("un-autre-secret-entierement").toString("base64");
    expect(signatureValide(SECRET, ID, ts, CORPS, signer(ID, ts, CORPS, autre))).toBe(false);
  });

  // Sans fenêtre, une requête interceptée se rejoue indéfiniment.
  it("refuse un horodatage trop vieux", () => {
    const vieux = (Math.floor(Date.now() / 1000) - 3600).toString();
    expect(signatureValide(SECRET, ID, vieux, CORPS, signer(ID, vieux, CORPS))).toBe(false);
  });

  it("accepte quand l'en-tête porte plusieurs signatures, dont la bonne", () => {
    const ts = maintenant();
    const entete = "v1,dGVzdA== " + signer(ID, ts, CORPS);
    expect(signatureValide(SECRET, ID, ts, CORPS, entete)).toBe(true);
  });
});
