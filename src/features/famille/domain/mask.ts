import { MASQUE } from "@/lib/securite/masque";

/**
 * Le masque d'un numéro de pièce d'identité, tel qu'il part dans la page.
 *
 * Toujours QUATRE points, quelle que soit la longueur réelle, et sans jamais
 * laisser filtrer un caractère : un masque qui suit la longueur annonce
 * combien de caractères chercher, et trois caractères en clair réduisent
 * d'autant ce qu'il reste à deviner. Règle commune à toutes les données
 * protégées (docs/security.md §2).
 *
 * Prend la valeur **telle qu'elle est stockée — chiffrée** : seule sa présence
 * compte, le masque ne dérive jamais du contenu. C'est ce qui permet à la
 * requête de page de ne pas déchiffrer du tout.
 *
 * Rend la chaîne vide quand il n'y a pas de numéro — quatre points diraient
 * qu'un numéro existe.
 */
export function maskDocNumber(valeurStockee: string | null): string {
  return valeurStockee ? MASQUE : "";
}
