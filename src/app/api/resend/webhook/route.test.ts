import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHmac } from "node:crypto";

// Le test de la ROUTE, pas de ses morceaux : `signature.ts` et `statut.ts` sont
// déjà éprouvés isolément, mais rien ne vérifiait leur composition — ni, surtout,
// que la route et `envoyer()` parlent bien du même identifiant (le dernier test).
//
// La signature n'est PAS simulée : elle est calculée avec le même algorithme que
// Resend, et vérifiée par le vrai `signature.ts`. Une signature simulée ne
// prouverait rien de ce que cette route refuse.

vi.mock("server-only", () => ({}));

const SECRET = `whsec_${Buffer.from("secret-de-test-du-webhook").toString("base64")}`;

const envMock = vi.hoisted(() => ({
  env: { RESEND_WEBHOOK_SECRET: undefined as string | undefined },
}));
vi.mock("@/lib/env", () => envMock);

// Journal en mémoire, partagé par la route ET par `envoyer()` : les deux passent
// par `createAdminClient()`, donc par ce même faux client.
type Ligne = {
  id: string;
  destinataire: string;
  genre: string;
  fournisseur_id: string | null;
  statut: string;
  user_id: string | null;
};
const journal = vi.hoisted(() => ({
  lignes: [] as Record<string, unknown>[],
  erreurLecture: null as { message: string } | null,
  erreurEcriture: null as { message: string } | null,
  sequence: 0,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      insert: (ligne: Record<string, unknown>) => ({
        select: () => ({
          single: async () => {
            const complete = { id: `ligne-${++journal.sequence}`, fournisseur_id: null, ...ligne };
            journal.lignes.push(complete);
            return { data: complete, error: null };
          },
        }),
      }),
      select: () => {
        const conditions: [string, unknown][] = [];
        const chaine = {
          eq: (colonne: string, valeur: unknown) => {
            conditions.push([colonne, valeur]);
            return chaine;
          },
          maybeSingle: async () => {
            if (journal.erreurLecture) return { data: null, error: journal.erreurLecture };
            const trouvee = journal.lignes.find((l) =>
              conditions.every(([colonne, valeur]) => l[colonne] === valeur),
            );
            return { data: trouvee ?? null, error: null };
          },
        };
        return chaine;
      },
      update: (champs: Record<string, unknown>) => {
        const egalites: [string, unknown][] = [];
        const appartenances: [string, unknown[]][] = [];
        const appliquer = () => {
          if (journal.erreurEcriture) return { error: journal.erreurEcriture };
          for (const ligne of journal.lignes) {
            const ok =
              egalites.every(([colonne, valeur]) => ligne[colonne] === valeur) &&
              appartenances.every(([colonne, valeurs]) => valeurs.includes(ligne[colonne]));
            if (ok) Object.assign(ligne, champs);
          }
          return { error: null };
        };
        const chaine = {
          eq: (colonne: string, valeur: unknown) => {
            egalites.push([colonne, valeur]);
            return chaine;
          },
          in: (colonne: string, valeurs: unknown[]) => {
            appartenances.push([colonne, valeurs]);
            return chaine;
          },
          // Thenable : `await ...update().eq()` (envoyer) comme
          // `await ...update().eq().in()` (la route) doivent tous deux résoudre.
          then: (ok: (r: unknown) => unknown, ko?: (e: unknown) => unknown) =>
            Promise.resolve(appliquer()).then(ok, ko),
        };
        return chaine;
      },
    }),
  }),
}));

// Pour le test de couture : un fournisseur qui rend l'identifiant que Resend
// rendrait, et que le webhook citera ensuite dans `data.email_id`.
const envoyerFournisseur = vi.hoisted(() => vi.fn());
vi.mock("@/lib/services/mail", () => ({
  getMailProvider: () => ({ name: "faux", envoyer: envoyerFournisseur }),
}));

import { POST } from "./route";
import { envoyer } from "@/lib/mail/envoyer";

