// Séjour à venir, lu depuis une RÉSERVATION de voyage (design Hôtels v2,
// écran 6 : « 12 → 15 octobre 2026 · à venir »).
//
// Décision : une réservation ne crée AUCUNE visite. Un séjour est ce qu'on a
// vécu, avec sa note ; une réservation est une intention, et elle s'annule. La
// fiche affiche donc l'à-venir en lisant la réservation, et propose la bascule
// une fois le séjour passé — proposée, jamais silencieuse.

export type ReservationHebergement = {
  id: string;
  voyageId: string;
  voyageTitre: string | null;
  /** « YYYY-MM-DD » ou null : une réservation peut n'avoir aucune date. */
  dateDebut: string | null;
  dateFin: string | null;
};

/** Un séjour déjà enregistré sur cet hébergement (table visites). */
export type SejourEnregistre = { visite_le: string; date_fin: string | null };

export type EtatReservation = "a_venir" | "en_cours" | "passee" | "sans_dates";

/** Dernier jour couvert : le départ, ou l'arrivée pour une réservation d'un jour. */
function finDe(r: { dateDebut: string | null; dateFin: string | null }): string | null {
  return r.dateFin ?? r.dateDebut;
}

export function etatReservation(r: ReservationHebergement, aujourdhui: string): EtatReservation {
  const fin = finDe(r);
  if (!r.dateDebut || !fin) return "sans_dates";
  if (r.dateDebut > aujourdhui) return "a_venir";
  // Le jour du départ, on y est encore : c'est en cours, pas passé.
  if (fin >= aujourdhui) return "en_cours";
  return "passee";
}

/**
 * Un séjour couvrant déjà ces dates a-t-il été saisi ? On raisonne par
 * CHEVAUCHEMENT et non par égalité : les dates saisies à la main dérivent d'un
 * jour (arrivée la veille, départ décalé) sans décrire un autre séjour.
 */
export function sejourDejaEnregistre(r: ReservationHebergement, sejours: SejourEnregistre[]): boolean {
  const debut = r.dateDebut;
  const fin = finDe(r);
  if (!debut || !fin) return false;
  return sejours.some((s) => {
    const sFin = s.date_fin ?? s.visite_le;
    return s.visite_le <= fin && sFin >= debut;
  });
}

/**
 * Faut-il proposer « Vous avez séjourné ici ? ». Seulement une fois le séjour
 * terminé, et seulement s'il n'a pas déjà été enregistré.
 */
export function basculeProposee(
  r: ReservationHebergement,
  sejours: SejourEnregistre[],
  aujourdhui: string,
): boolean {
  return etatReservation(r, aujourdhui) === "passee" && !sejourDejaEnregistre(r, sejours);
}
