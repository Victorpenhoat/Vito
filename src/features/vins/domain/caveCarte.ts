import { moyenneVerres } from "./verres";

// Carte de la Cave (design Vins & Cave écran 6) : où ai-je bu ?
//
// Décision produit : seules les dégustations en RESTAURANT sont épinglables —
// un établissement porte ses coordonnées, un lieu libre (maison, chez des amis,
// caviste, autre) n'a qu'un nom. Plutôt que d'inventer une position, ces
// dégustations sont rendues sous la carte dans un bloc « Ailleurs ».

export const LIEUX_LIBRES = ["restaurant", "maison", "amis", "caviste", "autre"] as const;
export type LieuLibre = (typeof LIEUX_LIBRES)[number];

export type DegustationLieu = {
  id: string;
  note: number | null;
  etablissement: { id: string; nom: string; lat: number | null; lng: number | null } | null;
  lieu_type: string | null;
  lieu_nom: string | null;
};

/** Un point de la carte : un établissement, ce que j'y ai bu et comment je l'ai noté. */
export type LieuCarte = {
  id: string;
  nom: string;
  lat: number;
  lng: number;
  nb: number;
  note_moyenne: number | null;
};

/** Un lieu sans coordonnées : compté et nommé, mais jamais épinglé. */
export type LieuAilleurs = {
  cle: string;
  type: LieuLibre;
  nom: string | null;
  nb: number;
  note_moyenne: number | null;
};

const PARIS = { lat: 48.8566, lng: 2.3522 };

const estLieuLibre = (v: string | null): v is LieuLibre =>
  v != null && (LIEUX_LIBRES as readonly string[]).includes(v);

/**
 * Répartit les dégustations entre la carte et le bloc « Ailleurs ».
 *
 * Une dégustation dont on ne sait rien du lieu (ni établissement, ni type) ne
 * compte nulle part : elle serait un point sans nom autant qu'une ligne vide.
 */
export function regrouperLieux(degustations: DegustationLieu[]): {
  carte: LieuCarte[];
  ailleurs: LieuAilleurs[];
  sansCoordonnees: number;
} {
  const parEtablissement = new Map<string, { nom: string; lat: number; lng: number; notes: (number | null)[] }>();
  const parLieuLibre = new Map<string, { type: LieuLibre; nom: string | null; notes: (number | null)[] }>();
  let sansCoordonnees = 0;

  for (const d of degustations) {
    const etab = d.etablissement;
    if (etab) {
      // Un établissement sans coordonnées ne peut pas être épinglé — on le
      // signale plutôt que de le faire disparaître (même parti pris que la
      // carte des restos).
      if (etab.lat == null || etab.lng == null) {
        sansCoordonnees += 1;
        continue;
      }
      const point = parEtablissement.get(etab.id)
        ?? { nom: etab.nom, lat: etab.lat, lng: etab.lng, notes: [] };
      point.notes.push(d.note);
      parEtablissement.set(etab.id, point);
      continue;
    }
    if (!estLieuLibre(d.lieu_type)) continue;
    const nom = d.lieu_nom?.trim() || null;
    // Deux « Caviste du coin » sont le même endroit ; la casse ne doit pas les
    // séparer, mais l'affichage garde l'orthographe saisie.
    const cle = nom ? `${d.lieu_type}·${nom.toLowerCase()}` : d.lieu_type;
    const groupe = parLieuLibre.get(cle) ?? { type: d.lieu_type, nom, notes: [] };
    groupe.notes.push(d.note);
    parLieuLibre.set(cle, groupe);
  }

  const carte: LieuCarte[] = [...parEtablissement.entries()].map(([id, p]) => ({
    id, nom: p.nom, lat: p.lat, lng: p.lng, nb: p.notes.length, note_moyenne: moyenneVerres(p.notes),
  }));
  const ailleurs: LieuAilleurs[] = [...parLieuLibre.entries()].map(([cle, g]) => ({
    cle, type: g.type, nom: g.nom, nb: g.notes.length, note_moyenne: moyenneVerres(g.notes),
  }));

  return { carte: trierParFrequence(carte, (l) => l.nom), ailleurs: trierParFrequence(ailleurs, nomAilleurs), sansCoordonnees };
}

const nomAilleurs = (l: LieuAilleurs) => l.nom ?? l.type;

/** Les lieux les plus fréquentés d'abord ; à égalité, l'ordre alphabétique. */
function trierParFrequence<T extends { nb: number }>(lieux: T[], nom: (l: T) => string): T[] {
  return [...lieux].sort((a, b) => b.nb - a.nb || nom(a).localeCompare(nom(b), "fr"));
}

/** Centre de la carte : la moyenne des points, Paris quand il n'y en a aucun. */
export function centreLieux(lieux: LieuCarte[]): { lat: number; lng: number } {
  if (lieux.length === 0) return PARIS;
  const lat = lieux.reduce((s, l) => s + l.lat, 0) / lieux.length;
  const lng = lieux.reduce((s, l) => s + l.lng, 0) / lieux.length;
  return { lat, lng };
}
