import type { TauxDeChange, TauxProvider } from "./types";

// Aucun fournisseur configuré : on ne devine pas. Rendre un taux plausible mais
// faux serait pire que ne rien rendre — l'écran demande alors le taux, et il
// est saisi en connaissance de cause.
export class AucunTauxProvider implements TauxProvider {
  readonly name = "aucun";
  async taux(de: string, vers: string, date: string): Promise<TauxDeChange | null> {
    return de === vers ? { taux: 1, date } : null;
  }
}
