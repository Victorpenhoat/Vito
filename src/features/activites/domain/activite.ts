// Activités régulières de la famille (design docs/design/Onglet_Activites.dc.html).
//
// Tout ce qui se calcule est ici, en fonctions pures : la prochaine occurrence
// d'un créneau et le décompte d'une formule. Ni l'une ni l'autre n'est stockée
// en base — un compteur se désynchronise, une prochaine date se périme.

export const TYPES_ACTIVITE = [
  "equitation", "danse", "football", "musique", "tennis", "natation", "theatre",
  "soutien_scolaire", "autre",
] as const;

export const STATUTS_ACTIVITE = ["en_cours", "en_pause", "terminee"] as const;

/** Créneau récurrent : 1 = lundi … 7 = dimanche (ISO), heures « HH:MM ». */
export type Creneau = {
  id: string;
  jourSemaine: number;
  heureDebut: string;
  heureFin: string;
  /** Bornes de validité du créneau — un cours peut ne durer qu'un trimestre. */
  valideDu?: string | null;
  valideAu?: string | null;
};

export type Occurrence = { date: string; heureDebut: string; creneauId: string };

const JOUR_MS = 86_400_000;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
/** Jour ISO d'une date « YYYY-MM-DD » : 1 = lundi … 7 = dimanche. */
export function jourIso(date: string): number {
  return ((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7) + 1;
}

/**
 * La prochaine séance à partir d'aujourd'hui — c'est le « demain 10h00 » de la
 * liste, et la seule information qu'on vient chercher en ouvrant l'onglet.
 *
 * Aujourd'hui compte s'il reste du temps avant le début du cours : un créneau
 * de 10h vu à 9h est bien la prochaine occurrence, pas celle de la semaine
 * suivante. Passée l'heure, on regarde plus loin.
 */
export function prochaineOccurrence(
  creneaux: Creneau[],
  aujourdhui: string,
  heureActuelle = "00:00",
): Occurrence | null {
  const depart = Date.parse(`${aujourdhui}T00:00:00Z`);
  let meilleure: Occurrence | null = null;

  for (const c of creneaux) {
    // HUIT jours, pas sept : si le cours d'aujourd'hui est déjà passé, il faut
    // pouvoir retomber sur le même jour la semaine suivante. Une fenêtre de
    // sept jours l'aurait manqué et rendu « aucune séance à venir ».
    for (let d = 0; d <= 7; d++) {
      const jour = iso(depart + d * JOUR_MS);
      if (jourIso(jour) !== c.jourSemaine) continue;
      if (d === 0 && c.heureDebut <= heureActuelle) continue;
      if (c.valideDu && jour < c.valideDu) continue;
      if (c.valideAu && jour > c.valideAu) continue;
      const candidate = { date: jour, heureDebut: c.heureDebut, creneauId: c.id };
      if (
        !meilleure ||
        candidate.date < meilleure.date ||
        (candidate.date === meilleure.date && candidate.heureDebut < meilleure.heureDebut)
      ) {
        meilleure = candidate;
      }
      break;
    }
  }
  return meilleure;
}

/**
 * « 7 séances restantes » d'une formule à la carte. `null` pour un abonnement
 * illimité : il n'y a alors rien à décompter, et afficher zéro serait faux.
 *
 * Une séance manquée est consommée — c'est ce qui rend le décompte utile.
 */
export function seancesRestantes(
  formuleSeances: number | null | undefined,
  seancesConsommees: number,
): number | null {
  if (formuleSeances == null) return null;
  return Math.max(0, formuleSeances - seancesConsommees);
}
