import type { Place } from "./filterPlaces";

/** Tags uniques (dédupliqués par slug), triés par label, présents sur l'ensemble des places. */
export function tagsForMap(places: Place[]): { slug: string; label: string }[] {
  const seen = new Map<string, string>();
  for (const p of places) {
    for (const t of p.tags) {
      if (!seen.has(t.slug)) seen.set(t.slug, t.label);
    }
  }
  return Array.from(seen, ([slug, label]) => ({ slug, label })).sort((a, b) => a.label.localeCompare(b.label));
}

/** Filtre par tag. slug null → toutes les places ; sinon celles portant ce slug. */
export function filterByTag(places: Place[], slug: string | null): Place[] {
  if (slug === null) return places;
  return places.filter((p) => p.tags.some((t) => t.slug === slug));
}
