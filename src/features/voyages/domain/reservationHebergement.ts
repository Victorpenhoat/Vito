import { RESERVATION_TYPES } from "./schemas";

// Quels types de réservation désignent un lieu où l'on dort. Un vol ou une
// voiture n'a rien à faire dans le carnet Hôtels — seuls ces deux-là déclenchent
// l'entrée au carnet (lot H6).
export const TYPES_HEBERGEMENT: readonly (typeof RESERVATION_TYPES)[number][] = ["hotel", "hebergement"];

export function estHebergement(type: string): boolean {
  return (TYPES_HEBERGEMENT as readonly string[]).includes(type);
}
