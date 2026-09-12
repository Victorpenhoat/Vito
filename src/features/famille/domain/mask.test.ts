import { describe, expect, it } from "vitest";
import { maskDocNumber } from "./mask";

// Le masque est calculé SERVEUR : c'est la seule forme qui parvient au
// navigateur tant que l'identité n'a pas été vérifiée (lot O-D).
//
// Depuis la migration 00068, la fonction ne reçoit plus la valeur du tout,
// seulement sa présence : « le masque ne laisse filtrer aucun caractère et
// n'annonce pas la longueur » n'est donc plus une propriété à éprouver ici,
// c'est la signature qui l'impose. Ce qui reste à tenir, et que ces deux cas
// verrouillent, c'est qu'un masque ne s'affiche QUE là où il y a quelque chose
// à masquer. L'invariant « la page ne demande pas la colonne chiffrée », lui,
// est éprouvé dans `data/queries.test.ts`, au seul endroit où il peut l'être.
describe("maskDocNumber", () => {
  it("montre quatre points quand un numéro existe", () => {
    expect(maskDocNumber(true)).toBe("••••");
  });

  it("ne montre rien quand il n'y en a pas", () => {
    // Quatre points sur un document sans numéro annonceraient un secret absent.
    expect(maskDocNumber(false)).toBe("");
    expect(maskDocNumber(null)).toBe("");
  });
});
