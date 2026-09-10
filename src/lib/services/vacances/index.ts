import { EducationGouvProvider } from "./educationGouv";
import type { VacancesProvider } from "./types";

// Pas de variable d'environnement : la source est publique, sans clé, et son
// URL ne change pas.
export function getVacancesProvider(): VacancesProvider {
  return new EducationGouvProvider();
}

export type { VacancesProvider } from "./types";
