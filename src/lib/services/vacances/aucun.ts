import type { PeriodeVacances, VacancesProvider } from "./types";

// Aucune source configurée : on ne rend rien, et l'écran le dira. Inventer un
// calendrier plausible serait pire que de n'en afficher aucun — on planifie des
// voyages dessus.
export class AucunVacancesProvider implements VacancesProvider {
  readonly name = "aucun";
  async recuperer(): Promise<PeriodeVacances[] | null> {
    return null;
  }
}
