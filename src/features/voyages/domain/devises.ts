// Multi-devise des dépenses (maquette « Nouvelle dépense » : « 86,50 [EUR ▾] ·
// Devise du voyage · saisie possible en devise locale », et la ligne « 52 $ ·
// taux du 14/10 » dans la liste).
//
// Deux principes tiennent tout le reste :
//
// 1. Le voyage a UNE devise, et c'est en elle que se comptent le total, les
//    parts et les soldes. Une dépense saisie en devise locale est convertie une
//    fois pour toutes ; rien en aval n'a besoin de savoir qu'elle vient
//    d'ailleurs.
// 2. Le taux est FIGÉ au moment de la saisie. Un taux relu chaque jour ferait
//    bouger tout seuls des soldes déjà réglés — « tu me devais 40 €, ce matin
//    tu m'en dois 41 » — pour une dette qui, elle, n'a pas bougé.
//
// Les montants sont en centièmes d'unité, y compris pour les devises sans
// subdivision : le yen s'affiche sans décimale parce qu'Intl le sait, pas parce
// qu'on le stocke autrement.

/**
 * Les devises que le fournisseur de taux sait convertir (taux de référence de
 * la BCE). En proposer d'autres promettrait une conversion qui échouerait.
 */
export const DEVISES = [
  "EUR", "USD", "GBP", "CHF", "JPY", "CAD", "AUD", "NZD", "SEK", "NOK", "DKK",
  "ISK", "PLN", "CZK", "HUF", "RON", "BGN", "TRY", "ILS", "ZAR", "BRL", "MXN",
  "CNY", "HKD", "SGD", "KRW", "INR", "IDR", "MYR", "PHP", "THB",
] as const;
export type Devise = (typeof DEVISES)[number];

export function estDeviseConnue(code: string): code is Devise {
  return (DEVISES as readonly string[]).includes(code);
}

/**
 * Le montant tel qu'il compte pour le voyage. Arrondi au centième : c'est la
 * somme qui entre dans les parts, donc elle doit être exacte à l'unité près, pas
 * traîner des décimales que personne ne peut payer.
 */
export function convertir(montantCents: number, taux: number): number {
  return Math.round(montantCents * taux);
}

/**
 * Un taux se saisit à la main aussi (celui de ta carte, d'un retrait en
 * espèces) : virgule acceptée, espaces ignorés. Zéro, négatif ou charabia ne
 * sont pas des taux — on rend `null` plutôt qu'un NaN qui contaminerait le
 * montant converti.
 */
export function tauxSaisi(brut: string): number | null {
  const nettoye = brut.replace(/\s/g, "").replace(",", ".");
  if (!/^\d*\.?\d+$/.test(nettoye)) return null;
  const valeur = Number(nettoye);
  return Number.isFinite(valeur) && valeur > 0 ? valeur : null;
}

export type Conversion = {
  /** Ce qui a été saisi, en centièmes de la devise locale. */
  montantSaisiCents: number;
  deviseSaisie: string;
  taux: number;
};

/**
 * Ce qu'une dépense a d'étranger, ou rien. Une dépense saisie dans la devise du
 * voyage n'a PAS de conversion à montrer : afficher « 30 € · taux 1,00 » serait
 * du bruit sur toutes les lignes d'un voyage en France.
 */
export function conversionAffichable(
  depense: { montantSaisiCents?: number | null; deviseSaisie?: string | null; taux?: number | null },
  deviseVoyage: string,
): Conversion | null {
  const { montantSaisiCents, deviseSaisie, taux } = depense;
  if (montantSaisiCents == null || !deviseSaisie || taux == null) return null;
  if (deviseSaisie === deviseVoyage) return null;
  return { montantSaisiCents, deviseSaisie, taux };
}

/**
 * Des parts saisies en devise locale, converties sans casser l'invariant qui
 * fait tenir les soldes : leur somme doit faire le total, au centime. Chaque
 * part arrondie de son côté dérive de quelques centimes ; l'écart est absorbé
 * par la plus grosse, là où il se voit le moins.
 *
 * Au-delà d'un centime par part, ce n'est plus un arrondi mais une saisie qui
 * ne tombe pas juste : on laisse alors l'écart, et le calcul des parts le
 * refusera en le disant.
 */
export function convertirParts(
  exactsCents: Record<string, number>,
  taux: number,
  totalConvertiCents: number,
): Record<string, number> {
  const ids = Object.keys(exactsCents);
  const convertis = ids.map((id) => convertir(exactsCents[id] ?? 0, taux));
  const ecart = totalConvertiCents - convertis.reduce((s, c) => s + c, 0);
  if (ecart !== 0 && ids.length > 0 && Math.abs(ecart) <= ids.length) {
    let iMax = 0;
    convertis.forEach((c, i) => { if (c > (convertis[iMax] ?? 0)) iMax = i; });
    convertis[iMax] = (convertis[iMax] ?? 0) + ecart;
  }
  return Object.fromEntries(ids.map((id, i) => [id, convertis[i] ?? 0]));
}
