const UPCOMING = new Set(["planifie", "confirme"]);

export function splitVoyages<T extends { statut: string; date_debut: string | null }>(
  voyages: T[],
  today: string,
): { prochain: T | null; reste: T[] } {
  // voyages est déjà trié par date_debut croissant → le premier à venir est le prochain départ.
  const idx = voyages.findIndex((v) => UPCOMING.has(v.statut) && v.date_debut != null && v.date_debut >= today);
  if (idx === -1) return { prochain: null, reste: voyages };
  return { prochain: voyages[idx]!, reste: voyages.filter((_, i) => i !== idx) };
}
