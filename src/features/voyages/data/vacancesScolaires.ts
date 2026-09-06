import type { Periode } from "../domain/planning";

// Vacances scolaires — ZONE C (Paris, Créteil, Versailles, Montpellier, Toulouse).
//
// Ce sont des dates OFFICIELLES : les inventer serait pire que ne rien
// afficher, puisqu'on planifie des voyages dessus. Celles-ci ont été
// confirmées par le PO le 2026-09-06, d'après le calendrier du ministère.
//
// Bornes du ministère, telles que la maquette les affiche : le premier jour est
// le dernier jour de classe, le dernier est le jour de la rentrée. Une période
// s'étend donc d'un bout à l'autre, jours inclus — c'est ainsi qu'on lit
// « Toussaint · 17 oct → 2 nov ».
//
// ⚠ À REVOIR À CHAQUE RENTRÉE : cette liste ne couvre que l'année scolaire
// 2026-2027. Passé l'été 2027, l'écran n'aura plus rien à proposer et le dira —
// mieux vaut ce silence qu'un calendrier périmé présenté comme vrai.
// Source : education.gouv.fr/calendrier-scolaire (jeu de données ouvert :
// data.education.gouv.fr).

/** Zone annoncée à l'écran (badge « Vacances · Zone C » de la maquette). */
export const ZONE_SCOLAIRE = "C";

export const VACANCES_ZONE_C: Periode[] = [
  { id: "toussaint-2026", libelle: "Toussaint", debut: "2026-10-17", fin: "2026-11-02" },
  { id: "noel-2026", libelle: "Noël", debut: "2026-12-19", fin: "2027-01-04" },
  { id: "hiver-2027", libelle: "Hiver", debut: "2027-02-06", fin: "2027-02-22" },
  { id: "printemps-2027", libelle: "Printemps", debut: "2027-04-03", fin: "2027-04-19" },
  // Fin des cours confirmée par le PO ; la rentrée de septembre ne l'est pas.
  // La période s'arrête donc au 31 août, faute de mieux : un jour de vacances
  // manquant se rattrape, un jour de classe annoncé comme vacances envoie
  // planifier un départ un lundi de rentrée.
  { id: "ete-2027", libelle: "Grandes vacances", debut: "2027-07-06", fin: "2027-08-31" },
];
