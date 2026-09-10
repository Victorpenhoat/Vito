export type Statut = "en_cours" | "accepte" | "remis" | "rebond" | "plainte" | "echec";

// Traduction des événements Resend. Ce qui n'est pas listé est ignoré : un
// statut inventé vaut moins que pas de statut du tout.
const DEPUIS_EVENEMENT: Record<string, Statut> = {
  "email.delivered": "remis",
  "email.bounced": "rebond",
  "email.complained": "plainte",
};

export function statutDepuisEvenement(type: string): Statut | null {
  return DEPUIS_EVENEMENT[type] ?? null;
}

// Les webhooks arrivent dans le désordre : un « envoyé » peut suivre un
// « remis ». On ne recule donc jamais — sauf qu'un rebond ou une plainte
// l'emportent, parce qu'ils disent quelque chose qu'une remise ne dit pas.
const RANG: Record<Statut, number> = {
  en_cours: 0,
  echec: 1,
  accepte: 1,
  remis: 2,
  rebond: 3,
  plainte: 4,
};

export function avance(actuel: Statut, nouveau: Statut): boolean {
  return RANG[nouveau] > RANG[actuel];
}

// Pour une écriture atomique : les statuts qu'un `UPDATE ... WHERE statut IN (...)`
// doit accepter comme état de départ pour que le passage à `nouveau` soit un progrès.
// Dérivé du même RANG qu'`avance()` — une seconde liste tenue à la main dériverait.
export function statutsAnterieurs(nouveau: Statut): Statut[] {
  return (Object.keys(RANG) as Statut[]).filter((s) => RANG[s] < RANG[nouveau]);
}
