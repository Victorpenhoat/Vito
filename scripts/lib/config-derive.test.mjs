import { describe, it, expect } from "vitest";
import {
  extraireDiff,
  derivesInterdites,
  messageDerive,
  estSousCommandeInconnue,
  CHEMINS_SURVEILLES,
} from "./config-derive.mjs";

/** Une entrée de `changes` telle que la rend `supabase config diff`. */
const change = (chemin, local, distant, classe = "update") => ({
  path: chemin.split("."),
  class: classe,
  declared: true,
  local,
  remote: distant,
});

const diff = (changes) => ({ schema_version: 1, changes, counts: { total: changes.length } });

describe("extraireDiff", () => {
  it("trouve le JSON même précédé des lignes de journal du CLI", () => {
    // Constaté : le CLI écrit un WARN de dépréciation et une ligne « Comparing
    // against project … » AVANT le JSON. Parser la sortie entière échoue.
    const sortie = [
      "WARN: config section [inbucket] is deprecated.",
      "Comparing against project nminpsgwaebiicgckmgp using base config",
      JSON.stringify(diff([])),
    ].join("\n");
    expect(extraireDiff(sortie).counts.total).toBe(0);
  });

  it("refuse bruyamment une sortie sans JSON, au lieu de la prendre pour un diff vide", () => {
    // Le mode de panne à éviter : le CLI échoue, on lit « aucune dérive » et on
    // conclut que tout va bien. C'est ce qui a laissé le hook débranché.
    expect(() => extraireDiff("Error: not authorized")).toThrow(/pas de JSON/i);
  });
});

describe("estSousCommandeInconnue", () => {
  it("reconnaît une CLI trop ancienne, qui rend son aide au lieu du diff", () => {
    // Mesuré : la CLI 2.116.0 ne connaît QUE `config push`. Au lieu d'une erreur,
    // elle rend son aide en JSON avec un statut non nul — indiscernable d'un
    // problème de jeton si on ne regarde pas la forme.
    const aide = JSON.stringify({
      _tag: "Help",
      doc: { usage: "supabase config <subcommand> [flags]", subcommands: [{ commands: [{ name: "push" }] }] },
    });
    expect(estSousCommandeInconnue(aide)).toBe(true);
  });

  it("ne confond pas un vrai refus d'authentification avec une CLI trop vieille", () => {
    expect(estSousCommandeInconnue("Error: Unauthorized. Have you run supabase login?")).toBe(false);
  });

  it("ne confond pas un diff valide avec une aide", () => {
    expect(estSousCommandeInconnue(JSON.stringify(diff([])))).toBe(false);
  });
});

describe("derivesInterdites", () => {
  it("ne signale rien quand les écarts portent sur des réglages libres", () => {
    // Le config local est un config de DÉVELOPPEMENT : il diffère légitimement
    // du distant sur l'URL du site, la longueur des OTP, les modèles d'e-mail…
    // Un garde-fou qui crie là-dessus serait rouge en permanence, donc ignoré.
    const d = diff([
      change("auth.site_url", "http://127.0.0.1:3000", "https://vito-theta.vercel.app"),
      change("auth.email.otp_length", 6, 8),
      change("storage.vector.enabled", false, true),
    ]);
    expect(derivesInterdites(d)).toEqual([]);
  });

  it("signale le hook désactivé à distance — le défaut vécu du 14 septembre", () => {
    const d = diff([
      change("auth.site_url", "http://127.0.0.1:3000", "https://vito-theta.vercel.app"),
      change("auth.hook.custom_access_token.enabled", true, false),
    ]);
    expect(derivesInterdites(d)).toEqual([
      { chemin: "auth.hook.custom_access_token.enabled", local: true, distant: false },
    ]);
  });

  it("signale aussi le hook sans URI, que le CLI classe « local_only »", () => {
    const d = diff([
      change("auth.hook.custom_access_token.uri", "pg-functions://postgres/public/x", null, "local_only"),
    ]);
    expect(derivesInterdites(d).map((x) => x.chemin)).toEqual(["auth.hook.custom_access_token.uri"]);
  });

  it("surveille exactement les chemins déclarés, ni plus ni moins", () => {
    const d = diff(CHEMINS_SURVEILLES.map((c) => change(c, "local", "distant")));
    expect(derivesInterdites(d).map((x) => x.chemin)).toEqual(CHEMINS_SURVEILLES);
  });

  it("tolère un diff sans clé `changes` plutôt que de lever", () => {
    expect(derivesInterdites({ counts: { total: 0 } })).toEqual([]);
  });
});

describe("messageDerive", () => {
  it("dit que tout est conforme quand rien ne dérive", () => {
    expect(messageDerive([], "prod")).toMatch(/conforme/i);
  });

  it("nomme le chemin, les deux valeurs, et le geste qui répare", () => {
    const m = messageDerive(
      [{ chemin: "auth.hook.custom_access_token.enabled", local: true, distant: false }],
      "prod",
    );
    expect(m).toContain("auth.hook.custom_access_token.enabled");
    expect(m).toContain("false");
    expect(m).toContain("Authentication → Hooks");
  });

  it("détourne explicitement de `config push`, qui écraserait le Site URL de prod", () => {
    // Piège mesuré : `supabase config push` envoie TOUT le config.toml et
    // remplacerait site_url par http://127.0.0.1:3000. Le message doit couper
    // court au réflexe.
    const m = messageDerive([{ chemin: "auth.hook.custom_access_token.enabled", local: true, distant: false }], "prod");
    expect(m).toMatch(/config push/);
    expect(m).toMatch(/jamais|surtout pas|ne pas/i);
  });
});
