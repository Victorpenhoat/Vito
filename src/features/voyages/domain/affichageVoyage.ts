// Affichage de la liste Voyages (design Onglet_Voyages, écran 1) :
// mapping statut+dates → chip de la liste, compte à rebours, nombre de nuits.
// « today » est un jour calendaire "YYYY-MM-DD" (comparaison lexicographique).

export type VoyageChip = "a_venir" | "en_cours" | "en_preparation" | "idees" | "termines";
export const VOYAGE_CHIPS: readonly VoyageChip[] = ["a_venir", "en_cours", "en_preparation", "idees", "termines"];

// « En cours » est DÉRIVÉ des dates pour un voyage confirmé (pas d'écriture en base).
// Un voyage en préparation/idée n'est jamais basculé « Terminé » par ses dates :
// des dates envisagées passées signifient « à re-planifier », pas « archivé ».
export function voyageChip(statut: string, dateDebut: string | null, dateFin: string | null, today: string): VoyageChip {
  if (statut === "idee") return "idees";
  if (statut === "termine") return "termines";
  if (statut === "en_preparation" || statut === "planifie") return "en_preparation";
  if (dateFin && dateFin < today) return "termines";
  if (statut === "en_cours") return "en_cours";
  if (dateDebut && dateDebut <= today && (!dateFin || dateFin >= today)) return "en_cours";
  return "a_venir";
}

const DAY_MS = 86_400_000;

// « Dans N jours » — null si pas de date ou déjà parti.
export function joursAvant(dateDebut: string | null, today: string): number | null {
  if (!dateDebut || dateDebut <= today) return null;
  const n = Math.round((Date.parse(dateDebut) - Date.parse(today)) / DAY_MS);
  return n > 0 ? n : null;
}

// « 3 nuits » — null si dates incomplètes ou incohérentes.
export function nuits(dateDebut: string | null, dateFin: string | null): number | null {
  if (!dateDebut || !dateFin) return null;
  const n = Math.round((Date.parse(dateFin) - Date.parse(dateDebut)) / DAY_MS);
  return n > 0 ? n : null;
}
