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

function doc(doc_number_chiffre: string | null) {
  return [{
    id: "d1", doc_type: "passeport", doc_label: null, doc_number_chiffre,
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

describe("getProche — le numéro protégé ne se déchiffre pas pour la page", () => {
  // docs/security.md §2 : « les requêtes de page ne sélectionnent jamais la
  // colonne chiffrée : la valeur n'est pas dans le HTML, même illisible ».
  // Le masque étant une constante, son contenu ne dépend plus de la valeur —
  // seule la PRÉSENCE compte, et déchiffrer devient du travail mort sur une
  // donnée sensible.
  it("ne déchiffre jamais le numéro pour construire le masque", async () => {
    setup(doc("blob-chiffre-quelconque"));
    await getProche("m1");
    expect(espionDechiffrer).not.toHaveBeenCalled();
  });

  it("masque un numéro dont le blob est illisible, au lieu de nier son existence", async () => {
    // Clé changée ou blob corrompu : le numéro EXISTE, il est seulement
    // indéchiffrable. Rendre "" prétendrait qu'il n'y a pas de numéro — et
    // `revelerNumero` répond déjà « Vérification impossible » dans ce cas.
    setup(doc("pas-un-blob-dechiffrable"));
    const res = await getProche("m1");
    expect(res?.documents[0]!.doc_number_masque).toBe("••••");
  });

  it("ne rend aucun masque quand le document n'a pas de numéro", async () => {
    setup(doc(null));
    const res = await getProche("m1");
    expect(res?.documents[0]!.doc_number_masque).toBe("");
  });
});
