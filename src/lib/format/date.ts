export function formatDay(iso: string | null, locale: string): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}

export function formatRange(start: string | null, end: string | null, locale: string): string {
  return [formatDay(start, locale), formatDay(end, locale)].filter(Boolean).join(" – ");
}
