/**
 * Le masque des données protégées — codes d'accès, numéros de pièce d'identité.
 *
 * Toujours QUATRE points, quelle que soit la longueur réelle : un masque qui
 * suit la longueur annonce combien de caractères chercher. C'est peu, mais
 * c'est gratuit à ne pas donner. Règle posée par docs/security.md §2.
 *
 * Une seule définition pour toute l'application : deux masques indépendants
 * dérivent, et c'est précisément ce qui était arrivé — le Cercle laissait voir
 * les trois derniers caractères pendant que les Activités tenaient la règle.
 */
export const MASQUE = "••••";
