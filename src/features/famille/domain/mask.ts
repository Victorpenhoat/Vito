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
 * Ne reçoit QUE la présence d'un numéro — jamais la valeur, ni en clair ni
 * chiffrée. L'invariant « le masque ne peut rien emprunter à ce qu'il
 * remplace » cesse ainsi d'être une promesse tenue par la fonction : il est
 * tenu par sa signature, et la requête de page n'a plus à lire la colonne
 * chiffrée du tout (colonne générée `doc_number_present`, migration 00068).
 *
 * Rend la chaîne vide quand il n'y a pas de numéro — quatre points diraient
 * qu'un numéro existe.
 */
export function maskDocNumber(numeroPresent: boolean | null): string {
  return numeroPresent ? MASQUE : "";
}
