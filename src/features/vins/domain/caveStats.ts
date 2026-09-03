import { moyenneVerres } from "./verres";

// « Ma cave en chiffres » (design Vins & Cave écran 7) : tout le calcul des
// statistiques, hors de l'affichage — les barres sont en CSS, il n'y a aucune
// bibliothèque de graphiques dans ce projet et ce lot n'en introduit pas.
//
// Deux conventions de comptage, tenues partout :
//   • les répartitions (couleur, région, cépage) comptent des VINS — un vin bu
//     dix fois ne doit pas écraser la composition de la cave ;
//   • les notes et les dépenses viennent des DÉGUSTATIONS — c'est ce que j'ai
//     vécu et payé.

export type VinStat = {
  id: string;
  couleur: string | null;
  region: string | null;
  cepages: string[];
  /** Prix caviste estimé par l'analyse d'étiquette (en euros), jamais saisi. */
  prix_estime: number | null;
};

export type DegustationStat = {
  vin_id: string;
  note: number | null;
  prix_paye: number | null;
  prix_unite: "bouteille" | "verre" | null;
  /** Date ISO « YYYY-MM-DD » telle que stockée. */
  deguste_le: string;
};

export type CaveStats = {
  nbVins: number;
  nbDegustations: number;
  noteMoyenne: number | null;
  couleurs: { couleur: string; nb: number; part: number }[];
  regions: { region: string; nb: number; note_moyenne: number | null }[];
  cepages: { cepage: string; nb: number; note_moyenne: number | null }[];
  depense: {
    totalPaye: number;
    /** Comparaison payé / estimé, limitée aux bouteilles comparables (null s'il n'y en a aucune). */
    bouteilles: { nb: number; paye: number; estime: number } | null;
    /** Six derniers mois, du plus ancien au mois courant. */
    mois: { mois: string; montant: number }[];
  };
};

/** Le design en montre quatre : au-delà, ce n'est plus un classement mais une liste. */
export const TOP_ENTREES = 4;
export const MOIS_SUIVIS = 6;

/** Ordre du design (et de l'enum `vin_couleur`), pour départager les ex æquo. */
const ORDRE_COULEURS = ["rouge", "blanc", "rose", "petillant", "autre"];

export function calculerCaveStats(
  source: { vins: VinStat[]; degustations: DegustationStat[] },
  aujourdhui: Date,
): CaveStats {
  const { vins, degustations } = source;
  const notesParVin = new Map<string, (number | null)[]>();
  for (const d of degustations) {
    notesParVin.set(d.vin_id, [...(notesParVin.get(d.vin_id) ?? []), d.note]);
  }
  const notesDe = (ids: string[]) => ids.flatMap((id) => notesParVin.get(id) ?? []);

  return {
    nbVins: vins.length,
    nbDegustations: degustations.length,
    noteMoyenne: moyenneVerres(degustations.map((d) => d.note)),
    couleurs: repartitionCouleurs(vins),
    regions: classement(vins, (v) => (v.region ? [v.region] : []), notesDe)
      .map(({ cle, nb, note_moyenne }) => ({ region: cle, nb, note_moyenne })),
    cepages: classement(vins, (v) => v.cepages, notesDe)
      .map(({ cle, nb, note_moyenne }) => ({ cepage: cle, nb, note_moyenne })),
    depense: depense(vins, degustations, aujourdhui),
  };
}

