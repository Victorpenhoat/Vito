// Détails d'une réservation (Lot C) : ce qu'un vol, un train ou une voiture a
// de particulier. Ils dorment en jsonb — une colonne par cas ferait une table
// à trous — et sont donc relus champ par champ à la sortie : le contenu peut
// venir d'une version antérieure de l'application ou avoir été bricolé.
// Ce qui n'est pas reconnu disparaît au lieu de casser l'écran.

/** Champs saisissables par type de réservation. L'ordre est celui du formulaire. */
export const CHAMPS_PAR_TYPE = {
  vol: ["compagnie", "numero", "depart", "arrivee", "heureDepart", "heureArrivee", "terminal", "siege"],
  train: ["compagnie", "numero", "gareDepart", "gareArrivee", "heureDepart", "heureArrivee", "voiture", "place"],
  voiture: ["agence", "lieuPrise", "lieuRestitution", "heurePrise", "heureRestitution", "categorie"],
  hotel: ["chambre", "typeChambre", "petitDejeuner", "heureArrivee"],
  hebergement: ["chambre", "typeChambre", "petitDejeuner", "heureArrivee"],
  autre: [],
} as const satisfies Record<string, readonly string[]>;

export type TypeReservation = keyof typeof CHAMPS_PAR_TYPE;
export type DetailsReservation = Record<string, string>;

/** Les champs de ce type ; rien pour un type inconnu — on ne devine pas. */
export function champsDuType(type: string): readonly string[] {
  return (CHAMPS_PAR_TYPE as Record<string, readonly string[]>)[type] ?? [];
}

/**
 * Relit le jsonb stocké en ne gardant que les champs du type, non vides et
 * textuels. Une valeur numérique n'est pas convertie : un champ mal typé est
 * un champ qu'on ne sait pas afficher.
 */
export function lireDetails(type: string, brut: unknown): DetailsReservation {
  if (!brut || typeof brut !== "object") return {};
  const source = brut as Record<string, unknown>;
  const details: DetailsReservation = {};
  for (const champ of champsDuType(type)) {
    const v = source[champ];
    if (typeof v !== "string") continue;
    const propre = v.trim();
    if (propre) details[champ] = propre;
  }
  return details;
}

/**
 * Résumé d'une ligne, affiché sous la réservation : « AF1204 · CDG → FCO ·
 * 10:15 ». Un trajet dont il manque un bout ne fabrique pas de flèche dans le
 * vide — on n'affiche que ce qu'on sait.
 */
export function resumeDetails(type: string, brut: unknown): string | null {
  const d = lireDetails(type, brut);
  const trajet = (de?: string, vers?: string) =>
    de && vers ? `${de} → ${vers}` : (de ?? vers ?? null);

  const morceaux =
    type === "vol" ? [d.numero, trajet(d.depart, d.arrivee), d.heureDepart]
    : type === "train" ? [d.numero, trajet(d.gareDepart, d.gareArrivee), d.heureDepart]
    : type === "voiture" ? [d.agence, trajet(d.lieuPrise, d.lieuRestitution), d.heurePrise]
    : type === "hotel" || type === "hebergement" ? [d.chambre, d.typeChambre, d.heureArrivee]
    : [];

  const resume = morceaux.filter(Boolean).join(" · ");
  return resume || null;
}
