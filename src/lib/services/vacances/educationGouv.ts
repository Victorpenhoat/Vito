import { log, errorContext } from "@/lib/log";
import type { PeriodeVacances, VacancesProvider } from "./types";

const BASE =
  "https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-calendrier-scolaire/records";

// Le jeu publie une ligne par ACADÉMIE : ~200 pour une année scolaire. Mais
// l'API refuse tout `limit` au-delà de 100 (HTTP 400) — mesuré, pas deviné.
// Il faut donc paginer : `TAILLE_PAGE` borne chaque requête, `PAGES_MAX`
// borne leur nombre pour qu'une source qui n'annoncerait jamais la fin ne
// fasse pas tourner l'appelant indéfiniment. Deux pages suffisent aux 198
// lignes mesurées ; trois laissent une marge sans faire du plafond un permis
// de tourner.
const TAILLE_PAGE = 100;
const PAGES_MAX = 3;

// Budget de temps de TOUTE la récupération d'une année, pages comprises.
//
// Il est créé une seule fois et partagé : un délai par page ne bornerait plus
// rien. Une source qui répondrait juste sous la limite à chaque page
// donnerait `PAGES_MAX` × le délai pour une année, le double pour une fenêtre
// à cheval sur deux années, et encore trois fois plus quand l'interrupteur
// ouvre les zones voisines en parallèle — le tout avant le premier octet
// rendu. Un point d'accès qui pend doit dégrader l'écran, pas le faire
// pendre.
const BUDGET_MS = 4_000;

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

// Les deux libellés d'été de la source. Le second est la forme définitive
// (une plage) ; le premier est la forme PROVISOIRE : une ligne d'un seul jour,
// publiée tant que la rentrée suivante n'est pas arrêtée. Cf. `dériverEte`.
const MARQUEUR_ETE = "Début des Vacances d'Été";
const ETE = "Vacances d'Été";

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
  // Les marqueurs d'été mis de côté, par `annee|zone` : ils ne deviennent une
  // période qu'à la fin, et seulement si la vraie plage manque (cf. plus bas).
  const marqueursEte = new Map<string, PeriodeVacances>();

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

    const periode = { anneeScolaire, zone, libelle, debut, fin };
    if (libelle === MARQUEUR_ETE) {
      fusionner(marqueursEte, `${anneeScolaire}|${zone}`, periode);
      continue;
    }
    // La clé porte la zone et le libellé, pas l'académie : c'est elle qui
    // rassemble les doublons.
    fusionner(parCle, `${anneeScolaire}|${zone}|${libelle}`, periode);
  }

  deriverEte(parCle, marqueursEte);
  return [...parCle.values()];
}

/**
 * Range une période sous sa clé, en gardant l'amplitude la plus LARGE.
 *
 * Les onze lignes académiques d'une même période portent les mêmes dates : la
 * fusion ne les change pas. Mais une fois les enseignants écartés, il reste des
 * lignes qui diffèrent vraiment — mesuré, Polynésie 2026-2027 « Grandes
 * Vacances » commence un jour plus tôt pour le premier degré que pour le
 * second. Un « le dernier gagne » choisirait au hasard de l'ordre de la
 * réponse ; un foyer peut avoir des enfants dans les deux degrés, et c'est
 * l'union qui le renseigne. Les dates étant en `YYYY-MM-DD`, l'ordre
 * lexicographique EST l'ordre chronologique.
 */
function fusionner(
  parCle: Map<string, PeriodeVacances>,
  cle: string,
  periode: PeriodeVacances,
): void {
  const deja = parCle.get(cle);
  if (!deja) {
    parCle.set(cle, periode);
    return;
  }
  parCle.set(cle, {
    ...deja,
    debut: periode.debut < deja.debut ? periode.debut : deja.debut,
    fin: periode.fin > deja.fin ? periode.fin : deja.fin,
  });
}

