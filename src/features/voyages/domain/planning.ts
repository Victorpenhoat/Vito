// Planning (Lot E) : une frise de douze mois où se superposent les voyages et
// les vacances scolaires. Ce qu'on y cherche n'est pas seulement « quand pars-
// je », mais « quels créneaux restent libres ».
//
// Tout est calculé en jours pleins, en UTC : un décalage horaire ne doit pas
// faire glisser une barre d'un jour.

export type Periode = { id: string; libelle: string; debut: string; fin: string };
export type Intervalle = { debut: string; fin: string };
export type Barre = { gauchePct: number; largeurPct: number };
export type MoisFrise = { annee: number; mois: number; debut: string; fin: string };

const JOUR_MS = 86_400_000;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const jour = (d: string) => Date.parse(`${d}T00:00:00Z`);

/** Fenêtre de la frise : n mois pleins à partir du mois en cours. */
export function fenetreDepuis(depart: Date, nbMois: number): Intervalle & { mois: MoisFrise[] } {
  const annee = depart.getUTCFullYear();
  const premierMois = depart.getUTCMonth();

  const mois: MoisFrise[] = Array.from({ length: nbMois }, (_, i) => {
    const d = new Date(Date.UTC(annee, premierMois + i, 1));
    // Jour 0 du mois suivant = dernier jour de celui-ci.
    const fin = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
    return {
      annee: d.getUTCFullYear(),
      mois: d.getUTCMonth() + 1,
      debut: iso(d.getTime()),
      fin: iso(fin.getTime()),
    };
  });

  return { debut: mois[0]!.debut, fin: mois.at(-1)!.fin, mois };
}

/**
 * Place une période sur la frise, en pourcentage de la fenêtre. Ce qui déborde
 * est rogné aux bords plutôt que rejeté : un voyage commencé le mois dernier
 * reste visible pour la part qui tombe dans la fenêtre.
 */
export function barrePour(debut: string | null, fin: string | null, fenetre: Intervalle): Barre | null {
  if (!debut) return null;
  const depart = jour(debut);
  // Une date de retour antérieure au départ est une saisie fautive : on ne
  // dessine pas une barre à l'envers, on s'en tient au jour du départ.
  const retour = fin && jour(fin) > depart ? jour(fin) : depart;

  const bordGauche = jour(fenetre.debut);
  const bordDroit = jour(fenetre.fin);
  if (retour < bordGauche || depart > bordDroit) return null;

  const total = bordDroit - bordGauche + JOUR_MS;
  const de = Math.max(depart, bordGauche);
  // +1 jour : une période du 11 au 20 occupe dix jours, pas neuf.
  const a = Math.min(retour, bordDroit) + JOUR_MS;

  return {
    gauchePct: ((de - bordGauche) / total) * 100,
    largeurPct: ((a - de) / total) * 100,
  };
}

/** Deux intervalles se chevauchent-ils ? Se toucher compte. */
export function chevauche(a: Intervalle, b: Intervalle): boolean {
  return a.debut <= b.fin && b.debut <= a.fin;
}

/** Les périodes visibles dans la fenêtre — les autres n'ont rien à y faire. */
export function periodesDeLaFenetre(periodes: Periode[], fenetre: Intervalle): Periode[] {
  return periodes.filter((p) => chevauche(p, fenetre));
}

/** Sur quelles vacances tombe ce voyage. Sans dates, il ne tombe sur rien. */
export function vacancesDuVoyage(
  voyage: { debut: string | null; fin: string | null },
  periodes: Periode[],
): Periode[] {
  if (!voyage.debut) return [];
  const intervalle = { debut: voyage.debut, fin: voyage.fin ?? voyage.debut };
  return periodes.filter((p) => chevauche(intervalle, p));
}
