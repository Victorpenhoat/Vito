import { computeParts, computeBalances, simplifyDebts } from "@/features/depenses/domain/calculations";

// Dépenses du voyage (Lot D) : le partage entre VOYAGEURS, y compris ceux qui
// n'ont pas de compte. L'onglet Dépenses global, lui, partage entre comptes et
// reste inchangé — les deux coexistent.
//
// Le calcul lui-même n'est pas réécrit : `computeParts`, `computeBalances` et
// `simplifyDebts` traitent des identifiants OPAQUES. Leur champ s'appelle
// `profileId` pour des raisons historiques, mais rien n'y présume un compte —
// on leur passe donc des ids de participants. Ce module est ce point de
// raccordement, et la seule place où cette équivalence est écrite.

export type PartVoyage = { participantId: string; partCents: number };
export type DepenseVoyage = {
  id: string;
  payePar: string;
  montantCents: number;
  parts: PartVoyage[];
};
export type RemboursementVoyage = {
  deParticipantId: string;
  versParticipantId: string;
  montantCents: number;
};
export type SoldeVoyage = { participantId: string; soldeCents: number };

/** Parts égales, au centime près : le reste de la division se distribue. */
export function partsEgales(montantCents: number, participantIds: string[]): PartVoyage[] {
  if (participantIds.length === 0) return [];
  return computeParts(montantCents, "egal", participantIds)
    .map((p) => ({ participantId: p.profileId, partCents: p.partCents }));
}

/** Parts saisies une par une (mode exact) — la somme doit faire le total. */
export function partsExactes(montantCents: number, exactsCents: Record<string, number>): PartVoyage[] {
  const ids = Object.keys(exactsCents);
  return computeParts(montantCents, "exact", ids, exactsCents)
    .map((p) => ({ participantId: p.profileId, partCents: p.partCents }));
}

/**
 * Solde de chaque voyageur : positif, on lui doit ; négatif, il doit. Un
 * voyageur qui n'a ni payé ni consommé apparaît à zéro plutôt que de manquer.
 */
export function soldesParticipants(
  participantIds: string[],
  depenses: DepenseVoyage[],
  remboursements: RemboursementVoyage[],
): SoldeVoyage[] {
  return computeBalances(
    participantIds,
    depenses.map((d) => ({
      payePar: d.payePar,
      parts: d.parts.map((p) => ({ profileId: p.participantId, partCents: p.partCents })),
    })),
    remboursements.map((r) => ({
      deProfileId: r.deParticipantId,
      versProfileId: r.versParticipantId,
      montantCents: r.montantCents,
    })),
  ).map((b) => ({ participantId: b.profileId, soldeCents: b.soldeCents }));
}

/** « Qui doit quoi à qui », en aussi peu de virements que possible. */
export function transfertsSimplifies(soldes: SoldeVoyage[]): RemboursementVoyage[] {
  return simplifyDebts(soldes.map((s) => ({ profileId: s.participantId, soldeCents: s.soldeCents })))
    .map((t) => ({
      deParticipantId: t.deProfileId,
      versParticipantId: t.versProfileId,
      montantCents: t.montantCents,
    }));
}

/** Ce que le voyage a coûté, tous payeurs confondus. */
export function totalDepenses(depenses: DepenseVoyage[]): number {
  return depenses.reduce((s, d) => s + d.montantCents, 0);
}
