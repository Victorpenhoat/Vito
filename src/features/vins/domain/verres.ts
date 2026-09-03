// Note en VERRES (design Vins & Cave écran 3) : sur 5, par demi-verres.
// Le pas de 0,5 est exactement représentable en binaire — pas de piège de
// flottant, contrairement aux notes /10 au dixième des restos.

export const VERRE_MAX = 5;

/** Arrondit au demi-verre le plus proche, borné à [0,5 ; 5]. */
export function arrondirVerres(valeur: number): number {
  const arrondi = Math.round(valeur * 2) / 2;
  return Math.min(VERRE_MAX, Math.max(0.5, arrondi));
}

/** Découpe une note en verres pleins / demi / vides, pour l'affichage. */
export function verresPour(note: number | null): { pleins: number; demi: boolean; vides: number } {
  if (note == null) return { pleins: 0, demi: false, vides: VERRE_MAX };
  const n = arrondirVerres(note);
  const pleins = Math.floor(n);
  const demi = n % 1 !== 0;
  return { pleins, demi, vides: VERRE_MAX - pleins - (demi ? 1 : 0) };
}

/**
 * Note visée par un clic sur le i-ème verre (1..5) : un tap donne le verre
 * plein, un second tap sur le même verre donne le demi (design : « tap pour un
 * verre, tap long pour un demi » — au clavier/souris, le second clic suffit).
 */
export function noteApresClic(indice: number, actuelle: number | null): number {
  const pleine = indice;
  const demie = indice - 0.5;
  if (actuelle === pleine) return demie;
  return pleine;
}

/** Moyenne des notes renseignées, arrondie au dixième (null si aucune). */
export function moyenneVerres(notes: (number | null)[]): number | null {
  const values = notes.filter((n): n is number => n != null);
  if (values.length === 0) return null;
  const somme = values.reduce((a, b) => a + b, 0);
  return Math.round((somme / values.length) * 10) / 10;
}
