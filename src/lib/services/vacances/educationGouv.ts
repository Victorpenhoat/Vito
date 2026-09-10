import { log, errorContext } from "@/lib/log";
import type { PeriodeVacances, VacancesProvider } from "./types";

const BASE =
  "https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-calendrier-scolaire/records";

// Le jeu publie une ligne par ACADÉMIE : ~200 pour une année scolaire.
const LIMITE = 200;

/**
 * Date de Paris à partir de l'horodatage de la source.
 *
 * Le piège : `2026-12-18T23:00:00+00:00` est minuit le 19 à Paris. Tronquer la
 * chaîne donnerait le 18 — un jour de vacances effacé, et un départ planifié un
 * jour d'école. `fr-CA` est choisi pour une seule raison : c'est la locale dont
 * le format court est déjà `YYYY-MM-DD`.
 */
export function dateDeParis(horodatage: string): string | null {
  const t = Date.parse(horodatage);
  if (Number.isNaN(t)) return null;
  return new Intl.DateTimeFormat("fr-CA", {
    timeZone: "Europe/Paris",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date(t));
}

type Brut = {
  description?: unknown; start_date?: unknown; end_date?: unknown;
  zones?: unknown; population?: unknown; annee_scolaire?: unknown;
};

/**
 * Trois filtres, trois pièges — aucun ne se devine, tous ont été relevés dans
 * la vraie réponse :
 *  1. les dates sont à minuit de Paris exprimé en UTC ;
 *  2. il y a une ligne par académie, donc jusqu'à onze doublons par période ;
 *  3. `population` vaut parfois « Enseignants » : ces dates ne concernent pas
 *     les familles et ne doivent jamais leur être annoncées.
 */
export function normaliser(reponse: unknown): PeriodeVacances[] {
  const results = (reponse as { results?: unknown } | null)?.results;
  if (!Array.isArray(results)) return [];

  const parCle = new Map<string, PeriodeVacances>();
  for (const brut of results as Brut[]) {
    const population = typeof brut.population === "string" ? brut.population : "";
    if (population === "Enseignants") continue;

    const zone = typeof brut.zones === "string" ? brut.zones : "";
    const libelle = typeof brut.description === "string" ? brut.description : "";
    const anneeScolaire = typeof brut.annee_scolaire === "string" ? brut.annee_scolaire : "";
    const debut = typeof brut.start_date === "string" ? dateDeParis(brut.start_date) : null;
    const fin = typeof brut.end_date === "string" ? dateDeParis(brut.end_date) : null;
    if (!zone || !libelle || !anneeScolaire || !debut || !fin) continue;

    // La clé porte la zone et le libellé, pas l'académie : c'est elle qui
    // écrase les doublons.
    parCle.set(`${anneeScolaire}|${zone}|${libelle}`, { anneeScolaire, zone, libelle, debut, fin });
  }
  return [...parCle.values()];
}

export class EducationGouvProvider implements VacancesProvider {
  readonly name = "education-gouv";

  async recuperer(anneeScolaire: string): Promise<PeriodeVacances[] | null> {
    const url =
      `${BASE}?where=annee_scolaire%3D%22${encodeURIComponent(anneeScolaire)}%22` +
      `&limit=${LIMITE}&select=description,start_date,end_date,zones,population,annee_scolaire`;
    try {
      const reponse = await fetch(url);
      if (!reponse.ok) {
        log.warn("vacances_refus", { statut: reponse.status, anneeScolaire });
        return null;
      }
      return normaliser(await reponse.json());
    } catch (err) {
      log.warn("vacances_injoignable", { anneeScolaire, ...errorContext(err) });
      return null;
    }
  }
}
