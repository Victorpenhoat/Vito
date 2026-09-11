export type PeriodeVacances = {
  /** « 2026-2027 » */
  anneeScolaire: string;
  /** Tel que la source le nomme : « Zone A », « Corse », « Réunion »… */
  zone: string;
  /** « Vacances de Noël » */
  libelle: string;
  /** `YYYY-MM-DD`, heure de PARIS — jamais la date UTC brute de la source. */
  debut: string;
  fin: string;
};

export interface VacancesProvider {
  readonly name: string;
  /**
   * `null` quand l'année n'a pas pu être récupérée, quelle qu'en soit la
   * raison. Ne jette jamais : un calendrier absent dégrade un écran, il ne
   * doit pas le casser.
   */
  recuperer(anneeScolaire: string): Promise<PeriodeVacances[] | null>;
}