/**
 * Les grandes vacances, quand la source n'en publie que le début.
 *
 * Mesuré le 2026-09-10 : Zone C 2026-2027 ne porte QUE
 * `Début des Vacances d'Été`, une ligne d'un seul jour. Sans traitement,
 * juillet et août 2027 se lisent comme libres — sur la frise, dans le
 * calendrier, et pour `vacancesDuVoyage`. Ce n'est pas la forme habituelle :
 * 2019-2020, 2022-2023, 2024-2025 et 2025-2026 publient toutes un vrai
 * `Vacances d'Été` avec une plage. Le marqueur d'un jour est la forme
 * PROVISOIRE d'une année dont la rentrée suivante n'est pas encore arrêtée.
 *
 * On ne peut pas attendre la forme définitive — l'écran est consulté
 * maintenant — et on ne peut pas la dériver de l'année suivante : 2027-2028
 * existe dans le jeu mais ne porte que Mayotte et la Polynésie, aucune zone
 * métropolitaine.
 *
 * D'où la dérivée : début = la date du marqueur, telle quelle ; fin = le
 * 31 août de la même année civile. Ce 31 août n'est pas inventé, c'est le
 * plancher que ce dépôt utilisait déjà avec l'accord du PO (ancien
 * `vacancesScolaires.ts`, entrée `ete-2027`), et il tombe TOUJOURS avant la
 * vraie rentrée. La convention du dépôt étant `fin` = jour de la rentrée,
 * bornes incluses, la dérivée s'arrête un cran en deçà : l'erreur va dans le
 * sens sûr. Un jour de vacances manquant se rattrape ; un jour de classe
 * annoncé comme vacances envoie planifier un départ un lundi de rentrée.
 *
 * Le libellé est celui de la forme définitive, pas un troisième : quand la
 * vraie plage paraîtra, elle écrasera la dérivée par la clé unique au lieu de
 * s'ajouter à côté d'elle. Et si les deux arrivent dans la même réponse, la
 * vraie l'emporte — la dérivée ne comble qu'un trou.
 */
function deriverEte(
  parCle: Map<string, PeriodeVacances>,
  marqueursEte: Map<string, PeriodeVacances>,
): void {
  for (const [cle, marqueur] of marqueursEte) {
    if (parCle.has(`${cle}|${ETE}`)) continue;
    const fin = `${marqueur.debut.slice(0, 4)}-08-31`;
    // Le 31 août suppose un été BORÉAL. À la Réunion, les grandes vacances
    // commencent mi-décembre : la dérivée irait du 18 décembre au 31 août
    // précédent, une période à l'envers. L'écran ne la dessinerait pas
    // (`barrePour` refuse une barre inversée), mais elle serait écrite dans
    // le cache et y resterait. On ne dérive donc rien : l'écran dira
    // « calendrier absent », ce qui est vrai. (La base tient le même
    // invariant depuis la migration 00065.)
    if (fin < marqueur.debut) continue;
    parCle.set(`${cle}|${ETE}`, { ...marqueur, libelle: ETE, fin });
  }
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

  /** `budgetMs` n'est paramétrable que pour que le test puisse l'éprouver
   *  sans faire attendre la suite quatre secondes. */
  constructor(private readonly budgetMs: number = BUDGET_MS) {}

  /**
   * Récupère toutes les pages d'une année scolaire.
   *
   * Une erreur sur une page — refus HTTP, réseau, JSON illisible, budget de
   * temps épuisé — jette tout ce qui a déjà été accumulé et rend `null` : un
   * calendrier à moitié rempli serait un mensonge silencieux, pire que son
   * absence assumée. Seul le plafond de pages (garde-fou, pas une panne) rend
   * ce qui a été collecté jusque-là.
   */
  async recuperer(anneeScolaire: string): Promise<PeriodeVacances[] | null> {
    const bruts: unknown[] = [];
    let attendu: number | null = null;
    // AVANT la boucle, et une seule fois : c'est ce qui en fait un budget
    // pour l'année entière plutôt qu'une permission par page.
    const budget = AbortSignal.timeout(this.budgetMs);

    for (let page = 0; page < PAGES_MAX; page++) {
      const offset = page * TAILLE_PAGE;
      let corps: unknown;
      try {
        const reponse = await fetch(urlPage(anneeScolaire, offset), { signal: budget });
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
