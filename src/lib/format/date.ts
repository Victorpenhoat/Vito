// Les dates du domaine sont des jours calendaires (colonnes DATE : "YYYY-MM-DD"),
// pas des instants. `new Date("2026-07-04")` les parse à minuit UTC ; formaté dans le
// fuseau du runtime, cela affiche J-1 à l'ouest d'UTC. On force donc l'affichage en UTC
// pour rendre exactement le jour stocké, quel que soit le fuseau du serveur/navigateur.
export function formatDay(iso: string | null, locale: string): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));
}

export function formatRange(start: string | null, end: string | null, locale: string): string {
  return [formatDay(start, locale), formatDay(end, locale)].filter(Boolean).join(" – ");
}
