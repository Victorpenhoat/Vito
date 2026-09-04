// Contexte de séjour (design Hôtels v2 écrans 7 et 8) : les dates et
// l'occupation choisies dans la recherche d'hébergement.
//
// Ce contexte n'est JAMAIS envoyé au fournisseur — Google Places New ne prend
// ni dates ni occupation (décision du lot H0). Il sert à une seule chose :
// reporter l'intention sur le formulaire « J'y ai séjourné », pour ne pas
// resaisir les mêmes dates deux écrans plus loin.
//
// Il vit dans le localStorage : tout ce qui en sort est relu champ par champ,
// comme une donnée étrangère (version antérieure, JSON bricolé à la main).

export type SejourContexte = {
  /** « YYYY-MM-DD » ou null. */
  arrivee: string | null;
  depart: string | null;
  adultes: number;
  enfants: number;
  chambres: number;
  /** Jour où le contexte a été posé, pour ne pas resservir une vieille intention. */
  misAJourLe: string | null;
};

export const CONTEXTE_DEFAUT: SejourContexte = {
  arrivee: null, depart: null, adultes: 2, enfants: 0, chambres: 1, misAJourLe: null,
};

/** Au-delà, l'intention est considérée oubliée et ne préremplit plus rien. */
export const PEREMPTION_JOURS = 30;

const JOUR_MS = 86_400_000;

/** Une date n'est valable que si elle s'écrit « YYYY-MM-DD » ET existe au calendrier. */
function dateOuNull(v: unknown): string | null {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00Z`);
  // « 2026-13-45 » se parse en NaN ; « 2026-02-30 » glisserait sur mars sans ce
  // retour à la chaîne d'origine.
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v ? null : v;
}

function entierBorne(v: unknown, min: number, max: number, defaut: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return defaut;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

/** Relit un contexte venu du localStorage. Ce qui n'est pas reconnu revient au défaut. */
export function lireContexte(brut: unknown): SejourContexte {
  if (!brut || typeof brut !== "object") return CONTEXTE_DEFAUT;
  const o = brut as Record<string, unknown>;
  const arrivee = dateOuNull(o.arrivee);
  const departBrut = dateOuNull(o.depart);
  return {
    arrivee,
    // Un départ sans arrivée, ou avant elle, ne décrit aucun séjour.
    depart: arrivee && departBrut && departBrut > arrivee ? departBrut : null,
    adultes: entierBorne(o.adultes, 1, 20, CONTEXTE_DEFAUT.adultes),
    enfants: entierBorne(o.enfants, 0, 20, CONTEXTE_DEFAUT.enfants),
    chambres: entierBorne(o.chambres, 1, 10, CONTEXTE_DEFAUT.chambres),
    misAJourLe: dateOuNull(o.misAJourLe),
  };
}

/**
 * Un contexte trop vieux ne préremplit plus rien. Ce sont les dates POSÉES qui
 * comptent, pas celles du séjour : on marque souvent un séjour au retour, et un
 * séjour passé reste parfaitement légitime à reprendre.
 */
export function contextePerime(contexte: SejourContexte, aujourdhui: Date): boolean {
  if (!contexte.misAJourLe) return true;
  const pose = Date.parse(`${contexte.misAJourLe}T00:00:00Z`);
  const jour = Date.parse(`${aujourdhui.toISOString().slice(0, 10)}T00:00:00Z`);
  return (jour - pose) / JOUR_MS > PEREMPTION_JOURS;
}

/** Nombre de nuits d'une plage complète, sinon null. */
export function nuits(contexte: Pick<SejourContexte, "arrivee" | "depart">): number | null {
  const { arrivee, depart } = contexte;
  if (!arrivee || !depart || depart <= arrivee) return null;
  return Math.round((Date.parse(depart) - Date.parse(arrivee)) / JOUR_MS);
}

type Plage = { arrivee: string | null; depart: string | null };

/**
 * Sélection au calendrier : un clic pose l'arrivée, le suivant ferme la plage.
 * Cliquer avant l'arrivée (ou sur elle) redéplace l'arrivée plutôt que de
 * fabriquer une plage à l'envers ; cliquer sur une plage complète recommence.
 */
export function plageApresClic(plage: Plage, jour: string): Plage {
  if (!plage.arrivee || plage.depart) return { arrivee: jour, depart: null };
  if (jour <= plage.arrivee) return { arrivee: jour, depart: null };
  return { arrivee: plage.arrivee, depart: jour };
}

/**
 * Un mois en semaines de sept cases, lundi d'abord (le design affiche
 * « L M M J V S D »). Les cases hors du mois sont vides : afficher les jours du
 * mois voisin inviterait à les cliquer.
 */
export function grilleMois(annee: number, mois: number): (string | null)[][] {
  const premier = new Date(Date.UTC(annee, mois - 1, 1));
  const nbJours = new Date(Date.UTC(annee, mois, 0)).getUTCDate();
  // getUTCDay : 0 = dimanche. Décalage pour une semaine qui commence lundi.
  const decalage = (premier.getUTCDay() + 6) % 7;

  const cases: (string | null)[] = Array.from({ length: decalage }, () => null);
  for (let j = 1; j <= nbJours; j += 1) {
    cases.push(`${annee}-${String(mois).padStart(2, "0")}-${String(j).padStart(2, "0")}`);
  }
  while (cases.length % 7 !== 0) cases.push(null);

  return Array.from({ length: cases.length / 7 }, (_, i) => cases.slice(i * 7, i * 7 + 7));
}

/** Les n mois à afficher à partir d'une date (le calendrier en déroule plusieurs). */
export function moisAPartirDe(depart: Date, n: number): { annee: number; mois: number }[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(depart.getUTCFullYear(), depart.getUTCMonth() + i, 1));
    return { annee: d.getUTCFullYear(), mois: d.getUTCMonth() + 1 };
  });
}
