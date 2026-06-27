import { createServerSupabase } from "@/lib/supabase/server";
import type { Place } from "../domain/filterPlaces";

export async function getPlaces(category: "resto" | "hotel"): Promise<Place[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("liste_items")
    .select(
      "id, statut, is_favorite, reco_source, etablissement:etablissements!inner(id, nom, type, ville, arrondissement, categorie, photo_ref, lat, lng, place_id, rating, rating_count), tags:liste_item_tags(tag:tags(slug, label, color))"
    )
    .eq("etablissement.categorie", category)
    .eq("is_archived", false)
    .order("added_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    statut: row.statut,
    is_favorite: row.is_favorite,
    reco_source: row.reco_source,
    etablissement: Array.isArray(row.etablissement) ? row.etablissement[0]! : row.etablissement,
    tags: (row.tags ?? []).flatMap((t) => {
      const tag = Array.isArray(t.tag) ? t.tag[0] : t.tag;
      return tag ? [tag] : [];
    }),
  })) as Place[];
}
