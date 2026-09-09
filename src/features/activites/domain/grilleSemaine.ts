// La semaine en sept colonnes (design « D · Cette semaine »).
//
// Une liste par jour dit CE QUI a lieu ; une grille dit QUAND, et surtout ce
// qui se chevauche. C'est la même donnée, lue autrement — d'où un domaine qui
// ne fait que placer, sans rien recalculer.

/** Le rail horaire de la maquette : 8h en haut, 20h en bas. */
export const RAIL_DEBUT = 8;
export const RAIL_FIN = 20;
/** Les graduations affichées, de deux en deux heures. */
export const GRADUATIONS = [8, 10, 12, 14, 16, 18, 20];

/** « 17:30 » → 17.5. */
export function enHeures(hhmm: string): number {
  const [h, m] = hhmm.split(":");
  return Number(h) + Number(m) / 60;
}

export type Placement = { hautPct: number; hauteurPct: number };

/**
 * Où poser une séance dans le rail, en pourcentage de sa hauteur.
 *
 * Ce qui déborde est ROGNÉ aux bords plutôt que rejeté : un cours de 7h ou de
 * 21h existe, et doit rester visible même si le rail ne le couvre pas en
 * entier. `null` seulement pour ce qui tombe entièrement hors du rail — sinon
 * on dessinerait une barre de hauteur nulle.
 */
export function placer(heureDebut: string, heureFin: string, rail = { debut: RAIL_DEBUT, fin: RAIL_FIN }): Placement | null {
  const amplitude = rail.fin - rail.debut;
  const debut = enHeures(heureDebut);
  const fin = enHeures(heureFin);
  if (fin <= rail.debut || debut >= rail.fin) return null;

  const haut = Math.max(debut, rail.debut);
  const bas = Math.min(fin, rail.fin);
  return {
    hautPct: ((haut - rail.debut) / amplitude) * 100,
    // Un minimum de hauteur : une séance de dix minutes doit rester cliquable.
    hauteurPct: Math.max(3, ((bas - haut) / amplitude) * 100),
  };
}

/**
 * Combien de colonnes côte à côte, et à quel rang, pour des séances qui se
 * chevauchent le même jour.
 *
 * Sans cela, deux cours simultanés se superposeraient exactement — et c'est
 * précisément le cas qu'on vient regarder.
 */
export function repartirColonnes<T extends { heureDebut: string; heureFin: string }>(
  seances: T[],
): { seance: T; rang: number; total: number }[] {
  const tries = [...seances].sort((a, b) => a.heureDebut.localeCompare(b.heureDebut));
  const rangs = new Map<T, number>();

  for (const s of tries) {
    const occupes = new Set(
      tries
        .filter((autre) => autre !== s && rangs.has(autre)
          && autre.heureDebut < s.heureFin && s.heureDebut < autre.heureFin)
        .map((autre) => rangs.get(autre)!),
    );
    let rang = 0;
    while (occupes.has(rang)) rang++;
    rangs.set(s, rang);
  }

  // Le total est celui du GROUPE qui se chevauche, pas de la journée : une
  // séance isolée le matin occupe toute la largeur.
  return tries.map((s) => {
    const groupe = tries.filter((a) => a.heureDebut < s.heureFin && s.heureDebut < a.heureFin);
    return {
      seance: s,
      rang: rangs.get(s)!,
      total: Math.max(...groupe.map((a) => rangs.get(a)! + 1)),
    };
  });
}
