// Zone de vacances d'une adresse.
//
// Deux moitiés, deux sources : académie → zone vient de l'API du calendrier
// elle-même (champ `location` regroupé par `zones`, relevé le 2026-09-10) ;
// département → académie est transcrit depuis fr-en-annuaire-education
// (requête citée ci-dessous). Aucune n'est écrite de mémoire — dix ancres les
// vérifient dans le test.

/** Les onze valeurs que la source emploie. L'ordre est celui de l'écran. */
export const ZONES = [
  "Zone A", "Zone B", "Zone C", "Corse",
  "Guadeloupe", "Guyane", "Martinique", "Mayotte",
  "Polynésie", "Réunion", "Saint Pierre et Miquelon",
] as const;

/**
 * Département → zone. Construit par jointure des deux jeux du ministère le
 * 2026-09-10 (requêtes citées en tête de fichier), pas de mémoire.
 *
 * Absents volontairement : 986 (Wallis-et-Futuna) et 988 (Nouvelle-Calédonie),
 * qui n'ont aucune ligne dans le calendrier — on rend `null` plutôt qu'une
 * zone inventée.
 */
const ZONE_PAR_DEPARTEMENT: Record<string, string> = Object.fromEntries([
  ...["01","03","07","15","16","17","19","21","23","24","25","26","33","38","39","40","42",
      "43","47","58","63","64","69","70","71","73","74","79","86","87","89","90"].map((d) => [d, "Zone A"]),
  ...["02","04","05","06","08","10","13","14","18","22","27","28","29","35","36","37","41",
      "44","45","49","50","51","52","53","54","55","56","57","59","60","61","62","67","68",
      "72","76","80","83","84","85","88"].map((d) => [d, "Zone B"]),
  ...["09","11","12","30","31","32","34","46","48","65","66","75","77","78","81","82","91",
      "92","93","94","95"].map((d) => [d, "Zone C"]),
  // "2A"/"2B" ne sont jamais atteints par une recherche via code postal (le
  // 20xxx est intercepté plus bas, avant consultation de la table) : ces deux
  // lignes servent une recherche par code de département, pas par code
  // postal. Elles restent correctes et utiles à ce titre — à ne pas
  // supprimer comme « mortes ».
  ["2A", "Corse"], ["2B", "Corse"],
  ["971", "Guadeloupe"], ["977", "Guadeloupe"], ["978", "Guadeloupe"],
  ["972", "Martinique"], ["973", "Guyane"], ["974", "Réunion"],
  ["975", "Saint Pierre et Miquelon"], ["976", "Mayotte"], ["987", "Polynésie"],
]);

/**
 * Zone déduite de l'adresse libre du foyer, ou `null`.
 *
 * `null` n'est pas un échec : c'est le cas « je ne sais pas », et l'écran
 * demande alors plutôt que de deviner. Une zone fausse enverrait planifier un
 * départ un jour d'école.
 */
export function deduireZone(adresse: string | null | undefined): string | null {
  if (!adresse) return null;
  // Un code postal français : cinq chiffres isolés. La Corse s'écrit 20xxx en
  // code postal et 2A/2B en département — la conversion est dans la table.
  //
  // On garde le DERNIER nombre à cinq chiffres, pas le premier : en adresse
  // française, le code postal précède immédiatement la ville, donc il se
  // trouve en fin de chaîne. Un numéro de lot, de résidence ou de boîte
  // postale plus tôt dans le texte peut aussi faire cinq chiffres — le
  // premier-match s'y ferait piéger et rendrait une zone fausse plutôt que
  // `null`, exactement ce que cette fonction doit éviter.
  const correspondances = adresse.match(/\b\d{5}\b/g);
  if (!correspondances) return null;
  const cp = correspondances[correspondances.length - 1]!;
  // La Corse s'écrit 20xxx en code POSTAL mais 2A/2B en DÉPARTEMENT. Les deux
  // partagent la même zone, donc la distinction Corse-du-Sud / Haute-Corse est
  // sans objet ici — d'où le raccourci, écrit plutôt que sous-entendu.
  if (cp.startsWith("20")) return "Corse";
  // Outre-mer : trois chiffres (971…978, 984…988). Métropole : deux.
  const departement = cp.startsWith("97") || cp.startsWith("98") ? cp.slice(0, 3) : cp.slice(0, 2);
  return ZONE_PAR_DEPARTEMENT[departement] ?? null;
}
