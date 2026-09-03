// Mode voyage hors ligne (design Onboarding_Compte écran 12).
//
// Deux promesses, et une seule ligne de partage entre elles :
//   « Vouchers, billets et réservations consultables hors ligne, sans vérification. »
//   « Les documents d'identité restent protégés, même hors ligne. »
//
// Ce qui part sur l'appareil est donc STRICTEMENT le carnet d'un voyage : sa
// fiche, ses réservations et ses pièces jointes. Rien du Cercle — ni scan
// d'identité, ni numéro de document — ne peut y entrer, puisque rien ici ne
// nomme ces tables.

/** Nom du cache. ⚠ Répliqué dans public/sw.js, qui ne peut pas importer ce module. */
export const CACHE_HORS_LIGNE = "vito-hors-ligne";

/** Entrée qui décrit ce qui est stocké (lue par l'UI pour afficher l'état). */
export const CLE_META = "/__vito/hors-ligne";

export type MetaCarnet = {
  voyageId: string;
  locale: string;
  enregistreLe: number;
  octets: number;
  documents: number;
};

/** URL de la page consultable sans réseau. */
export function cheminCarnet(locale: string, voyageId: string): string {
  return `/${locale}/carnet-hors-ligne/${voyageId}`;
}

/** URL d'une pièce jointe du voyage (même route qu'en ligne : rien de spécial à servir). */
export function cheminDocument(documentId: string): string {
  return `/api/voyages/documents/${documentId}`;
}

/**
 * Tout ce qu'il faut mettre en cache pour que le carnet tienne debout sans
 * réseau : la page, puis chaque pièce jointe.
 */
export function urlsDuCarnet(locale: string, voyageId: string, documentIds: string[]): string[] {
  return [cheminCarnet(locale, voyageId), ...documentIds.map(cheminDocument)];
}

/** Taille lisible — on annonce le poids AVANT de télécharger, en itinérance. */
export function tailleLisible(octets: number): string {
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(1).replace(".", ",")} Mo`;
}

/** Une image s'affiche dans la page ; le reste (PDF) s'ouvre à la demande. */
export function estAffichable(mime: string): boolean {
  return mime.startsWith("image/");
}

type AvecDates = { date_debut: string | null; date_fin?: string | null };

/**
 * Réservations regroupées par jour de début, dans l'ordre. Celles sans date
 * ferment la marche plutôt que de disparaître : hors ligne, un voucher non daté
 * reste le seul papier disponible.
 */
export function parJour<T extends AvecDates>(reservations: T[]): { date: string | null; items: T[] }[] {
  const groupes = new Map<string, T[]>();
  const sansDate: T[] = [];
  for (const r of reservations) {
    if (!r.date_debut) { sansDate.push(r); continue; }
    const existant = groupes.get(r.date_debut);
    if (existant) existant.push(r);
    else groupes.set(r.date_debut, [r]);
  }
  const ordonnes = [...groupes.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, items]) => ({ date: date as string | null, items }));
  return sansDate.length ? [...ordonnes, { date: null, items: sansDate }] : ordonnes;
}

/** Le voyage se déroule-t-il aujourd'hui ? (« Actif pendant le séjour à Rome ») */
export function sejourEnCours(debut: string | null, fin: string | null, aujourdhui: string): boolean {
  if (!debut) return false;
  return debut <= aujourdhui && (fin ?? debut) >= aujourdhui;
}
