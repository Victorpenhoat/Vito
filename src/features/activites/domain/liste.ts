
// Ce que montrent les vues « En cours » et « Tous » : un groupement par membre
// et des filtres cumulables. Tout est pur — la liste complète tient largement
// en mémoire pour un carnet de famille, et filtrer ici plutôt qu'en base évite
// autant d'allers-retours que de clics sur un filtre.

export type MembreRef = { id: string; prenom: string; couleur: string | null; estMoi?: boolean };

export type ActiviteFiltrable = {
  id: string;
  nom: string;
  type: string;
  statut: string;
  clubNom: string | null;
  membres: MembreRef[];
  tags: { slug: string }[];
  /** Intervenants des créneaux : la recherche du design les couvre aussi. */
  intervenants: string[];
};

export type Filtres = {
  membres?: string[];
  statuts?: string[];
  types?: string[];
  tags?: string[];
  recherche?: string;
};

/** Sans accents ni casse : « équitation » se trouve en tapant « equitation ». */
export function normaliser(texte: string): string {
  return texte.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/**
 * La recherche du design : « Activité, club, intervenant… ». Elle ne cherche
 * PAS dans les notes — on tape le nom d'un club pour retrouver un cours, pas
 * pour fouiller ses propres remarques.
 */
export function correspond(activite: ActiviteFiltrable, requete: string): boolean {
  const q = normaliser(requete);
  if (!q) return true;
  return [activite.nom, activite.clubNom ?? "", ...activite.intervenants]
    .some((champ) => normaliser(champ).includes(q));
}

/**
 * Filtres cumulables : ET entre les dimensions, OU à l'intérieur de chacune.
 * Cocher « Alexia » et « En pause » montre les activités en pause d'Alexia ;
 * cocher deux membres montre celles de l'un OU de l'autre.
 *
 * Une dimension vide ne filtre rien — c'est ce qui rend les filtres cumulables
 * sans avoir à tout cocher.
 */
export function filtrerActivites<T extends ActiviteFiltrable>(activites: T[], f: Filtres): T[] {
  return activites.filter((a) => {
    if (f.membres?.length && !a.membres.some((m) => f.membres!.includes(m.id))) return false;
    if (f.statuts?.length && !f.statuts.includes(a.statut)) return false;
    if (f.types?.length && !f.types.includes(a.type)) return false;
    if (f.tags?.length && !a.tags.some((t) => f.tags!.includes(t.slug))) return false;
    if (f.recherche && !correspond(a, f.recherche)) return false;
    return true;
  });
}

export type GroupeMembre<T> = { membre: MembreRef | null; activites: T[] };

/**
 * Groupement par membre, comme la liste « En cours ».
 *
 * Une activité partagée apparaît dans CHAQUE groupe concerné : l'équitation est
 * autant celle d'Alexia que celle de Tom, et la faire disparaître d'un des deux
 * ferait mentir le compte « 2 activités ».
 *
 * Les membres sont classés par prénom, « moi » en dernier : on regarde d'abord
 * les cours de ses enfants. Une activité sans membre forme un groupe à part
 * plutôt que d'être perdue.
 */
export function grouperParMembre<T extends ActiviteFiltrable>(activites: T[]): GroupeMembre<T>[] {
  const groupes = new Map<string, GroupeMembre<T>>();
  const orphelines: T[] = [];

  for (const a of activites) {
    if (a.membres.length === 0) { orphelines.push(a); continue; }
    for (const m of a.membres) {
      const groupe = groupes.get(m.id) ?? { membre: m, activites: [] };
      groupe.activites.push(a);
      groupes.set(m.id, groupe);
    }
  }

  const tries = [...groupes.values()].sort((x, y) => {
    const mx = x.membre!, my = y.membre!;
    if (!!mx.estMoi !== !!my.estMoi) return mx.estMoi ? 1 : -1;
    return mx.prenom.localeCompare(my.prenom, "fr");
  });
  return orphelines.length ? [...tries, { membre: null, activites: orphelines }] : tries;
}
