import type { Periode } from "../domain/planning";

// Vacances scolaires — ZONE C (Paris, Créteil, Versailles, Montpellier, Toulouse).
//
// ⚠ VIDE À DESSEIN. Ce sont des dates OFFICIELLES : les inventer serait pire
// que ne rien afficher, puisqu'on planifie des voyages dessus. À remplir depuis
// le calendrier scolaire du ministère (education.gouv.fr/calendrier-scolaire,
// ou le jeu de données ouvert data.education.gouv.fr), et à revoir à chaque
// rentrée. Tant que cette liste est vide, la frise le dit à l'écran au lieu de
// laisser croire qu'il n'y a pas de vacances.
//
// Format : identifiant stable, libellé affiché, premier et dernier jour de
// vacances (dates ISO INCLUSES).
//
// Exemple de ligne, à remplacer par le calendrier réel :
//   { id: "toussaint-2026", libelle: "Toussaint", debut: "2026-10-17", fin: "2026-11-02" },
export const VACANCES_ZONE_C: Periode[] = [];