function signer(corps: string, id = "msg_1", horodatage = String(Math.floor(Date.now() / 1000))) {
  const brut = Buffer.from(SECRET.replace(/^whsec_/, ""), "base64");
  const signature = createHmac("sha256", brut).update(`${id}.${horodatage}.${corps}`).digest("base64");
  return { id, horodatage, signature: `v1,${signature}` };
}

function requete(evenement: unknown, options?: { signature?: string }) {
  const corps = JSON.stringify(evenement);
  const { id, horodatage, signature } = signer(corps);
  return new Request("http://x/api/resend/webhook", {
    method: "POST",
    body: corps,
    headers: {
      "svix-id": id,
      "svix-timestamp": horodatage,
      "svix-signature": options?.signature ?? signature,
    },
  });
}

const remise = (emailId: string) => ({ type: "email.delivered", data: { email_id: emailId } });

beforeEach(() => {
  envMock.env.RESEND_WEBHOOK_SECRET = SECRET;
  journal.lignes.length = 0;
  journal.erreurLecture = null;
  journal.erreurEcriture = null;
  journal.sequence = 0;
  envoyerFournisseur.mockReset();
});

describe("POST /api/resend/webhook", () => {
  it("secret absent → 500, et rien n'est lu", async () => {
    envMock.env.RESEND_WEBHOOK_SECRET = undefined;
    journal.lignes.push({ id: "l1", fournisseur_id: "re_1", statut: "accepte" });
    const res = await POST(requete(remise("re_1")));
    expect(res.status).toBe(500);
    expect((journal.lignes[0] as Ligne).statut).toBe("accepte");
  });

  it("signature invalide → 400, et rien n'est écrit", async () => {
    journal.lignes.push({ id: "l1", fournisseur_id: "re_1", statut: "accepte" });
    const res = await POST(requete(remise("re_1"), { signature: "v1,bWF1dmFpc2U=" }));
    expect(res.status).toBe(400);
    expect((journal.lignes[0] as Ligne).statut).toBe("accepte");
  });

  it("identifiant inconnu → 200 sans insertion : qui connaît l'URL ne remplit pas la table", async () => {
    const res = await POST(requete(remise("re_jamais_vu")));
    expect(res.status).toBe(200);
    expect(journal.lignes).toHaveLength(0);
  });

  it("lecture en erreur → 500 (Resend rejouera), et surtout PAS 200", async () => {
    journal.erreurLecture = { message: "base indisponible" };
    const res = await POST(requete(remise("re_1")));
    expect(res.status).toBe(500);
  });

  it("écriture en erreur → 500", async () => {
    journal.lignes.push({ id: "l1", fournisseur_id: "re_1", statut: "accepte" });
    journal.erreurEcriture = { message: "écriture refusée" };
    const res = await POST(requete(remise("re_1")));
    expect(res.status).toBe(500);
  });

  it("un statut ne recule pas : 'remis' ne redevient pas 'accepte'", async () => {
    journal.lignes.push({ id: "l1", fournisseur_id: "re_1", statut: "remis" });
    const res = await POST(
      requete({ type: "email.sent", data: { email_id: "re_1" } }),
    );
    expect(res.status).toBe(200);
    expect((journal.lignes[0] as Ligne).statut).toBe("remis");
  });

  // LA couture, et la raison d'être de ce fichier : `envoyer()` écrit dans
  // `fournisseur_id` le `{id}` que rend Resend ; la route relit `data.email_id`.
  // Rien ne prouvait que les deux désignent la même chose. Ici le journal est
  // écrit par la vraie `envoyer()`, et lu par la vraie route.
  it("email.delivered fait passer à 'remis' la ligne écrite par envoyer()", async () => {
    envoyerFournisseur.mockResolvedValue({ id: "re_couture" });
    await envoyer({
      a: "lecteur@vito.test",
      genre: "lien_magique",
      sujet: "Votre lien de connexion à Vito",
      html: "<p>x</p>",
      texte: "x",
    });
    expect(journal.lignes).toHaveLength(1);
    expect(journal.lignes[0]).toMatchObject({ fournisseur_id: "re_couture", statut: "accepte" });

    const res = await POST(requete(remise("re_couture")));

    expect(res.status).toBe(200);
    expect((journal.lignes[0] as Ligne).statut).toBe("remis");
  });
});
