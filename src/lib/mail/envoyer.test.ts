import { describe, it, expect, vi, beforeEach } from "vitest";

// "server-only" throw inconditionnellement hors bundler Next (pas de condition
// d'export "react-server" sous Vitest) — no-op pour ce test unitaire du module lui-même.
vi.mock("server-only", () => ({}));

const envoyerFournisseur = vi.fn();
vi.mock("@/lib/services/mail", () => ({
  getMailProvider: () => ({ name: "faux", envoyer: envoyerFournisseur }),
}));

// Le client admin est réduit à ce que `envoyer()` en fait : insert ... select single,
// puis update ... eq. On garde la trace des appels pour les assertions.
const inserees: Record<string, unknown>[] = [];
const misesAJour: Record<string, unknown>[] = [];
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      insert: (ligne: Record<string, unknown>) => ({
        select: () => ({
          single: async () => {
            inserees.push(ligne);
            return { data: { id: "ligne-1" }, error: null };
          },
        }),
      }),
      update: (champs: Record<string, unknown>) => ({
        eq: async () => {
          misesAJour.push(champs);
          return { error: null };
        },
      }),
    }),
  }),
}));

import { envoyer } from "./envoyer";

const message = {
  a: "lecteur@vito.test",
  genre: "lien_magique" as const,
  sujet: "sujet-secret-9f3a",
  html: "<p>corps-secret-9f3a</p>",
  texte: "corps-secret-9f3a",
};

beforeEach(() => {
  inserees.length = 0;
  misesAJour.length = 0;
  envoyerFournisseur.mockReset();
});

describe("envoyer", () => {
  it("journalise en 'en_cours' AVANT d'appeler le fournisseur", async () => {
    envoyerFournisseur.mockResolvedValue({ id: "re_1" });
    await envoyer(message);
    expect(inserees[0]).toMatchObject({
      destinataire: "lecteur@vito.test",
      genre: "lien_magique",
      statut: "en_cours",
    });
  });

  it("ne journalise ni le sujet ni le corps", async () => {
    envoyerFournisseur.mockResolvedValue({ id: "re_1" });
    await envoyer(message);
    const ligne = JSON.stringify(inserees[0]);
    // Marqueur distinctif partagé par sujet/html/texte, absent de tout ce qui est
    // légitimement journalisé (genre, destinataire, statut) : une seule assertion
    // suffit à couvrir une fuite depuis n'importe lequel des trois champs.
    expect(ligne).not.toContain("secret-9f3a");
  });

  it("passe la ligne à 'accepte' avec l'identifiant du fournisseur", async () => {
    envoyerFournisseur.mockResolvedValue({ id: "re_1" });
    expect(await envoyer(message)).toEqual({ id: "re_1" });
    expect(misesAJour[0]).toMatchObject({ statut: "accepte", fournisseur_id: "re_1" });
  });

  it("passe la ligne à 'echec' et rend null quand le fournisseur ne part pas", async () => {
    envoyerFournisseur.mockResolvedValue(null);
    expect(await envoyer(message)).toBeNull();
    expect(misesAJour[0]).toMatchObject({ statut: "echec" });
  });

  it("ne jette jamais, même si le fournisseur jette : un e-mail ne fait pas échouer l'action", async () => {
    envoyerFournisseur.mockRejectedValue(new Error("boum"));
    await expect(envoyer(message)).resolves.toBeNull();
    expect(misesAJour[0]).toMatchObject({ statut: "echec" });
  });
});
