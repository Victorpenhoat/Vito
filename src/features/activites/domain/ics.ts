import { jourIso, type Creneau } from "./activite";

// Export iCalendar d'une activité (« Ajouter au calendrier » du design).
//
// Les heures sont FLOTTANTES — sans fuseau ni « Z ». Un cours du samedi 10h est
// à 10h là où il a lieu ; l'ancrer en UTC le ferait glisser d'une heure au
// changement d'heure, deux fois par an, sur toute la saison.

const JOURS_ICS = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];

/** « 2026-09-12 » + « 10:00 » → « 20260912T100000 ». */
function horodatage(date: string, heure: string): string {
  return `${date.replace(/-/g, "")}T${heure.replace(":", "")}00`;
}

/**
 * La première occurrence d'un créneau à partir d'une date : c'est le DTSTART.
 * Une règle de répétition part forcément d'un jour où la règle s'applique.
 */
export function premiereOccurrence(creneau: Creneau, depuis: string): string {
  const debut = creneau.valideDu && creneau.valideDu > depuis ? creneau.valideDu : depuis;
  const t0 = Date.parse(`${debut}T00:00:00Z`);
  for (let d = 0; d < 7; d++) {
    const jour = new Date(t0 + d * 86_400_000).toISOString().slice(0, 10);
    if (jourIso(jour) === creneau.jourSemaine) return jour;
  }
  return debut;
}

/** Les sauts de ligne et les virgules ont un sens en iCalendar : on les échappe. */
function echapper(texte: string): string {
  return texte.replace(/\\/g, "\\\\").replace(/[,;]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
}

export type ActiviteIcs = {
  id: string;
  nom: string;
  clubNom: string | null;
  adresse: string | null;
  saisonDebut: string | null;
  saisonFin: string | null;
  creneaux: (Creneau & { lieuPrecision?: string | null; intervenant?: string | null })[];
};

/**
 * Un VEVENT par créneau, répété chaque semaine jusqu'à la fin de la saison.
 *
 * Sans fin de saison, l'événement se répète sans borne : c'est ce que fait un
 * cours qui n'a pas annoncé sa dernière séance, et c'est plus honnête que de
 * choisir une date à sa place.
 */
export function versIcs(activite: ActiviteIcs, aujourdhui: string): string {
  const lignes = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Vito//Activites//FR",
    "CALSCALE:GREGORIAN",
  ];

  for (const c of activite.creneaux) {
    const depart = premiereOccurrence(c, activite.saisonDebut ?? aujourdhui);
    const lieu = [activite.clubNom, c.lieuPrecision, activite.adresse].filter(Boolean).join(", ");
    const fin = c.valideAu ?? activite.saisonFin;
    lignes.push(
      "BEGIN:VEVENT",
      // Stable : réimporter le fichier met à jour l'événement au lieu d'en
      // créer un second.
      `UID:${c.id}@vito`,
      `DTSTAMP:${horodatage(aujourdhui, "00:00")}Z`,
      `DTSTART:${horodatage(depart, c.heureDebut)}`,
      `DTEND:${horodatage(depart, c.heureFin)}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${JOURS_ICS[c.jourSemaine - 1]}${fin ? `;UNTIL=${horodatage(fin, "23:59")}` : ""}`,
      `SUMMARY:${echapper(activite.nom)}`,
      ...(lieu ? [`LOCATION:${echapper(lieu)}`] : []),
      ...(c.intervenant ? [`DESCRIPTION:${echapper(c.intervenant)}`] : []),
      "END:VEVENT",
    );
  }

  lignes.push("END:VCALENDAR");
  // CRLF : la norme iCalendar l'exige, et certains agendas refusent le reste.
  return lignes.join("\r\n") + "\r\n";
}
