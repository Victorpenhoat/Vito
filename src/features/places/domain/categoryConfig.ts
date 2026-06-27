export type Categorie = "resto" | "hotel";

export type Notation =
  | { kind: "stars"; value: number; scale: 5 }
  | { kind: "score"; value: number; scale: 10 };

/** Note d'affichage. resto = étoiles /5 (valeur brute) ; hôtel = score /10 (= rating × 2). null si pas de rating. */
export function computeNotation(categorie: Categorie, rating: number | null): Notation | null {
  if (rating == null) return null;
  if (categorie === "hotel") return { kind: "score", value: rating * 2, scale: 10 };
  return { kind: "stars", value: rating, scale: 5 };
}

export type CategoryConfig = {
  notationKind: "stars" | "score";
  maxChipsListe: number;
  maxChipsVignette: number;
  /** Descripteur secondaire (chips), source = tags. */
  descriptor: "cuisine" | "ambiance";
  /** Réservé Slice 7 : classe étoiles hôtel. Non rendu ni alimenté en Slice 2. */
  showStarClass: boolean;
};

export const categoryConfig: Record<Categorie, CategoryConfig> = {
  resto: { notationKind: "stars", maxChipsListe: 2, maxChipsVignette: 1, descriptor: "cuisine", showStarClass: false },
  hotel: { notationKind: "score", maxChipsListe: 2, maxChipsVignette: 1, descriptor: "ambiance", showStarClass: false },
};

/** Limite la liste de chips selon la catégorie et le variant. */
export function chipsForVariant<T>(tags: T[], categorie: Categorie, variant: "liste" | "vignette"): T[] {
  const cfg = categoryConfig[categorie];
  const max = variant === "vignette" ? cfg.maxChipsVignette : cfg.maxChipsListe;
  return tags.slice(0, max);
}
