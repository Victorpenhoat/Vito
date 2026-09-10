import { describe, it, expect, vi, beforeEach } from "vitest";

// "server-only" throw inconditionnellement hors bundler Next — no-op pour ce
// test unitaire (même convention que envoyer.test.ts).
vi.mock("server-only", () => ({}));

// `vi.hoisted` : les `vi.mock` sont hissés en tête de fichier, avant toute
// déclaration de variable — sans ça, les fabriques ci-dessous liraient
// `generateLink`/`rpc`/`envoyer` avant leur initialisation.
const { generateLink, rpc, envoyer, compter, filtres } = vi.hoisted(() => ({
  generateLink: vi.fn(),
  rpc: vi.fn(),
  envoyer: vi.fn(),
  // Le compteur du limiteur : rend { count, error } comme PostgREST en
  // `head: true`, et enregistre les filtres pour qu'on vérifie SUR QUOI il compte.
  compter: vi.fn(),
  filtres: [] as [string, unknown][],
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: { admin: { generateLink } },
    rpc,
    from: (table: string) => ({
      select: (_colonnes: string, options?: { count?: string; head?: boolean }) => {
        filtres.push(["from", table]);
        filtres.push(["select", options]);
        const chaine = {
          eq: (colonne: string, valeur: unknown) => {
            filtres.push([`eq:${colonne}`, valeur]);
            return chaine;
          },
          gte: (colonne: string, valeur: unknown) => {
            filtres.push([`gte:${colonne}`, valeur]);
            return chaine;
          },
          then: (ok: (r: unknown) => unknown, ko?: (e: unknown) => unknown) =>
            Promise.resolve(compter()).then(ok, ko),
        };
        return chaine;
      },
    }),
  }),
}));
vi.mock("@/lib/mail/envoyer", () => ({ envoyer }));

import { envoyerLienMagiqueA, LIMITE_LIENS } from "./lienMagique";

beforeEach(() => {
  generateLink.mockReset();
  rpc.mockReset();
  // Compte existant par défaut : chaque test qui veut le cas « inconnu »
  // le redéfinit explicitement, pour ne jamais s'y retrouver par accident.
  rpc.mockResolvedValue({ data: true, error: null });
  envoyer.mockReset();
  envoyer.mockResolvedValue({ id: "re_1" });
  compter.mockReset();
  // Sous la limite par défaut : chaque test qui veut le refus le dit.
  compter.mockResolvedValue({ count: 0, error: null });
  filtres.length = 0;
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

// I3 : le garde-fou de débit, qui n'existait pas — et dont l'absence est une
// régression, pas un manque : GoTrue appliquait `rate_limit_email_sent` tant
// qu'il envoyait, `generateLink` le contourne.
describe("limitation de débit du lien magique", () => {
  it("compte les liens déjà envoyés à CETTE adresse, sur une fenêtre récente", async () => {
    generateLink.mockResolvedValue({
      data: { properties: { hashed_token: "abc" }, user: { id: "u-1" } },
      error: null,
    });
    await envoyerLienMagiqueA("lecteur@vito.test", "https://vito.app");

    expect(filtres).toContainEqual(["from", "journal_envois"]);
    expect(filtres).toContainEqual(["select", { count: "exact", head: true }]);
    expect(filtres).toContainEqual(["eq:destinataire", "lecteur@vito.test"]);
    expect(filtres).toContainEqual(["eq:genre", "lien_magique"]);
    const borne = filtres.find(([c]) => c === "gte:created_at")?.[1] as string;
    const ecartMinutes = (Date.now() - Date.parse(borne)) / 60_000;
    expect(ecartMinutes).toBeGreaterThan(14.9);
    expect(ecartMinutes).toBeLessThan(15.1);
  });

  it("passe tant qu'on est sous la limite", async () => {
    compter.mockResolvedValue({ count: LIMITE_LIENS - 1, error: null });
    generateLink.mockResolvedValue({
      data: { properties: { hashed_token: "abc" }, user: { id: "u-1" } },
      error: null,
    });
    await envoyerLienMagiqueA("lecteur@vito.test", "https://vito.app");
    expect(envoyer).toHaveBeenCalledOnce();
  });

  it("au-delà de la limite : refus SILENCIEUX, aucun generateLink, aucun envoi", async () => {
    compter.mockResolvedValue({ count: LIMITE_LIENS, error: null });
    await expect(
      envoyerLienMagiqueA("lecteur@vito.test", "https://vito.app"),
    ).resolves.toBeUndefined();
    expect(generateLink).not.toHaveBeenCalled();
    expect(envoyer).not.toHaveBeenCalled();
  });

  // La casse ne doit pas offrir un quota neuf : « Foo@ » puis « foo@ » sont la
  // même boîte, et `compte_existe` compare déjà en minuscules.
  it("normalise l'adresse : une variante de casse compte sur le même compteur", async () => {
    compter.mockResolvedValue({ count: LIMITE_LIENS, error: null });
    await envoyerLienMagiqueA("  Lecteur@Vito.TEST ", "https://vito.app");
    expect(filtres).toContainEqual(["eq:destinataire", "lecteur@vito.test"]);
    expect(rpc).toHaveBeenCalledWith("compte_existe", { p_email: "lecteur@vito.test" });
    expect(generateLink).not.toHaveBeenCalled();
  });

  // Même règle que consommerQuota (ADR 0002) : un limiteur qui s'ouvre quand la
  // base tousse n'en est pas un.
  it("refuse quand le compteur est indisponible", async () => {
    compter.mockResolvedValue({ count: null, error: { message: "base indisponible" } });
    await expect(
      envoyerLienMagiqueA("lecteur@vito.test", "https://vito.app"),
    ).resolves.toBeUndefined();
    expect(generateLink).not.toHaveBeenCalled();
    expect(envoyer).not.toHaveBeenCalled();
  });
});
