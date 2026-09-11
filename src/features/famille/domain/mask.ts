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
 * Rend la chaîne vide quand il n'y a pas de numéro — quatre points diraient
 * qu'un numéro existe.
 */
export function maskDocNumber(num: string | null): string {
  return num ? MASQUE : "";
}
