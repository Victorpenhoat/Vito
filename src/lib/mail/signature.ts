import { createHmac, timingSafeEqual } from "node:crypto";

// Vérification de la signature Svix (le transport de webhooks qu'utilise
// Resend), à la main : `node:crypto` suffit, et une dépendance de plus est une
// dépendance à auditer.
//
// La signature couvre `<id>.<horodatage>.<corps>` : sans l'id et l'horodatage,
// une requête interceptée se rejouerait telle quelle.
const FENETRE_SECONDES = 300;

export function signatureValide(
  secret: string,
  id: string,
  horodatage: string,
  corps: string,
  entete: string,
): boolean {
  const ts = Number(horodatage);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - ts) > FENETRE_SECONDES) return false;

  const brut = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const attendue = createHmac("sha256", brut).update(`${id}.${horodatage}.${corps}`).digest();

  // L'en-tête peut porter plusieurs signatures séparées par des espaces (rotation
  // de secret) : il suffit qu'une corresponde.
  return entete.split(" ").some((part) => {
    const [version, valeur] = part.split(",");
    if (version !== "v1" || !valeur) return false;
    const fournie = Buffer.from(valeur, "base64");
    return fournie.length === attendue.length && timingSafeEqual(fournie, attendue);
  });
}
