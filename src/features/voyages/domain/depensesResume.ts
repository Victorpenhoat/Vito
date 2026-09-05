import type { DepenseVoyage } from "./depensesVoyage";

// Ce que la maquette met en tête de l'écran Dépenses : le total du voyage, MA
// part, et MON solde. Le total dit ce que le voyage coûte ; les deux autres
// disent ce qu'il me coûte, à moi — c'est ce qu'on vient chercher en premier.

/**
 * Qui suis-je parmi les voyageurs ? Le lien passe par le compte : un voyageur
 * sans compte (un enfant) n'est jamais « moi », et si je ne me suis pas ajouté
 * au voyage, il n'y a simplement pas de « ma part » à afficher.
 */
export function participantMoi<T extends { id: string; profileId: string | null }>(
  participants: T[],
  monProfileId: string | null,
): T | null {
  if (!monProfileId) return null;
  return participants.find((p) => p.profileId === monProfileId) ?? null;
}

/** Somme de mes parts sur l'ensemble des dépenses. */
export function maPart(depenses: DepenseVoyage[], participantId: string | null): number {
  if (!participantId) return 0;
  return depenses.reduce(
    (s, d) => s + d.parts.filter((p) => p.participantId === participantId).reduce((x, p) => x + p.partCents, 0),
    0,
  );
}

/**
 * Qui partage cette dépense. « Pour tous » se dit d'un coup d'œil ; sinon on
 * compte. Une part à ZÉRO reste une part : la personne est concernée même si
 * elle ne doit rien.
 */
export function porteeDepense(depense: DepenseVoyage, nbParticipants: number): { tous: boolean; nb: number } {
  const nb = depense.parts.length;
  return { tous: nb > 0 && nb >= nbParticipants, nb };
}

/** « 21,63 € par personne » — l'aide à la saisie de la maquette. */
export function parPersonne(montantCents: number, nbPersonnes: number): number | null {
  if (nbPersonnes <= 0) return null;
  return Math.round(montantCents / nbPersonnes);
}
