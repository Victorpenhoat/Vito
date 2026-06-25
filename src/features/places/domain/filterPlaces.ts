export type Place = {
  id: string;
  statut: "a_faire" | "visite";
  is_favorite: boolean;
  etablissement: { id: string; nom: string; type: string | null; ville: string | null; arrondissement: string | null; categorie: "resto" | "hotel"; photo_ref: string | null };
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
