import { jourIso, type Creneau } from "./activite";
import { chevauche, type Periode } from "@/features/voyages/domain/planning";

// La vue « Cette semaine » : ce qui a lieu, ce qui tombe pendant les vacances,
// ce qu'un voyage fait manquer, et les trajets qui se télescopent.
//
// C'est l'écran du quotidien : il doit dire d'un coup d'œil où il faut être, et
// surtout où il faut être DEUX FOIS en même temps.

const JOUR_MS = 86_400_000;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

/** Les sept jours de la semaine contenant cette date, lundi d'abord. */
export function joursDeLaSemaine(date: string): string[] {
  const t = Date.parse(`${date}T00:00:00Z`);
  const lundi = t - (jourIso(date) - 1) * JOUR_MS;
  return Array.from({ length: 7 }, (_, i) => iso(lundi + i * JOUR_MS));
}

/** Semaine précédente ou suivante, en gardant le lundi comme repère. */
export function semaineVoisine(date: string, pas: number): string {
  return iso(Date.parse(`${date}T00:00:00Z`) + pas * 7 * JOUR_MS);
}

export type Exception = { creneauId: string; date: string; type: "annulation" | "ponctuelle"; heureDebut?: string | null; heureFin?: string | null };

export type ActiviteSemaine = {
  id: string;
  nom: string;
  clubNom: string | null;
  statut: string;
  membres: { id: string; prenom: string; couleur: string | null }[];
  creneaux: (Creneau & {
    lieuPrecision?: string | null;
    deposePar?: { id: string; prenom: string } | null;
    covoiturage?: boolean | null;
  })[];
};

export type Occurrence = {
  activiteId: string;
  activiteNom: string;
  clubNom: string | null;
  creneauId: string;
  date: string;
  heureDebut: string;
  heureFin: string;
  membres: { id: string; prenom: string; couleur: string | null }[];
  deposePar: { id: string; prenom: string } | null;
  covoiturage: boolean;
  lieuPrecision: string | null;
};

/**
 * Ce qui a lieu ce jour-là.
 *
 * Une activité EN PAUSE ou TERMINÉE n'a plus de séance : elle reste au carnet,
 * mais elle ne remplit plus la semaine.
 *
 * Les exceptions priment sur le créneau récurrent : une annulation retire la
 * séance, une séance ponctuelle en ajoute une là où il n'y en avait pas.
 */
export function occurrencesDuJour(
  activites: ActiviteSemaine[],
  jour: string,
  exceptions: Exception[] = [],
): Occurrence[] {
  const jIso = jourIso(jour);
  const annulees = new Set(
    exceptions.filter((e) => e.date === jour && e.type === "annulation").map((e) => e.creneauId),
  );
  const ponctuelles = exceptions.filter((e) => e.date === jour && e.type === "ponctuelle");

  const out: Occurrence[] = [];
  for (const a of activites) {
    if (a.statut !== "en_cours") continue;
    for (const c of a.creneaux) {
      const ponctuelle = ponctuelles.find((p) => p.creneauId === c.id);
      const recurrent = c.jourSemaine === jIso && !annulees.has(c.id)
        && !(c.valideDu && jour < c.valideDu) && !(c.valideAu && jour > c.valideAu);
      if (!recurrent && !ponctuelle) continue;
      out.push({
        activiteId: a.id,
        activiteNom: a.nom,
        clubNom: a.clubNom,
        creneauId: c.id,
        date: jour,
        heureDebut: ponctuelle?.heureDebut ?? c.heureDebut,
        heureFin: ponctuelle?.heureFin ?? c.heureFin,
        membres: a.membres,
        deposePar: c.deposePar ?? null,
        covoiturage: c.covoiturage ?? false,
        lieuPrecision: c.lieuPrecision ?? null,
      });
    }
  }
  return out.sort((x, y) => x.heureDebut.localeCompare(y.heureDebut));
}

/**
 * Les trajets qui se télescopent : deux séances qui se CHEVAUCHENT dans le
 * temps et ne concernent pas les mêmes personnes — il faut donc être à deux
 * endroits à la fois.
 *
 * Deux séances du même enfant qui se chevauchent sont une faute de saisie, pas
 * un conflit de trajet : on ne les signale pas ici.
 */
export function conflitsDuJour(occurrences: Occurrence[]): Occurrence[][] {
  const conflits: Occurrence[][] = [];
  const vus = new Set<string>();

  for (const a of occurrences) {
    if (vus.has(a.creneauId)) continue;
    const groupe = occurrences.filter(
      (b) =>
        b.heureDebut < a.heureFin && a.heureDebut < b.heureFin &&
        // Personnes distinctes : c'est ce qui fait le trajet impossible.
        !b.membres.some((m) => a.membres.some((n) => n.id === m.id)),
    );
    if (groupe.length > 0) {
      const complet = [a, ...groupe];
      complet.forEach((o) => vus.add(o.creneauId));
      conflits.push(complet.sort((x, y) => x.heureDebut.localeCompare(y.heureDebut)));
    }
  }
  return conflits;
}

export type VoyagePeriode = { id: string; titre: string; debut: string | null; fin: string | null };

/**
 * Ce que la semaine dit d'un jour, en plus de ses séances : des vacances
 * scolaires, un voyage en cours.
 *
 * Le voyage fait MANQUER la séance ; les vacances la suspendent seulement — un
 * club ferme souvent, mais pas toujours. On signale, on n'affirme pas.
 */
export function signauxDuJour(
  jour: string,
  vacances: Periode[],
  voyages: VoyagePeriode[],
): { vacances: Periode | null; voyage: VoyagePeriode | null } {
  const p = vacances.find((v) => chevauche({ debut: jour, fin: jour }, v)) ?? null;
  const v = voyages.find(
    (x) => x.debut != null && chevauche({ debut: jour, fin: jour }, { debut: x.debut, fin: x.fin ?? x.debut }),
  ) ?? null;
  return { vacances: p, voyage: v };
}
