import { createServerSupabase } from "@/lib/supabase/server";
import type { Place } from "../domain/filterPlaces";

export async function getPlaces(category: "resto" | "hotel"): Promise<Place[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("liste_items")
    .select(
      "id, statut, is_favorite, etablissement:etablissements!inner(id, nom, type, ville, arrondissement, categorie), tags:liste_item_tags(tag:tags(slug, label, color))"
    )
    .eq("etablissement.categorie", category)
    .order("added_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    statut: row.statut,
    is_favorite: row.is_favorite,
    etablissement: Array.isArray(row.etablissement) ? row.etablissement[0]! : row.etablissement,
    tags: (row.tags ?? []).flatMap((t) => {
      const tag = Array.isArray(t.tag) ? t.tag[0] : t.tag;
      return tag ? [tag] : [];
    }),
  })) as Place[];
}
