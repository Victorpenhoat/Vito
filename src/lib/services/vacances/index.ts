import { EducationGouvProvider } from "./educationGouv";
import type { VacancesProvider } from "./types";

// Pas de variable d'environnement : la source est publique, sans clé, et son
// URL ne change pas. `AucunVacancesProvider` existe pour les tests qui veulent
// une source muette, pas pour une configuration.
export function getVacancesProvider(): VacancesProvider {
  return new EducationGouvProvider();
}

export { AucunVacancesProvider } from "./aucun";
export type { PeriodeVacances, VacancesProvider } from "./types";
