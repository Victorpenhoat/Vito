import { decryptDocument, encryptDocument } from "./documents";
import { getDocumentKey } from "./documentKey";

// Chiffrement d'un champ texte court (numéro de document…) — même primitive et
// même clé que les scans, seul le format d'entrée change. Le résultat est du
// base64, stockable en colonne texte.

export function chiffrerChamp(clair: string): string {
  return encryptDocument(Buffer.from(clair, "utf8"), getDocumentKey()).toString("base64");
}

/** Déchiffre un champ ; null si absent ou si le blob est corrompu / clé changée. */
export function dechiffrerChamp(chiffre: string | null): string | null {
  if (!chiffre) return null;
  try {
    return decryptDocument(Buffer.from(chiffre, "base64"), getDocumentKey()).toString("utf8");
  } catch {
    return null;
  }
}
