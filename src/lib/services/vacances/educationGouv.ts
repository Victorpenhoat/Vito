import { log, errorContext } from "@/lib/log";
import type { PeriodeVacances, VacancesProvider } from "./types";

const BASE =
  "https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-calendrier-scolaire/records";

// Le jeu publie une ligne par ACADÉMIE : ~200 pour une année scolaire. Mais
// l'API refuse tout `limit` au-delà de 100 (HTTP 400) — mesuré, pas deviné.
// Il faut donc paginer : `TAILLE_PAGE` borne chaque requête, `PAGES_MAX`
// borne leur nombre pour qu'une source qui n'annoncerait jamais la fin ne
// fasse pas tourner l'appelant indéfiniment.
const TAILLE_PAGE = 100;
const PAGES_MAX = 10;

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
 *  3. `population` ne vaut pas « Élèves », « Enseignants » ou « - » : le jeu
 *     publie VINGT ET UNE valeurs (mesuré le 2026-09-10), dont cinq familles
 *     enseignantes — « Enseignants », et les mêmes déclinées « des collèges »,
 *     « des lycées », « du premier degré », « du second degré ». Une égalité
 *     stricte en laissait passer quatre, et comme la clé de dédoublonnage
 *     ignore la population, la ligne enseignante ÉCRASAIT celle des élèves :
 *     Zone C 2025-2026, l'été des enseignants finit un jour plus tôt. D'où le
 *     préfixe plutôt que l'égalité. Tout le reste concerne bien une famille :
 *     `-`, les « Élèves … », « Premier degré », « Second degré »,
 *     « Premier degré et collèges », et les valeurs guadeloupéennes, qui
 *     nomment un territoire et non un public.
 */
export function normaliser(reponse: unknown): PeriodeVacances[] {
  const results = (reponse as { results?: unknown } | null)?.results;
  if (!Array.isArray(results)) return [];

  const parCle = new Map<string, PeriodeVacances>();
  for (const brut of results as Brut[]) {
    const population = typeof brut.population === "string" ? brut.population : "";
    // Le préfixe couvre les cinq variantes connues et celles à venir : une
    // sixième déclinaison enseignante ne doit pas rouvrir la faille en
    // silence.
    if (population.startsWith("Enseignant")) continue;

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

function urlPage(anneeScolaire: string, offset: number): string {
  return (
    `${BASE}?where=annee_scolaire%3D%22${encodeURIComponent(anneeScolaire)}%22` +
    `&limit=${TAILLE_PAGE}&offset=${offset}` +
    `&select=description,start_date,end_date,zones,population,annee_scolaire`
  );
}

export class EducationGouvProvider implements VacancesProvider {
  readonly name = "education-gouv";

  /**
   * Récupère toutes les pages d'une année scolaire.
   *
   * Une erreur sur une page — refus HTTP, réseau, JSON illisible — jette tout
   * ce qui a déjà été accumulé et rend `null` : un calendrier à moitié
   * rempli serait un mensonge silencieux, pire que son absence assumée. Seul
   * le plafond de pages (garde-fou, pas une panne) rend ce qui a été
   * collecté jusque-là.
   */
  async recuperer(anneeScolaire: string): Promise<PeriodeVacances[] | null> {
    const bruts: unknown[] = [];
    let attendu: number | null = null;

    for (let page = 0; page < PAGES_MAX; page++) {
      const offset = page * TAILLE_PAGE;
      let corps: unknown;
      try {
        const reponse = await fetch(urlPage(anneeScolaire, offset), { signal: AbortSignal.timeout(4_000) });
        if (!reponse.ok) {
          log.warn("vacances_refus", { statut: reponse.status, anneeScolaire, offset });
          return null;
        }
        corps = await reponse.json();
      } catch (err) {
        log.warn("vacances_injoignable", { anneeScolaire, offset, ...errorContext(err) });
        return null;
      }

      const page_ = corps as { results?: unknown; total_count?: unknown } | null;
      const results = page_?.results;
      if (!Array.isArray(results)) {
        log.warn("vacances_reponse_difforme", { anneeScolaire, offset });
        return null;
      }
      bruts.push(...results);
      if (typeof page_?.total_count === "number") attendu = page_.total_count;

      if (results.length === 0 || (attendu !== null && bruts.length >= attendu)) {
        return normaliser({ results: bruts });
      }
    }

    log.warn("vacances_pagination_plafond", { anneeScolaire, pages: PAGES_MAX, recoltees: bruts.length });
    return normaliser({ results: bruts });
  }
}
