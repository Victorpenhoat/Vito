import { chevauche, type Periode } from "./planning";

// Planning calendaire (maquette « Planning Mois » et « Web — Planning global »).
//
// La maquette montre un vrai calendrier : une grille de semaines commençant le
// lundi, les jours voisins visibles en grisé (28 29 30 1 2 3 4), les voyages
// inscrits sous la semaine qu'ils traversent, et un panneau d'année scolaire qui
// dit, pour chaque période de vacances, ce qui est prévu — ou qu'elle est libre.
//
// Tout est en UTC et en jours pleins : un fuseau ne doit pas décaler une case.

export type JourGrille = {
  /** « YYYY-MM-DD ». */
  jour: string;
  numero: number;
  /** Jour d'un mois voisin, affiché en grisé et non cliquable. */
  horsMois: boolean;
};

export type VoyagePlanning = {
  id: string;
  titre: string;
  debut: string | null;
  fin: string | null;
  statut: string;
};

const JOUR_MS = 86_400_000;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

/**
 * La grille d'un mois : des semaines de sept jours, lundi d'abord, jours
 * voisins compris. Contrairement à la grille du sélecteur de dates (qui laisse
 * les bords vides pour ne pas inviter à les cliquer), un calendrier de planning
 * les MONTRE : c'est ce qui permet de voir qu'un voyage déborde sur le mois
 * suivant.
 */
export function grilleDuMois(annee: number, mois: number): JourGrille[][] {
  const premier = Date.UTC(annee, mois - 1, 1);
  const nbJours = new Date(Date.UTC(annee, mois, 0)).getUTCDate();
  // getUTCDay : 0 = dimanche ; décalage pour une semaine qui commence lundi.
  const decalage = (new Date(premier).getUTCDay() + 6) % 7;
  const debut = premier - decalage * JOUR_MS;

  // Assez de semaines pour couvrir le mois entier, jamais une de trop.
  const nbSemaines = Math.ceil((decalage + nbJours) / 7);

  return Array.from({ length: nbSemaines }, (_, s) =>
    Array.from({ length: 7 }, (_, j) => {
      const t = debut + (s * 7 + j) * JOUR_MS;
      const d = new Date(t);
      return {
        jour: iso(t),
        numero: d.getUTCDate(),
        horsMois: d.getUTCMonth() + 1 !== mois || d.getUTCFullYear() !== annee,
      };
    }),
  );
}

/** Les voyages qui traversent cette semaine — un voyage sans dates n'en est pas. */
export function voyagesDeLaSemaine(semaine: JourGrille[], voyages: VoyagePlanning[]): VoyagePlanning[] {
  const debut = semaine[0]?.jour;
  const fin = semaine.at(-1)?.jour;
  if (!debut || !fin) return [];
  return voyages.filter((v) =>
    v.debut != null && chevauche({ debut: v.debut, fin: v.fin ?? v.debut }, { debut, fin }),
  );
}

/**
 * Le panneau d'année scolaire : chaque période de vacances avec ce qui y est
 * prévu. Une période sans voyage est une période LIBRE — c'est elle que la
 * maquette propose de transformer en idée.
 */
export function periodesEtLeursVoyages(
  periodes: Periode[],
  voyages: VoyagePlanning[],
): { periode: Periode; voyages: VoyagePlanning[] }[] {
  return periodes.map((periode) => ({
    periode,
    voyages: voyages.filter((v) =>
      v.debut != null && chevauche({ debut: v.debut, fin: v.fin ?? v.debut }, periode),
    ),
  }));
}

/** Mois précédent ou suivant, l'année suit toute seule. */
export function moisVoisin(annee: number, mois: number, pas: number): { annee: number; mois: number } {
  const d = new Date(Date.UTC(annee, mois - 1 + pas, 1));
  return { annee: d.getUTCFullYear(), mois: d.getUTCMonth() + 1 };
}
