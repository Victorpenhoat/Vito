export type SignauxImplicites = {
  types: Record<string, number>;
  zones: Record<string, number>;
};

type EtabSignal = { type: string | null; arrondissement: string | null };

function bump(map: Record<string, number>, key: string | null, weight: number): void {
  if (!key) return;
  map[key] = (map[key] ?? 0) + weight;
}

// Favoris pesés +2, avis bien notés +1, agrégés en compteurs type/zone.
export function buildSignauxImplicites(
  favoris: EtabSignal[],
  avisBienNotes: EtabSignal[],
): SignauxImplicites {
  const types: Record<string, number> = {};
  const zones: Record<string, number> = {};
  for (const f of favoris) {
    bump(types, f.type, 2);
    bump(zones, f.arrondissement, 2);
  }
  for (const a of avisBienNotes) {
    bump(types, a.type, 1);
    bump(zones, a.arrondissement, 1);
  }
  return { types, zones };
}
