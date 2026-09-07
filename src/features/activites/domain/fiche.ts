// Ce que la fiche d'une activité calcule : la présence et l'argent.
//
// Aucun des deux n'est stocké. Un compteur de séances se désynchronise dès
// qu'on corrige une présence, et un paiement « en retard » stocké devient faux
// tout seul le lendemain de son échéance.

export type Seance = { date: string; statut: "faite" | "manquee" };

export type ResumePresence = {
  faites: number;
  manquees: number;
  consommees: number;
  /** null pour un abonnement illimité : il n'y a rien à décompter. */
  restantes: number | null;
  formule: number | null;
};

/**
 * « Formule 20 séances · 13 / 20 · ✓ 12 faites · ✗ 1 manquée · 7 restantes ».
 *
 * Une séance manquée est CONSOMMÉE : c'est ce qui rend le décompte utile, et ce
 * qui distingue un carnet de séances d'un simple journal de présence.
 */
export function resumePresence(seances: Seance[], formule: number | null | undefined): ResumePresence {
  const faites = seances.filter((s) => s.statut === "faite").length;
  const manquees = seances.filter((s) => s.statut === "manquee").length;
  const consommees = faites + manquees;
  return {
    faites,
    manquees,
    consommees,
    formule: formule ?? null,
    restantes: formule == null ? null : Math.max(0, formule - consommees),
  };
}

export type Paiement = {
  id: string;
  montantCents: number;
  echeance: string | null;
  statut: "du" | "paye";
};
export type EtatEcheance = "paye" | "en_retard" | "a_venir";

/**
 * L'état d'une échéance se DÉDUIT de la date. Le stocker le rendrait faux le
 * lendemain : rien ne repasse dans la base pour vieillir une ligne.
 *
 * Une échéance due sans date n'est pas en retard — on ne peut pas être en
 * retard sur une date qu'on n'a pas fixée.
 */
export function etatEcheance(paiement: Paiement, aujourdhui: string): EtatEcheance {
  if (paiement.statut === "paye") return "paye";
  if (paiement.echeance && paiement.echeance < aujourdhui) return "en_retard";
  return "a_venir";
}

/** « Réglé cette saison » : ce qui est effectivement payé, pas ce qui est dû. */
export function totalRegle(paiements: Paiement[]): number {
  return paiements.filter((p) => p.statut === "paye").reduce((s, p) => s + p.montantCents, 0);
}

/** Ce qui reste à payer, dates dépassées comprises. */
export function totalDu(paiements: Paiement[]): number {
  return paiements.filter((p) => p.statut === "du").reduce((s, p) => s + p.montantCents, 0);
}

/**
 * Les échéances dans l'ordre où elles comptent : le retard d'abord, puis ce qui
 * vient, puis ce qui est réglé. C'est l'ordre de la maquette, et c'est aussi
 * celui de l'urgence.
 */
export function ordonnerEcheances<T extends Paiement>(paiements: T[], aujourdhui: string): T[] {
  const rang: Record<EtatEcheance, number> = { en_retard: 0, a_venir: 1, paye: 2 };
  return [...paiements].sort((a, b) => {
    const dr = rang[etatEcheance(a, aujourdhui)] - rang[etatEcheance(b, aujourdhui)];
    if (dr !== 0) return dr;
    // À état égal, la date la plus proche d'abord ; sans date, à la fin.
    if (!a.echeance) return 1;
    if (!b.echeance) return -1;
    return a.echeance.localeCompare(b.echeance);
  });
}
