export type Place = {
  id: string;
  statut: "a_faire" | "visite";
  is_favorite: boolean;
  reco_source: string | null;
  // Restos v2 — OPTIONNELS pour ne pas casser les fixtures de tests existantes
  origine_type?: "reco" | "trouve" | null;
  origine_qui?: string | null;
  origine_source?: string | null;
  derniere_visite?: { note: number | null; visite_le: string; date_fin?: string | null } | null;
  // Hôtels v2 — OPTIONNELS (fixtures de tests existantes intactes)
  etoiles?: number | null;
  prix_nuit?: number | null;
  etablissement: { id: string; nom: string; type: string | null; ville: string | null; arrondissement: string | null; categorie: "resto" | "hotel"; photo_ref: string | null; lat: number | null; lng: number | null; place_id: string | null; rating: number | null; rating_count: number | null; type_hebergement?: string | null; equipements?: Record<string, boolean | null> | null };
  tags: { slug: string; label: string; color: string | null }[];
};

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function filterPlaces(places: Place[], query: string): Place[] {
  const q = norm(query.trim());
  if (!q) return places;
  return places.filter((p) => {
    const hay = [p.etablissement.nom, p.etablissement.ville ?? "", ...p.tags.map((t) => t.label)].map(norm).join(" ");
    return hay.includes(q);
  });
}