/** Parts en pourcents entiers qui retombent sur 100 (méthode des plus forts restes). */
function repartitionCouleurs(vins: VinStat[]): { couleur: string; nb: number; part: number }[] {
  const compte = new Map<string, number>();
  for (const v of vins) if (v.couleur) compte.set(v.couleur, (compte.get(v.couleur) ?? 0) + 1);

  const total = [...compte.values()].reduce((a, b) => a + b, 0);
  if (total === 0) return [];

  const rang = (c: string) => {
    const i = ORDRE_COULEURS.indexOf(c);
    return i === -1 ? ORDRE_COULEURS.length : i;
  };
  const lignes = [...compte.entries()]
    .map(([couleur, nb]) => ({ couleur, nb, exact: (nb / total) * 100 }))
    .sort((a, b) => b.nb - a.nb || rang(a.couleur) - rang(b.couleur))
    .map((l) => ({ ...l, part: Math.floor(l.exact) }));

  // Les points perdus aux arrondis reviennent aux plus gros restes : sans cela,
  // « 52 % + 26 % + 13 % + 9 % » afficherait 99 % et se remarquerait.
  let reste = 100 - lignes.reduce((s, l) => s + l.part, 0);
  for (const l of [...lignes].sort((a, b) => (b.exact - b.part) - (a.exact - a.part))) {
    if (reste <= 0) break;
    l.part += 1;
    reste -= 1;
  }
  return lignes.map(({ couleur, nb, part }) => ({ couleur, nb, part }));
}

/**
 * Classement générique régions / cépages : combien de vins, et quelle note leur
 * ai-je donnée. Un vin à plusieurs cépages compte pour chacun d'eux.
 */
function classement(
  vins: VinStat[],
  clesDe: (v: VinStat) => string[],
  notesDe: (ids: string[]) => (number | null)[],
): { cle: string; nb: number; note_moyenne: number | null }[] {
  // La casse ne doit pas dédoubler « Merlot » et « merlot » ; l'affichage garde
  // la première orthographe rencontrée.
  const groupes = new Map<string, { libelle: string; vinIds: string[] }>();
  for (const v of vins) {
    for (const brut of clesDe(v)) {
      const libelle = brut.trim();
      if (!libelle) continue;
      const cle = libelle.toLowerCase();
      const groupe = groupes.get(cle) ?? { libelle, vinIds: [] };
      groupe.vinIds.push(v.id);
      groupes.set(cle, groupe);
    }
  }

  return [...groupes.values()]
    .map((g) => ({ cle: g.libelle, nb: g.vinIds.length, note_moyenne: moyenneVerres(notesDe(g.vinIds)) }))
    .sort((a, b) => b.nb - a.nb || (b.note_moyenne ?? 0) - (a.note_moyenne ?? 0) || a.cle.localeCompare(b.cle, "fr"))
    .slice(0, TOP_ENTREES);
}

function depense(vins: VinStat[], degustations: DegustationStat[], aujourdhui: Date): CaveStats["depense"] {
  const estimeParVin = new Map(vins.map((v) => [v.id, v.prix_estime]));
  let totalPaye = 0;
  const comparables = { nb: 0, paye: 0, estime: 0 };
  const parMois = new Map<string, number>();

  for (const d of degustations) {
    if (d.prix_paye == null) continue;
    totalPaye += d.prix_paye;
    const mois = d.deguste_le.slice(0, 7);
    parMois.set(mois, (parMois.get(mois) ?? 0) + d.prix_paye);

    // Un verre payé 14 € ne se compare pas à une bouteille estimée 28 € : seules
    // les bouteilles dont le vin porte un prix estimé entrent dans la balance.
    const estime = estimeParVin.get(d.vin_id) ?? null;
    if (d.prix_unite === "bouteille" && estime != null) {
      comparables.nb += 1;
      comparables.paye += d.prix_paye;
      comparables.estime += estime;
    }
  }

  return {
    totalPaye,
    bouteilles: comparables.nb > 0 ? comparables : null,
    mois: derniersMois(aujourdhui).map((mois) => ({ mois, montant: parMois.get(mois) ?? 0 })),
  };
}

/** Les six clés « YYYY-MM » qui se terminent au mois courant. */
function derniersMois(aujourdhui: Date): string[] {
  const annee = aujourdhui.getUTCFullYear();
  const mois = aujourdhui.getUTCMonth();
  return Array.from({ length: MOIS_SUIVIS }, (_, i) => {
    // Date.UTC absorbe les mois négatifs : décembre précède janvier sans calcul.
    const d = new Date(Date.UTC(annee, mois - (MOIS_SUIVIS - 1 - i), 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}
