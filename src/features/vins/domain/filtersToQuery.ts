import type { VinFilters } from "./schemas";

export type VinQueryConstraints = {
  vin: { couleur?: string; region?: string };
  degustation: { noteMin?: number; etablissementId?: string; dateFrom?: string; dateTo?: string };
};

// Sépare les filtres portant sur le vin (intrinsèque) de ceux portant sur la dégustation.
export function filtersToQuery(f: VinFilters): VinQueryConstraints {
  return {
    vin: { couleur: f.couleur, region: f.region },
    degustation: {
      noteMin: f.noteMin,
      etablissementId: f.etablissementId,
      dateFrom: f.dateFrom,
      dateTo: f.dateTo,
    },
  };
}
