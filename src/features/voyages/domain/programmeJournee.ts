import type { Etape } from "./programme";

// Programme jour par jour (maquette « Programme » et « Web — Planning voyage »).
//
// Deux idées de la maquette commandent ce module :
//   • les étapes sont TYPÉES (trajet, restaurant, activité, note) et peuvent
//     porter un moment plutôt qu'une heure (« Soir · gelato puis balade ») ;
//   • « les réservations liées apparaissent automatiquement » — un vol ou un
//     hôtel déjà saisi n'a pas à être ressaisi dans le programme. Il y figure,
//     en lecture, à sa date.

export type EtapeProgramme = Etape & { categorie: string | null; moment: string | null };

export type ReservationProgramme = {
  id: string;
  type: string;
  libelle: string;
  dateDebut: string | null;
  dateFin: string | null;
  /** « HH:MM » si le détail de la réservation en porte une. */
  heure: string | null;
  /** Résumé d'une ligne (« CDG → FCO »), déjà calculé par le domaine des détails. */
  resume: string | null;
};

export type ElementProgramme = {
  cle: string;
  source: "etape" | "reservation";
  heure: string | null;
  moment: string | null;
  etape?: EtapeProgramme;
  reservation?: ReservationProgramme;
};

/** Ordre des moments dans une journée — pas l'ordre alphabétique. */
const MOMENTS = ["matin", "midi", "apres_midi", "soir"] as const;
const rangMoment = (m: string | null) => {
  const i = MOMENTS.indexOf((m ?? "") as (typeof MOMENTS)[number]);
  return i === -1 ? MOMENTS.length : i;
};

const couvre = (r: ReservationProgramme, jour: string) =>
  r.dateDebut != null && r.dateDebut <= jour && (r.dateFin ?? r.dateDebut) >= jour;

/**
 * Ce qu'il y a à faire ce jour-là : les étapes saisies ET les réservations qui
 * couvrent la date. Une réservation d'hôtel court sur plusieurs jours et
 * apparaît donc chacun d'eux — c'est bien le cas : on y dort chaque nuit.
 */
export function elementsDuJour(
  jour: string,
  etapes: EtapeProgramme[],
  reservations: ReservationProgramme[],
): ElementProgramme[] {
  const desEtapes: ElementProgramme[] = etapes
    .filter((e) => e.jour === jour)
    .map((e) => ({ cle: `etape-${e.id}`, source: "etape", heure: e.heure, moment: e.moment, etape: e }));

  const desResas: ElementProgramme[] = reservations
    .filter((r) => couvre(r, jour))
    .map((r) => ({ cle: `resa-${r.id}`, source: "reservation", heure: r.heure, moment: null, reservation: r }));

  return [...desResas, ...desEtapes].sort((a, b) => {
    // Ce qui a une heure passe devant ; le reste s'ordonne par moment de journée.
    if (a.heure && b.heure) return a.heure.localeCompare(b.heure);
    if (a.heure) return -1;
    if (b.heure) return 1;
    return rangMoment(a.moment) - rangMoment(b.moment);
  });
}

export type ResumeJour = { cle: "arrivee" | "retour" | "libre" | "etapes"; n?: number };

/**
 * Le résumé sous l'onglet du jour : « arrivée », « retour », « 3 étapes » ou
 * « libre ». L'arrivée l'emporte sur le compte — c'est ce que dit la maquette,
 * et c'est ce qu'on retient d'un premier jour.
 */
export function resumeJour(
  jour: string,
  joursDuVoyage: string[],
  etapes: EtapeProgramme[],
  reservations: ReservationProgramme[],
): ResumeJour {
  if (jour === joursDuVoyage[0]) return { cle: "arrivee" };
  if (joursDuVoyage.length > 1 && jour === joursDuVoyage.at(-1)) return { cle: "retour" };
  const n = elementsDuJour(jour, etapes, reservations).length;
  return n === 0 ? { cle: "libre" } : { cle: "etapes", n };
}
