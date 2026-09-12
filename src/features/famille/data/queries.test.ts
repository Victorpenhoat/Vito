import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabase, type OpResult } from "@/test/supabaseMock";

// Espion qui DÉLÈGUE au vrai déchiffrement : on veut la vraie logique de
// `dechiffrerChamp` dans le premier test, et savoir s'il est appelé dans le second.
const espionDechiffrer = vi.fn();
vi.mock("@/lib/crypto/champs", async () => {
  const reel = await vi.importActual<typeof import("@/lib/crypto/champs")>("@/lib/crypto/champs");
  return {
    ...reel,
    dechiffrerChamp: (chiffre: string | null) => {
      espionDechiffrer(chiffre);
      return reel.dechiffrerChamp(chiffre);
    },
  };
});

let mock: ReturnType<typeof createMockSupabase>;
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => mock.client,
  getCachedUser: async () => ({ user: { id: "u1" } }),
}));

import { getProche } from "./queries";

const MEMBRE = {
  id: "m1", first_name: "Camille", last_name: "Dupont", relation: "fille",
  circle: "famille", avatar_color: null, phone: null, email: null,
  birth_date: null, birth_place: null, address: null,
  // false : pas de second appel family_members pour l'adresse du foyer
  address_inherit: false, profile_id: null,
};

function doc(doc_number_present: boolean) {
  return [{
    id: "d1", doc_type: "passeport", doc_label: null, doc_number_present,
    country: "FR", holder_name: null, issue_date: null, expiry_date: null,
    issue_place: null, mime_type: "application/pdf", reminder: null, taille_verso: null,
  }];
}

const setup = (docs: ReturnType<typeof doc>) => {
  mock = createMockSupabase({
    on: (table): OpResult =>
      table === "family_members" ? { data: MEMBRE, error: null } : { data: docs, error: null },
  });
};

beforeEach(() => espionDechiffrer.mockClear());

describe("getProche — le numéro protégé ne parvient jamais à la page", () => {
  // docs/security.md §2 : « les requêtes de page ne sélectionnent jamais la
  // colonne chiffrée : la valeur n'est pas dans le HTML, même illisible ».
  //
  // Le masque étant une constante, seule la PRÉSENCE d'un numéro compte. La
  // requête demande donc une colonne générée booléenne, et la valeur chiffrée
  // ne quitte plus la base du tout — ni pour être déchiffrée, ni pour être
  // transportée jusqu'au serveur puis jetée.
  it("ne demande jamais la colonne chiffrée à la base", async () => {
    setup(doc(true));
    await getProche("m1");
    const appel = mock.calls.find(
      (c) => c.kind === "table" && c.table === "family_documents" && c.op === "select",
    );
    const projection = String(appel && "payload" in appel ? appel.payload : "");
    expect(projection).not.toContain("doc_number_chiffre");
    expect(projection).toContain("doc_number_present");
  });

  it("ne déchiffre jamais le numéro pour construire le masque", async () => {
    setup(doc(true));
    await getProche("m1");
    expect(espionDechiffrer).not.toHaveBeenCalled();
  });

  it("masque un numéro qui existe, sans rien en dire d'autre", async () => {
    setup(doc(true));
    const res = await getProche("m1");
    expect(res?.documents[0]!.doc_number_masque).toBe("••••");
  });

  it("ne rend aucun masque quand le document n'a pas de numéro", async () => {
    // Quatre points diraient qu'un numéro existe.
    setup(doc(false));
    const res = await getProche("m1");
    expect(res?.documents[0]!.doc_number_masque).toBe("");
  });
});
